'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Clock, Play } from 'lucide-react';
import Link from 'next/link';

interface Assignment {
  id: string;
  status: 'ACTIVE' | 'CLOSED';
  assignedAt: string;
  dueAt: string | null;
  exam: { id: string; title: string; durationSeconds: number };
  classroom?: { id: string; name: string };
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

export default function AssignmentsPage() {
  const { user } = useAuth();
  const isTeacher = user?.role === 'TEACHER';

  return isTeacher ? <TeacherAssignments /> : <StudentAssignments />;
}

function TeacherAssignments() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassroom, setSelectedClassroom] = useState<string>('');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

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
      const data = await api<Assignment[]>(`/assignments?classroomId=${selectedClassroom}`);
      setAssignments(data);
    } catch {
      // ignore
    }
  }, [selectedClassroom]);

  useEffect(() => {
    fetchClassrooms();
  }, [fetchClassrooms]);

  useEffect(() => {
    if (selectedClassroom) fetchAssignments();
  }, [selectedClassroom, fetchAssignments]);

  const handleClose = async (id: string) => {
    if (!confirm('Đóng bài giao này?')) return;
    await api(`/assignments/${id}/close`, { method: 'PATCH' });
    fetchAssignments();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Giao bài</h1>
        <CreateAssignmentDialog onCreated={fetchAssignments} />
      </div>

      {classrooms.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {classrooms.map((c) => (
            <Button
              key={c.id}
              variant={selectedClassroom === c.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedClassroom(c.id)}
            >
              {c.name}
            </Button>
          ))}
        </div>
      )}

      {assignments.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          Chưa giao bài nào cho lớp này
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => (
            <Card key={a.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">{a.exam.title}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant={a.status === 'ACTIVE' ? 'default' : 'secondary'}>
                    {a.status === 'ACTIVE' ? 'Đang mở' : 'Đã đóng'}
                  </Badge>
                  {a.status === 'ACTIVE' && (
                    <Button size="sm" variant="outline" onClick={() => handleClose(a.id)}>
                      Đóng
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {Math.round(a.exam.durationSeconds / 60)} phút
                  </span>
                  <span>
                    Giao: {new Date(a.assignedAt).toLocaleDateString('vi-VN')}
                  </span>
                  {a.dueAt && (
                    <span>
                      Hạn: {new Date(a.dueAt).toLocaleDateString('vi-VN')}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function StudentAssignments() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassroom, setSelectedClassroom] = useState<string>('');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

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
      const data = await api<Assignment[]>(`/assignments?classroomId=${selectedClassroom}`);
      setAssignments(data);
    } catch {
      // ignore
    }
  }, [selectedClassroom]);

  useEffect(() => {
    fetchClassrooms();
  }, [fetchClassrooms]);

  useEffect(() => {
    if (selectedClassroom) fetchAssignments();
  }, [selectedClassroom, fetchAssignments]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Bài thi</h1>

      {classrooms.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {classrooms.map((c) => (
            <Button
              key={c.id}
              variant={selectedClassroom === c.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedClassroom(c.id)}
            >
              {c.name}
            </Button>
          ))}
        </div>
      )}

      {assignments.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          Chưa có bài thi nào
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assignments.map((a) => (
            <Card key={a.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{a.exam.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {Math.round(a.exam.durationSeconds / 60)} phút
                  </span>
                  {a.dueAt && (
                    <span>Hạn: {new Date(a.dueAt).toLocaleDateString('vi-VN')}</span>
                  )}
                </div>
                <Link href={`/dashboard/take-exam/${a.exam.id}?assignmentId=${a.id}`}>
                  <Button size="sm" className="w-full">
                    <Play className="mr-2 h-3.5 w-3.5" />
                    Làm bài
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateAssignmentDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [exams, setExams] = useState<Exam[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedClassroom, setSelectedClassroom] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    api<Exam[]>('/exams').then((d) => {
      const published = d.filter((e) => e.status === 'PUBLISHED');
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
        Giao bài
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
              onChange={(e) => setSelectedExam(e.target.value)}
              className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm"
              required
            >
              <option value="">Chọn đề thi...</option>
              {exams.map((e) => (
                <option key={e.id} value={e.id}>{e.title}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Lớp học</Label>
            <select
              value={selectedClassroom}
              onChange={(e) => setSelectedClassroom(e.target.value)}
              className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm"
              required
            >
              <option value="">Chọn lớp...</option>
              {classrooms.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Đang giao...' : 'Giao bài'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
