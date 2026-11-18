'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  FileUp,
  LoaderCircle,
  FileText,
  Check,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  ShieldCheck,
  Zap,
  Download,
  PencilLine,
} from 'lucide-react';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

/* ── Data models matching the backend ──────────────────────── */

interface ParsedOption {
  content: string;
  isCorrect: boolean;
  position: number;
}

interface ParsedQuestion {
  content: string;
  type: 'MCQ' | 'TRUE_FALSE' | 'ESSAY' | 'SHORT_ANSWER';
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | null;
  options: ParsedOption[];
  correctAnswer: string | null;
  error?: string;
}

/* ── Constants ─────────────────────────────────────────────── */

const SAMPLE_QUESTIONS: ParsedQuestion[] = [
  {
    content: 'Hàm số y = 2^x là hàm số gì?',
    type: 'MCQ',
    difficulty: 'EASY',
    options: [
      { content: 'Hàm số mũ', isCorrect: true, position: 0 },
      { content: 'Hàm số logarit', isCorrect: false, position: 1 },
      { content: 'Hàm số lượng giác', isCorrect: false, position: 2 },
      { content: 'Hàm số bậc nhất', isCorrect: false, position: 3 },
    ],
    correctAnswer: null,
  },
  {
    content: 'Hàm số y = log₂(x) đồng biến trên khoảng (0; +∞).',
    type: 'TRUE_FALSE',
    difficulty: 'MEDIUM',
    options: [
      { content: 'Đúng', isCorrect: true, position: 0 },
      { content: 'Sai', isCorrect: false, position: 1 },
    ],
    correctAnswer: null,
  },
  {
    content: 'Giải phương trình log₂(x) + log₂(x − 2) = 3.',
    type: 'ESSAY',
    difficulty: 'HARD',
    options: [],
    correctAnswer: null,
  },
  {
    content: 'Câu hỏi không có nội dung đáp án hợp lệ trong tài liệu.',
    type: 'ESSAY',
    difficulty: null,
    options: [],
    correctAnswer: null,
    error: 'Không nhận dạng được',
  },
];

const TYPE_LABELS: Record<string, string> = {
  MCQ: 'Trắc nghiệm',
  TRUE_FALSE: 'Đúng/Sai',
  ESSAY: 'Tự luận',
  SHORT_ANSWER: 'Trả lời ngắn',
};
const TYPE_TONES: Record<string, string> = {
  MCQ: 'bg-[#dbeafe] text-[#1d4ed8]',
  TRUE_FALSE: 'bg-[#cffafe] text-[#0e7490]',
  ESSAY: 'bg-[#e0e7ff] text-[#4338ca]',
  SHORT_ANSWER: 'bg-[#ffedd5] text-[#c2410c]',
};
const DIFFICULTY_LABELS: Record<string, string> = {
  EASY: 'Dễ',
  MEDIUM: 'Trung bình',
  HARD: 'Khó',
};
const DIFFICULTY_TONES: Record<string, string> = {
  EASY: 'bg-[#d1fae5] text-[#047857]',
  MEDIUM: 'bg-[#e2e8f0] text-[#475569]',
  HARD: 'bg-[#ffedd5] text-[#c2410c]',
};

/* ── API helpers ───────────────────────────────────────────── */

async function uploadDocx(file: File): Promise<ParsedQuestion[]> {
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('accessToken')
      : null;
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/questions/parse-docx`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.error?.message || 'Upload thất bại');
  }
  const json = await res.json();
  return json.data;
}

async function bulkImport(questions: ParsedQuestion[]): Promise<void> {
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('accessToken')
      : null;
  const payload = questions
    .filter((q) => !q.error)
    .map((q) => ({
      content: q.content,
      type: q.type,
      difficulty: q.difficulty ?? undefined,
      correctAnswer: q.correctAnswer ?? undefined,
      options: q.options.length >= 2 ? q.options : undefined,
    }));
  const res = await fetch(`${API_BASE}/questions/bulk`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ questions: payload }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.error?.message || 'Nhập câu hỏi thất bại');
  }
}

/* ── Inline Badge (matching Figma: 4px 7px, rounded-full, 11px, 800) ── */

function FBadge({
  tone,
  children,
}: {
  tone: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-[7px] py-[4px] text-[11px] font-extrabold tracking-[0.15px] ${tone}`}
    >
      {children}
    </span>
  );
}

/* ── Page component ────────────────────────────────────────── */

type Stage = 'upload' | 'parsing' | 'preview';

export default function ImportQuestionsPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('upload');
  const [fileName, setFileName] = useState('');
  const [items, setItems] = useState<ParsedQuestion[]>([]);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validItems = items.filter((q) => !q.error);
  const errorItems = items.filter((q) => q.error);

  const typeCounts = validItems.reduce(
    (acc, q) => {
      acc[q.type] = (acc[q.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const handleFile = useCallback(async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      setError('File vượt quá dung lượng tối đa 10 MB');
      return;
    }
    if (!file.name.toLowerCase().endsWith('.docx')) {
      setError('Vui lòng chọn đúng định dạng file Word (.docx)');
      return;
    }
    setError('');
    setFileName(file.name);
    setStage('parsing');
    try {
      const parsed = await uploadDocx(file);
      setItems(parsed);
      setStage('preview');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Không thể phân tích file',
      );
      setStage('upload');
    }
  }, []);

  const handleDemoData = useCallback(() => {
    setFileName('Bộ-câu-hỏi-Hàm-số-mũ.docx');
    setItems(SAMPLE_QUESTIONS);
    setStage('preview');
  }, []);

  const handleRemoveItem = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleImport = useCallback(async () => {
    setImporting(true);
    try {
      await bulkImport(validItems);
      router.push('/dashboard/questions');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Nhập câu hỏi thất bại',
      );
    } finally {
      setImporting(false);
    }
  }, [validItems, router]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  /* ── Preview stage ───────────────────────────────────────── */
  if (stage === 'preview') {
    return (
      <div className="space-y-0">
        {/* Preview header — Figma: flex, gap 12px, mb 20px */}
        <div className="mb-5 flex items-center gap-3">
          <button
            onClick={() => {
              setStage('upload');
              setItems([]);
              setError('');
            }}
            className="inline-grid h-[34px] w-[34px] flex-none place-items-center rounded-[9px] border border-border bg-background text-muted-foreground transition-colors hover:border-blue-300 hover:text-primary"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            {/* Figma: filename font-size 11px color muted */}
            <span className="text-[11px] text-muted-foreground">
              {fileName}
            </span>
            {/* Figma: h1 22px, letter-spacing -0.5px, mt 4px */}
            <h1 className="mt-1 text-[22px] font-bold leading-tight tracking-[-0.5px]">
              Đã nhận dạng {items.length} câu hỏi
            </h1>
          </div>
          {/* Figma: .import-count-badges flex gap 6px */}
          <div className="flex items-center gap-1.5">
            {typeCounts.MCQ && (
              <FBadge tone="bg-[#dbeafe] text-[#1d4ed8]">
                {typeCounts.MCQ} trắc nghiệm
              </FBadge>
            )}
            {typeCounts.TRUE_FALSE && (
              <FBadge tone="bg-[#cffafe] text-[#0e7490]">
                {typeCounts.TRUE_FALSE} đúng/sai
              </FBadge>
            )}
            {typeCounts.ESSAY && (
              <FBadge tone="bg-[#e0e7ff] text-[#4338ca]">
                {typeCounts.ESSAY} tự luận
              </FBadge>
            )}
            {errorItems.length > 0 && (
              <FBadge tone="bg-[#ffedd5] text-[#c2410c]">
                {errorItems.length} cần kiểm tra
              </FBadge>
            )}
          </div>
        </div>

        {/* Question list — Figma: flex-col gap 12px */}
        <div className="flex flex-col gap-3">
          {items.map((question, index) => (
            <div
              key={`q-${index}`}
              className={`overflow-hidden rounded-[14px] border bg-background shadow-sm ${
                question.error ? 'border-red-300' : 'border-border'
              }`}
              style={{
                display: 'grid',
                gridTemplateColumns: '45px 1fr',
              }}
            >
              {/* Figma: .import-q-number — 45px, pt 21px, text-center, bg surface-2, 11px, 800 */}
              <div
                className={`border-r border-border pt-[21px] text-center text-[11px] font-extrabold ${
                  question.error
                    ? 'bg-red-50 text-red-600 dark:bg-red-950/20'
                    : 'bg-muted/40 text-slate-400'
                }`}
              >
                {String(index + 1).padStart(2, '0')}
              </div>

              {/* Figma: .import-q-content — padding 17px 18px */}
              <div className="px-[18px] py-[17px]">
                {/* Figma: .import-q-title — flex, justify-between, gap 12px */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-[7px]">
                    {question.error ? (
                      <>
                        <AlertTriangle
                          size={18}
                          className="shrink-0 text-red-600"
                        />
                        {/* Figma: h3 12px, line-height 1.5 */}
                        <span className="text-xs font-semibold leading-relaxed text-red-600">
                          Không nhận dạng được
                        </span>
                      </>
                    ) : (
                      <p className="text-xs font-semibold leading-relaxed">
                        {question.content}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-[7px]">
                    {!question.error && (
                      <>
                        <FBadge
                          tone={TYPE_TONES[question.type] || ''}
                        >
                          {TYPE_LABELS[question.type] || question.type}
                        </FBadge>
                        {question.difficulty && (
                          <FBadge
                            tone={
                              DIFFICULTY_TONES[question.difficulty] || ''
                            }
                          >
                            {DIFFICULTY_LABELS[question.difficulty] ||
                              question.difficulty}
                          </FBadge>
                        )}
                      </>
                    )}
                    {/* Figma: .trash-button 30×30, radius 7px */}
                    <button
                      className="grid h-[30px] w-[30px] place-items-center rounded-[7px] border-0 bg-transparent text-red-500 transition-colors hover:bg-red-50"
                      onClick={() => handleRemoveItem(index)}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>

                {/* Error body — Figma: mt 12px, p 11px, radius 8px, 12px */}
                {question.error && (
                  <div className="mt-3 rounded-lg bg-red-50/80 p-[11px] text-xs text-rose-700 dark:bg-red-950/20">
                    <p>
                      Dòng không đúng cấu trúc. Hãy bổ sung nội dung câu
                      hỏi hoặc xóa mục này.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-[9px]"
                    >
                      <PencilLine className="mr-1.5 h-3.5 w-3.5" />
                      Chỉnh sửa thủ công
                    </Button>
                  </div>
                )}

                {/* MCQ / TRUE_FALSE answers — Figma: grid 2col gap 7px, my 14px */}
                {!question.error && question.options.length > 0 && (
                  <div className="my-[14px] grid grid-cols-2 gap-[7px]">
                    {question.options.map((opt, oi) => (
                      <div
                        key={`opt-${index}-${oi}`}
                        className={`flex items-center gap-2 rounded-lg border px-[10px] py-2 text-[13px] ${
                          opt.isCorrect
                            ? 'border-green-300 bg-emerald-50/70 font-bold text-emerald-800 dark:border-emerald-500/50 dark:bg-emerald-950/20 dark:text-emerald-300'
                            : 'border-border text-muted-foreground'
                        }`}
                      >
                        {/* Figma: letter 22×22, radius 5px, font-bold */}
                        <span
                          className={`grid h-[22px] w-[22px] flex-none place-items-center rounded-[5px] text-xs font-bold ${
                            opt.isCorrect
                              ? 'bg-emerald-500 text-white'
                              : 'bg-muted/50 text-foreground'
                          }`}
                        >
                          {String.fromCharCode(65 + oi)}
                        </span>
                        <span className="flex-1">{opt.content}</span>
                        {opt.isCorrect && (
                          <CheckCircle2
                            size={17}
                            className="ml-auto shrink-0 text-emerald-600"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Essay placeholder — Figma: my 14px, p 11px, radius 8px, 12px, color secondary */}
                {!question.error && question.type === 'ESSAY' && (
                  <div className="my-[14px] flex items-center gap-2 rounded-lg bg-indigo-50/70 p-[11px] text-[13px] text-indigo-600 dark:bg-indigo-950/20">
                    <FileText size={17} className="shrink-0" />
                    Câu hỏi tự luận — giáo viên chấm thủ công
                  </div>
                )}

                {/* Footer — Figma: pt 12px, border-top, flex justify-between */}
                {!question.error && (
                  <div className="flex items-end justify-between border-t border-border pt-3">
                    <label className="w-[220px]">
                      <span className="mb-1 block text-[11px] font-bold text-muted-foreground">
                        Danh mục
                      </span>
                      <select className="w-full rounded-md border border-border bg-background px-[9px] py-[7px] text-xs">
                        <option>Chưa phân loại</option>
                      </select>
                    </label>
                    {/* Figma: 11px font-bold text-green-600 */}
                    <span className="flex items-center gap-[5px] text-[11px] font-bold text-emerald-600">
                      <CheckCircle2 size={15} />
                      Đã kiểm tra định dạng
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Summary card — Figma: grid 4col, mt 16px, overflow hidden */}
        <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-[14px] border border-border bg-background shadow-sm sm:grid-cols-4">
          {[
            {
              label: 'Tổng nhận dạng',
              value: items.length,
              color: '',
            },
            {
              label: 'Sẵn sàng nhập',
              value: validItems.length,
              color: 'text-[#059669]',
            },
            {
              label: 'Cần kiểm tra',
              value: errorItems.length,
              color: 'text-[#ea580c]',
            },
            { label: 'Danh mục', value: 1, color: '' },
          ].map((item, i) => (
            <div
              key={item.label}
              className={`flex flex-col px-[18px] py-4 ${i < 3 ? 'border-r border-border' : ''}`}
            >
              {/* Figma: label 11px muted, value mt 4px 17px bold */}
              <span className="text-[11px] text-muted-foreground">
                {item.label}
              </span>
              <b className={`mt-1 text-[17px] font-bold ${item.color}`}>
                {item.value}
              </b>
            </div>
          ))}
        </div>

        {/* Error message */}
        {error && (
          <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </div>
        )}

        {/* Action buttons — Figma: sticky bottom, grid auto+1fr, gap 9px, py 14px, backdrop-blur */}
        <div
          className="sticky bottom-0 z-10 mt-4 grid gap-[9px] py-[14px]"
          style={{
            gridTemplateColumns: 'auto 1fr',
            background:
              'color-mix(in srgb, var(--background, #f8fafc) 92%, transparent)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <Link href="/dashboard/questions">
            <Button variant="outline" className="min-h-[38px] rounded-[9px] px-[14px] text-xs font-bold">
              Hủy
            </Button>
          </Link>
          <Button
            disabled={validItems.length === 0 || importing}
            onClick={handleImport}
            className="w-full min-h-[38px] rounded-[9px] px-[14px] text-xs font-bold"
          >
            <Download className="mr-2 h-4 w-4" />
            {importing
              ? 'Đang nhập...'
              : `Nhập ${validItems.length} câu hỏi vào ngân hàng`}
          </Button>
        </div>
      </div>
    );
  }

  /* ── Upload stage ────────────────────────────────────────── */
  return (
    <div className="space-y-0">
      {/* Back + header — Figma: .back-row, align-items flex-start */}
      <div className="mb-6 flex items-start gap-3">
        <Link href="/dashboard/questions">
          <button className="inline-grid h-[34px] w-[34px] flex-none place-items-center rounded-[9px] border border-border bg-background text-muted-foreground transition-colors hover:border-blue-300 hover:text-primary">
            <ArrowLeft size={19} />
          </button>
        </Link>
        <div>
          {/* Figma: h2 22px, letter-spacing -0.45px, mb 5px */}
          <h2 className="mb-[5px] text-[22px] font-bold tracking-[-0.45px]">
            Nhập câu hỏi từ file
          </h2>
          {/* Figma: p 13px, muted */}
          <p className="text-[13px] text-muted-foreground">
            Tải lên file Word (.docx) để tạo câu hỏi hàng loạt
          </p>
        </div>
      </div>

      {/* Two-column layout — Figma: grid 1.45fr minmax(300px,0.75fr), gap 18px; collapses at 900px */}
      <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.75fr)]">
        {/* Left: Upload card — Figma: .card with p 18px */}
        <div className="rounded-[14px] border border-border bg-background p-[18px] shadow-sm">
          {/* Dropzone — Figma: min-h 280px, 1.5px dashed #93c5fd, radius 12px, p 30px */}
          <label
            className={`flex min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-xl border-[1.5px] border-dashed p-[30px] text-center transition-all ${
              stage === 'parsing'
                ? 'border-primary/30 bg-primary/5'
                : error
                  ? 'border-red-300 bg-red-50/50 dark:bg-red-950/10'
                  : 'border-blue-300 hover:border-primary hover:-translate-y-px'
            }`}
            style={
              !error && stage !== 'parsing'
                ? {
                    background:
                      'radial-gradient(circle at 50% 30%, rgba(37,99,235,0.05), transparent 40%), color-mix(in srgb, #eff6ff 45%, var(--background, #fff))',
                  }
                : undefined
            }
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileInput}
            />

            {stage === 'parsing' ? (
              <>
                <LoaderCircle
                  size={36}
                  className="animate-spin text-primary"
                />
                {/* Figma: h3 13px, mt 16px mb 7px */}
                <h3 className="mb-[7px] mt-4 text-[13px] font-semibold">
                  Đang đọc và nhận dạng câu hỏi...
                </h3>
                <p className="mb-[15px] text-xs text-muted-foreground">
                  Lumi đang phân tích cấu trúc, đáp án và loại câu hỏi.
                </p>
                {/* Figma: progress bar w min(330px,80%) h 6px radius 6px */}
                <div className="h-1.5 w-[min(330px,80%)] overflow-hidden rounded-md bg-blue-100">
                  <div className="h-full animate-pulse rounded-md bg-gradient-to-r from-primary to-cyan-500" />
                </div>
              </>
            ) : error ? (
              <>
                <AlertTriangle size={36} className="text-destructive" />
                <h3 className="mb-[7px] mt-4 text-[13px] font-semibold text-destructive">
                  Tải file không thành công
                </h3>
                <p className="text-xs text-muted-foreground">{error}</p>
                <p className="mt-2 text-xs text-primary">
                  Nhấn để chọn file khác và thử lại
                </p>
              </>
            ) : (
              <>
                {/* Figma: .word-icon 58×58, radius 15px, shadow */}
                <div
                  className="grid h-[58px] w-[58px] place-items-center rounded-[15px] bg-primary/10 text-primary"
                  style={{
                    boxShadow: '0 8px 20px rgba(37,99,235,0.12)',
                  }}
                >
                  <FileUp size={30} />
                </div>
                <h3 className="mb-[7px] mt-4 text-[13px] font-semibold">
                  Kéo thả file .docx vào đây hoặc nhấn để chọn
                </h3>
                <p className="mb-[15px] text-xs text-muted-foreground">
                  Hỗ trợ file Word (.docx) — tối đa 10 MB
                </p>
                {/* Figma: span p 8px 12px, border #bfdbfe, radius 8px, 12px, 700 */}
                <span className="rounded-lg border border-blue-200 bg-background px-3 py-2 text-xs font-bold text-primary">
                  Chọn file từ máy tính
                </span>
              </>
            )}
          </label>

          {/* Figma: .demo-import mt 10px, 11px */}
          {stage === 'upload' && (
            <button
              type="button"
              className="mt-[10px] w-full border-0 bg-transparent text-center text-[11px] text-muted-foreground"
              onClick={handleDemoData}
            >
              Không có file?{' '}
              <b className="text-primary">Xem trước với dữ liệu mẫu</b>
            </button>
          )}
        </div>

        {/* Right: Format guide — Figma: .card p 18px */}
        <div className="rounded-[14px] border border-border bg-background p-[18px] shadow-sm">
          {/* Figma: .format-guide-head flex between, gap 10px */}
          <div className="flex items-center justify-between gap-[10px]">
            <div className="flex items-center gap-2 text-primary">
              <FileText size={20} />
              {/* Figma: h3 13px, color text */}
              <h3 className="text-[13px] font-semibold text-foreground">
                Hướng dẫn định dạng
              </h3>
            </div>
            <FBadge tone="bg-[#d1fae5] text-[#047857]">
              DỄ NHẬN DẠNG
            </FBadge>
          </div>

          {/* Figma: p 12px, muted, leading 1.5 */}
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Sử dụng cấu trúc dưới đây để Lumi nhận dạng chính xác đáp án:
          </p>

          {/* Figma: .format-example m 15px 0, p 14px, radius 9px, gap 9px, font-serif, 12px */}
          <div className="my-[15px] flex flex-col gap-[9px] rounded-[9px] border border-border bg-muted/30 p-[14px] font-serif text-xs">
            <b className="mb-1 leading-relaxed">
              Câu 1: Hàm số y = 2ˣ là hàm số gì?
            </b>
            <span className="flex items-center justify-between font-bold text-emerald-700">
              A. Hàm số mũ <Check size={14} />
            </span>
            <span className="text-muted-foreground">
              B. Hàm số logarit
            </span>
            <span className="text-muted-foreground">
              C. Hàm số lượng giác
            </span>
            <span className="text-muted-foreground">
              D. Hàm số bậc nhất
            </span>
          </div>

          {/* Figma: .supported-types pt 13px pb 16px, border-top */}
          <div className="border-t border-border pb-4 pt-[13px]">
            {/* Figma: label 11px font-bold muted, mb 9px */}
            <span className="mb-[9px] block text-[11px] font-bold text-muted-foreground">
              Loại câu hỏi hỗ trợ
            </span>
            <div className="flex flex-wrap gap-1.5">
              <FBadge tone="bg-[#dbeafe] text-[#1d4ed8]">
                Trắc nghiệm
              </FBadge>
              <FBadge tone="bg-[#cffafe] text-[#0e7490]">
                Đúng/Sai
              </FBadge>
              <FBadge tone="bg-[#e0e7ff] text-[#4338ca]">
                Tự luận
              </FBadge>
            </div>
          </div>

          {/* Figma: .full-btn w-full */}
          <Button
            variant="outline"
            className="w-full min-h-[38px] rounded-[9px] text-xs font-bold"
          >
            <Download className="mr-2 h-4 w-4" />
            Tải file mẫu
          </Button>
        </div>
      </div>

      {/* Bottom notes — Figma: flex gap 28px, mt 16px, pl 18px */}
      <div className="mt-4 flex flex-col gap-3 pl-[18px] sm:flex-row sm:gap-7">
        <div className="flex items-center gap-2 text-primary">
          <ShieldCheck size={18} className="shrink-0" />
          <span className="flex flex-col">
            {/* Figma: b 13px text, desc 12px muted */}
            <b className="mb-[2px] text-[13px] text-foreground">
              Dữ liệu được bảo mật
            </b>
            <span className="text-xs text-muted-foreground">
              File sẽ tự động xóa sau khi xử lý.
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2 text-primary">
          <Zap size={18} className="shrink-0" />
          <span className="flex flex-col">
            <b className="mb-[2px] text-[13px] text-foreground">
              Nhận dạng thông minh
            </b>
            <span className="text-xs text-muted-foreground">
              Kiểm tra lại trước khi nhập.
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
