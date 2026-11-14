'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { SectionHeader } from '@/components/ui/section-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Bell,
  CheckCheck,
  ClipboardCheck,
  CheckCircle2,
  BarChart3,
  CalendarDays,
  MessageSquareText,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

const TYPE_CONFIG: Record<
  string,
  { icon: LucideIcon; tone: string }
> = {
  EXAM_PUBLISHED: { icon: ClipboardCheck, tone: 'blue' },
  GRADING_COMPLETE: { icon: CheckCircle2, tone: 'green' },
  RESULTS_RELEASED: { icon: BarChart3, tone: 'cyan' },
  DEADLINE_REMINDER: { icon: CalendarDays, tone: 'orange' },
  ANNOUNCEMENT: { icon: MessageSquareText, tone: 'violet' },
};

const DEFAULT_CONFIG = { icon: Bell, tone: 'blue' };

function getConfig(type: string) {
  return TYPE_CONFIG[type] || DEFAULT_CONFIG;
}

function timeAgo(dateStr: string) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  return new Date(dateStr).toLocaleDateString('vi-VN');
}

const toneClasses: Record<string, string> = {
  blue: 'tone-blue',
  violet: 'tone-violet',
  orange: 'tone-orange',
  cyan: 'tone-cyan',
  green: 'tone-green',
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<
    Notification[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Notification[]>('/notifications?limit=50')
      .then(setNotifications)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function markAsRead(id: string) {
    await api(`/notifications/${id}/read`, { method: 'PATCH' });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  }

  async function markAllAsRead() {
    await api('/notifications/read-all', { method: 'POST' });
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read: true })),
    );
  }

  if (loading) {
    return <EmptyState type="loading" />;
  }

  const hasUnread = notifications.some((n) => !n.read);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <SectionHeader
        title="Thông báo"
        description="Cập nhật mới nhất từ lớp học và hoạt động của bạn."
        action={
          hasUnread ? (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllAsRead}
            >
              <CheckCheck className="mr-2 h-4 w-4" />
              Đánh dấu tất cả đã đọc
            </Button>
          ) : undefined
        }
      />

      {notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Không có thông báo"
          text="Thông báo mới sẽ xuất hiện tại đây."
        />
      ) : (
        <Card className="divide-y p-0">
          {notifications.map((n) => {
            const config = getConfig(n.type);
            const Icon = config.icon;
            const toneCls = toneClasses[config.tone] || 'tone-blue';

            return (
              <button
                key={n.id}
                onClick={() => !n.read && markAsRead(n.id)}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50 ${
                  !n.read ? 'bg-primary/5' : ''
                }`}
              >
                <div
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${toneCls}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p
                      className={`truncate text-sm ${!n.read ? 'font-semibold' : 'font-medium'}`}
                    >
                      {n.title}
                    </p>
                    {!n.read && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">
                    {n.body}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {timeAgo(n.createdAt)}
                  </p>
                </div>
              </button>
            );
          })}
        </Card>
      )}
    </div>
  );
}
