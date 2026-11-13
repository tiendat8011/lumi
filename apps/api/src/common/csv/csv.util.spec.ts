import { contentDisposition, csvDownload, toCsv } from './csv.util';
import { formatVn } from '../utils/datetime';

describe('toCsv', () => {
  it('writes a BOM, CRLF line ends and quoted text cells', () => {
    const csv = toCsv(['Họ tên', 'Điểm'], [['Nguyễn "A"', 7.5]]);
    expect(csv).toBe('﻿"Họ tên","Điểm"\r\n"Nguyễn ""A""",7.5\r\n');
  });

  it('writes null and undefined as empty cells and keeps newlines inside quotes', () => {
    expect(toCsv(['a'], [[null], [undefined], ['x\ny']])).toBe(
      '﻿"a"\r\n\r\n\r\n"x\ny"\r\n',
    );
  });

  it.each(['=1+1', '+1', '-1', '@SUM(A1)'])(
    'prefixes a cell starting like a formula: %s',
    (value) => {
      expect(toCsv(['h'], [[value]])).toContain(`"'${value}"`);
    },
  );
});

describe('contentDisposition / csvDownload', () => {
  it('carries an ASCII name and the UTF-8 original', () => {
    expect(contentDisposition('Kết quả lớp 10A.csv')).toBe(
      'attachment; filename="ket-qua-lop-10a.csv"; ' +
        "filename*=UTF-8''K%E1%BA%BFt%20qu%E1%BA%A3%20l%E1%BB%9Bp%2010A.csv",
    );
  });

  it('returns a StreamableFile with CSV headers', () => {
    const file = csvDownload('a.csv', toCsv(['h'], []));
    const headers = file.getHeaders();
    expect(headers.type).toBe('text/csv; charset=utf-8');
    expect(headers.disposition).toContain('filename="a.csv"');
    expect(headers.length).toBe(Buffer.byteLength('﻿"h"\r\n'));
  });
});

describe('formatVn', () => {
  it('formats in Asia/Ho_Chi_Minh (UTC+7)', () => {
    const date = new Date('2026-11-12T18:05:00.000Z');
    expect(formatVn(date)).toBe('13/11/2026 01:05');
    expect(formatVn(date, 'date')).toBe('13/11/2026');
    expect(formatVn(null)).toBe('');
  });
});
