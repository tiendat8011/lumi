'use client';

import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, FileQuestion, ClipboardList, BarChart3 } from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const isTeacher = user?.role === 'TEACHER';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Xin chào, {user?.displayName}!
        </h1>
        <p className="text-muted-foreground">
          {isTeacher ? 'Quản lý lớp học và đề thi của bạn' : 'Xem các bài thi được giao'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isTeacher ? (
          <>
            <StatCard icon={Users} label="Lớp học" value="—" />
            <StatCard icon={FileQuestion} label="Câu hỏi" value="—" />
            <StatCard icon={ClipboardList} label="Đề thi" value="—" />
            <StatCard icon={BarChart3} label="Bài đã giao" value="—" />
          </>
        ) : (
          <>
            <StatCard icon={Users} label="Lớp học" value="—" />
            <StatCard icon={ClipboardList} label="Bài thi" value="—" />
            <StatCard icon={BarChart3} label="Đã hoàn thành" value="—" />
            <StatCard icon={BarChart3} label="Điểm TB" value="—" />
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
