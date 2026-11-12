'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Users, TrendingUp } from 'lucide-react';

interface Classroom {
  id: string;
  name: string;
}

interface ClassroomStats {
  memberCount: number;
  examCount: number;
  avgScore: number | null;
  highestScore: number | null;
  lowestScore: number | null;
  submissionRate: number;
  totalAttempts: number;
}

interface Exam {
  id: string;
  title: string;
  status: string;
}

interface DistBucket {
  range: string;
  count: number;
}

interface QuestionStat {
  questionId: string;
  position: number;
  content: string;
  totalAnswered: number;
  correctCount: number;
  correctRate: number | null;
}

export default function AnalyticsPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassroom, setSelectedClassroom] = useState<string>('');
  const [classroomStats, setClassroomStats] = useState<ClassroomStats | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState<string>('');
  const [distribution, setDistribution] = useState<DistBucket[]>([]);
  const [questionStats, setQuestionStats] = useState<QuestionStat[]>([]);

  useEffect(() => {
    api<Classroom[]>('/classrooms').then(setClassrooms).catch(() => {});
    api<Exam[]>('/exams').then(setExams).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedClassroom) { setClassroomStats(null); return; }
    api<ClassroomStats>(`/analytics/classrooms/${selectedClassroom}`)
      .then(setClassroomStats)
      .catch(() => setClassroomStats(null));
  }, [selectedClassroom]);

  useEffect(() => {
    if (!selectedExam) { setDistribution([]); setQuestionStats([]); return; }
    api<{ buckets: DistBucket[] }>(`/analytics/exams/${selectedExam}/distribution`)
      .then((r) => setDistribution(r.buckets))
      .catch(() => setDistribution([]));
    api<QuestionStat[]>(`/analytics/exams/${selectedExam}/questions`)
      .then(setQuestionStats)
      .catch(() => setQuestionStats([]));
  }, [selectedExam]);

  const maxBucket = Math.max(...distribution.map((b) => b.count), 1);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Thống kê</h1>

      {/* Classroom Stats */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2"><Users className="h-5 w-5" /> Thống kê lớp học</h2>
        <select
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={selectedClassroom}
          onChange={(e) => setSelectedClassroom(e.target.value)}
        >
          <option value="">-- Chọn lớp --</option>
          {classrooms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {classroomStats && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card><CardContent className="pt-4"><p className="text-2xl font-bold">{classroomStats.memberCount}</p><p className="text-sm text-muted-foreground">Học sinh</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-2xl font-bold">{classroomStats.examCount}</p><p className="text-sm text-muted-foreground">Bài thi</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-2xl font-bold">{classroomStats.avgScore?.toFixed(1) ?? '—'}</p><p className="text-sm text-muted-foreground">Điểm TB</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-2xl font-bold">{Math.round(classroomStats.submissionRate * 100)}%</p><p className="text-sm text-muted-foreground">Tỉ lệ nộp bài</p></CardContent></Card>
          </div>
        )}
      </section>

      {/* Exam Analytics */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Phân tích đề thi</h2>
        <select
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={selectedExam}
          onChange={(e) => setSelectedExam(e.target.value)}
        >
          <option value="">-- Chọn đề thi --</option>
          {exams.filter((e) => e.status === 'PUBLISHED').map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>

        {distribution.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Phân bố điểm</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-end gap-1" style={{ height: 120 }}>
                {distribution.map((b) => (
                  <div key={b.range} className="flex flex-1 flex-col items-center gap-1">
                    <div className="w-full rounded-t bg-primary transition-all" style={{ height: `${(b.count / maxBucket) * 100}%`, minHeight: b.count > 0 ? 4 : 0 }} />
                    <span className="text-[10px] text-muted-foreground">{b.range}</span>
                    <span className="text-[10px] font-medium">{b.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {questionStats.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Độ chính xác theo câu hỏi</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {questionStats.map((q) => (
                  <div key={q.questionId} className="flex items-center gap-3">
                    <span className="w-8 text-sm font-medium text-muted-foreground">C{q.position}</span>
                    <div className="flex-1">
                      <div className="h-4 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${(q.correctRate ?? 0) < 0.3 ? 'bg-destructive' : (q.correctRate ?? 0) < 0.6 ? 'bg-yellow-500' : 'bg-green-500'}`}
                          style={{ width: `${(q.correctRate ?? 0) * 100}%` }}
                        />
                      </div>
                    </div>
                    <span className="w-14 text-right text-sm">{q.correctRate !== null ? `${Math.round(q.correctRate * 100)}%` : '—'}</span>
                    <span className="w-12 text-right text-xs text-muted-foreground">{q.totalAnswered} trả lời</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
