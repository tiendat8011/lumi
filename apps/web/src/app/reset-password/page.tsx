'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/ui/logo';
import {
  XCircle,
  LoaderCircle,
  CheckCircle2,
  KeyRound,
  ArrowLeft,
} from 'lucide-react';

const MIN_PASSWORD_LENGTH = 8;

export default function ResetPasswordPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-card">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <ResetPasswordPage />
    </Suspense>
  );
}

/** The two-column frame the other auth screens use. */
function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#0F172A] p-12 text-white lg:flex">
        <Logo className="relative z-10 text-white" />
        <div className="relative z-10 max-w-[570px]">
          <span className="inline-block rounded-full bg-cyan-400/20 px-2.5 py-1 text-[10px] font-extrabold tracking-wide text-cyan-300">
            BẢO MẬT TÀI KHOẢN
          </span>
          <h1 className="mt-4 text-4xl font-extrabold leading-[1.04] tracking-tight xl:text-5xl">
            Đặt mật khẩu mới.
          </h1>
          <p className="mt-3.5 max-w-[470px] text-sm leading-relaxed text-blue-200">
            Chọn một mật khẩu mạnh và chỉ bạn biết, để giữ an toàn cho
            không gian học tập của mình.
          </p>
        </div>
        <div className="relative z-10 max-w-[390px] rounded-xl border border-white/15 bg-white/8 p-5 backdrop-blur-xl">
          <p className="text-xs font-bold">
            Tối thiểu {MIN_PASSWORD_LENGTH} ký tự
          </p>
          <p className="mt-1 text-[10px] text-blue-200">
            Không dùng lại mật khẩu của các tài khoản khác.
          </p>
        </div>
        <div className="pointer-events-none absolute -right-[150px] -bottom-[150px] h-[380px] w-[380px] rounded-full border-[60px] border-white/[0.035]" />
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-card p-6 lg:p-10">
        <div className="w-full max-w-[395px]">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // No token in the URL: nothing to submit, so say so instead of showing a
  // form that can only fail.
  if (!token) {
    return (
      <AuthLayout>
        <InvalidLink />
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout>
        <div className="mb-5 grid h-12 w-12 place-items-center rounded-xl bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">
          Mật khẩu đã được đặt lại
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Bạn có thể đăng nhập bằng mật khẩu mới ngay bây giờ.
        </p>
        <Button
          type="button"
          className="mt-6 w-full"
          render={<Link href="/login" />}
        >
          Đăng nhập
        </Button>
      </AuthLayout>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`);
      return;
    }
    if (password !== confirm) {
      setError('Hai mật khẩu không khớp.');
      return;
    }

    setLoading(true);
    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword: password }),
      });
      setDone(true);
    } catch (err) {
      // A rejected token and a network failure both land here. The server's
      // message says which, and the link below covers the token case.
      setError(
        err instanceof Error
          ? err.message
          : 'Không thể đặt lại mật khẩu.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h2 className="text-2xl font-bold tracking-tight">
        Đặt lại mật khẩu
      </h2>
      <p className="mt-1.5 mb-6 text-sm text-muted-foreground">
        Nhập mật khẩu mới cho tài khoản của bạn.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs font-medium text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
            <Link
              href="/forgot-password"
              className="mt-1.5 ml-6 inline-block font-semibold underline"
            >
              Gửi lại liên kết
            </Link>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="password">Mật khẩu mới</Label>
          <Input
            id="password"
            type="password"
            placeholder={`Tối thiểu ${MIN_PASSWORD_LENGTH} ký tự`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={MIN_PASSWORD_LENGTH}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">Nhập lại mật khẩu mới</Label>
          <Input
            id="confirm"
            type="password"
            placeholder="Nhập lại mật khẩu"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={MIN_PASSWORD_LENGTH}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Đang xử lý...
            </>
          ) : (
            'Đặt lại mật khẩu'
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link
          href="/login"
          className="font-semibold text-primary hover:underline"
        >
          Quay lại đăng nhập
        </Link>
      </p>
    </AuthLayout>
  );
}

function InvalidLink() {
  return (
    <>
      <div className="mb-5 grid h-12 w-12 place-items-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400">
        <KeyRound className="h-6 w-6" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight">
        Liên kết không hợp lệ
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Hãy yêu
        cầu một liên kết mới.
      </p>
      <Button
        className="mt-6 w-full"
        render={<Link href="/forgot-password" />}
      >
        Gửi lại liên kết
      </Button>
      <Link
        href="/login"
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Quay lại đăng nhập
      </Link>
    </>
  );
}
