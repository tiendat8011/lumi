'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Trash2, Check, X, Search, FolderPlus } from 'lucide-react';

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

const DIFFICULTY_LABELS: Record<string, string> = { EASY: 'Dễ', MEDIUM: 'Trung bình', HARD: 'Khó' };
const TYPE_LABELS: Record<string, string> = { MCQ: 'Trắc nghiệm', MCQ_MULTI: 'Nhiều đáp án', TRUE_FALSE: 'Đúng/Sai', SHORT_ANSWER: 'Trả lời ngắn', FILL_BLANK: 'Điền khuyết', ESSAY: 'Tự luận' };
const DIFFICULTY_COLORS: Record<string, string> = { EASY: 'bg-green-500/10 text-green-600', MEDIUM: 'bg-yellow-500/10 text-yellow-600', HARD: 'bg-red-500/10 text-red-600' };

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');
  const [filterType, setFilterType] = useState('');

  const fetchQuestions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filterCategory) params.set('categoryId', filterCategory);
      if (filterDifficulty) params.set('difficulty', filterDifficulty);
      if (filterType) params.set('type', filterType);
      const data = await api<{ items: Question[]; total: number }>(`/questions?${params}`);
      setQuestions(data.items ?? (data as unknown as Question[]));
    } catch {
    } finally {
      setLoading(false);
    }
  }, [search, filterCategory, filterDifficulty, filterType]);

  useEffect(() => {
    api<Category[]>('/questions/categories').then(setCategories).catch(() => {});
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ngân hàng câu hỏi</h1>
        <div className="flex gap-2">
          <CreateCategoryDialog onCreated={() => api<Category[]>('/questions/categories').then(setCategories)} />
          <CreateQuestionDialog categories={categories} onCreated={fetchQuestions} />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Tìm kiếm câu hỏi..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
          <option value="">Tất cả danh mục</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filterDifficulty} onChange={(e) => setFilterDifficulty(e.target.value)}>
          <option value="">Tất cả độ khó</option>
          <option value="EASY">Dễ</option>
          <option value="MEDIUM">Trung bình</option>
          <option value="HARD">Khó</option>
        </select>
        <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">Tất cả loại</option>
          <option value="MCQ">Trắc nghiệm</option>
          <option value="MCQ_MULTI">Nhiều đáp án</option>
          <option value="TRUE_FALSE">Đúng/Sai</option>
          <option value="SHORT_ANSWER">Trả lời ngắn</option>
          <option value="ESSAY">Tự luận</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : questions.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          {search || filterCategory || filterDifficulty || filterType ? 'Không tìm thấy câu hỏi nào.' : 'Chưa có câu hỏi nào. Tạo câu hỏi đầu tiên!'}
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((q, idx) => (
            <Card key={q.id}>
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div>
                  <CardTitle className="text-sm font-medium">Câu {idx + 1}: {q.content}</CardTitle>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <Badge variant="outline" className="text-[10px]">{TYPE_LABELS[q.type] || q.type}</Badge>
                    {q.difficulty && <Badge className={`text-[10px] ${DIFFICULTY_COLORS[q.difficulty] || ''}`}>{DIFFICULTY_LABELS[q.difficulty]}</Badge>}
                    {q.category && <Badge variant="secondary" className="text-[10px]">{q.category.name}</Badge>}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(q.id)} className="text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </CardHeader>
              <CardContent>
                {q.options.length > 0 ? (
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {q.options.map((o) => (
                      <div key={o.id} className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${o.isCorrect ? 'border-green-500/30 bg-green-500/5 text-green-600' : ''}`}>
                        {o.isCorrect ? <Check className="h-3.5 w-3.5 shrink-0" /> : <X className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                        <span>{o.content}</span>
                      </div>
                    ))}
                  </div>
                ) : q.correctAnswer ? (
                  <p className="text-sm"><span className="text-muted-foreground">Đáp án:</span> {q.correctAnswer}</p>
                ) : null}
                {q.explanation && <p className="mt-2 text-xs text-muted-foreground">Giải thích: {q.explanation}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateCategoryDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api('/questions/categories', { method: 'POST', body: JSON.stringify({ name }) });
      setOpen(false);
      setName('');
      onCreated();
    } catch {} finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <FolderPlus className="mr-2 h-4 w-4" /> Danh mục
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Tạo danh mục</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><Label>Tên danh mục</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <Button type="submit" disabled={loading} className="w-full">{loading ? 'Đang tạo...' : 'Tạo'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateQuestionDialog({ categories, onCreated }: { categories: Category[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('MCQ');
  const [content, setContent] = useState('');
  const [explanation, setExplanation] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [options, setOptions] = useState<OptionInput[]>([
    { content: '', isCorrect: true, position: 0 },
    { content: '', isCorrect: false, position: 1 },
    { content: '', isCorrect: false, position: 2 },
    { content: '', isCorrect: false, position: 3 },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const needsOptions = ['MCQ', 'MCQ_MULTI', 'TRUE_FALSE'].includes(type);

  useEffect(() => {
    if (type === 'TRUE_FALSE') {
      setOptions([
        { content: 'Đúng', isCorrect: true, position: 0 },
        { content: 'Sai', isCorrect: false, position: 1 },
      ]);
    } else if (type === 'MCQ' || type === 'MCQ_MULTI') {
      setOptions([
        { content: '', isCorrect: true, position: 0 },
        { content: '', isCorrect: false, position: 1 },
        { content: '', isCorrect: false, position: 2 },
        { content: '', isCorrect: false, position: 3 },
      ]);
    }
  }, [type]);

  const updateOption = (index: number, field: keyof OptionInput, value: string | boolean) => {
    setOptions((prev) =>
      prev.map((o, i) => {
        if (i !== index) {
          if (field === 'isCorrect' && value === true && type !== 'MCQ_MULTI') {
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
          ...(needsOptions && { options: options.filter((o) => o.content.trim()) }),
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
        <Plus className="mr-2 h-4 w-4" /> Tạo câu hỏi
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Tạo câu hỏi mới</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Loại câu hỏi</Label>
              <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="MCQ">Trắc nghiệm</option>
                <option value="MCQ_MULTI">Nhiều đáp án</option>
                <option value="TRUE_FALSE">Đúng/Sai</option>
                <option value="SHORT_ANSWER">Trả lời ngắn</option>
                <option value="ESSAY">Tự luận</option>
              </select>
            </div>
            <div>
              <Label>Độ khó</Label>
              <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
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
              <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Không chọn</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <Label>Nội dung câu hỏi</Label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Nhập nội dung câu hỏi..." rows={3} required />
          </div>

          {needsOptions && (
            <div className="space-y-3">
              <Label>Đáp án {type === 'MCQ_MULTI' ? '(chọn nhiều đáp án đúng)' : '(chọn đáp án đúng)'}</Label>
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateOption(i, 'isCorrect', type === 'MCQ_MULTI' ? !opt.isCorrect : true)}
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${opt.isCorrect ? 'border-green-500 bg-green-500 text-white' : 'border-input'}`}
                  >
                    {opt.isCorrect && <Check className="h-3 w-3" />}
                  </button>
                  <Input value={opt.content} onChange={(e) => updateOption(i, 'content', e.target.value)} placeholder={`Đáp án ${String.fromCharCode(65 + i)}`} className="flex-1" />
                </div>
              ))}
            </div>
          )}

          {(type === 'SHORT_ANSWER' || type === 'FILL_BLANK') && (
            <div>
              <Label>Đáp án đúng</Label>
              <Input value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} placeholder="Nhập đáp án..." />
            </div>
          )}

          <div>
            <Label>Giải thích (tùy chọn)</Label>
            <Textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="Giải thích đáp án..." rows={2} />
          </div>

          <Button type="submit" disabled={loading} className="w-full">{loading ? 'Đang tạo...' : 'Tạo câu hỏi'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
