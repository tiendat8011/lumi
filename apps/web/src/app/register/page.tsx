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
import {
  XCircle,
  LoaderCircle,
  GraduationCap,
  BookOpen,
} from 'lucide-react';

export default function RegisterPage() {
  const { register, loginWithGoogle, user } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<'TEACHER' | 'STUDENT'>('STUDENT');
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
      await register(email, password, displayName, role);
      router.push('/dashboard');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Đăng ký thất bại',
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
            BẮT ĐẦU MIỄN PHÍ
          </span>
          <h1 className="mt-4 text-4xl font-extrabold leading-[1.04] tracking-tight xl:text-5xl">
            Cùng nhau tiến bộ mỗi ngày.
          </h1>
          <p className="mt-3.5 max-w-[470px] text-sm leading-relaxed text-blue-200">
            Tạo tài khoản để khám phá không gian dạy và học thông
            minh, trực quan.
          </p>
        </div>
        <div className="relative z-10 max-w-[390px] rounded-xl border border-white/15 bg-white/8 p-5 backdrop-blur-xl">
          <p className="text-xs font-bold">
            Nền tảng thi trực tuyến hiện đại
          </p>
          <p className="mt-1 text-[10px] text-blue-200">
            Quản lý lớp học, tạo đề thi và theo dõi kết quả dễ dàng.
          </p>
        </div>
        <div className="pointer-events-none absolute -right-[150px] -bottom-[150px] h-[380px] w-[380px] rounded-full border-[60px] border-white/[0.035]" />
      </div>

      {/* Register form panel */}
      <div className="flex items-center justify-center bg-card p-6 lg:p-10">
        <div className="w-full max-w-[395px]">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">
            Đăng ký tài khoản
          </h2>
          <p className="mt-1.5 mb-6 text-sm text-muted-foreground">
            Tạo tài khoản mới để bắt đầu sử dụng Lumi.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs font-medium text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
                <XCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Role selector */}
            <div className="space-y-1.5">
              <Label>Bạn là</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole('TEACHER')}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-bold transition-colors ${
                    role === 'TEACHER'
                      ? 'border-blue-300 bg-blue-50 text-primary dark:border-blue-800 dark:bg-blue-950'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <GraduationCap className="h-4 w-4" />
                  Giáo viên
                </button>
                <button
                  type="button"
                  onClick={() => setRole('STUDENT')}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-bold transition-colors ${
                    role === 'STUDENT'
                      ? 'border-blue-300 bg-blue-50 text-primary dark:border-blue-800 dark:bg-blue-950'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <BookOpen className="h-4 w-4" />
                  Học sinh
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="displayName">Họ và tên</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Nguyễn Văn A"
                required
              />
            </div>
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
              <Label htmlFor="password">Mật khẩu</Label>
              <Input
                id="password"
                type="password"
                placeholder="Tối thiểu 8 ký tự"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
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
                  Đang tạo tài khoản...
                </>
              ) : (
                'Đăng ký'
              )}
            </Button>
          </form>

          {/* Uses the role picked above for a brand-new account */}
          <SocialLogin
            label="Hoặc đăng ký với"
            onGoogleToken={async (accessToken) => {
              await loginWithGoogle({ accessToken }, role);
              router.push('/dashboard');
            }}
          />

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Đã có tài khoản?{' '}
            <Link
              href="/login"
              className="font-semibold text-primary hover:underline"
            >
              Đăng nhập
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
