import { normalizeAnswerText, slugify } from './text';

describe('normalizeAnswerText', () => {
  it('trims, collapses whitespace and lower-cases', () => {
    expect(normalizeAnswerText('  Hà \t Nội\n')).toBe('hà nội');
  });

  it('normalizes to NFC', () => {
    expect(normalizeAnswerText('Việt'.normalize('NFD'))).toBe(
      'việt'.normalize('NFC'),
    );
  });
});

describe('slugify', () => {
  it('removes Vietnamese diacritics and joins words with hyphens', () => {
    expect(slugify('Kết quả Đề thi số 1 (Lớp 10A)')).toBe(
      'ket-qua-de-thi-so-1-lop-10a',
    );
  });

  it('falls back when nothing is left', () => {
    expect(slugify('***')).toBe('file');
    expect(slugify('', 'export')).toBe('export');
  });
});
