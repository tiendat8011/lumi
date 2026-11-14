import * as mammoth from 'mammoth';

export interface ParsedQuestion {
  content: string;
  type: 'MCQ' | 'TRUE_FALSE' | 'ESSAY' | 'SHORT_ANSWER';
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | null;
  options: { content: string; isCorrect: boolean; position: number }[];
  correctAnswer: string | null;
  error?: string;
}

const QUESTION_START =
  /^(?:Câu\s+\d+\s*[.:]\s*|(\d+)\s*[.)]\s*)/i;

const OPTION_LINE =
  /^([A-Z])\.\s+(.+)/;

const CORRECT_MARKERS = /[✓*]|(\(đáp án\))|(\(correct\))/i;

const TRUE_FALSE_PATTERN =
  /^(Đúng|Sai|True|False)\s*$/i;

function splitQuestionBlocks(text: string): string[][] {
  const lines = text.split(/\r?\n/);
  const blocks: string[][] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (QUESTION_START.test(line) && current.length > 0) {
      blocks.push(current);
      current = [];
    }
    if (line.trim()) {
      current.push(line.trim());
    }
  }
  if (current.length > 0) {
    blocks.push(current);
  }

  return blocks;
}

function stripQuestionNumber(line: string): string {
  return line.replace(QUESTION_START, '').trim();
}

function parseBlock(lines: string[]): ParsedQuestion {
  if (lines.length === 0) {
    return {
      content: '',
      type: 'ESSAY',
      difficulty: null,
      options: [],
      correctAnswer: null,
      error: 'Khối câu hỏi trống',
    };
  }

  const content = stripQuestionNumber(lines[0]!);
  if (!content) {
    return {
      content: lines.join(' '),
      type: 'ESSAY',
      difficulty: null,
      options: [],
      correctAnswer: null,
      error: 'Không thể trích xuất nội dung câu hỏi',
    };
  }

  const rawOptions: {
    letter: string;
    text: string;
    isCorrect: boolean;
  }[] = [];

  const trueFalseValues: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!;

    const optMatch = OPTION_LINE.exec(line);
    if (optMatch) {
      const letter = optMatch[1]!;
      let text = optMatch[2]!.trim();
      const isCorrect = CORRECT_MARKERS.test(text);
      text = text
        .replace(/[✓*]/g, '')
        .replace(/\(đáp án\)/gi, '')
        .replace(/\(correct\)/gi, '')
        .trim();
      rawOptions.push({ letter, text, isCorrect });
      continue;
    }

    if (TRUE_FALSE_PATTERN.test(line)) {
      trueFalseValues.push(line.trim());
    }
  }

  if (trueFalseValues.length === 2 && rawOptions.length === 0) {
    const options = trueFalseValues.map((val, idx) => {
      const normalized = val.toLowerCase();
      const isCorrect =
        normalized === 'đúng' || normalized === 'true';
      return {
        content: val,
        isCorrect,
        position: idx,
      };
    });
    return {
      content,
      type: 'TRUE_FALSE',
      difficulty: null,
      options,
      correctAnswer: null,
    };
  }

  if (rawOptions.length >= 2 && rawOptions.length <= 6) {
    const options = rawOptions.map((o, idx) => ({
      content: o.text,
      isCorrect: o.isCorrect,
      position: idx,
    }));
    return {
      content,
      type: 'MCQ',
      difficulty: null,
      options,
      correctAnswer: null,
    };
  }

  return {
    content,
    type: 'ESSAY',
    difficulty: null,
    options: [],
    correctAnswer: null,
  };
}

export async function parseDocx(
  buffer: Buffer,
): Promise<ParsedQuestion[]> {
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value;
  const blocks = splitQuestionBlocks(text);
  return blocks.map(parseBlock);
}
