'use client';

import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Send, AlertTriangle, BookOpen } from 'lucide-react';

export default function TakeExamPageWrapper() {
  return (
    <Suspense fallback={
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    }>
      <TakeExamPage />
    </Suspense>
  );
}

interface OptionSnapshot {
  id: string;
  content: string;
  isCorrect: boolean;
  position: number;
}

interface ExamQuestion {
  id: string;
  contentSnapshot: string;
  optionsSnapshot: OptionSnapshot[];
  points: number;
  position: number;
}

interface Answer {
  examQuestionId: string;
  answerPayload: { selectedOptionId: string };
}

interface Attempt {
  id: string;
  status: 'IN_PROGRESS' | 'SUBMITTED';
  expiresAt: string;
  score?: string | null;
  exam: {
    title: string;
    instructions: string | null;
    questions: ExamQuestion[];
    showResultImmediately: boolean;
    shuffleOptions: boolean;
  };
  answers: Answer[];
}

function TakeExamPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const examId = params.examId as string;
  const assignmentId = searchParams.get('assignmentId');

  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInstructions, setShowInstructions] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startAttempt = useCallback(async () => {
    try {
      const data = await api<Attempt>('/attempts/start', {
        method: 'POST',
        body: JSON.stringify({ examId, assignmentId }),
      });
      setAttempt(data);

      if (data.exam.instructions && data.answers.length === 0) {
        setShowInstructions(true);
      }

      const savedAnswers: Record<string, string> = {};
      data.answers?.forEach((a) => {
        savedAnswers[a.examQuestionId] = a.answerPayload.selectedOptionId;
      });
      setAnswers(savedAnswers);

      const expires = new Date(data.expiresAt).getTime();
      setTimeLeft(Math.max(0, Math.floor((expires - Date.now()) / 1000)));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to start exam');
      router.push('/dashboard/assignments');
    } finally {
      setLoading(false);
    }
  }, [examId, assignmentId, router]);

  useEffect(() => {
    startAttempt();
  }, [startAttempt]);

  useEffect(() => {
    if (!attempt || attempt.status === 'SUBMITTED' || showInstructions) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [attempt, showInstructions]);

  // Screen exit monitoring (P2)
  useEffect(() => {
    if (!attempt || attempt.status !== 'IN_PROGRESS') return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        api(`/attempts/${attempt.id}/exit-log`, { method: 'POST' }).catch(() => {});
      } else {
        api(`/attempts/${attempt.id}/return-log`, { method: 'POST' }).catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [attempt]);

  const handleSelectAnswer = async (examQuestionId: string, optionId: string) => {
    if (!attempt || attempt.status === 'SUBMITTED') return;
    setAnswers((prev) => ({ ...prev, [examQuestionId]: optionId }));
    try {
      await api(`/attempts/${attempt.id}/answer`, {
        method: 'POST',
        body: JSON.stringify({ examQuestionId, selectedOptionId: optionId }),
      });
    } catch {}
  };

  const handleSubmit = async () => {
    if (!attempt || submitting) return;
    setSubmitting(true);
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      const result = await api<Attempt>(`/attempts/${attempt.id}/submit`, { method: 'POST' });
      setAttempt({ ...attempt, status: 'SUBMITTED', score: result.score });
    } catch {} finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center space-y-3">
          <div className="h-10 w-10 mx-auto animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Đang tải đề thi...</p>
        </div>
      </div>
    );
  }

  if (!attempt) return null;

  // Instructions screen
  if (showInstructions && attempt.exam.instructions) {
    return (
      <div className="mx-auto max-w-xl space-y-6 py-12">
        <div className="text-center">
          <BookOpen className="mx-auto h-12 w-12 text-primary" />
          <h1 className="mt-4 text-2xl font-bold">{attempt.exam.title}</h1>
        </div>
        <Card>
          <CardHeader><CardTitle className="text-base">Hướng dẫn làm bài</CardTitle></CardHeader>
          <CardContent>
            <div className="prose prose-sm dark:prose-invert whitespace-pre-wrap">{attempt.exam.instructions}</div>
          </CardContent>
        </Card>
        <div className="text-center text-sm text-muted-foreground">
          Thời gian: {Math.round((new Date(attempt.expiresAt).getTime() - Date.now()) / 60000)} phút
        </div>
        <Button onClick={() => setShowInstructions(false)} className="w-full" size="lg">
          Bắt đầu làm bài
        </Button>
      </div>
    );
  }

  if (attempt.status === 'SUBMITTED') {
    return (
      <div className="mx-auto max-w-xl space-y-6 py-12 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
          <Send className="h-8 w-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold">Đã nộp bài!</h1>
        {attempt.score != null && attempt.exam.showResultImmediately && (
          <p className="text-lg">
            Điểm: <span className="text-2xl font-bold text-primary">{Number(attempt.score).toFixed(1)}</span> / 10
          </p>
        )}
        <p className="text-muted-foreground">
          {attempt.exam.showResultImmediately ? 'Xem kết quả chi tiết trong mục Kết quả.' : 'Giáo viên sẽ công bố kết quả sau.'}
        </p>
        <Button onClick={() => router.push('/dashboard/assignments')}>Quay lại danh sách</Button>
      </div>
    );
  }

  const questions = attempt.exam.questions;
  const answeredCount = Object.keys(answers).length;
  const isLowTime = timeLeft < 60;

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 -mx-4 -mt-4 border-b bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">{attempt.exam.title}</h1>
            <p className="text-xs text-muted-foreground">{answeredCount}/{questions.length} câu đã trả lời</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={isLowTime ? 'destructive' : 'outline'} className="flex items-center gap-1 text-base font-mono px-3 py-1">
              {isLowTime && <AlertTriangle className="h-3.5 w-3.5" />}
              <Clock className="h-3.5 w-3.5" />
              {formatTime(timeLeft)}
            </Badge>
            <Button onClick={() => { if (confirm('Bạn có chắc muốn nộp bài?')) handleSubmit(); }} disabled={submitting} size="sm">
              <Send className="mr-2 h-3.5 w-3.5" />
              {submitting ? 'Đang nộp...' : 'Nộp bài'}
            </Button>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {questions.map((q) => (
            <a key={q.id} href={`#q-${q.id}`} className={`flex h-7 w-7 items-center justify-center rounded text-xs font-medium transition-colors ${answers[q.id] ? 'bg-primary text-primary-foreground' : 'border bg-background hover:bg-muted'}`}>
              {q.position + 1}
            </a>
          ))}
        </div>
      </div>

      <div className="space-y-4 pb-20">
        {questions.map((q) => {
          const opts = q.optionsSnapshot || [];
          return (
            <Card key={q.id} id={`q-${q.id}`} className="scroll-mt-36">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Câu {q.position + 1} <span className="font-normal text-muted-foreground">({q.points} điểm)</span>
                </CardTitle>
                <p className="text-base mt-1">{q.contentSnapshot}</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {opts.map((opt, i) => {
                    const selected = answers[q.id] === opt.id;
                    return (
                      <button key={opt.id} type="button" onClick={() => handleSelectAnswer(q.id, opt.id)}
                        className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors ${selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50'}`}>
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-medium ${selected ? 'border-primary bg-primary text-primary-foreground' : 'border-input'}`}>
                          {String.fromCharCode(65 + i)}
                        </span>
                        <span>{opt.content}</span>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
