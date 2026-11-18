'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { SectionHeader } from '@/components/ui/section-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Check,
  X,
  ChevronRight,
  Clock,
  FileText,
} from 'lucide-react';

interface Exam {
  id: string;
  title: string;
  status: string;
}

interface AttemptResult {
  id: string;
  status: string;
  score: string | null;
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

interface ReviewResponse {
  gradingMode: string;
  gradingProgress: { graded: number; total: number };
  questions: ReviewItem[];
}

export default function GradingPage() {
  const { user, loading: authLoading } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [attempts, setAttempts] = useState<AttemptResult[]>([]);
  const [selectedAttemptId, setSelectedAttemptId] =
    useState<string>('');
  const [review, setReview] = useState<ReviewItem[]>([]);
  const [score, setScore] = useState<number>(0);
  const [feedback, setFeedback] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reviewLoading, setReviewLoading] = useState(false);

  useEffect(() => {
    api<Exam[]>('/exams')
      .then((data) => {
        const published = data.filter(
          (e) => e.status === 'PUBLISHED',
        );
        setExams(published);
        if (published.length > 0) setSelectedExamId(published[0]!.id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function fetchAttempts() {
    if (!selectedExamId) {
      setAttempts([]);
      return;
    }
    api<AttemptResult[]>(
      `/attempts?examId=${selectedExamId}`,
    )
      .then((data) =>
        setAttempts(data.filter((a) => a.status === 'SUBMITTED')),
      )
      .catch(() => setAttempts([]));
  }

  // Picking a different exam clears the open submission, and picking a
  // submission primes the panel for it. Both resets belong to the event that
  // causes them rather than to an effect reacting to the new id.
  const handleExamChange = (next: string) => {
    if (next === selectedExamId) return;
    setSelectedExamId(next);
    setSelectedAttemptId('');
    setReview([]);
    if (!next) setAttempts([]);
  };

  const handleSelectAttempt = (attempt: AttemptResult) => {
    setSelectedAttemptId(attempt.id);
    setReviewLoading(true);
    setScore(attempt.score != null ? Number(attempt.score) : 0);
    setFeedback(attempt.feedback || '');
  };

  useEffect(() => {
    if (!selectedExamId) return;
    let cancelled = false;
    api<AttemptResult[]>(
      `/attempts?examId=${selectedExamId}`,
    )
      .then((data) => {
        if (!cancelled)
          setAttempts(
            data.filter((a) => a.status === 'SUBMITTED'),
          );
      })
      .catch(() => {
        if (!cancelled) setAttempts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedExamId]);

  useEffect(() => {
    if (!selectedAttemptId) return;
    let cancelled = false;
    api<ReviewResponse>(`/attempts/${selectedAttemptId}/review`)
      .then((data) => {
        if (!cancelled) setReview(data.questions ?? []);
      })
      .catch(() => {
        if (!cancelled) setReview([]);
      })
      .finally(() => {
        if (!cancelled) setReviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedAttemptId]);

  const selectedExam = exams.find((e) => e.id === selectedExamId);
  const selectedAttempt = attempts.find(
    (a) => a.id === selectedAttemptId,
  );
  const ungradedCount = attempts.filter(
    (a) => a.score == null,
  ).length;

  async function handleSave(goNext: boolean) {
    if (!selectedAttemptId) return;
    setSaving(true);
    try {
      await api(`/attempts/${selectedAttemptId}/score`, {
        method: 'PATCH',
        body: JSON.stringify({ score }),
      });
      if (feedback.trim()) {
        await api(`/attempts/${selectedAttemptId}/feedback`, {
          method: 'PATCH',
          body: JSON.stringify({ feedback }),
        });
      }
      await fetchAttempts();
      if (goNext) {
        const currentIdx = attempts.findIndex(
          (a) => a.id === selectedAttemptId,
        );
        const nextUngraded = attempts.find(
          (a, i) => i > currentIdx && a.score == null,
        );
        if (nextUngraded) {
          handleSelectAttempt(nextUngraded);
        }
      }
    } catch {
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || loading) {
    return <EmptyState type="loading" />;
  }

  if (user?.role !== 'TEACHER') {
    return (
      <EmptyState
        type="error"
        title="Không có quyền truy cập"
        text="Trang này chỉ dành cho giáo viên."
      />
    );
  }

  if (exams.length === 0) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="Chấm bài"
          description="Đánh giá bài làm, phản hồi và trả kết quả cho học sinh."
        />
        <EmptyState
          title="Chưa có đề thi"
          text="Bạn cần tạo và xuất bản đề thi trước khi chấm bài."
        />
      </div>
    );
  }

  function getInitials(name: string) {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Chấm bài"
        description="Đánh giá bài làm, phản hồi và trả kết quả cho học sinh."
      />

      <div className="grid gap-4 lg:grid-cols-[280px_1fr_300px]">
        {/* Left panel — student list */}
        <Card className="flex flex-col gap-0 p-0">
          <div className="border-b p-3">
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={selectedExamId}
              onChange={(e) => handleExamChange(e.target.value)}
            >
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.title}
                </option>
              ))}
            </select>
            {selectedExam && ungradedCount > 0 && (
              <Badge
                variant="secondary"
                className="mt-2 bg-orange-500/10 text-orange-600"
              >
                {ungradedCount} chưa chấm
              </Badge>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {attempts.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Chưa có bài nộp
              </div>
            ) : (
              attempts.map((attempt) => (
                <button
                  key={attempt.id}
                  onClick={() => handleSelectAttempt(attempt)}
                  className={`flex w-full items-center gap-3 border-b px-3 py-2.5 text-left transition-colors hover:bg-accent/50 ${
                    selectedAttemptId === attempt.id
                      ? 'bg-accent'
                      : ''
                  }`}
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="text-[10px]">
                      {getInitials(attempt.student.displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {attempt.student.displayName}
                    </p>
                    <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {attempt.submittedAt
                        ? new Date(
                            attempt.submittedAt,
                          ).toLocaleString('vi-VN')
                        : '—'}
                    </p>
                  </div>
                  {attempt.score != null ? (
                    <Badge
                      variant="secondary"
                      className="shrink-0 bg-green-500/10 text-green-600"
                    >
                      {Number(attempt.score).toFixed(1)}
                    </Badge>
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                </button>
              ))
            )}
          </div>
        </Card>

        {/* Center panel — answer paper */}
        <Card className="min-h-[400px] p-4">
          {!selectedAttemptId ? (
            <EmptyState
              icon={FileText}
              title="Chọn bài làm"
              text="Chọn một học sinh ở bên trái để xem bài làm."
            />
          ) : reviewLoading ? (
            <EmptyState type="loading" />
          ) : review.length === 0 ? (
            <EmptyState
              title="Không có dữ liệu"
              text="Không thể tải bài làm của học sinh."
            />
          ) : (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground">
                Bài làm của {selectedAttempt?.student.displayName}
              </h3>
              {review.map((item) => (
                <div
                  key={item.position}
                  className="rounded-lg border p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">
                      Câu {item.position}: {item.content}
                    </p>
                    <Badge
                      variant={
                        item.isCorrect ? 'default' : 'destructive'
                      }
                      className="shrink-0 text-[10px]"
                    >
                      {item.earnedPoints}/{item.points}
                    </Badge>
                  </div>
                  {item.options ? (
                    <div className="mt-2 space-y-1">
                      {item.options.map((opt) => {
                        const isCorrect =
                          opt.id === item.correctOptionId;
                        const isSelected =
                          opt.id === item.selectedOptionId;
                        return (
                          <div
                            key={opt.id}
                            className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${
                              isCorrect ? 'bg-green-500/10' : ''
                            } ${isSelected && !isCorrect ? 'bg-red-500/10' : ''}`}
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
                            <span>{opt.content}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-2 rounded border bg-muted/50 p-2 text-sm italic">
                      {item.selectedOptionId ||
                        '(Không có câu trả lời)'}
                    </div>
                  )}
                  {item.feedback && (
                    <p className="mt-1 text-xs text-muted-foreground italic">
                      Nhận xét: {item.feedback}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Right panel — scoring */}
        <Card className="flex flex-col gap-4 p-4">
          <h3 className="text-sm font-semibold">Chấm điểm</h3>

          {selectedAttemptId ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="score">Điểm số</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="score"
                    type="number"
                    value={score}
                    onChange={(e) => setScore(Number(e.target.value))}
                    min={0}
                    max={10}
                    step={0.1}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">
                    / 10
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="feedback">Nhận xét</Label>
                <Textarea
                  id="feedback"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Nhận xét cho học sinh..."
                  rows={4}
                />
              </div>

              <div className="mt-auto flex flex-col gap-2">
                <Button
                  onClick={() => handleSave(false)}
                  disabled={saving}
                >
                  {saving ? 'Đang lưu...' : 'Lưu và trả bài'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleSave(true)}
                  disabled={saving}
                >
                  Lưu, chấm bài tiếp theo
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Chọn bài làm để chấm điểm.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
