/**
 * Canonical form used to compare a typed answer with the answer key:
 * Unicode NFC, trimmed, inner whitespace collapsed to one space, lower-case.
 */
export function normalizeAnswerText(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * ASCII slug for file names: Vietnamese diacritics removed, lower-case,
 * anything that is not a letter or digit becomes a single hyphen.
 */
export function slugify(value: string, fallback = 'file'): string {
  const slug = value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}
