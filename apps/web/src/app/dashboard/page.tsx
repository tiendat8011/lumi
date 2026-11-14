'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { StatCard } from '@/components/ui/stat-card';
import { SectionHeader } from '@/components/ui/section-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Users,
  FileQuestion,
  ClipboardCheck,
  FileCheck2,
  Plus,
  UserPlus,
  BarChart3,
  Upload,
  BookOpen,
  Target,
  Clock3,
  Zap,
  ChevronRight,
} from 'lucide-react';

interface DashboardCounts {
  classrooms: number;
  questions: number;
  exams: number;
  assignments: number;
}

function useDashboardCounts() {
  const [counts, setCounts] = useState<DashboardCounts>({
    classrooms: 0,
    questions: 0,
    exams: 0,
    assignments: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCounts() {
      try {
        const results = await Promise.allSettled([
          api<{ items: unknown[]; total?: number }>(
            '/classrooms?page=1&limit=1',
          ),
          api<{ items: unknown[]; total?: number }>(
            '/questions?page=1&limit=1',
          ),
          api<{ items: unknown[]; total?: number }>(
            '/exams?page=1&limit=1',
          ),
          api<{ items: unknown[]; total?: number }>(
            '/assignments?page=1&limit=1',
          ),
        ]);
        setCounts({
          classrooms:
            results[0].status === 'fulfilled'
              ? (results[0].value.total ?? results[0].value.items?.length ?? 0)
              : 0,
          questions:
            results[1].status === 'fulfilled'
              ? (results[1].value.total ?? results[1].value.items?.length ?? 0)
              : 0,
          exams:
            results[2].status === 'fulfilled'
              ? (results[2].value.total ?? results[2].value.items?.length ?? 0)
              : 0,
          assignments:
            results[3].status === 'fulfilled'
              ? (results[3].value.total ?? results[3].value.items?.length ?? 0)
              : 0,
        });
      } catch {
        // keep defaults
      } finally {
        setLoading(false);
      }
    }
    fetchCounts();
  }, []);

  return { counts, loading };
}

function TeacherDashboard({
  displayName,
  counts,
}: {
  displayName: string;
  counts: DashboardCounts;
}) {
  const today = new Date();
  const dayName = today.toLocaleDateString('vi-VN', {
    weekday: 'long',
  });
  const dateStr = today.toLocaleDateString('vi-VN', {
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-primary">
            {dayName}, {dateStr}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            Xin chào, {displayName}!
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Quản lý lớp học và đề thi của bạn
          </p>
        </div>
        <Link href="/dashboard/exams">
          <Button>
            <Plus className="h-4 w-4" />
            Tạo bài kiểm tra
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Lớp học"
          value={String(counts.classrooms)}
          tone="blue"
        />
        <StatCard
          icon={FileQuestion}
          label="Câu hỏi"
          value={String(counts.questions)}
          tone="violet"
        />
        <StatCard
          icon={ClipboardCheck}
          label="Bài kiểm tra"
          value={String(counts.exams)}
          tone="orange"
        />
        <StatCard
          icon={FileCheck2}
          label="Bài tập"
          value={String(counts.assignments)}
          tone="cyan"
        />
      </div>

      {/* Quick actions */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <SectionHeader title="Thao tác nhanh" />
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <QuickAction
              href="/dashboard/classrooms"
              icon={UserPlus}
              label="Mời học sinh"
            />
            <QuickAction
              href="/dashboard/questions"
              icon={FileQuestion}
              label="Thêm câu hỏi"
            />
            <QuickAction
              href="/dashboard/assignments"
              icon={Upload}
              label="Giao bài tập"
            />
            <QuickAction
              href="/dashboard/analytics"
              icon={BarChart3}
              label="Xem báo cáo"
            />
          </div>
        </Card>
        <Card className="p-5">
          <SectionHeader
            title="Hoạt động gần đây"
            action={
              <Link href="/dashboard/grading">
                <Button variant="ghost" size="sm">
                  Xem tất cả
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            }
          />
          <div className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Chưa có hoạt động nào gần đây.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

function StudentDashboard({
  displayName,
  counts,
}: {
  displayName: string;
  counts: DashboardCounts;
}) {
  return (
    <div className="space-y-6">
      {/* Student hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#172554] via-[#1e40af] to-[#4338ca] p-6 text-white lg:p-8">
        <div className="relative z-10">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-400/20 px-2.5 py-1 text-[10px] font-extrabold text-cyan-300">
            <Zap className="h-3 w-3" />
            Chuỗi học tập
          </span>
          <h1 className="mt-3 text-xl font-bold tracking-tight lg:text-2xl">
            Sẵn sàng cho một ngày học tốt, {displayName}?
          </h1>
          <p className="mt-1.5 text-xs text-blue-200">
            Hoàn thành nhiệm vụ hôm nay để duy trì tiến độ của bạn.
          </p>
          <Link href="/dashboard/assignments" className="mt-4 block">
            <Button className="bg-white text-blue-700 hover:bg-blue-50">
              <BookOpen className="h-4 w-4" />
              Tiếp tục học
            </Button>
          </Link>
        </div>
        <div className="pointer-events-none absolute -right-16 -top-32 h-72 w-72 rounded-full border-[45px] border-white/[0.06]" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={BookOpen}
          label="Lớp đang học"
          value={String(counts.classrooms)}
          tone="blue"
        />
        <StatCard
          icon={ClipboardCheck}
          label="Bài sắp đến hạn"
          value={String(counts.assignments)}
          tone="orange"
        />
        <StatCard
          icon={Target}
          label="Bài kiểm tra"
          value={String(counts.exams)}
          tone="violet"
        />
        <StatCard
          icon={Clock3}
          label="Tổng bài tập"
          value={String(counts.assignments)}
          tone="cyan"
        />
      </div>

      {/* Content */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <SectionHeader
            title="Cần hoàn thành"
            action={
              <Link href="/dashboard/assignments">
                <Button variant="ghost" size="sm">
                  Xem tất cả
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            }
          />
          <div className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Chưa có bài tập nào cần hoàn thành.
            </p>
          </div>
        </Card>
        <Card className="p-5">
          <SectionHeader
            title="Kết quả gần đây"
            action={
              <Link href="/dashboard/my-results">
                <Button variant="ghost" size="sm">
                  Xem tất cả
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            }
          />
          <div className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Chưa có kết quả nào gần đây.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <Link href={href}>
      <button className="flex w-full flex-col items-center gap-2 rounded-xl border border-transparent bg-muted p-3.5 text-[11px] font-semibold transition-colors hover:border-blue-200 hover:text-primary dark:hover:border-blue-800">
        <span className="text-primary">
          <Icon className="h-5 w-5" />
        </span>
        {label}
      </button>
    </Link>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { counts } = useDashboardCounts();
  const isTeacher = user?.role === 'TEACHER';
  const displayName = user?.displayName || '';

  if (isTeacher) {
    return (
      <TeacherDashboard
        displayName={displayName}
        counts={counts}
      />
    );
  }

  return (
    <StudentDashboard displayName={displayName} counts={counts} />
  );
}
