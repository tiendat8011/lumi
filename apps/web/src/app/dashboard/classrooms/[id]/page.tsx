'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ArrowLeft, Copy, Users, Pencil, Trash2, UserMinus } from 'lucide-react';
import Link from 'next/link';

interface ClassroomDetail {
  id: string;
  name: string;
  joinCode: string;
  ownerId: string;
}

interface Member {
  id: string;
  user: { id: string; displayName: string; email: string };
  joinedAt: string;
}

export default function ClassroomDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { user } = useAuth();
  const [classroom, setClassroom] = useState<ClassroomDetail | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const isTeacher = user?.role === 'TEACHER';

  const fetchData = useCallback(async () => {
    try {
      const c = await api<ClassroomDetail>(`/classrooms/${id}`);
      setClassroom(c);
      const m = await api<Member[]>(`/classrooms/${id}/members`);
      setMembers(m);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void (async () => {
      await fetchData();
    })();
  }, [fetchData]);

  async function handleDelete() {
    if (!confirm('Bạn có chắc muốn xóa lớp học này?')) return;
    try {
      await api(`/classrooms/${id}`, { method: 'DELETE' });
      router.push('/dashboard/classrooms');
    } catch {}
  }

  async function handleRemoveMember(memberId: string) {
    if (!confirm('Xóa học sinh này khỏi lớp?')) return;
    try {
      await api(`/classrooms/${id}/members/${memberId}`, { method: 'DELETE' });
      setMembers((prev) => prev.filter((m) => m.user.id !== memberId));
    } catch {}
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!classroom) {
    return <div className="text-center text-muted-foreground">Không tìm thấy lớp học</div>;
  }

  const copyCode = () => navigator.clipboard.writeText(classroom.joinCode);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/classrooms">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{classroom.name}</h1>
          {isTeacher && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-muted-foreground">Mã lớp:</span>
              <Badge variant="secondary" className="font-mono">{classroom.joinCode}</Badge>
              <Button variant="ghost" size="sm" onClick={copyCode}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
        {isTeacher && (
          <div className="flex gap-2">
            <EditClassroomDialog classroom={classroom} onUpdated={fetchData} />
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              <Trash2 className="mr-1 h-4 w-4" /> Xóa
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Thành viên ({members.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có học sinh nào tham gia</p>
          ) : (
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-lg border px-4 py-2">
                  <div>
                    <p className="text-sm font-medium">{m.user.displayName}</p>
                    <p className="text-xs text-muted-foreground">{m.user.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(m.joinedAt).toLocaleDateString('vi-VN')}
                    </span>
                    {isTeacher && (
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleRemoveMember(m.user.id)}>
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EditClassroomDialog({ classroom, onUpdated }: { classroom: ClassroomDetail; onUpdated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(classroom.name);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api(`/classrooms/${classroom.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      });
      setOpen(false);
      onUpdated();
    } catch {} finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Pencil className="mr-1 h-4 w-4" /> Sửa
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chỉnh sửa lớp học</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tên lớp</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Đang lưu...' : 'Lưu'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
