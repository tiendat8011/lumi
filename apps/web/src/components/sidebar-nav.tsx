'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import {
  Home,
  Users,
  FileQuestion,
  ClipboardCheck,
  FileCheck2,
  PencilLine,
  BarChart3,
  TrendingUp,
  Target,
} from 'lucide-react';

const teacherLinks = [
  { href: '/dashboard', label: 'Tổng quan', icon: Home },
  { href: '/dashboard/classrooms', label: 'Lớp học', icon: Users },
  {
    href: '/dashboard/questions',
    label: 'Ngân hàng câu hỏi',
    icon: FileQuestion,
  },
  {
    href: '/dashboard/exams',
    label: 'Bài kiểm tra',
    icon: ClipboardCheck,
  },
  { href: '/dashboard/assignments', label: 'Bài tập', icon: FileCheck2 },
  { href: '/dashboard/grading', label: 'Chấm bài', icon: PencilLine },
  { href: '/dashboard/analytics', label: 'Phân tích', icon: BarChart3 },
];

const studentLinks = [
  { href: '/dashboard', label: 'Tổng quan', icon: Home },
  {
    href: '/dashboard/classrooms',
    label: 'Lớp học của tôi',
    icon: Users,
  },
  { href: '/dashboard/assignments', label: 'Bài tập', icon: FileCheck2 },
  {
    href: '/dashboard/exams',
    label: 'Bài kiểm tra',
    icon: ClipboardCheck,
  },
  { href: '/dashboard/my-results', label: 'Kết quả', icon: TrendingUp },
  {
    href: '/dashboard/analytics',
    label: 'Tiến độ học tập',
    icon: Target,
  },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const links = user?.role === 'TEACHER' ? teacherLinks : studentLinks;

  return (
    <nav className="flex flex-col gap-1 px-3 py-2">
      {links.map((link) => {
        const isActive =
          link.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
            )}
          >
            <link.icon className="h-4 w-4 shrink-0" />
            <span>{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
