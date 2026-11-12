'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { BarChart3, Clock, Eye, Check, X } from 'lucide-react';

interface MyAttempt {
  id: string;
  status: string;
  score: string | null;
  feedback: string | null;
  submittedAt: string | null;
  startedAt: string;
  exam: { title: string; showResultImmediately: boolean; resultsReleased: boolean };
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

export default function MyResultsPage() {
  const [attempts, setAttempts] = useState<MyAttempt[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAttempts = useCallback(async () => {
    try {
      const data = await api<MyAttempt[]>('/attempts/my');
      setAttempts(data);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAttempts();
  }, [fetchAttempts]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Kết quả của tôi</h1>

      {attempts.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          Chưa có kết quả nào
        </div>
      ) : (
        <div className="space-y-3">
          {attempts.map((a) => {
            const canSeeResults = a.exam.showResultImmediately || a.exam.resultsReleased;
            return (
              <Card key={a.id}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base">{a.exam.title}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={a.status === 'SUBMITTED' ? 'default' : 'secondary'}>
                      {a.status === 'SUBMITTED' ? 'Đã nộp' : 'Đang làm'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm">
                    {a.score != null && canSeeResults && (
                      <span className="flex items-center gap-1 font-bold text-primary">
                        <BarChart3 className="h-4 w-4" />
                        {Number(a.score).toFixed(1)} / 10
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {new Date(a.startedAt).toLocaleString('vi-VN')}
                    </span>
                    {canSeeResults && a.status === 'SUBMITTED' && (
                      <StudentReviewDialog attemptId={a.id} examTitle={a.exam.title} />
                    )}
                  </div>
                  {a.feedback && (
                    <p className="mt-2 text-sm text-muted-foreground italic">Nhận xét: {a.feedback}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StudentReviewDialog({ attemptId, examTitle }: { attemptId: string; examTitle: string }) {
  const [open, setOpen] = useState(false);
  const [review, setReview] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api<ReviewItem[]>(`/attempts/${attemptId}/review`)
      .then(setReview)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, attemptId]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Eye className="mr-1 h-3.5 w-3.5" /> Xem chi tiết
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Chi tiết: {examTitle}</DialogTitle></DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-4">
            {review.map((r) => (
              <div key={r.position} className="rounded-lg border p-3">
                <div className="flex items-start justify-between">
                  <p className="font-medium text-sm">Câu {r.position}: {r.content}</p>
                  <Badge variant={r.isCorrect ? 'default' : 'destructive'} className="text-[10px]">
                    {r.earnedPoints}/{r.points}
                  </Badge>
                </div>
                {r.options && (
                  <div className="mt-2 space-y-1">
                    {r.options.map((o) => {
                      const isCorrect = o.id === r.correctOptionId;
                      const isSelected = o.id === r.selectedOptionId;
                      return (
                        <div key={o.id} className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${isCorrect ? 'bg-green-500/10' : ''} ${isSelected && !isCorrect ? 'bg-red-500/10' : ''}`}>
                          {isSelected ? (
                            isCorrect ? <Check className="h-3.5 w-3.5 text-green-600" /> : <X className="h-3.5 w-3.5 text-red-600" />
                          ) : isCorrect ? (
                            <Check className="h-3.5 w-3.5 text-green-600 opacity-50" />
                          ) : (
                            <span className="w-3.5" />
                          )}
                          <span>{o.content}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {r.feedback && <p className="mt-1 text-xs text-muted-foreground italic">Nhận xét: {r.feedback}</p>}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
