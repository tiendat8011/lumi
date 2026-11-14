'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
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
  Clock,
  Play,
  FileText,
  CalendarDays,
  Users,
  Upload,
  ChevronRight,
  PencilLine,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';

interface Assignment {
  id: string;
  status: 'ACTIVE' | 'CLOSED';
  assignedAt: string;
  dueAt: string | null;
  exam: { id: string; title: string; durationSeconds: number };
  classroom?: { id: string; name: string };
  description?: string;
  _count?: { submissions: number };
}

interface Exam {
  id: string;
  title: string;
  status: string;
}

interface Classroom {
  id: string;
  name: string;
}

const ICON_TONES = [
  { bg: 'bg-blue-500/10', text: 'text-blue-600' },
  { bg: 'bg-violet-500/10', text: 'text-violet-600' },
  { bg: 'bg-cyan-500/10', text: 'text-cyan-600' },
  { bg: 'bg-orange-500/10', text: 'text-orange-600' },
];

export default function AssignmentsPage() {
  const { user } = useAuth();
  const isTeacher = user?.role === 'TEACHER';

  return isTeacher ? (
    <TeacherAssignments />
  ) : (
    <StudentAssignments />
  );
}

function TeacherAssignments() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassroom, setSelectedClassroom] =
    useState<string>('');
  const [assignments, setAssignments] = useState<Assignment[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Assignment | null>(
    null,
  );

  const fetchClassrooms = useCallback(async () => {
    try {
      const data = await api<Classroom[]>('/classrooms');
      setClassrooms(data);
      if (data.length > 0) setSelectedClassroom(data[0].id);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAssignments = useCallback(async () => {
    if (!selectedClassroom) return;
    try {
      const data = await api<Assignment[]>(
        `/assignments?classroomId=${selectedClassroom}`,
      );
      setAssignments(data);
      if (data.length > 0 && !selected) setSelected(data[0]);
    } catch {
      // ignore
    }
  }, [selectedClassroom]);

  useEffect(() => {
    fetchClassrooms();
  }, [fetchClassrooms]);

  useEffect(() => {
    if (selectedClassroom) {
      setSelected(null);
      fetchAssignments();
    }
  }, [selectedClassroom, fetchAssignments]);

  const handleClose = async (id: string) => {
    if (!confirm('Đóng bài giao này?')) return;
    await api(`/assignments/${id}/close`, { method: 'PATCH' });
    fetchAssignments();
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Bài tập"
        description="Giao bài và theo dõi tiến độ nộp bài của học sinh"
        action={
          <CreateAssignmentDialog
            onCreated={fetchAssignments}
          />
        }
      />

      {loading ? (
        <EmptyState type="loading" />
      ) : classrooms.length === 0 ? (
        <EmptyState
          type="empty"
          title="Chưa có lớp học"
          text="Tạo lớp học trước khi giao bài"
        />
      ) : (
        <>
          {/* Classroom tabs */}
          <div className="flex gap-2 overflow-x-auto">
            {classrooms.map((c) => (
              <Button
                key={c.id}
                variant={
                  selectedClassroom === c.id
                    ? 'default'
                    : 'outline'
                }
                size="sm"
                onClick={() => setSelectedClassroom(c.id)}
              >
                {c.name}
              </Button>
            ))}
          </div>

          {assignments.length === 0 ? (
            <EmptyState
              type="empty"
              title="Chưa giao bài nào cho lớp này"
              text="Bấm nút Tạo bài tập để bắt đầu"
            />
          ) : (
            <div className="flex flex-col gap-4 lg:flex-row">
              {/* Left: Assignment list */}
              <div className="w-full space-y-2 lg:w-80 lg:shrink-0">
                {assignments.map((a, idx) => {
                  const tone =
                    ICON_TONES[idx % ICON_TONES.length];
                  const isSelected = selected?.id === a.id;

                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setSelected(a)}
                      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-transparent bg-card hover:bg-muted/50'
                      }`}
                    >
                      <div
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tone.bg}`}
                      >
                        <FileText
                          className={`h-5 w-5 ${tone.text}`}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {a.exam.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {a.classroom?.name}
                        </p>
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                          {a.dueAt && (
                            <span className="flex items-center gap-0.5">
                              <CalendarDays className="h-2.5 w-2.5" />
                              {formatDate(a.dueAt)}
                            </span>
                          )}
                        </div>
                      </div>
                      <Badge
                        className={
                          a.status === 'ACTIVE'
                            ? 'bg-green-500/10 text-green-600'
                            : 'bg-slate-500/10 text-slate-500'
                        }
                      >
                        {a.status === 'ACTIVE'
                          ? 'Đang mở'
                          : 'Đã đóng'}
                      </Badge>
                    </button>
                  );
                })}
              </div>

              {/* Right: Detail panel */}
              <Card className="flex-1 p-6">
                {selected ? (
                  <div className="space-y-6">
                    <div>
                      <Badge
                        className={
                          selected.status === 'ACTIVE'
                            ? 'bg-green-500/10 text-green-600'
                            : 'bg-slate-500/10 text-slate-500'
                        }
                      >
                        {selected.status === 'ACTIVE'
                          ? 'Đang mở'
                          : 'Đã đóng'}
                      </Badge>
                      <h2 className="mt-2 text-xl font-semibold">
                        {selected.exam.title}
                      </h2>
                      {selected.classroom && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {selected.classroom.name}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        {Math.round(
                          selected.exam.durationSeconds / 60,
                        )}{' '}
                        phút
                      </span>
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="h-4 w-4" />
                        Giao:{' '}
                        {formatDate(selected.assignedAt)}
                      </span>
                      {selected.dueAt && (
                        <span className="flex items-center gap-1.5">
                          <AlertCircle className="h-4 w-4" />
                          Hạn:{' '}
                          {formatDate(selected.dueAt)}
                        </span>
                      )}
                    </div>

                    {selected.description && (
                      <div>
                        <h3 className="text-sm font-medium">
                          Mô tả
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {selected.description}
                        </p>
                      </div>
                    )}

                    {/* Submission stats */}
                    <div className="rounded-xl border bg-muted/30 p-4">
                      <h3 className="text-sm font-medium">
                        Thống kê nộp bài
                      </h3>
                      <div className="mt-3 grid grid-cols-3 gap-4">
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-1 text-green-600">
                            <CheckCircle2 className="h-4 w-4" />
                          </div>
                          <p className="mt-1 text-lg font-bold">
                            {selected._count?.submissions ?? 0}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Đã nộp
                          </p>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-1 text-orange-600">
                            <AlertCircle className="h-4 w-4" />
                          </div>
                          <p className="mt-1 text-lg font-bold">
                            0
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Chờ nộp
                          </p>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-1 text-blue-600">
                            <PencilLine className="h-4 w-4" />
                          </div>
                          <p className="mt-1 text-lg font-bold">
                            --
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Điểm TB
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button className="flex-1">
                        <PencilLine className="mr-2 h-4 w-4" />
                        Chấm bài nộp
                      </Button>
                      {selected.status === 'ACTIVE' && (
                        <Button
                          variant="outline"
                          onClick={() =>
                            handleClose(selected.id)
                          }
                        >
                          Đóng bài
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    type="empty"
                    title="Chọn bài tập"
                    text="Chọn một bài tập từ danh sách bên trái để xem chi tiết"
                  />
                )}
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StudentAssignments() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassroom, setSelectedClassroom] =
    useState<string>('');
  const [assignments, setAssignments] = useState<Assignment[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Assignment | null>(
    null,
  );

  const fetchClassrooms = useCallback(async () => {
    try {
      const data = await api<Classroom[]>('/classrooms');
      setClassrooms(data);
      if (data.length > 0) setSelectedClassroom(data[0].id);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAssignments = useCallback(async () => {
    if (!selectedClassroom) return;
    try {
      const data = await api<Assignment[]>(
        `/assignments?classroomId=${selectedClassroom}`,
      );
      setAssignments(data);
      if (data.length > 0 && !selected) setSelected(data[0]);
    } catch {
      // ignore
    }
  }, [selectedClassroom]);

  useEffect(() => {
    fetchClassrooms();
  }, [fetchClassrooms]);

  useEffect(() => {
    if (selectedClassroom) {
      setSelected(null);
      fetchAssignments();
    }
  }, [selectedClassroom, fetchAssignments]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

  if (loading) {
    return <EmptyState type="loading" />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Bài tập"
        description="Danh sách bài tập được giao và nộp bài"
      />

      {classrooms.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {classrooms.map((c) => (
            <Button
              key={c.id}
              variant={
                selectedClassroom === c.id
                  ? 'default'
                  : 'outline'
              }
              size="sm"
              onClick={() => setSelectedClassroom(c.id)}
            >
              {c.name}
            </Button>
          ))}
        </div>
      )}

      {assignments.length === 0 ? (
        <EmptyState
          type="empty"
          title="Chưa có bài tập nào"
          text="Bài tập được giao sẽ xuất hiện tại đây"
        />
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row">
          {/* Left: Assignment list */}
          <div className="w-full space-y-2 lg:w-80 lg:shrink-0">
            {assignments.map((a, idx) => {
              const tone = ICON_TONES[idx % ICON_TONES.length];
              const isSelected = selected?.id === a.id;

              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelected(a)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-transparent bg-card hover:bg-muted/50'
                  }`}
                >
                  <div
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tone.bg}`}
                  >
                    <FileText
                      className={`h-5 w-5 ${tone.text}`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {a.exam.title}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        {Math.round(
                          a.exam.durationSeconds / 60,
                        )}{' '}
                        phút
                      </span>
                      {a.dueAt && (
                        <span className="flex items-center gap-0.5">
                          <CalendarDays className="h-2.5 w-2.5" />
                          {formatDate(a.dueAt)}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge
                    className={
                      a.status === 'ACTIVE'
                        ? 'bg-green-500/10 text-green-600'
                        : 'bg-slate-500/10 text-slate-500'
                    }
                  >
                    {a.status === 'ACTIVE'
                      ? 'Đang mở'
                      : 'Đã đóng'}
                  </Badge>
                </button>
              );
            })}
          </div>

          {/* Right: Detail panel */}
          <Card className="flex-1 p-6">
            {selected ? (
              <div className="space-y-6">
                <div>
                  <Badge
                    className={
                      selected.status === 'ACTIVE'
                        ? 'bg-green-500/10 text-green-600'
                        : 'bg-slate-500/10 text-slate-500'
                    }
                  >
                    {selected.status === 'ACTIVE'
                      ? 'Đang mở'
                      : 'Đã đóng'}
                  </Badge>
                  <h2 className="mt-2 text-xl font-semibold">
                    {selected.exam.title}
                  </h2>
                  {selected.classroom && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {selected.classroom.name}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    {Math.round(
                      selected.exam.durationSeconds / 60,
                    )}{' '}
                    phút
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4" />
                    Giao: {formatDate(selected.assignedAt)}
                  </span>
                  {selected.dueAt && (
                    <span className="flex items-center gap-1.5">
                      <AlertCircle className="h-4 w-4" />
                      Hạn: {formatDate(selected.dueAt)}
                    </span>
                  )}
                </div>

                {selected.description && (
                  <div>
                    <h3 className="text-sm font-medium">
                      Mô tả
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {selected.description}
                    </p>
                  </div>
                )}

                {/* Upload zone (visual only) */}
                <div className="rounded-xl border-2 border-dashed p-8 text-center">
                  <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm font-medium">
                    Kéo thả tệp hoặc bấm để tải lên
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Hỗ trợ PDF, DOC, DOCX, JPG, PNG (tối đa
                    10MB)
                  </p>
                </div>

                {selected.status === 'ACTIVE' && (
                  <Link
                    href={`/dashboard/take-exam/${selected.exam.id}?assignmentId=${selected.id}`}
                  >
                    <Button className="w-full">
                      <Play className="mr-2 h-4 w-4" />
                      Làm bài
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <EmptyState
                type="empty"
                title="Chọn bài tập"
                text="Chọn một bài tập từ danh sách bên trái để xem chi tiết"
              />
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function CreateAssignmentDialog({
  onCreated,
}: {
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [exams, setExams] = useState<Exam[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedClassroom, setSelectedClassroom] =
    useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    api<Exam[]>('/exams').then((d) => {
      const published = d.filter(
        (e) => e.status === 'PUBLISHED',
      );
      setExams(published);
    });
    api<Classroom[]>('/classrooms').then(setClassrooms);
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api('/assignments', {
        method: 'POST',
        body: JSON.stringify({
          examId: selectedExam,
          classroomId: selectedClassroom,
        }),
      });
      setOpen(false);
      onCreated();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="mr-2 h-4 w-4" />
        Tạo bài tập
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Giao bài thi</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Đề thi</Label>
            <select
              value={selectedExam}
              onChange={(e) =>
                setSelectedExam(e.target.value)
              }
              className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm"
              required
            >
              <option value="">Chọn đề thi...</option>
              {exams.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Lớp học</Label>
            <select
              value={selectedClassroom}
              onChange={(e) =>
                setSelectedClassroom(e.target.value)
              }
              className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm"
              required
            >
              <option value="">Chọn lớp...</option>
              {classrooms.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Đang giao...' : 'Giao bài'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
