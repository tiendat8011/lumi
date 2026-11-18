'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/protected-route';
import { SidebarNav } from '@/components/sidebar-nav';
import { ThemeToggle } from '@/components/theme-toggle';
import { Logo } from '@/components/ui/logo';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Menu, LogOut, Bell, User } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const initials =
    user?.displayName
      ?.split(' ')
      .map((n: string) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?';

  const roleLabel =
    user?.role === 'TEACHER'
      ? 'Giáo viên'
      : user?.role === 'ADMIN'
        ? 'Quản trị viên'
        : 'Học sinh';

  // Pinned to the bottom of the sidebar on desktop and in the mobile sheet,
  // so the account in use is visible without opening the header menu.
  const accountCard = (
    <div className="border-t border-sidebar-border p-3">
      <div className="flex items-center gap-2.5">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-sidebar-foreground">
            {user?.displayName}
          </p>
          <p className="truncate text-[11px] text-sidebar-foreground/70">
            {roleLabel}
          </p>
        </div>
      </div>
    </div>
  );

  useEffect(() => {
    if (!user) return;
    api<{ unread: number }>('/notifications/count')
      .then((r) => setUnreadCount(r.unread))
      .catch(() => {});
    const interval = setInterval(() => {
      api<{ unread: number }>('/notifications/count')
        .then((r) => setUnreadCount(r.unread))
        .catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [user]);

  return (
    <ProtectedRoute>
      <div className="flex h-screen overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar md:flex md:flex-col">
          <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
            <Logo />
          </div>
          <div className="flex-1 overflow-y-auto">
            <SidebarNav />
          </div>
          {accountCard}
        </aside>

        {/* Main area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header */}
          <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
            {/* Mobile menu */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden"
                  />
                }
              >
                <Menu className="h-5 w-5" />
              </SheetTrigger>
              <SheetContent
                side="left"
                className="flex w-64 flex-col bg-sidebar p-0"
              >
                <SheetTitle className="sr-only">
                  Navigation
                </SheetTitle>
                <div className="flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border px-4">
                  <Logo />
                </div>
                <div
                  className="flex-1 overflow-y-auto"
                  onClick={() => setMobileOpen(false)}
                >
                  <SidebarNav />
                </div>
                {accountCard}
              </SheetContent>
            </Sheet>

            <div className="flex-1" />

            <Link href="/dashboard/notifications">
              <Button
                variant="ghost"
                size="icon"
                className="relative"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Button>
            </Link>

            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                  />
                }
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">
                    {user?.displayName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
                <DropdownMenuSeparator />
                <Link href="/dashboard/profile">
                  <DropdownMenuItem>
                    <User className="mr-2 h-4 w-4" />
                    Hồ sơ
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuItem
                  onClick={logout}
                  className="text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Đăng xuất
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          {/* Content */}
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
