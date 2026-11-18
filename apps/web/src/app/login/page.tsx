'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/ui/logo';
import { SocialLogin } from '@/components/social-login';
import { XCircle, LoaderCircle } from 'lucide-react';

export default function LoginPage() {
  const { login, loginWithGoogle, user } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) router.replace('/dashboard');
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Đăng nhập thất bại',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#0F172A] p-12 text-white lg:flex">
        <Logo className="relative z-10 text-white" />
        <div className="relative z-10 max-w-[570px]">
          <span className="inline-block rounded-full bg-cyan-400/20 px-2.5 py-1 text-[10px] font-extrabold tracking-wide text-cyan-300">
            HỌC TẬP THÔNG MINH HƠN
          </span>
          <h1 className="mt-4 text-4xl font-extrabold leading-[1.04] tracking-tight xl:text-5xl">
            Mỗi bài học là một bước tiến.
          </h1>
          <p className="mt-3.5 max-w-[470px] text-sm leading-relaxed text-blue-200">
            Dạy học, kiểm tra và theo dõi tiến bộ trong một không gian
            hiện đại, trực quan.
          </p>
        </div>
        <div className="relative z-10 max-w-[390px] rounded-xl border border-white/15 bg-white/8 p-5 backdrop-blur-xl">
          <p className="text-xs font-bold">
            Hơn 12.000 giáo viên và học sinh
          </p>
          <p className="mt-1 text-[10px] text-blue-200">
            đang cùng nhau tiến bộ mỗi ngày trên Lumi.
          </p>
        </div>
        <div className="pointer-events-none absolute -right-[150px] -bottom-[150px] h-[380px] w-[380px] rounded-full border-[60px] border-white/[0.035]" />
      </div>

      {/* Auth form panel */}
      <div className="flex items-center justify-center bg-card p-6 lg:p-10">
        <div className="w-full max-w-[395px]">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">
            Chào mừng trở lại
          </h2>
          <p className="mt-1.5 mb-6 text-sm text-muted-foreground">
            Đăng nhập để tiếp tục không gian học tập của bạn.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs font-medium text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
                <XCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <Label htmlFor="password">Mật khẩu</Label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Quên mật khẩu?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="Nhập mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Đang đăng nhập...
                </>
              ) : (
                'Đăng nhập'
              )}
            </Button>
          </form>

          {/* The role only applies to a first-time sign-in; an existing
              account keeps the role it already has. */}
          <SocialLogin
            label="Hoặc đăng nhập với"
            onGoogleToken={async (accessToken) => {
              await loginWithGoogle({ accessToken }, 'STUDENT');
              router.push('/dashboard');
            }}
          />

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Chưa có tài khoản?{' '}
            <Link
              href="/register"
              className="font-semibold text-primary hover:underline"
            >
              Đăng ký miễn phí
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
