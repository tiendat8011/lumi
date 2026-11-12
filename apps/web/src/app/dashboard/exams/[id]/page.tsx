'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ArrowLeft, Plus, Trash2, Send, Check, X } from 'lucide-react';
import Link from 'next/link';

interface ExamQuestion {
  id: string;
  position: number;
  points: number;
  contentSnapshot: string | null;
  optionsSnapshot: Array<{ id: string; content: string; isCorrect: boolean }> | null;
  sourceQuestion?: {
    id: string;
    content: string;
    options: Array<{ id: string; content: string; isCorrect: boolean }>;
  } | null;
}

interface ExamDetail {
  id: string;
  title: string;
  description: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  durationSeconds: number;
  maxAttempts: number;
  questions: ExamQuestion[];
}

interface BankQuestion {
  id: string;
  content: string;
  options: Array<{ id: string; content: string; isCorrect: boolean }>;
}

export default function ExamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchExam = useCallback(async () => {
    try {
      const data = await api<ExamDetail>(`/exams/${id}`);
      setExam(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchExam();
  }, [fetchExam]);

  const handlePublish = async () => {
    if (!confirm('Phát hành đề thi? Sau khi phát hành sẽ không thể chỉnh sửa.')) return;
    try {
      await api(`/exams/${id}/publish`, { method: 'POST' });
      fetchExam();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to publish');
    }
  };

  const handleRemoveQuestion = async (eqId: string) => {
    await api(`/exams/${id}/questions/${eqId}`, { method: 'DELETE' });
    fetchExam();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!exam) {
    return <div className="text-center text-muted-foreground">Không tìm thấy đề thi</div>;
  }

  const isDraft = exam.status === 'DRAFT';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/exams">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{exam.title}</h1>
            <Badge variant={isDraft ? 'secondary' : 'default'}>
              {isDraft ? 'Nháp' : 'Đã phát hành'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {Math.round(exam.durationSeconds / 60)} phút · {exam.questions.length} câu
          </p>
        </div>
        {isDraft && (
          <div className="flex gap-2">
            <AddQuestionDialog examId={id} onAdded={fetchExam} currentCount={exam.questions.length} />
            <Button onClick={handlePublish} disabled={exam.questions.length === 0}>
              <Send className="mr-2 h-4 w-4" />
              Phát hành
            </Button>
          </div>
        )}
      </div>

      {exam.questions.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          Chưa có câu hỏi. Thêm câu hỏi từ ngân hàng!
        </div>
      ) : (
        <div className="space-y-3">
          {exam.questions.map((eq) => {
            const content = eq.contentSnapshot || eq.sourceQuestion?.content || '—';
            const options = eq.optionsSnapshot || eq.sourceQuestion?.options || [];
            return (
              <Card key={eq.id}>
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <CardTitle className="text-sm">
                    Câu {eq.position + 1} ({eq.points} điểm): {content}
                  </CardTitle>
                  {isDraft && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleRemoveQuestion(eq.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {options.map((o) => (
                      <div
                        key={o.id}
                        className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${
                          o.isCorrect ? 'border-success/30 bg-success-bg text-success' : ''
                        }`}
                      >
                        {o.isCorrect ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5 text-muted-foreground" />}
                        {o.content}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AddQuestionDialog({
  examId,
  onAdded,
  currentCount,
}: {
  examId: string;
  onAdded: () => void;
  currentCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ items: BankQuestion[] } | BankQuestion[]>('/questions');
      setQuestions(Array.isArray(data) ? data : data.items);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchQuestions();
  }, [open, fetchQuestions]);

  const handleAdd = async (questionId: string) => {
    try {
      await api(`/exams/${examId}/questions`, {
        method: 'POST',
        body: JSON.stringify({
          questionId,
          points: 1,
          position: currentCount,
        }),
      });
      onAdded();
      setOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <Plus className="mr-2 h-4 w-4" />
        Thêm câu hỏi
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Chọn câu hỏi từ ngân hàng</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : questions.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Không có câu hỏi nào. Tạo câu hỏi trước.
          </p>
        ) : (
          <div className="space-y-2">
            {questions.map((q) => (
              <div
                key={q.id}
                className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted/50"
              >
                <p className="text-sm flex-1 mr-3">{q.content}</p>
                <Button size="sm" variant="outline" onClick={() => handleAdd(q.id)}>
                  Thêm
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
