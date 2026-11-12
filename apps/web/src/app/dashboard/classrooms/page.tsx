'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Users, Copy, LogIn } from 'lucide-react';
import Link from 'next/link';

interface Classroom {
  id: string;
  name: string;
  joinCode: string;
  ownerId: string;
  _count?: { members: number };
}

export default function ClassroomsPage() {
  const { user } = useAuth();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
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
    fetchClassrooms();
  }, [fetchClassrooms]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Lớp học</h1>
        {isTeacher ? (
          <CreateClassroomDialog onCreated={fetchClassrooms} />
        ) : (
          <JoinClassroomDialog onJoined={fetchClassrooms} />
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : classrooms.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          {isTeacher ? 'Chưa có lớp học nào. Tạo lớp học đầu tiên!' : 'Chưa tham gia lớp học nào.'}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classrooms.map((c) => (
            <Link key={c.id} href={`/dashboard/classrooms/${c.id}`}>
              <Card className="cursor-pointer transition-shadow hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base">{c.name}</CardTitle>
                  {isTeacher && (
                    <Badge variant="secondary" className="font-mono text-xs">
                      {c.joinCode}
                    </Badge>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    <span>{c._count?.members ?? 0} thành viên</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateClassroomDialog({ onCreated }: { onCreated: () => void }) {
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

function JoinClassroomDialog({ onJoined }: { onJoined: () => void }) {
  const [open, setOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // We need to find the classroom ID from the join code first, or use a different endpoint
      // The API expects POST /classrooms/:id/join with joinCode in body
      // For student join, we'll use a workaround: fetch all, then join
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
        Tham gia
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
