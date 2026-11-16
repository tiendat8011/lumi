'use client';

import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { useState } from 'react';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

interface GoogleLoginButtonProps {
  onSuccess: (credential: string) => Promise<void>;
  text?: 'signin_with' | 'signup_with' | 'continue_with';
}

export function GoogleLoginButton({
  onSuccess,
  text = 'signin_with',
}: GoogleLoginButtonProps) {
  const [error, setError] = useState('');

  if (!GOOGLE_CLIENT_ID) {
    return null;
  }

  const handleSuccess = async (response: CredentialResponse) => {
    if (!response.credential) {
      setError('Không nhận được thông tin từ Google');
      return;
    }
    setError('');
    try {
      await onSuccess(response.credential);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng nhập Google thất bại');
    }
  };

  return (
    <div>
      <div className="flex justify-center">
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={() => setError('Đăng nhập Google thất bại')}
          text={text}
          shape="rectangular"
          width="350"
        />
      </div>
      {error && (
        <p className="mt-1.5 text-center text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
