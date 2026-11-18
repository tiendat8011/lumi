'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { SectionHeader } from '@/components/ui/section-header';
import { StatCard } from '@/components/ui/stat-card';
import { EmptyState } from '@/components/ui/empty-state';
import Link from 'next/link';
import {
  Plus,
  Trash2,
  Check,
  Search,
  FolderPlus,
  FileQuestion,
  FileUp,
  FolderOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface Option {
  id: string;
  content: string;
  isCorrect: boolean;
  position: number;
}

interface Category {
  id: string;
  name: string;
  _count?: { questions: number };
}

interface Question {
  id: string;
  content: string;
  type: string;
  difficulty: string | null;
  explanation: string | null;
  imageUrl: string | null;
  correctAnswer: string | null;
  category: Category | null;
  options: Option[];
  createdAt: string;
}

interface OptionInput {
  content: string;
  isCorrect: boolean;
  position: number;
}

/**
 * The option rows a question type starts with, or `null` for the types that
 * take no options. Returns fresh objects so each reset is a new array.
 */
function defaultOptionsForType(
  type: string,
): OptionInput[] | null {
  if (type === 'TRUE_FALSE') {
    return [
      { content: 'Đúng', isCorrect: true, position: 0 },
      { content: 'Sai', isCorrect: false, position: 1 },
    ];
  }
  if (type === 'MCQ' || type === 'MCQ_MULTI') {
    return [
      { content: '', isCorrect: true, position: 0 },
      { content: '', isCorrect: false, position: 1 },
      { content: '', isCorrect: false, position: 2 },
      { content: '', isCorrect: false, position: 3 },
    ];
  }
  return null;
}

const DIFFICULTY_LABELS: Record<string, string> = {
  EASY: 'Dễ',
  MEDIUM: 'Trung bình',
  HARD: 'Khó',
};
const TYPE_LABELS: Record<string, string> = {
  MCQ: 'Trắc nghiệm',
  MCQ_MULTI: 'Nhiều đáp án',
  TRUE_FALSE: 'Đúng/Sai',
  SHORT_ANSWER: 'Trả lời ngắn',
  FILL_BLANK: 'Điền khuyết',
  ESSAY: 'Tự luận',
};
const DIFFICULTY_COLORS: Record<string, string> = {
  EASY: 'bg-green-500/10 text-green-600',
  MEDIUM: 'bg-yellow-500/10 text-yellow-600',
  HARD: 'bg-red-500/10 text-red-600',
};
const TYPE_COLORS: Record<string, string> = {
  MCQ: 'bg-blue-500/10 text-blue-600',
  MCQ_MULTI: 'bg-violet-500/10 text-violet-600',
  TRUE_FALSE: 'bg-cyan-500/10 text-cyan-600',
  SHORT_ANSWER: 'bg-orange-500/10 text-orange-600',
  FILL_BLANK: 'bg-emerald-500/10 text-emerald-600',
  ESSAY: 'bg-pink-500/10 text-pink-600',
};

const TAB_TYPE_MAP: Record<string, string> = {
  all: '',
  MCQ: 'MCQ',
  TRUE_FALSE: 'TRUE_FALSE',
  ESSAY: 'ESSAY',
  FILL_BLANK: 'FILL_BLANK',
};

const ITEMS_PER_PAGE = 10;

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchQuestions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filterType) params.set('type', filterType);
      params.set('page', String(page));
      params.set('limit', String(ITEMS_PER_PAGE));
      const data = await api<{
        items: Question[];
        total: number;
      }>(`/questions?${params}`);
      const items = data.items ?? (data as unknown as Question[]);
      setQuestions(items);
      setTotal(data.total ?? items.length);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [search, filterType, page]);

  useEffect(() => {
    api<Category[]>('/questions/categories')
      .then(setCategories)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(fetchQuestions, 300);
    return () => clearTimeout(timer);
  }, [fetchQuestions]);

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa câu hỏi này?')) return;
    await api(`/questions/${id}`, { method: 'DELETE' });
    fetchQuestions();
  };

  const handleTabChange = (
    value: string | number | null,
  ) => {
    const v = String(value ?? 'all');
    setFilterType(TAB_TYPE_MAP[v] ?? '');
    setPage(1);
  };

  const totalPages = Math.max(
    1,
    Math.ceil(total / ITEMS_PER_PAGE),
  );
  const usedCount = questions.filter(
    (q) => q.category !== null,
  ).length;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Ngân hàng câu hỏi"
        description="Quản lý và tổ chức câu hỏi cho các bài kiểm tra"
        action={
          <div className="flex gap-2">
            <Link href="/dashboard/import-questions">
              <Button variant="outline">
                <FileUp className="mr-2 h-4 w-4" />
                Import file Word
              </Button>
            </Link>
            <CreateCategoryDialog
              onCreated={() =>
                api<Category[]>('/questions/categories').then(
                  setCategories,
                )
              }
            />
            <CreateQuestionDialog
              categories={categories}
              onCreated={fetchQuestions}
            />
          </div>
        }
      />

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={FileQuestion}
          label="Tổng câu hỏi"
          value={String(total)}
          tone="blue"
        />
        <StatCard
          icon={FolderOpen}
          label="Thư mục"
          value={String(categories.length)}
          tone="violet"
        />
        <StatCard
          icon={CheckCircle2}
          label="Đã sử dụng"
          value={String(usedCount)}
          tone="green"
        />
      </div>

      {/* Table card */}
      <Card className="overflow-hidden">
        <div className="border-b px-4 pt-3">
          <Tabs
            defaultValue="all"
            onValueChange={handleTabChange}
          >
            <TabsList variant="line">
              <TabsTrigger value="all">Tất cả</TabsTrigger>
              <TabsTrigger value="MCQ">
                Trắc nghiệm
              </TabsTrigger>
              <TabsTrigger value="TRUE_FALSE">
                Đúng / Sai
              </TabsTrigger>
              <TabsTrigger value="ESSAY">Tự luận</TabsTrigger>
              <TabsTrigger value="FILL_BLANK">
                Điền khuyết
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="p-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm câu hỏi..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
        </div>

        {loading ? (
          <div className="px-4 pb-6">
            <EmptyState type="loading" />
          </div>
        ) : questions.length === 0 ? (
          <div className="px-4 pb-6">
            <EmptyState
              type="empty"
              title={
                search || filterType
                  ? 'Không tìm thấy câu hỏi nào'
                  : 'Chưa có câu hỏi nào'
              }
              text={
                search || filterType
                  ? 'Thử thay đổi bộ lọc'
                  : 'Tạo câu hỏi đầu tiên!'
              }
            />
          </div>
        ) : (
          <>
            <div className="divide-y">
              {questions.map((q, idx) => (
                <div
                  key={q.id}
                  className="flex items-start gap-4 px-4 py-3 transition-colors hover:bg-muted/50"
                >
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium">
                    {(page - 1) * ITEMS_PER_PAGE + idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-tight">
                      {q.content}
                    </p>
                    {q.category && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {q.category.name}
                      </p>
                    )}
                  </div>
                  <Badge
                    className={`shrink-0 text-[10px] ${TYPE_COLORS[q.type] || ''}`}
                  >
                    {TYPE_LABELS[q.type] || q.type}
                  </Badge>
                  {q.difficulty && (
                    <Badge
                      className={`shrink-0 text-[10px] ${DIFFICULTY_COLORS[q.difficulty] || ''}`}
                    >
                      {DIFFICULTY_LABELS[q.difficulty]}
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(q.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Hiển thị{' '}
                {(page - 1) * ITEMS_PER_PAGE + 1}–
                {Math.min(page * ITEMS_PER_PAGE, total)} trong{' '}
                {total} câu hỏi
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                {Array.from(
                  { length: Math.min(totalPages, 5) },
                  (_, i) => {
                    const p = i + 1;
                    return (
                      <Button
                        key={p}
                        variant={p === page ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 w-7 p-0 text-xs"
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </Button>
                    );
                  },
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function CreateCategoryDialog({
  onCreated,
}: {
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api('/questions/categories', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      setOpen(false);
      setName('');
      onCreated();
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <FolderPlus className="mr-2 h-4 w-4" /> Danh mục
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tạo danh mục</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Tên danh mục</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Đang tạo...' : 'Tạo'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateQuestionDialog({
  categories,
  onCreated,
}: {
  categories: Category[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('MCQ');
  const [content, setContent] = useState('');
  const [explanation, setExplanation] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [options, setOptions] = useState<OptionInput[]>(
    () => defaultOptionsForType('MCQ') ?? [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const needsOptions = ['MCQ', 'MCQ_MULTI', 'TRUE_FALSE'].includes(
    type,
  );

  // The option rows follow the question type, so they are reset in the same
  // event that changes the type rather than in an effect that reacts to it.
  const handleTypeChange = (next: string) => {
    setType(next);
    const defaults = defaultOptionsForType(next);
    if (defaults) setOptions(defaults);
  };

  const updateOption = (
    index: number,
    field: keyof OptionInput,
    value: string | boolean,
  ) => {
    setOptions((prev) =>
      prev.map((o, i) => {
        if (i !== index) {
          if (
            field === 'isCorrect' &&
            value === true &&
            type !== 'MCQ_MULTI'
          ) {
            return { ...o, isCorrect: false };
          }
          return o;
        }
        return { ...o, [field]: value };
      }),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api('/questions', {
        method: 'POST',
        body: JSON.stringify({
          content,
          type,
          explanation: explanation || undefined,
          difficulty: difficulty || undefined,
          categoryId: categoryId || undefined,
          correctAnswer: correctAnswer || undefined,
          ...(needsOptions && {
            options: options.filter((o) => o.content.trim()),
          }),
        }),
      });
      setOpen(false);
      setContent('');
      setExplanation('');
      setCorrectAnswer('');
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="mr-2 h-4 w-4" /> Thêm câu hỏi
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tạo câu hỏi mới</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Loại câu hỏi</Label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={type}
                onChange={(e) =>
                  handleTypeChange(e.target.value)
                }
              >
                <option value="MCQ">Trắc nghiệm</option>
                <option value="MCQ_MULTI">
                  Nhiều đáp án
                </option>
                <option value="TRUE_FALSE">Đúng/Sai</option>
                <option value="SHORT_ANSWER">
                  Trả lời ngắn
                </option>
                <option value="ESSAY">Tự luận</option>
              </select>
            </div>
            <div>
              <Label>Độ khó</Label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              >
                <option value="">Không chọn</option>
                <option value="EASY">Dễ</option>
                <option value="MEDIUM">Trung bình</option>
                <option value="HARD">Khó</option>
              </select>
            </div>
          </div>

          {categories.length > 0 && (
            <div>
              <Label>Danh mục</Label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">Không chọn</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <Label>Nội dung câu hỏi</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Nhập nội dung câu hỏi..."
              rows={3}
              required
            />
          </div>

          {needsOptions && (
            <div className="space-y-3">
              <Label>
                Đáp án{' '}
                {type === 'MCQ_MULTI'
                  ? '(chọn nhiều đáp án đúng)'
                  : '(chọn đáp án đúng)'}
              </Label>
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateOption(
                        i,
                        'isCorrect',
                        type === 'MCQ_MULTI'
                          ? !opt.isCorrect
                          : true,
                      )
                    }
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${opt.isCorrect ? 'border-green-500 bg-green-500 text-white' : 'border-input'}`}
                  >
                    {opt.isCorrect && (
                      <Check className="h-3 w-3" />
                    )}
                  </button>
                  <Input
                    value={opt.content}
                    onChange={(e) =>
                      updateOption(i, 'content', e.target.value)
                    }
                    placeholder={`Đáp án ${String.fromCharCode(65 + i)}`}
                    className="flex-1"
                  />
                </div>
              ))}
            </div>
          )}

          {(type === 'SHORT_ANSWER' || type === 'FILL_BLANK') && (
            <div>
              <Label>Đáp án đúng</Label>
              <Input
                value={correctAnswer}
                onChange={(e) =>
                  setCorrectAnswer(e.target.value)
                }
                placeholder="Nhập đáp án..."
              />
            </div>
          )}

          <div>
            <Label>Giải thích (tùy chọn)</Label>
            <Textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Giải thích đáp án..."
              rows={2}
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Đang tạo...' : 'Tạo câu hỏi'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
