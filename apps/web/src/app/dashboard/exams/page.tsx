'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { SectionHeader } from '@/components/ui/section-header';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Plus,
  Clock,
  FileQuestion,
  ClipboardCheck,
  Search,
  Play,
  ChevronRight,
  Users,
} from 'lucide-react';
import Link from 'next/link';

interface Exam {
  id: string;
  title: string;
  description: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  durationSeconds: number;
  maxAttempts: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  accessCode: string | null;
  _count?: { questions: number };
  createdAt: string;
  classroom?: { id: string; name: string };
}

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  DRAFT: {
    label: 'Bản nháp',
    className: 'bg-slate-500/10 text-slate-600',
  },
  PUBLISHED: {
    label: 'Đang diễn ra',
    className: 'bg-green-500/10 text-green-600',
  },
  ARCHIVED: {
    label: 'Đã kết thúc',
    className: 'bg-slate-500/10 text-slate-500',
  },
};

const ICON_TONES = [
  { bg: 'bg-blue-500/10', text: 'text-blue-600' },
  { bg: 'bg-violet-500/10', text: 'text-violet-600' },
  { bg: 'bg-cyan-500/10', text: 'text-cyan-600' },
  { bg: 'bg-orange-500/10', text: 'text-orange-600' },
];

export default function ExamsPage() {
  const { user } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const isTeacher = user?.role === 'TEACHER';

  const fetchExams = useCallback(async () => {
    try {
      const data = await api<Exam[]>('/exams');
      setExams(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await fetchExams();
    })();
  }, [fetchExams]);

  const filtered = exams.filter((e) => {
    const matchSearch = e.title
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchStatus =
      statusFilter === 'all' ||
      (statusFilter === 'upcoming' && e.status === 'DRAFT') ||
      (statusFilter === 'active' && e.status === 'PUBLISHED') ||
      (statusFilter === 'ended' && e.status === 'ARCHIVED');
    return matchSearch && matchStatus;
  });

  const activeExams = exams.filter(
    (e) => e.status === 'PUBLISHED',
  );

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Bài kiểm tra"
        description={
          isTeacher
            ? 'Quản lý và tạo bài kiểm tra cho lớp học'
            : 'Danh sách các bài kiểm tra của bạn'
        }
        action={
          isTeacher ? (
            <CreateExamDialog onCreated={fetchExams} />
          ) : undefined
        }
      />

      {/* Student: active exam callout */}
      {!isTeacher && activeExams.length > 0 && (
        <Card className="border-green-500/30 bg-green-500/5">
          <div className="flex items-center gap-4 p-4">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
              </span>
              <span className="text-sm font-semibold text-green-700">
                ĐANG MỞ
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {activeExams[0].title}
              </p>
              <p className="text-xs text-muted-foreground">
                {Math.round(
                  activeExams[0].durationSeconds / 60,
                )}{' '}
                phút
              </p>
            </div>
            <Link
              href={`/dashboard/take-exam/${activeExams[0].id}`}
            >
              <Button size="sm">
                <Play className="mr-2 h-3.5 w-3.5" />
                Bắt đầu làm bài
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {/* Table card */}
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b px-4 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs
            defaultValue="all"
            onValueChange={(v) =>
              setStatusFilter(String(v ?? 'all'))
            }
          >
            <TabsList variant="line">
              <TabsTrigger value="all">Tất cả</TabsTrigger>
              <TabsTrigger value="upcoming">
                Sắp diễn ra
              </TabsTrigger>
              <TabsTrigger value="active">
                Đang diễn ra
              </TabsTrigger>
              <TabsTrigger value="ended">
                Đã kết thúc
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="p-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm bài kiểm tra..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {loading ? (
          <div className="px-4 pb-6">
            <EmptyState type="loading" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 pb-6">
            <EmptyState
              type="empty"
              title={
                search || statusFilter !== 'all'
                  ? 'Không tìm thấy bài kiểm tra'
                  : 'Chưa có bài kiểm tra nào'
              }
              text={
                isTeacher
                  ? 'Tạo bài kiểm tra đầu tiên!'
                  : 'Bài kiểm tra sẽ xuất hiện tại đây'
              }
            />
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((exam, idx) => {
              const tone = ICON_TONES[idx % ICON_TONES.length];
              const status =
                STATUS_CONFIG[exam.status] ??
                STATUS_CONFIG.DRAFT;

              return (
                <Link
                  key={exam.id}
                  href={`/dashboard/exams/${exam.id}`}
                >
                  <div className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/50">
                    <div
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tone.bg}`}
                    >
                      <ClipboardCheck
                        className={`h-5 w-5 ${tone.text}`}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {exam.title}
                      </p>
                      <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                        {exam.classroom && (
                          <span>{exam.classroom.name}</span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {Math.round(
                            exam.durationSeconds / 60,
                          )}{' '}
                          phút
                        </span>
                        <span className="flex items-center gap-1">
                          <FileQuestion className="h-3 w-3" />
                          {exam._count?.questions ?? 0} câu
                        </span>
                      </div>
                    </div>
                    {isTeacher && (
                      <div className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
                        <Users className="h-3 w-3" />
                        <span>0 bài nộp</span>
                      </div>
                    )}
                    <Badge className={status.className}>
                      {status.label}
                    </Badge>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function CreateExamDialog({
  onCreated,
}: {
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [duration, setDuration] = useState(45);
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleOptions, setShuffleOptions] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api('/exams', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description: description || undefined,
          instructions: instructions || undefined,
          durationSeconds: duration * 60,
          maxAttempts,
          shuffleQuestions,
          shuffleOptions,
          accessCode: accessCode || undefined,
        }),
      });
      setOpen(false);
      setTitle('');
      setDescription('');
      setInstructions('');
      setDuration(45);
      setMaxAttempts(1);
      setShuffleQuestions(false);
      setShuffleOptions(false);
      setAccessCode('');
      onCreated();
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="mr-2 h-4 w-4" /> Tạo bài kiểm tra
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tạo bài kiểm tra mới</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Tiêu đề</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Kiểm tra giữa kỳ Toán 12"
              required
            />
          </div>
          <div>
            <Label>Mô tả (tùy chọn)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mô tả bài kiểm tra..."
              rows={2}
            />
          </div>
          <div>
            <Label>Hướng dẫn làm bài (tùy chọn)</Label>
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Hướng dẫn cho học sinh trước khi bắt đầu..."
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Thời gian (phút)</Label>
              <Input
                type="number"
                value={duration}
                onChange={(e) =>
                  setDuration(Number(e.target.value))
                }
                min={1}
                required
              />
            </div>
            <div>
              <Label>Số lần làm tối đa</Label>
              <Input
                type="number"
                value={maxAttempts}
                onChange={(e) =>
                  setMaxAttempts(Number(e.target.value))
                }
                min={1}
              />
            </div>
          </div>
          <div>
            <Label>Mã truy cập (tùy chọn)</Label>
            <Input
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              placeholder="Để trống nếu không cần"
            />
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={shuffleQuestions}
                onChange={(e) =>
                  setShuffleQuestions(e.target.checked)
                }
                className="rounded"
              />
              Trộn câu hỏi
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={shuffleOptions}
                onChange={(e) =>
                  setShuffleOptions(e.target.checked)
                }
                className="rounded"
              />
              Trộn đáp án
            </label>
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Đang tạo...' : 'Tạo bài kiểm tra'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
