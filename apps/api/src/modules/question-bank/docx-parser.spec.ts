import { parseDocx, ParsedQuestion } from './docx-parser';
import * as mammoth from 'mammoth';

jest.mock('mammoth');
const mockExtractRawText = mammoth.extractRawText as jest.Mock;

function mockDocx(text: string) {
  mockExtractRawText.mockResolvedValueOnce({ value: text });
}

describe('parseDocx', () => {
  it('parses MCQ questions with correct answer markers', async () => {
    mockDocx(
      [
        'Câu 1: Thủ đô Việt Nam là gì?',
        'A. Hà Nội ✓',
        'B. Hồ Chí Minh',
        'C. Đà Nẵng',
        'D. Huế',
      ].join('\n'),
    );

    const result = await parseDocx(Buffer.alloc(0));

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject<Partial<ParsedQuestion>>({
      content: 'Thủ đô Việt Nam là gì?',
      type: 'MCQ',
      options: [
        { content: 'Hà Nội', isCorrect: true, position: 0 },
        { content: 'Hồ Chí Minh', isCorrect: false, position: 1 },
        { content: 'Đà Nẵng', isCorrect: false, position: 2 },
        { content: 'Huế', isCorrect: false, position: 3 },
      ],
    });
  });

  it('parses TRUE_FALSE questions', async () => {
    mockDocx(
      [
        'Câu 1. Trái đất quay quanh mặt trời',
        'Đúng',
        'Sai',
      ].join('\n'),
    );

    const result = await parseDocx(Buffer.alloc(0));

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject<Partial<ParsedQuestion>>({
      content: 'Trái đất quay quanh mặt trời',
      type: 'TRUE_FALSE',
      options: [
        { content: 'Đúng', isCorrect: true, position: 0 },
        { content: 'Sai', isCorrect: false, position: 1 },
      ],
    });
  });

  it('parses ESSAY questions (no options)', async () => {
    mockDocx('Câu 1: Giải thích hiện tượng thủy triều');

    const result = await parseDocx(Buffer.alloc(0));

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject<Partial<ParsedQuestion>>({
      content: 'Giải thích hiện tượng thủy triều',
      type: 'ESSAY',
      options: [],
    });
  });

  it('parses multiple questions', async () => {
    mockDocx(
      [
        'Câu 1: Câu hỏi một',
        'A. Đáp án A',
        'B. Đáp án B *',
        'Câu 2: Câu hỏi hai',
        'Đúng',
        'Sai',
        'Câu 3: Câu hỏi ba',
      ].join('\n'),
    );

    const result = await parseDocx(Buffer.alloc(0));

    expect(result).toHaveLength(3);
    expect(result[0]!.type).toBe('MCQ');
    expect(result[1]!.type).toBe('TRUE_FALSE');
    expect(result[2]!.type).toBe('ESSAY');
  });

  it('handles numbered format with parentheses', async () => {
    mockDocx(
      [
        '1) Câu hỏi đầu tiên',
        'A. Lựa chọn 1 (đáp án)',
        'B. Lựa chọn 2',
      ].join('\n'),
    );

    const result = await parseDocx(Buffer.alloc(0));

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject<Partial<ParsedQuestion>>({
      content: 'Câu hỏi đầu tiên',
      type: 'MCQ',
    });
    expect(result[0]!.options[0]!.isCorrect).toBe(true);
  });

  it('handles numbered format with dot', async () => {
    mockDocx(
      [
        '1. Câu hỏi một',
        'A. A',
        'B. B',
        '2. Câu hỏi hai',
      ].join('\n'),
    );

    const result = await parseDocx(Buffer.alloc(0));
    expect(result).toHaveLength(2);
  });

  it('returns empty array for empty document', async () => {
    mockDocx('');

    const result = await parseDocx(Buffer.alloc(0));
    expect(result).toHaveLength(0);
  });

  it('strips correct-answer markers from option text', async () => {
    mockDocx(
      [
        'Câu 1: Test',
        'A. Đáp án A (correct)',
        'B. Đáp án B',
      ].join('\n'),
    );

    const result = await parseDocx(Buffer.alloc(0));
    expect(result[0]!.options[0]!.content).toBe('Đáp án A');
    expect(result[0]!.options[0]!.isCorrect).toBe(true);
  });
});
