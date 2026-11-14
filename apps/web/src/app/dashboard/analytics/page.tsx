'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { SectionHeader } from '@/components/ui/section-header';
import { StatCard } from '@/components/ui/stat-card';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3,
  TrendingUp,
  Clock,
  Target,
  Trophy,
} from 'lucide-react';

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
  const { user } = useAuth();
  const isTeacher = user?.role === 'TEACHER';

  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassroom, setSelectedClassroom] =
    useState<string>('');
  const [classroomStats, setClassroomStats] =
    useState<ClassroomStats | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState<string>('');
  const [distribution, setDistribution] = useState<DistBucket[]>([]);
  const [questionStats, setQuestionStats] = useState<QuestionStat[]>(
    [],
  );

  useEffect(() => {
    api<Classroom[]>('/classrooms').then(setClassrooms).catch(() => {});
    api<Exam[]>('/exams').then(setExams).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedClassroom) {
      setClassroomStats(null);
      return;
    }
    api<ClassroomStats>(
      `/analytics/classrooms/${selectedClassroom}`,
    )
      .then(setClassroomStats)
      .catch(() => setClassroomStats(null));
  }, [selectedClassroom]);

  useEffect(() => {
    if (!selectedExam) {
      setDistribution([]);
      setQuestionStats([]);
      return;
    }
    api<{ buckets: DistBucket[] }>(
      `/analytics/exams/${selectedExam}/distribution`,
    )
      .then((r) => setDistribution(r.buckets))
      .catch(() => setDistribution([]));
    api<QuestionStat[]>(
      `/analytics/exams/${selectedExam}/questions`,
    )
      .then(setQuestionStats)
      .catch(() => setQuestionStats([]));
  }, [selectedExam]);

  const maxBucket = Math.max(
    ...distribution.map((b) => b.count),
    1,
  );

  return (
    <div className="space-y-6">
      <SectionHeader
        title={isTeacher ? 'Phân tích học tập' : 'Tiến độ học tập'}
        description={
          isTeacher
            ? 'Tổng quan kết quả và hiệu suất học tập của lớp.'
            : 'Theo dõi kết quả và tiến bộ học tập của bạn.'
        }
        action={
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={selectedClassroom}
            onChange={(e) => setSelectedClassroom(e.target.value)}
          >
            <option value="">-- Chọn lớp --</option>
            {classrooms.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        }
      />

      {/* Stats row */}
      {classroomStats && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={TrendingUp}
            label="Điểm trung bình"
            value={classroomStats.avgScore?.toFixed(1) ?? '—'}
            tone="blue"
          />
          <StatCard
            icon={Target}
            label="Tỷ lệ hoàn thành"
            value={`${Math.round(classroomStats.submissionRate * 100)}%`}
            tone="violet"
          />
          <StatCard
            icon={Clock}
            label="Tổng bài nộp"
            value={String(classroomStats.totalAttempts)}
            tone="orange"
          />
          <StatCard
            icon={Trophy}
            label="Điểm cao nhất"
            value={classroomStats.highestScore?.toFixed(1) ?? '—'}
            tone="green"
          />
        </div>
      )}

      {/* Exam selector */}
      <div>
        <select
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={selectedExam}
          onChange={(e) => setSelectedExam(e.target.value)}
        >
          <option value="">-- Chọn đề thi --</option>
          {exams
            .filter((e) => e.status === 'PUBLISHED')
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
        </select>
      </div>

      {/* Two-column grid */}
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* Left — score distribution chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" />
              Xu hướng kết quả
            </CardTitle>
          </CardHeader>
          <CardContent>
            {distribution.length > 0 ? (
              <div className="space-y-3">
                <svg
                  viewBox="0 0 400 160"
                  className="w-full"
                  preserveAspectRatio="xMidYMid meet"
                >
                  <defs>
                    <linearGradient
                      id="chartGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="var(--primary)"
                        stopOpacity="0.3"
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--primary)"
                        stopOpacity="0.02"
                      />
                    </linearGradient>
                  </defs>
                  {(() => {
                    const barW =
                      360 / Math.max(distribution.length, 1);
                    const gap = 4;
                    return distribution.map((b, i) => {
                      const h = (b.count / maxBucket) * 120;
                      return (
                        <g key={b.range}>
                          <rect
                            x={20 + i * barW + gap / 2}
                            y={140 - h}
                            width={Math.max(barW - gap, 4)}
                            height={h}
                            rx={3}
                            fill="var(--primary)"
                            opacity={0.8}
                          />
                          <text
                            x={20 + i * barW + barW / 2}
                            y={155}
                            textAnchor="middle"
                            fontSize="8"
                            fill="var(--muted-foreground)"
                          >
                            {b.range}
                          </text>
                        </g>
                      );
                    });
                  })()}
                </svg>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary" />
                    Số lượng học sinh
                  </span>
                </div>
              </div>
            ) : (
              <EmptyState
                title="Chưa có dữ liệu"
                text="Chọn đề thi để xem phân bố điểm."
              />
            )}
          </CardContent>
        </Card>

        {/* Right — question accuracy / skill bars */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4" />
              Năng lực theo câu hỏi
            </CardTitle>
          </CardHeader>
          <CardContent>
            {questionStats.length > 0 ? (
              <div className="space-y-3">
                {questionStats.map((q) => {
                  const pct = (q.correctRate ?? 0) * 100;
                  return (
                    <div key={q.questionId} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate font-medium">
                          C{q.position}
                        </span>
                        <span className="shrink-0 text-muted-foreground">
                          {q.correctRate !== null
                            ? `${Math.round(pct)}%`
                            : '—'}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full transition-all ${
                            pct < 30
                              ? 'bg-destructive'
                              : pct < 60
                                ? 'bg-yellow-500'
                                : 'bg-green-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {q.totalAnswered} trả lời
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="Chưa có dữ liệu"
                text="Chọn đề thi để xem năng lực."
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ranking section */}
      {classroomStats && classroomStats.totalAttempts > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4" />
              Bảng xếp hạng
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {classroomStats.memberCount} học sinh &middot;{' '}
              {classroomStats.totalAttempts} bài nộp &middot; Điểm
              TB: {classroomStats.avgScore?.toFixed(1) ?? '—'}
            </p>
            <div className="mt-3 flex items-center gap-4 text-sm">
              <Badge className="bg-green-500/10 text-green-600">
                Cao nhất:{' '}
                {classroomStats.highestScore?.toFixed(1) ?? '—'}
              </Badge>
              <Badge className="bg-orange-500/10 text-orange-600">
                Thấp nhất:{' '}
                {classroomStats.lowestScore?.toFixed(1) ?? '—'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
