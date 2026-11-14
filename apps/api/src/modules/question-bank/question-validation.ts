type QuestionInput = {
  type: string;
  content?: string;
  options?: { isCorrect: boolean }[];
  correctAnswer?: string | null;
};

export type ValidationResult = {
  valid: boolean;
  errors: string[];
};

const OPTION_TYPES = [
  'MCQ',
  'MCQ_MULTI',
  'TRUE_FALSE',
  'LISTENING_MCQ',
  'READING_MCQ',
];
const SINGLE_CORRECT_TYPES = [
  'MCQ',
  'TRUE_FALSE',
  'LISTENING_MCQ',
  'READING_MCQ',
];
const KEYED_TEXT_TYPES = [
  'SHORT_ANSWER',
  'FILL_BLANK',
  'LISTENING_FILL',
  'READING_FILL',
];

export function validateQuestionInput(dto: QuestionInput): ValidationResult {
  const errors: string[] = [];

  if (OPTION_TYPES.includes(dto.type)) {
    if (!dto.options || dto.options.length < 2) {
      errors.push('Câu hỏi dạng này cần ít nhất 2 đáp án');
    } else {
      const correctCount = dto.options.filter((o) => o.isCorrect).length;
      if (SINGLE_CORRECT_TYPES.includes(dto.type)) {
        if (correctCount !== 1) {
          errors.push('Cần đúng 1 đáp án đúng');
        }
      } else if (dto.type === 'MCQ_MULTI') {
        if (correctCount < 1) {
          errors.push('Cần ít nhất 1 đáp án đúng');
        }
      }
    }
  }

  if (KEYED_TEXT_TYPES.includes(dto.type)) {
    if (!dto.correctAnswer || dto.correctAnswer.trim() === '') {
      errors.push('Cần có đáp án đúng cho dạng câu hỏi này');
    }
  }

  return { valid: errors.length === 0, errors };
}
