'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { SectionHeader } from '@/components/ui/section-header';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Plus,
  Users,
  LogIn,
  Search,
  GraduationCap,
  CalendarDays,
  ChevronRight,
  MoreHorizontal,
  LayoutGrid,
  List,
} from 'lucide-react';
import Link from 'next/link';

interface Classroom {
  id: string;
  name: string;
  joinCode: string;
  ownerId: string;
  _count?: { members: number };
}

const CARD_TONES = [
  {
    bg: 'bg-blue-500/10',
    text: 'text-blue-600',
    border: 'border-blue-500/20',
    fill: 'bg-blue-500',
  },
  {
    bg: 'bg-violet-500/10',
    text: 'text-violet-600',
    border: 'border-violet-500/20',
    fill: 'bg-violet-500',
  },
  {
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-600',
    border: 'border-cyan-500/20',
    fill: 'bg-cyan-500',
  },
];

export default function ClassroomsPage() {
  const { user } = useAuth();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const isTeacher = user?.role === 'TEACHER';

  const fetchClassrooms = useCallback(async () => {
    try {
      const data = await api<Classroom[]>('/classrooms');
      setClassrooms(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await fetchClassrooms();
    })();
  }, [fetchClassrooms]);

  const filtered = classrooms.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <SectionHeader
        title={isTeacher ? 'Lớp học' : 'Lớp học của tôi'}
        description={
          isTeacher
            ? 'Quản lý lớp học và theo dõi tiến độ học sinh'
            : 'Danh sách các lớp học bạn đang tham gia'
        }
        action={
          isTeacher ? (
            <CreateClassroomDialog onCreated={fetchClassrooms} />
          ) : (
            <JoinClassroomDialog onJoined={fetchClassrooms} />
          )
        }
      />

      {/* Filter row */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm kiếm lớp học..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="ml-auto flex items-center gap-1 rounded-lg border p-1">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`rounded-md p-1.5 transition-colors ${viewMode === 'grid' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`rounded-md p-1.5 transition-colors ${viewMode === 'list' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <EmptyState type="loading" />
      ) : filtered.length === 0 ? (
        <EmptyState
          type="empty"
          title={
            search
              ? 'Không tìm thấy lớp học'
              : isTeacher
                ? 'Chưa có lớp học nào'
                : 'Chưa tham gia lớp học nào'
          }
          text={
            search
              ? 'Thử thay đổi từ khóa tìm kiếm'
              : isTeacher
                ? 'Tạo lớp học đầu tiên để bắt đầu!'
                : 'Nhập mã lớp để tham gia lớp học'
          }
        />
      ) : viewMode === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c, i) => (
            <ClassroomCard
              key={c.id}
              classroom={c}
              tone={CARD_TONES[i % 3]}
              isTeacher={isTeacher}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c, i) => (
            <ClassroomListItem
              key={c.id}
              classroom={c}
              tone={CARD_TONES[i % 3]}
              isTeacher={isTeacher}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ClassroomCard({
  classroom: c,
  tone,
  isTeacher,
}: {
  classroom: Classroom;
  tone: (typeof CARD_TONES)[number];
  isTeacher: boolean;
}) {
  const memberCount = c._count?.members ?? 0;

  return (
    <Link href={`/dashboard/classrooms/${c.id}`}>
      <Card className="cursor-pointer overflow-hidden transition-shadow hover:shadow-md">
        {/* Cover area */}
        <div
          className={`relative flex items-center justify-between px-4 py-5 ${tone.bg}`}
        >
          <GraduationCap className={`h-8 w-8 ${tone.text}`} />
          {isTeacher && (
            <Badge
              variant="secondary"
              className="font-mono text-[10px]"
            >
              {c.joinCode}
            </Badge>
          )}
          <button
            type="button"
            className="absolute right-2 top-2 rounded-md p-1 opacity-0 transition-opacity hover:bg-black/5 group-hover:opacity-100"
            onClick={(e) => e.preventDefault()}
          >
            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-3 p-4">
          <div>
            <h3 className="font-semibold leading-tight">{c.name}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              GV. Giáo viên
            </p>
          </div>

          {/* Members */}
          <div className="flex items-center gap-2">
            <div className="flex -space-x-1.5">
              {Array.from({ length: Math.min(memberCount, 3) }).map(
                (_, j) => (
                  <div
                    key={j}
                    className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-muted text-[9px] font-medium"
                  >
                    {String.fromCharCode(65 + j)}
                  </div>
                ),
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {memberCount} thành viên
            </span>
          </div>

          {/* Progress bar placeholder */}
          <div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Tiến độ</span>
              <span>75%</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${tone.fill}`}
                style={{ width: '75%' }}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-1.5 border-t pt-3 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            <span className="flex-1">Buổi học tiếp theo</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </div>
        </div>
      </Card>
    </Link>
  );
}

function ClassroomListItem({
  classroom: c,
  tone,
  isTeacher,
}: {
  classroom: Classroom;
  tone: (typeof CARD_TONES)[number];
  isTeacher: boolean;
}) {
  const memberCount = c._count?.members ?? 0;

  return (
    <Link href={`/dashboard/classrooms/${c.id}`}>
      <Card className="flex cursor-pointer items-center gap-4 p-4 transition-shadow hover:shadow-md">
        <div
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tone.bg}`}
        >
          <GraduationCap className={`h-5 w-5 ${tone.text}`} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold">{c.name}</h3>
          <p className="text-xs text-muted-foreground">
            GV. Giáo viên
          </p>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          <span>{memberCount}</span>
        </div>
        {isTeacher && (
          <Badge
            variant="secondary"
            className="font-mono text-[10px]"
          >
            {c.joinCode}
          </Badge>
        )}
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </Card>
    </Link>
  );
}

function CreateClassroomDialog({
  onCreated,
}: {
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api('/classrooms', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      setOpen(false);
      setName('');
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
        <Plus className="mr-2 h-4 w-4" />
        Tạo lớp học
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tạo lớp học mới</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="className">Tên lớp</Label>
            <Input
              id="className"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Toán 12A1"
              required
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Đang tạo...' : 'Tạo lớp'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function JoinClassroomDialog({
  onJoined,
}: {
  onJoined: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api(`/classrooms/join`, {
        method: 'POST',
        body: JSON.stringify({ joinCode }),
      });
      setOpen(false);
      setJoinCode('');
      onJoined();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <LogIn className="mr-2 h-4 w-4" />
        Tham gia lớp
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tham gia lớp học</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="joinCode">Mã lớp</Label>
            <Input
              id="joinCode"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Nhập mã lớp (6 ký tự)"
              maxLength={8}
              required
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Đang tham gia...' : 'Tham gia'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
