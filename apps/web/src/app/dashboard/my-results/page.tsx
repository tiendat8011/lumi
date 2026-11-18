'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { SectionHeader } from '@/components/ui/section-header';
import { EmptyState } from '@/components/ui/empty-state';
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
import {
  BarChart3,
  Clock,
  Eye,
  Check,
  X,
  MessageSquare,
} from 'lucide-react';

interface MyAttempt {
  id: string;
  status: string;
  score: string | null;
  feedback: string | null;
  submittedAt: string | null;
  startedAt: string;
  exam: {
    title: string;
    showResultImmediately: boolean;
    resultsReleased: boolean;
  };
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

function ScoreCircle({ score }: { score: number }) {
  const pct = (score / 10) * 100;
  const r = 42;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const color =
    score >= 8
      ? 'text-green-500'
      : score >= 5
        ? 'text-primary'
        : 'text-destructive';

  return (
    <svg
      viewBox="0 0 100 100"
      className="h-28 w-28 shrink-0"
    >
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke="var(--muted)"
        strokeWidth="6"
      />
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        className={color}
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform="rotate(-90 50 50)"
      />
      <text
        x="50"
        y="46"
        textAnchor="middle"
        className="fill-foreground text-lg font-bold"
        fontSize="20"
      >
        {score.toFixed(1)}
      </text>
      <text
        x="50"
        y="62"
        textAnchor="middle"
        className="fill-muted-foreground"
        fontSize="10"
      >
        / 10
      </text>
    </svg>
  );
}

function scoreBadge(score: number) {
  if (score >= 8)
    return { text: 'Hoàn thành tốt', cls: 'bg-green-500/10 text-green-600' };
  if (score >= 5)
    return { text: 'Đạt', cls: 'bg-blue-500/10 text-blue-600' };
  return { text: 'Cần cải thiện', cls: 'bg-orange-500/10 text-orange-600' };
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
    void (async () => {
      await fetchAttempts();
    })();
  }, [fetchAttempts]);

  if (loading) {
    return <EmptyState type="loading" />;
  }

  const submitted = attempts.filter(
    (a) => a.status === 'SUBMITTED',
  );
  const hero = submitted.find(
    (a) =>
      a.score != null &&
      (a.exam.showResultImmediately || a.exam.resultsReleased),
  );

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Kết quả học tập"
        description="Tổng hợp kết quả các bài kiểm tra và bài tập của bạn."
      />

      {attempts.length === 0 ? (
        <EmptyState
          title="Chưa có kết quả nào"
          text="Kết quả bài kiểm tra sẽ xuất hiện tại đây sau khi bạn nộp bài."
        />
      ) : (
        <>
          {/* Hero result card */}
          {hero && hero.score != null && (
            <Card className="overflow-hidden">
              <CardContent className="flex flex-col items-center gap-6 py-6 sm:flex-row sm:items-start">
                <ScoreCircle score={Number(hero.score)} />
                <div className="flex-1 text-center sm:text-left">
                  <Badge
                    className={`mb-2 ${scoreBadge(Number(hero.score)).cls}`}
                  >
                    {scoreBadge(Number(hero.score)).text}
                  </Badge>
                  <h3 className="text-lg font-semibold">
                    {hero.exam.title}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Nộp lúc{' '}
                    {hero.submittedAt
                      ? new Date(hero.submittedAt).toLocaleString(
                          'vi-VN',
                        )
                      : '—'}
                  </p>
                  <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                    <Badge
                      variant="secondary"
                      className="gap-1"
                    >
                      <BarChart3 className="h-3 w-3" />
                      {Number(hero.score).toFixed(1)} / 10
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="gap-1"
                    >
                      <Clock className="h-3 w-3" />
                      {new Date(hero.startedAt).toLocaleDateString(
                        'vi-VN',
                      )}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Feedback & detail cards */}
          {hero && hero.feedback && (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MessageSquare className="h-4 w-4" />
                    Nhận xét từ giáo viên
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm italic text-muted-foreground">
                    {hero.feedback}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* All attempts */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">
              Tất cả bài làm
            </h3>
            {attempts.map((a) => {
              const canSeeResults =
                a.exam.showResultImmediately ||
                a.exam.resultsReleased;
              return (
                <Card key={a.id}>
                  <CardContent className="flex items-center gap-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">
                          {a.exam.title}
                        </p>
                        <Badge
                          variant={
                            a.status === 'SUBMITTED'
                              ? 'default'
                              : 'secondary'
                          }
                        >
                          {a.status === 'SUBMITTED'
                            ? 'Đã nộp'
                            : 'Đang làm'}
                        </Badge>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        {a.score != null && canSeeResults && (
                          <span className="flex items-center gap-1 font-bold text-primary">
                            <BarChart3 className="h-3 w-3" />
                            {Number(a.score).toFixed(1)} / 10
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(a.startedAt).toLocaleString(
                            'vi-VN',
                          )}
                        </span>
                      </div>
                      {a.feedback && canSeeResults && (
                        <p className="mt-1 text-xs text-muted-foreground italic">
                          Nhận xét: {a.feedback}
                        </p>
                      )}
                    </div>
                    {canSeeResults && a.status === 'SUBMITTED' && (
                      <StudentReviewDialog
                        attemptId={a.id}
                        examTitle={a.exam.title}
                      />
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function StudentReviewDialog({
  attemptId,
  examTitle,
}: {
  attemptId: string;
  examTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const [review, setReview] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    api<{ questions: ReviewItem[] }>(`/attempts/${attemptId}/review`)
      .then((data) => setReview(data.questions ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, attemptId]);

  // The spinner is raised by the event that opens the dialog, so the effect
  // below only has to clear it when the fetch settles.
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) setLoading(true);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={<Button variant="outline" size="sm" />}
      >
        <Eye className="mr-1 h-3.5 w-3.5" /> Xem chi tiết
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Chi tiết: {examTitle}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <EmptyState type="loading" />
        ) : (
          <div className="space-y-4">
            {review.map((r) => (
              <div
                key={r.position}
                className="rounded-lg border p-3"
              >
                <div className="flex items-start justify-between">
                  <p className="text-sm font-medium">
                    Câu {r.position}: {r.content}
                  </p>
                  <Badge
                    variant={
                      r.isCorrect ? 'default' : 'destructive'
                    }
                    className="text-[10px]"
                  >
                    {r.earnedPoints}/{r.points}
                  </Badge>
                </div>
                {r.options && (
                  <div className="mt-2 space-y-1">
                    {r.options.map((o) => {
                      const isCorrect =
                        o.id === r.correctOptionId;
                      const isSelected =
                        o.id === r.selectedOptionId;
                      return (
                        <div
                          key={o.id}
                          className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${isCorrect ? 'bg-green-500/10' : ''} ${isSelected && !isCorrect ? 'bg-red-500/10' : ''}`}
                        >
                          {isSelected ? (
                            isCorrect ? (
                              <Check className="h-3.5 w-3.5 text-green-600" />
                            ) : (
                              <X className="h-3.5 w-3.5 text-red-600" />
                            )
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
                {r.feedback && (
                  <p className="mt-1 text-xs text-muted-foreground italic">
                    Nhận xét: {r.feedback}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
