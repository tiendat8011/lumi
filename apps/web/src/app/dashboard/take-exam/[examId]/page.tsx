'use client';

import {
  Suspense,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import {
  useParams,
  useSearchParams,
  useRouter,
} from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Logo } from '@/components/ui/logo';
import {
  Clock,
  Send,
  AlertTriangle,
  BookOpen,
  HelpCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Headphones,
  Mic,
  Square,
  RotateCcw,
} from 'lucide-react';

export default function TakeExamPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
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
  optionsSnapshot: OptionSnapshot[] | null;
  typeSnapshot?: string;
  points: number;
  position: number;
  audioUrlSnapshot?: string | null;
  passageSnapshot?: string | null;
  imageUrlSnapshot?: string | null;
}

interface Answer {
  examQuestionId: string;
  answerPayload: Record<string, unknown>;
}

interface Attempt {
  id: string;
  status: 'IN_PROGRESS' | 'SUBMITTED';
  expiresAt: string;
  score?: string | null;
  /** POST /attempts/start returns only these two fields under `exam`. */
  exam: {
    title: string;
    instructions: string | null;
  };
  /** The questions come back at the top level, NOT under `exam`. */
  questions: ExamQuestion[];
  answers: Answer[];
  /**
   * Filled in from the submit response. Whether a student may see a score is
   * decided by canStudentSeeResults on the server — showResultImmediately OR
   * resultsReleased, and the assignment not hiding them. The client takes that
   * answer and must not re-derive it from a single flag, which is what this
   * screen used to do.
   */
  resultsHidden?: boolean;
}

/** POST /attempts/:id/submit — a different shape from Attempt. */
interface SubmitResult {
  id: string;
  status: 'SUBMITTED';
  submittedAt: string;
  score?: string | null;
  resultsHidden: boolean;
}

type AnswerValue = string | string[] | { text: string };

const QUESTION_TYPE_LABELS: Record<string, string> = {
  MCQ: 'Trắc nghiệm',
  LISTENING_MCQ: 'Trắc nghiệm',
  READING_MCQ: 'Trắc nghiệm',
  TRUE_FALSE: 'Đúng/Sai',
  SHORT_ANSWER: 'Điền đáp án',
  FILL_BLANK: 'Điền đáp án',
  LISTENING_FILL: 'Điền đáp án',
  READING_FILL: 'Điền đáp án',
  ESSAY: 'Tự luận',
  SPEAKING: 'Nói',
  MCQ_MULTI: 'Chọn nhiều đáp án',
};

function isOptionType(type?: string): boolean {
  return (
    !type ||
    type === 'MCQ' ||
    type === 'TRUE_FALSE' ||
    type === 'LISTENING_MCQ' ||
    type === 'READING_MCQ' ||
    type === 'MCQ_MULTI'
  );
}

function isAnswered(val: AnswerValue | undefined): boolean {
  if (!val) return false;
  if (typeof val === 'string') return true;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === 'object' && 'text' in val)
    return val.text.trim().length > 0;
  return false;
}

function parseAnswerPayload(
  payload: Record<string, unknown>,
): AnswerValue | undefined {
  if (payload.selectedOptionId) {
    return payload.selectedOptionId as string;
  }
  if (
    Array.isArray(payload.selectedOptionIds) &&
    payload.selectedOptionIds.length > 0
  ) {
    return payload.selectedOptionIds as string[];
  }
  if (typeof payload.text === 'string' && payload.text) {
    return { text: payload.text };
  }
  return undefined;
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:4000/api';

function TakeExamPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const examId = params.examId as string;
  const assignmentId = searchParams.get('assignmentId');

  const [attempt, setAttempt] = useState<Attempt | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [showInstructions, setShowInstructions] =
    useState(false);
  const [answers, setAnswers] = useState<
    Record<string, AnswerValue>
  >({});
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const timerRef = useRef<
    ReturnType<typeof setInterval> | null
  >(null);
  const debounceRef = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});

  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] =
    useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(
    null,
  );
  const [uploadingAudio, setUploadingAudio] =
    useState(false);
  const mediaRecorderRef =
    useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<ReturnType<
    typeof setInterval
  > | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Guards the submit against a second in-flight call. A ref rather than the
  // `submitting` state because the auto-submit on expiry and a click on "Nộp
  // bài" can land in the same tick, where both would still read the old state.
  const submitInFlightRef = useRef(false);

  const handleSubmit = useCallback(async () => {
    if (!attempt || submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    setSubmitting(true);
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      const result = await api<SubmitResult>(
        `/attempts/${attempt.id}/submit`,
        { method: 'POST' },
      );
      setAttempt({
        ...attempt,
        status: 'SUBMITTED',
        score: result.score,
        resultsHidden: result.resultsHidden,
      });
    } catch {
      // ignore
    } finally {
      submitInFlightRef.current = false;
      setSubmitting(false);
    }
  }, [attempt]);

  const handleSaveAnswer = useCallback(
    async (
      examQuestionId: string,
      payload: Record<string, unknown>,
    ) => {
      if (!attempt || attempt.status === 'SUBMITTED')
        return;
      const val = parseAnswerPayload(payload);
      if (val !== undefined) {
        setAnswers((prev) => ({
          ...prev,
          [examQuestionId]: val,
        }));
      }
      try {
        await api(`/attempts/${attempt.id}/answer`, {
          method: 'POST',
          body: JSON.stringify({
            examQuestionId,
            ...payload,
          }),
        });
      } catch {
        // ignore
      }
    },
    [attempt],
  );

  const startAttempt = useCallback(async () => {
    try {
      const data = await api<Attempt>('/attempts/start', {
        method: 'POST',
        body: JSON.stringify({ examId, assignmentId }),
      });
      setAttempt(data);

      if (
        data.exam.instructions &&
        data.answers.length === 0
      ) {
        setShowInstructions(true);
      }

      const savedAnswers: Record<string, AnswerValue> = {};
      data.answers?.forEach((a) => {
        const val = parseAnswerPayload(a.answerPayload);
        if (val !== undefined) {
          savedAnswers[a.examQuestionId] = val;
        }
      });
      setAnswers(savedAnswers);

      const expires = new Date(data.expiresAt).getTime();
      setTimeLeft(
        Math.max(
          0,
          Math.floor((expires - Date.now()) / 1000),
        ),
      );
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : 'Failed to start exam',
      );
      router.push('/dashboard/assignments');
    } finally {
      setLoading(false);
    }
  }, [examId, assignmentId, router]);

  useEffect(() => {
    void (async () => {
      await startAttempt();
    })();
  }, [startAttempt]);

  // The countdown only counts. It used to call the submit from inside the
  // setTimeLeft updater, which has to be a pure function of the previous
  // value — React may run it more than once per tick, which could fire a
  // second submit. Reaching zero is now handled by the effect below.
  useEffect(() => {
    if (
      !attempt ||
      attempt.status === 'SUBMITTED' ||
      showInstructions
    )
      return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    timerRef.current = interval;
    return () => clearInterval(interval);
  }, [attempt, showInstructions]);

  // Auto-submit when the countdown reaches zero. `handleSubmit` is guarded by
  // submitInFlightRef, so this submits exactly once.
  useEffect(() => {
    if (
      !attempt ||
      attempt.status === 'SUBMITTED' ||
      showInstructions ||
      timeLeft > 0
    )
      return;
    void (async () => {
      await handleSubmit();
    })();
  }, [attempt, showInstructions, timeLeft, handleSubmit]);

  useEffect(() => {
    if (!attempt || attempt.status !== 'IN_PROGRESS')
      return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        api(`/attempts/${attempt.id}/exit-log`, {
          method: 'POST',
        }).catch(() => {});
      } else {
        api(`/attempts/${attempt.id}/return-log`, {
          method: 'POST',
        }).catch(() => {});
      }
    };

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    );
    return () =>
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      );
  }, [attempt]);

  const handleSelectAnswer = useCallback(
    (examQuestionId: string, optionId: string) => {
      handleSaveAnswer(examQuestionId, {
        selectedOptionId: optionId,
      });
    },
    [handleSaveAnswer],
  );

  const handleToggleMulti = useCallback(
    (examQuestionId: string, optionId: string) => {
      if (!attempt || attempt.status === 'SUBMITTED')
        return;
      setAnswers((prev) => {
        const current = prev[examQuestionId];
        let selected: string[] = [];
        if (Array.isArray(current)) {
          selected = [...current];
        }
        const idx = selected.indexOf(optionId);
        if (idx >= 0) {
          selected.splice(idx, 1);
        } else {
          selected.push(optionId);
        }
        const next = {
          ...prev,
          [examQuestionId]: selected,
        };
        handleSaveAnswer(examQuestionId, {
          selectedOptionIds: selected,
        });
        return next;
      });
    },
    [attempt, handleSaveAnswer],
  );

  const handleTextChange = useCallback(
    (
      examQuestionId: string,
      text: string,
      delayMs: number,
    ) => {
      if (!attempt || attempt.status === 'SUBMITTED')
        return;
      setAnswers((prev) => ({
        ...prev,
        [examQuestionId]: { text },
      }));
      if (debounceRef.current[examQuestionId]) {
        clearTimeout(debounceRef.current[examQuestionId]);
      }
      debounceRef.current[examQuestionId] = setTimeout(
        () => {
          handleSaveAnswer(examQuestionId, { text });
        },
        delayMs,
      );
    },
    [attempt, handleSaveAnswer],
  );

  const handleTextBlur = useCallback(
    (examQuestionId: string, text: string) => {
      if (debounceRef.current[examQuestionId]) {
        clearTimeout(debounceRef.current[examQuestionId]);
        delete debounceRef.current[examQuestionId];
      }
      if (!attempt || attempt.status === 'SUBMITTED')
        return;
      handleSaveAnswer(examQuestionId, { text });
    },
    [attempt, handleSaveAnswer],
  );

  const startRecording = useCallback(async () => {
    try {
      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, {
          type: 'audio/webm',
        });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      setRecording(true);
      setRecordingTime(0);
      setAudioBlob(null);
      setAudioUrl(null);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch {
      alert(
        'Không thể truy cập microphone. Vui lòng cho phép quyền truy cập.',
      );
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }, []);

  const uploadAudio = useCallback(
    async (examQuestionId: string, blob: Blob) => {
      if (!attempt) return;
      setUploadingAudio(true);
      try {
        const token =
          typeof window !== 'undefined'
            ? localStorage.getItem('accessToken')
            : null;
        const form = new FormData();
        form.append('file', blob, 'recording.webm');
        const res = await fetch(
          `${API_BASE}/uploads/student-audio`,
          {
            method: 'POST',
            headers: token
              ? { Authorization: `Bearer ${token}` }
              : {},
            body: form,
          },
        );
        if (!res.ok)
          throw new Error('Upload thất bại');
        const json = await res.json();
        const url = json.data?.url || json.data;
        handleSaveAnswer(examQuestionId, {
          text: url,
        });
      } catch {
        alert('Không thể tải lên bản ghi âm.');
      } finally {
        setUploadingAudio(false);
      }
    },
    [attempt, handleSaveAnswer],
  );

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">
            Đang tải đề thi...
          </p>
        </div>
      </div>
    );
  }

  if (!attempt) return null;

  if (showInstructions && attempt.exam.instructions) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-xl space-y-6">
          <div className="text-center">
            <BookOpen className="mx-auto h-12 w-12 text-primary" />
            <h1 className="mt-4 text-2xl font-bold">
              {attempt.exam.title}
            </h1>
          </div>
          <div className="rounded-xl border bg-card p-6">
            <h2 className="text-sm font-semibold">
              Hướng dẫn làm bài
            </h2>
            <div className="prose prose-sm dark:prose-invert mt-3 whitespace-pre-wrap">
              {attempt.exam.instructions}
            </div>
          </div>
          <div className="text-center text-sm text-muted-foreground">
            Thời gian: {Math.round(timeLeft / 60)} phút
          </div>
          <Button
            onClick={() => setShowInstructions(false)}
            className="w-full"
            size="lg"
          >
            Bắt đầu làm bài
          </Button>
        </div>
      </div>
    );
  }

  if (attempt.status === 'SUBMITTED') {
    const answeredCount = Object.values(answers).filter(
      (v) => isAnswered(v),
    ).length;
    const totalQuestions = attempt.questions.length;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <Badge className="bg-green-500/10 text-green-600">
            NỘP BÀI THÀNH CÔNG
          </Badge>
          <h1 className="text-2xl font-bold">
            Bạn đã hoàn thành bài kiểm tra!
          </h1>
          <p className="text-sm text-muted-foreground">
            Thời gian nộp:{' '}
            {new Date().toLocaleString('vi-VN')}
          </p>

          {attempt.score != null &&
            !attempt.resultsHidden && (
              <p className="text-lg">
                Điểm:{' '}
                <span className="text-2xl font-bold text-primary">
                  {Number(attempt.score).toFixed(1)}
                </span>{' '}
                / 10
              </p>
            )}

          <div className="rounded-xl border bg-card p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">
                  Số câu đã làm
                </p>
                <p className="text-lg font-bold">
                  {answeredCount}/{totalQuestions}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Thời gian
                </p>
                <p className="text-lg font-bold">
                  {timeLeft <= 0 ? 'Hết giờ' : 'Đã nộp'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Mã bài
                </p>
                <p className="font-mono text-lg font-bold">
                  {attempt.id.slice(0, 6).toUpperCase()}
                </p>
              </div>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            {attempt.resultsHidden
              ? 'Giáo viên sẽ công bố kết quả sau.'
              : 'Xem kết quả chi tiết trong mục Kết quả.'}
          </p>
          <Button
            onClick={() =>
              router.push('/dashboard/assignments')
            }
            className="w-full"
          >
            Quay lại danh sách
          </Button>
        </div>
      </div>
    );
  }

  const questions = attempt.questions;
  const answeredCount = Object.values(answers).filter(
    (v) => isAnswered(v),
  ).length;
  const isLowTime = timeLeft < 60;
  const currentQuestion = questions[currentIdx];
  const progressPct = Math.round(
    (answeredCount / questions.length) * 100,
  );

  const qType = currentQuestion?.typeSnapshot;
  const currentAnswer = currentQuestion
    ? answers[currentQuestion.id]
    : undefined;
  const currentTextValue =
    currentAnswer &&
    typeof currentAnswer === 'object' &&
    !Array.isArray(currentAnswer) &&
    'text' in currentAnswer
      ? currentAnswer.text
      : '';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-4 border-b bg-card px-4">
        <Logo className="hidden sm:flex" />
        <div className="hidden h-6 w-px bg-border sm:block" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {attempt.exam.title}
          </p>
          <p className="text-[10px] text-muted-foreground">
            Tự động lưu
          </p>
        </div>
        <div
          className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium ${isLowTime ? 'bg-red-500/10 text-red-600' : 'bg-muted'}`}
        >
          {isLowTime && (
            <AlertTriangle className="h-3.5 w-3.5" />
          )}
          <Clock className="h-3.5 w-3.5" />
          <span className="hidden text-[10px] text-muted-foreground sm:inline">
            Thời gian còn lại
          </span>
          <span className="font-mono font-bold">
            {formatTime(timeLeft)}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — question navigator */}
        <aside className="hidden w-64 shrink-0 flex-col border-r bg-card md:flex">
          <div className="p-4">
            <h3 className="text-sm font-semibold">
              Danh sách câu hỏi
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto px-4">
            <div className="grid grid-cols-5 gap-1.5">
              {questions.map((q, i) => {
                const answered = isAnswered(answers[q.id]);
                const isCurrent = i === currentIdx;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setCurrentIdx(i)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                      isCurrent
                        ? 'bg-primary text-primary-foreground ring-2 ring-primary/30'
                        : answered
                          ? 'bg-primary/10 text-primary'
                          : 'border bg-background hover:bg-muted'
                    }`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-4 space-y-2 text-[10px]">
              <div className="flex items-center gap-2">
                <span className="flex h-4 w-4 items-center justify-center rounded bg-primary text-[8px] text-primary-foreground">
                  1
                </span>
                <span className="text-muted-foreground">
                  Đang xem
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex h-4 w-4 items-center justify-center rounded bg-primary/10 text-[8px] text-primary">
                  2
                </span>
                <span className="text-muted-foreground">
                  Đã trả lời
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex h-4 w-4 items-center justify-center rounded border bg-background text-[8px]">
                  3
                </span>
                <span className="text-muted-foreground">
                  Chưa trả lời
                </span>
              </div>
            </div>
          </div>

          {/* Progress + submit */}
          <div className="space-y-3 border-t p-4">
            <div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Tiến độ</span>
                <span>{progressPct}%</span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {answeredCount}/{questions.length} câu đã
                trả lời
              </p>
            </div>
            <Button
              onClick={() => {
                if (confirm('Bạn có chắc muốn nộp bài?'))
                  handleSubmit();
              }}
              disabled={submitting}
              className="w-full"
            >
              <Send className="mr-2 h-4 w-4" />
              {submitting ? 'Đang nộp...' : 'Nộp bài'}
            </Button>
          </div>
        </aside>

        {/* Main area */}
        <main className="flex-1 overflow-y-auto">
          {currentQuestion && (
            <div className="mx-auto max-w-2xl p-4 md:p-8">
              <div className="mb-6">
                <div className="mb-3 flex items-center gap-2">
                  <Badge variant="outline">
                    Câu {currentIdx + 1} /{' '}
                    {questions.length}
                  </Badge>
                  {qType &&
                    QUESTION_TYPE_LABELS[qType] && (
                      <Badge
                        variant="outline"
                        className="text-muted-foreground"
                      >
                        {QUESTION_TYPE_LABELS[qType]}
                      </Badge>
                    )}
                </div>

                {/* Audio player for listening questions */}
                {currentQuestion.audioUrlSnapshot && (
                  <div className="mb-4 rounded-xl border bg-muted/60 p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                      <Headphones className="h-4 w-4" />
                      Nghe đoạn audio và trả lời câu hỏi
                    </div>
                    <audio
                      controls
                      src={
                        currentQuestion.audioUrlSnapshot
                      }
                      className="w-full"
                    />
                  </div>
                )}

                {/* Passage for reading questions */}
                {currentQuestion.passageSnapshot && (
                  <div className="mb-4 rounded-xl border bg-muted/60 p-5">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                      <BookOpen className="h-4 w-4" />
                      Đọc đoạn văn sau
                    </div>
                    <div className="prose prose-sm max-w-none whitespace-pre-wrap leading-relaxed text-foreground">
                      {currentQuestion.passageSnapshot}
                    </div>
                  </div>
                )}

                {/* Image */}
                {currentQuestion.imageUrlSnapshot && (
                  <div className="mb-4">
                    {/*
                      next/image is deliberately not used here. The image is a
                      teacher upload served from the API host, which comes from
                      NEXT_PUBLIC_API_URL at runtime and differs per deployment
                      (localhost in dev, a service hostname in Docker and on
                      Render). images.remotePatterns is build-time config, so
                      there is no correct pattern to declare for it. Routing
                      exam images through the optimizer would also add a second
                      host that has to be up while a timed attempt is running.
                    */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        currentQuestion.imageUrlSnapshot
                      }
                      alt="Hình minh họa"
                      className="max-h-64 rounded-lg object-contain"
                    />
                  </div>
                )}

                <p className="text-lg font-medium leading-relaxed">
                  {currentQuestion.contentSnapshot}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {currentQuestion.points} điểm
                </p>
              </div>

              {/* MCQ / TRUE_FALSE / LISTENING_MCQ / READING_MCQ single-select options */}
              {isOptionType(qType) &&
                qType !== 'MCQ_MULTI' &&
                qType !== 'TRUE_FALSE' && (
                  <div className="space-y-3">
                    {(
                      currentQuestion.optionsSnapshot || []
                    ).map((opt, i) => {
                      const selected =
                        typeof currentAnswer === 'string'
                          ? currentAnswer === opt.id
                          : false;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            handleSelectAnswer(
                              currentQuestion.id,
                              opt.id,
                            )
                          }
                          className={`flex w-full items-center gap-4 rounded-xl border-2 px-5 py-4 text-left transition-all ${
                            selected
                              ? 'border-primary bg-primary/5 shadow-sm'
                              : 'border-transparent bg-card hover:border-border hover:bg-muted/50'
                          }`}
                        >
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors ${
                              selected
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-input'
                            }`}
                          >
                            {String.fromCharCode(65 + i)}
                          </span>
                          <span className="text-sm">
                            {opt.content}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

              {/* TRUE_FALSE — two large horizontal buttons */}
              {qType === 'TRUE_FALSE' && (
                <div className="grid grid-cols-2 gap-4">
                  {(
                    currentQuestion.optionsSnapshot || []
                  ).map((opt) => {
                    const selected =
                      typeof currentAnswer === 'string'
                        ? currentAnswer === opt.id
                        : false;
                    const label =
                      opt.content === 'Đúng' ||
                      opt.position === 0
                        ? 'Đúng'
                        : 'Sai';
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          handleSelectAnswer(
                            currentQuestion.id,
                            opt.id,
                          )
                        }
                        className={`flex items-center justify-center rounded-xl border-2 px-6 py-6 text-lg font-semibold transition-all ${
                          selected
                            ? 'border-primary bg-primary/5 shadow-sm'
                            : 'border-transparent bg-card hover:border-border hover:bg-muted/50'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* MCQ_MULTI — checkboxes */}
              {qType === 'MCQ_MULTI' && (
                <div className="space-y-3">
                  {(
                    currentQuestion.optionsSnapshot || []
                  ).map((opt, i) => {
                    const selectedIds = Array.isArray(
                      currentAnswer,
                    )
                      ? currentAnswer
                      : [];
                    const checked =
                      selectedIds.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          handleToggleMulti(
                            currentQuestion.id,
                            opt.id,
                          )
                        }
                        className={`flex w-full items-center gap-4 rounded-xl border-2 px-5 py-4 text-left transition-all ${
                          checked
                            ? 'border-primary bg-primary/5 shadow-sm'
                            : 'border-transparent bg-card hover:border-border hover:bg-muted/50'
                        }`}
                      >
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded border-2 text-sm font-semibold transition-colors ${
                            checked
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-input'
                          }`}
                        >
                          {checked
                            ? '✓'
                            : String.fromCharCode(
                                65 + i,
                              )}
                        </span>
                        <span className="text-sm">
                          {opt.content}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* SHORT_ANSWER / FILL_BLANK / LISTENING_FILL / READING_FILL */}
              {(qType === 'SHORT_ANSWER' ||
                qType === 'FILL_BLANK' ||
                qType === 'LISTENING_FILL' ||
                qType === 'READING_FILL') && (
                <div>
                  <input
                    type="text"
                    maxLength={1000}
                    value={currentTextValue}
                    onChange={(e) =>
                      handleTextChange(
                        currentQuestion.id,
                        e.target.value,
                        1500,
                      )
                    }
                    onBlur={() =>
                      handleTextBlur(
                        currentQuestion.id,
                        currentTextValue,
                      )
                    }
                    placeholder="Nhập đáp án của bạn..."
                    className="w-full rounded-xl border bg-card px-5 py-4 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              )}

              {/* ESSAY */}
              {qType === 'ESSAY' && (
                <div>
                  <textarea
                    maxLength={20000}
                    value={currentTextValue}
                    onChange={(e) =>
                      handleTextChange(
                        currentQuestion.id,
                        e.target.value,
                        2000,
                      )
                    }
                    onBlur={() =>
                      handleTextBlur(
                        currentQuestion.id,
                        currentTextValue,
                      )
                    }
                    placeholder="Viết câu trả lời của bạn..."
                    rows={8}
                    className="w-full resize-y rounded-xl border bg-card px-5 py-4 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <p className="mt-1 text-right text-xs text-muted-foreground">
                    {currentTextValue.length}/20000 ký tự
                  </p>
                </div>
              )}

              {/* SPEAKING — audio recorder */}
              {qType === 'SPEAKING' && (
                <div className="rounded-xl border bg-card p-6">
                  {!recording && !audioBlob && (
                    <div className="flex flex-col items-center gap-3">
                      <button
                        type="button"
                        onClick={startRecording}
                        aria-label="Bắt đầu ghi âm"
                        className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
                      >
                        <Mic className="h-8 w-8" />
                      </button>
                      <p className="text-sm text-muted-foreground">
                        Nhấn để ghi âm
                      </p>
                    </div>
                  )}
                  {recording && (
                    <div className="flex flex-col items-center gap-3">
                      <button
                        type="button"
                        onClick={stopRecording}
                        aria-label="Dừng ghi âm"
                        className="flex h-20 w-20 items-center justify-center rounded-full bg-foreground text-background transition-opacity hover:opacity-90"
                      >
                        <Square className="h-8 w-8" />
                      </button>
                      {/* Red carries the recording state as an indicator beside
                          a text label, not as the colour of the whole control:
                          destructive red means "error" everywhere else. */}
                      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <span
                          aria-hidden="true"
                          className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-red-600"
                        />
                        Đang ghi âm{' '}
                        <span className="tabular-nums">
                          {formatTime(recordingTime)}
                        </span>
                      </p>
                    </div>
                  )}
                  {!recording && audioBlob && (
                    <div className="flex flex-col items-center gap-4">
                      {audioUrl && (
                        <audio
                          controls
                          src={audioUrl}
                          className="w-full"
                        />
                      )}
                      <div className="flex items-center gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setAudioBlob(null);
                            setAudioUrl(null);
                            startRecording();
                          }}
                        >
                          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                          Ghi lại
                        </Button>
                        <Button
                          size="sm"
                          disabled={uploadingAudio}
                          onClick={() =>
                            uploadAudio(
                              currentQuestion.id,
                              audioBlob,
                            )
                          }
                        >
                          {uploadingAudio ? (
                            'Đang tải lên...'
                          ) : (
                            <>
                              <Send className="mr-1.5 h-3.5 w-3.5" />
                              Gửi bản ghi âm
                            </>
                          )}
                        </Button>
                      </div>
                      {isAnswered(
                        answers[currentQuestion.id],
                      ) && (
                        <p className="text-xs text-green-600">
                          Đã lưu bản ghi âm
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Prev/Next buttons */}
              <div className="mt-8 flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={() =>
                    setCurrentIdx((i) =>
                      Math.max(0, i - 1),
                    )
                  }
                  disabled={currentIdx === 0}
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Câu trước
                </Button>
                {currentIdx < questions.length - 1 ? (
                  <Button
                    onClick={() =>
                      setCurrentIdx((i) =>
                        Math.min(
                          questions.length - 1,
                          i + 1,
                        ),
                      )
                    }
                  >
                    Câu tiếp
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      if (
                        confirm(
                          'Bạn có chắc muốn nộp bài?',
                        )
                      )
                        handleSubmit();
                    }}
                    disabled={submitting}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    {submitting
                      ? 'Đang nộp...'
                      : 'Nộp bài'}
                  </Button>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Mobile bottom bar */}
      <div className="flex items-center gap-2 border-t bg-card p-3 md:hidden">
        <div className="flex flex-1 gap-1 overflow-x-auto">
          {questions.map((q, i) => {
            const answered = isAnswered(answers[q.id]);
            const isCurrent = i === currentIdx;
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => setCurrentIdx(i)}
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded text-xs font-medium ${
                  isCurrent
                    ? 'bg-primary text-primary-foreground'
                    : answered
                      ? 'bg-primary/10 text-primary'
                      : 'border bg-background'
                }`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
        <Button
          size="sm"
          onClick={() => {
            if (confirm('Bạn có chắc muốn nộp bài?'))
              handleSubmit();
          }}
          disabled={submitting}
        >
          <Send className="mr-1 h-3 w-3" />
          Nộp
        </Button>
      </div>
    </div>
  );
}
