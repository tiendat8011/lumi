'use client';

import { useGoogleLogin } from '@react-oauth/google';
import { useState, type ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

/** Official Google "G" mark. Do not recolor — Google's brand terms require it. */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.1A6.6 6.6 0 0 1 5.49 12c0-.73.13-1.44.35-2.1V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.44 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

/** The logo button itself, shared by every provider. */
function ProviderButton({
  name,
  ariaLabel,
  busy,
  disabled,
  onClick,
  children,
}: {
  name: string;
  ariaLabel: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={name}
      aria-label={ariaLabel}
      className="grid h-12 w-12 place-items-center rounded-xl border border-border bg-card transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy ? (
        <LoaderCircle className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : (
        children
      )}
    </button>
  );
}

interface ProviderProps {
  ariaLabel: string;
  pending: string | null;
  setPending: (id: string | null) => void;
  setError: (message: string) => void;
  onToken: (accessToken: string) => Promise<void>;
}

/**
 * Mounted only when GOOGLE_CLIENT_ID is set: `useGoogleLogin` throws unless a
 * GoogleOAuthProvider is above it, and that provider only exists when the
 * client ID is configured.
 */
function GoogleProvider({
  ariaLabel,
  pending,
  setPending,
  setError,
  onToken,
}: ProviderProps) {
  const start = useGoogleLogin({
    flow: 'implicit',
    scope: 'email profile',
    onSuccess: async (tokenResponse) => {
      setPending('google');
      setError('');
      try {
        await onToken(tokenResponse.access_token);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Đăng nhập Google thất bại',
        );
      } finally {
        setPending(null);
      }
    },
    onError: () => {
      setPending(null);
      setError('Đăng nhập Google thất bại');
    },
    // Popup blocked or closed by the user — not an auth failure, so stay quiet.
    onNonOAuthError: () => setPending(null),
  });

  return (
    <ProviderButton
      name="Google"
      ariaLabel={`${ariaLabel} Google`}
      busy={pending === 'google'}
      disabled={pending !== null}
      onClick={() => start()}
    >
      <GoogleIcon />
    </ProviderButton>
  );
}

interface SocialLoginProps {
  /** Sits above the provider logos, e.g. "Hoặc đăng nhập với". */
  label: string;
  /** Receives a Google OAuth access token for POST /auth/google. */
  onGoogleToken: (accessToken: string) => Promise<void>;
}

/**
 * Provider logos in a row under a label. Adding a provider later is one more
 * entry in `providers` plus its own component — the layout does not change.
 */
export function SocialLogin({ label, onGoogleToken }: SocialLoginProps) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState('');

  const shared = { ariaLabel: label, pending, setPending, setError };

  // An unconfigured provider is left out rather than rendered broken.
  const providers = [
    GOOGLE_CLIENT_ID ? (
      <GoogleProvider key="google" {...shared} onToken={onGoogleToken} />
    ) : null,
    // Thêm provider mới tại đây, ví dụ Facebook / Apple / Microsoft:
    // FACEBOOK_APP_ID ? <FacebookProvider key="facebook" {...shared} … /> : null,
  ].filter(Boolean);

  if (providers.length === 0) return null;

  return (
    <div>
      {/* Label with a rule on either side */}
      <div className="relative my-6">
        <div aria-hidden className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-card px-3 text-xs font-medium text-muted-foreground">
            {label}
          </span>
        </div>
      </div>

      {/* Provider logos */}
      <div className="flex items-center justify-center gap-3">{providers}</div>

      {error && (
        <p className="mt-2.5 text-center text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
