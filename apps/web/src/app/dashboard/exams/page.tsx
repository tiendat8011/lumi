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
import { Plus, Clock, FileQuestion, Shuffle, Lock } from 'lucide-react';
import Link from 'next/link';

interface Exam {
  id: string;
  title: string;
  description: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  durationSeconds: number;
  maxAttempts: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  accessCode: string | null;
  _count?: { questions: number };
  createdAt: string;
}

export default function ExamsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchExams = useCallback(async () => {
    try {
      const data = await api<Exam[]>('/exams');
      setExams(data);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  const statusColor = (s: string) => {
    switch (s) {
      case 'DRAFT': return 'secondary';
      case 'PUBLISHED': return 'default';
      case 'ARCHIVED': return 'outline';
      default: return 'secondary' as const;
    }
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case 'DRAFT': return 'Nháp';
      case 'PUBLISHED': return 'Đã phát hành';
      case 'ARCHIVED': return 'Lưu trữ';
      default: return s;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Đề thi</h1>
        <CreateExamDialog onCreated={fetchExams} />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : exams.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          Chưa có đề thi nào. Tạo đề thi đầu tiên!
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {exams.map((exam) => (
            <Link key={exam.id} href={`/dashboard/exams/${exam.id}`}>
              <Card className="cursor-pointer transition-shadow hover:shadow-md">
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <CardTitle className="text-base">{exam.title}</CardTitle>
                  <Badge variant={statusColor(exam.status)}>{statusLabel(exam.status)}</Badge>
                </CardHeader>
                <CardContent className="space-y-2">
                  {exam.description && <p className="text-sm text-muted-foreground line-clamp-2">{exam.description}</p>}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{Math.round(exam.durationSeconds / 60)} phút</span>
                    <span className="flex items-center gap-1"><FileQuestion className="h-3 w-3" />{exam._count?.questions ?? 0} câu</span>
                    {exam.shuffleQuestions && <span className="flex items-center gap-1"><Shuffle className="h-3 w-3" />Trộn</span>}
                    {exam.accessCode && <span className="flex items-center gap-1"><Lock className="h-3 w-3" />Mã</span>}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateExamDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [duration, setDuration] = useState(45);
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleOptions, setShuffleOptions] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api('/exams', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description: description || undefined,
          instructions: instructions || undefined,
          durationSeconds: duration * 60,
          maxAttempts,
          shuffleQuestions,
          shuffleOptions,
          accessCode: accessCode || undefined,
        }),
      });
      setOpen(false);
      setTitle('');
      setDescription('');
      setInstructions('');
      setDuration(45);
      setMaxAttempts(1);
      setShuffleQuestions(false);
      setShuffleOptions(false);
      setAccessCode('');
      onCreated();
    } catch {
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="mr-2 h-4 w-4" /> Tạo đề thi
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Tạo đề thi mới</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><Label>Tiêu đề</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Kiểm tra giữa kỳ Toán 12" required /></div>
          <div><Label>Mô tả (tùy chọn)</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Mô tả đề thi..." rows={2} /></div>
          <div><Label>Hướng dẫn làm bài (tùy chọn)</Label><Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Hướng dẫn cho học sinh trước khi bắt đầu..." rows={2} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Thời gian (phút)</Label><Input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} min={1} required /></div>
            <div><Label>Số lần làm tối đa</Label><Input type="number" value={maxAttempts} onChange={(e) => setMaxAttempts(Number(e.target.value))} min={1} /></div>
          </div>
          <div><Label>Mã truy cập (tùy chọn)</Label><Input value={accessCode} onChange={(e) => setAccessCode(e.target.value)} placeholder="Để trống nếu không cần" /></div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={shuffleQuestions} onChange={(e) => setShuffleQuestions(e.target.checked)} className="rounded" />
              Trộn câu hỏi
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={shuffleOptions} onChange={(e) => setShuffleOptions(e.target.checked)} className="rounded" />
              Trộn đáp án
            </label>
          </div>
          <Button type="submit" disabled={loading} className="w-full">{loading ? 'Đang tạo...' : 'Tạo đề thi'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
