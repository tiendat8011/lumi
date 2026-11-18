'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/ui/logo';
import {
  XCircle,
  LoaderCircle,
  MailCheck,
  ArrowLeft,
} from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      // The API answers the same way whether or not the address exists, and so
      // does this screen: it must not reveal who has an account.
      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Không thể gửi yêu cầu',
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
            KHÔI PHỤC TÀI KHOẢN
          </span>
          <h1 className="mt-4 text-4xl font-extrabold leading-[1.04] tracking-tight xl:text-5xl">
            Quên mật khẩu là chuyện thường.
          </h1>
          <p className="mt-3.5 max-w-[470px] text-sm leading-relaxed text-blue-200">
            Chỉ cần email của bạn, chúng tôi sẽ gửi liên kết để đặt lại
            mật khẩu.
          </p>
        </div>
        <div className="relative z-10 max-w-[390px] rounded-xl border border-white/15 bg-white/8 p-5 backdrop-blur-xl">
          <p className="text-xs font-bold">Liên kết có hiệu lực 1 giờ</p>
          <p className="mt-1 text-[10px] text-blue-200">
            Sau đó bạn cần yêu cầu một liên kết mới.
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

          {sent ? (
            <>
              <div className="mb-5 grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-primary dark:bg-blue-950">
                <MailCheck className="h-6 w-6" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">
                Kiểm tra email của bạn
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Nếu email này tồn tại trong hệ thống, chúng tôi đã gửi
                một liên kết đặt lại mật khẩu. Liên kết có hiệu lực
                trong 1 giờ.
              </p>
              <p className="mt-4 text-sm text-muted-foreground">
                Không thấy email? Hãy kiểm tra thư mục spam, hoặc{' '}
                <button
                  type="button"
                  onClick={() => setSent(false)}
                  className="font-semibold text-primary hover:underline"
                >
                  thử lại với email khác
                </button>
                .
              </p>
              <Link
                href="/login"
                className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
              >
                <ArrowLeft className="h-4 w-4" />
                Quay lại đăng nhập
              </Link>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold tracking-tight">
                Quên mật khẩu
              </h2>
              <p className="mt-1.5 mb-6 text-sm text-muted-foreground">
                Nhập email để nhận liên kết đặt lại mật khẩu.
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
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Đang gửi...
                    </>
                  ) : (
                    'Gửi liên kết'
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
