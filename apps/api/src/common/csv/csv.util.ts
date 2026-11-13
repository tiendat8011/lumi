import { StreamableFile } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { slugify } from '../utils/text';

export type CsvCell = string | number | boolean | null | undefined;

const BOM = '﻿';
const FORMULA_START = /^[=+\-@]/;

function cell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '';
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  // A leading apostrophe stops spreadsheet applications from evaluating the
  // cell as a formula (CSV injection).
  const text = FORMULA_START.test(value) ? `'${value}` : value;
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * UTF-8 with BOM, CRLF line ends, every text cell quoted. Numbers are
 * written bare so spreadsheets treat them as numbers.
 */
export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(cell).join(','));
  return BOM + lines.join('\r\n') + '\r\n';
}

/**
 * Content-Disposition with both forms: an ASCII fallback and the original
 * name percent-encoded (RFC 5987).
 */
export function contentDisposition(filename: string): string {
  const dot = filename.lastIndexOf('.');
  const base = dot > 0 ? filename.slice(0, dot) : filename;
  const ext =
    dot > 0 ? filename.slice(dot + 1).replace(/[^A-Za-z0-9]/g, '') : '';
  const ascii = slugify(base) + (ext ? `.${ext.toLowerCase()}` : '');
  const encoded = encodeURIComponent(filename).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

/**
 * A CSV file response. Return it from a controller; the TransformInterceptor
 * passes StreamableFile through without the JSON envelope.
 */
export function csvDownload(filename: string, content: string): StreamableFile {
  const buffer = Buffer.from(content, 'utf8');
  return new StreamableFile(buffer, {
    type: 'text/csv; charset=utf-8',
    disposition: contentDisposition(filename),
    length: buffer.length,
  });
}

export function parseCsv(
  content: string | Buffer,
): Record<string, string>[] {
  const text =
    typeof content === 'string'
      ? content
      : content.toString('utf8').replace(/^﻿/, '');
  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as Record<string, string>[];
}

export function fileDownload(
  filename: string,
  buffer: Buffer,
  contentType: string,
): StreamableFile {
  return new StreamableFile(buffer, {
    type: contentType,
    disposition: contentDisposition(filename),
    length: buffer.length,
  });
}
