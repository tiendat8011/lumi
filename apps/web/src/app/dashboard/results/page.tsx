'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Eye, Pencil, MessageSquare, Check, X } from 'lucide-react';

interface Exam {
  id: string;
  title: string;
  status: string;
}

interface AttemptResult {
  id: string;
  status: string;
  score: string | null;
  manualScoreOverride: boolean;
  feedback: string | null;
  submittedAt: string | null;
  student: { id: string; displayName: string; email: string };
}

interface ReviewItem {
  position: number;
  content: string;
  options: { id: string; content: string }[] | null;
  correctOptionId: string | null;
  selectedOptionId: string | null;
  isCorrect: boolean;
  points: number;
  earnedPoints: number;
  feedback: string | null;
}

export default function ResultsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState<string>('');
  const [attempts, setAttempts] = useState<AttemptResult[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchExams = useCallback(async () => {
    try {
      const data = await api<Exam[]>('/exams');
      const published = data.filter((e) => e.status === 'PUBLISHED');
      setExams(published);
      if (published.length > 0) setSelectedExam(published[0]!.id);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAttempts = useCallback(async () => {
    if (!selectedExam) return;
    try {
      const data = await api<AttemptResult[]>(`/attempts?examId=${selectedExam}`);
      setAttempts(data);
    } catch {
    }
  }, [selectedExam]);

  useEffect(() => { fetchExams(); }, [fetchExams]);
  useEffect(() => { if (selectedExam) fetchAttempts(); }, [selectedExam, fetchAttempts]);

  async function handleReleaseResults() {
    if (!selectedExam) return;
    await api(`/exams/${selectedExam}/release-results`, {
      method: 'PATCH',
      body: JSON.stringify({ release: true }),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Kết quả</h1>
        {selectedExam && (
          <Button variant="outline" size="sm" onClick={handleReleaseResults}>
            Công bố kết quả
          </Button>
        )}
      </div>

      {exams.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {exams.map((e) => (
            <Button key={e.id} variant={selectedExam === e.id ? 'default' : 'outline'} size="sm" onClick={() => setSelectedExam(e.id)}>
              {e.title}
            </Button>
          ))}
        </div>
      )}

      {attempts.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          Chưa có bài nộp nào
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-3 font-medium">Học sinh</th>
                <th className="pb-3 font-medium">Trạng thái</th>
                <th className="pb-3 font-medium">Điểm</th>
                <th className="pb-3 font-medium">Thời gian nộp</th>
                <th className="pb-3 font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((a) => (
                <tr key={a.id} className="border-b">
                  <td className="py-3">
                    <p className="font-medium">{a.student.displayName}</p>
                    <p className="text-xs text-muted-foreground">{a.student.email}</p>
                  </td>
                  <td className="py-3">
                    <Badge variant={a.status === 'SUBMITTED' ? 'default' : 'secondary'}>
                      {a.status === 'SUBMITTED' ? 'Đã nộp' : 'Đang làm'}
                    </Badge>
                    {a.manualScoreOverride && <Badge variant="outline" className="ml-1 text-[10px]">Sửa điểm</Badge>}
                  </td>
                  <td className="py-3 font-mono font-bold">
                    {a.score != null ? Number(a.score).toFixed(1) : '—'}
                  </td>
                  <td className="py-3 text-muted-foreground">
                    {a.submittedAt ? new Date(a.submittedAt).toLocaleString('vi-VN') : '—'}
                  </td>
                  <td className="py-3">
                    <div className="flex gap-1">
                      <ReviewDialog attemptId={a.id} studentName={a.student.displayName} />
                      <EditScoreDialog attemptId={a.id} currentScore={a.score} onUpdated={fetchAttempts} />
                      <FeedbackDialog attemptId={a.id} currentFeedback={a.feedback} onUpdated={fetchAttempts} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ReviewDialog({ attemptId, studentName }: { attemptId: string; studentName: string }) {
  const [open, setOpen] = useState(false);
  const [review, setReview] = useState<ReviewItem[]>([]);

  useEffect(() => {
    if (!open) return;
    api<ReviewItem[]>(`/attempts/${attemptId}/review`).then(setReview).catch(() => {});
  }, [open, attemptId]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        <Eye className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Bài làm: {studentName}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {review.map((r) => (
            <div key={r.position} className="rounded-lg border p-3">
              <p className="font-medium text-sm">Câu {r.position}: {r.content}</p>
              {r.options && (
                <div className="mt-2 space-y-1">
                  {r.options.map((o) => {
                    const isCorrect = o.id === r.correctOptionId;
                    const isSelected = o.id === r.selectedOptionId;
                    return (
                      <div key={o.id} className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${isCorrect ? 'bg-green-500/10' : ''} ${isSelected && !isCorrect ? 'bg-red-500/10' : ''}`}>
                        {isSelected ? (isCorrect ? <Check className="h-3.5 w-3.5 text-green-600" /> : <X className="h-3.5 w-3.5 text-red-600" />) : isCorrect ? <Check className="h-3.5 w-3.5 text-green-600 opacity-50" /> : <span className="w-3.5" />}
                        <span>{o.content}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span>{r.earnedPoints}/{r.points} điểm</span>
                {r.feedback && <span className="italic">Phản hồi: {r.feedback}</span>}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditScoreDialog({ attemptId, currentScore, onUpdated }: { attemptId: string; currentScore: string | null; onUpdated: () => void }) {
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState(currentScore ? Number(currentScore) : 0);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api(`/attempts/${attemptId}/score`, { method: 'PATCH', body: JSON.stringify({ score }) });
      setOpen(false);
      onUpdated();
    } catch {} finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        <Pencil className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Sửa điểm</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input type="number" value={score} onChange={(e) => setScore(Number(e.target.value))} min={0} max={10} step={0.1} />
          <Button type="submit" disabled={loading} className="w-full">{loading ? 'Đang lưu...' : 'Lưu'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FeedbackDialog({ attemptId, currentFeedback, onUpdated }: { attemptId: string; currentFeedback: string | null; onUpdated: () => void }) {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState(currentFeedback || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api(`/attempts/${attemptId}/feedback`, { method: 'PATCH', body: JSON.stringify({ feedback }) });
      setOpen(false);
      onUpdated();
    } catch {} finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        <MessageSquare className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nhận xét</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Nhận xét cho học sinh..." rows={3} />
          <Button type="submit" disabled={loading} className="w-full">{loading ? 'Đang lưu...' : 'Lưu nhận xét'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
