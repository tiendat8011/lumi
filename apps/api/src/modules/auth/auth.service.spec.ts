// `@nestjs/jwt` ships ESM only and this Jest setup transforms nothing in
// node_modules, so importing it for real fails with "Cannot use import
// statement outside a module". Nothing here signs a JWT; a stub class is
// enough to satisfy the DI metadata `AuthService` emits.
jest.mock('@nestjs/jwt', () => ({ JwtService: class JwtService {} }));

import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AuthService } from './auth.service';
import { MailService, MailPayload } from '../mail/mail.service';
import { PrismaService } from '../../database/prisma.service';
import { UsersService } from '../users/users.service';

type StoredToken = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
};

const sha256 = (value: string) =>
  crypto.createHash('sha256').update(value).digest('hex');

describe('AuthService — password reset', () => {
  const user = {
    id: 'user-1',
    email: 'victim@example.com',
    displayName: 'Nguyễn Văn A',
    role: 'TEACHER',
    passwordHash: 'old-hash',
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };

  let service: AuthService;
  let findByEmail: jest.Mock;
  let updateProfile: jest.Mock;
  let send: jest.Mock<Promise<void>, [MailPayload]>;
  let resetToken: {
    deleteMany: jest.Mock;
    create: jest.Mock;
    findUnique: jest.Mock;
    delete: jest.Mock;
  };

  /** The link in the most recent mail, or undefined if nothing was sent. */
  const sentResetUrl = (): string | undefined => {
    const payload = send.mock.calls[0]?.[0];
    return payload?.text.match(/https?:\/\/\S+/)?.[0];
  };

  beforeEach(() => {
    findByEmail = jest.fn().mockResolvedValue(user);
    updateProfile = jest.fn().mockResolvedValue(user);
    send = jest.fn<Promise<void>, [MailPayload]>().mockResolvedValue(undefined);
    resetToken = {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockResolvedValue({ id: 'token-1' }),
      findUnique: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue({ id: 'token-1' }),
    };

    const config = {
      get: (key: string, fallback?: unknown) =>
        key === 'APP_BASE_URL' ? 'https://lumi.example.com' : fallback,
    } as unknown as ConfigService;

    service = new AuthService(
      { findByEmail, updateProfile } as unknown as UsersService,
      { sign: jest.fn() } as unknown as JwtService,
      config,
      { passwordResetToken: resetToken } as unknown as PrismaService,
      { send } as unknown as MailService,
    );
  });

  describe('forgotPassword', () => {
    it('never returns the reset token in the response', async () => {
      const result = await service.forgotPassword(user.email);

      expect(result).toEqual({
        message: 'If the email exists, a reset link has been sent',
      });
      expect(Object.keys(result)).toEqual(['message']);
      expect(JSON.stringify(result)).not.toContain('Token');
    });

    it('mails a link whose token matches the stored hash', async () => {
      await service.forgotPassword(user.email);

      expect(send).toHaveBeenCalledTimes(1);
      const payload = send.mock.calls[0]![0];
      expect(payload.to).toBe(user.email);

      const url = sentResetUrl();
      expect(url).toBeDefined();
      expect(url).toMatch(
        /^https:\/\/lumi\.example\.com\/reset-password\?token=[0-9a-f]{64}$/,
      );

      const token = new URL(url!).searchParams.get('token')!;
      const stored = resetToken.create.mock.calls[0]![0].data as StoredToken;
      expect(stored.tokenHash).toBe(sha256(token));
      // Only the hash is persisted.
      expect(stored.tokenHash).not.toBe(token);
    });

    it('expires the token one hour out', async () => {
      const before = Date.now();
      await service.forgotPassword(user.email);
      const stored = resetToken.create.mock.calls[0]![0].data as StoredToken;

      const ttl = stored.expiresAt.getTime() - before;
      expect(ttl).toBeGreaterThan(3_600_000 - 5_000);
      expect(ttl).toBeLessThanOrEqual(3_600_000);
    });

    it('drops any earlier token for that user first', async () => {
      await service.forgotPassword(user.email);

      expect(resetToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: user.id },
      });
      expect(resetToken.deleteMany.mock.invocationCallOrder[0]!).toBeLessThan(
        resetToken.create.mock.invocationCallOrder[0]!,
      );
    });

    it('answers an unknown email identically and writes nothing', async () => {
      findByEmail.mockResolvedValue(null);

      const unknown = await service.forgotPassword('nobody@example.com');

      findByEmail.mockResolvedValue(user);
      const known = await service.forgotPassword(user.email);

      expect(unknown).toEqual(known);
      expect(resetToken.create).toHaveBeenCalledTimes(1);
      expect(send).toHaveBeenCalledTimes(1);
      expect(send.mock.calls[0]![0].to).toBe(user.email);
    });

    it('returns the same response when sending the mail fails', async () => {
      send.mockRejectedValue(new Error('SMTP down'));
      jest.spyOn(service['logger'], 'error').mockImplementation(() => undefined);

      await expect(service.forgotPassword(user.email)).resolves.toEqual({
        message: 'If the email exists, a reset link has been sent',
      });
    });

    it('escapes the display name in the HTML body', async () => {
      findByEmail.mockResolvedValue({
        ...user,
        displayName: '<script>alert(1)</script>',
      });

      await service.forgotPassword(user.email);

      const payload = send.mock.calls[0]![0];
      expect(payload.html).toContain('&lt;script&gt;');
      expect(payload.html).not.toContain('<script>');
    });
  });

  describe('resetPassword', () => {
    it('rejects an unknown token', async () => {
      resetToken.findUnique.mockResolvedValue(null);

      await expect(service.resetPassword('garbage', 'newpass123')).rejects.toThrow(
        BadRequestException,
      );
      expect(updateProfile).not.toHaveBeenCalled();
    });

    it('rejects an expired token and leaves the password alone', async () => {
      resetToken.findUnique.mockResolvedValue({
        id: 'token-1',
        userId: user.id,
        tokenHash: sha256('expired'),
        expiresAt: new Date(Date.now() - 1_000),
      } satisfies StoredToken);

      await expect(
        service.resetPassword('expired', 'newpass123'),
      ).rejects.toThrow(BadRequestException);
      expect(updateProfile).not.toHaveBeenCalled();
      expect(resetToken.delete).not.toHaveBeenCalled();
    });

    it('looks the token up by its hash, not its raw value', async () => {
      resetToken.findUnique.mockResolvedValue(null);

      await expect(
        service.resetPassword('raw-token', 'newpass123'),
      ).rejects.toThrow(BadRequestException);
      expect(resetToken.findUnique).toHaveBeenCalledWith({
        where: { tokenHash: sha256('raw-token') },
      });
    });

    it('hashes the new password and consumes the token', async () => {
      resetToken.findUnique.mockResolvedValue({
        id: 'token-1',
        userId: user.id,
        tokenHash: sha256('valid'),
        expiresAt: new Date(Date.now() + 60_000),
      } satisfies StoredToken);

      const result = await service.resetPassword('valid', 'newpass123');

      expect(result).toEqual({ message: 'Password reset successfully' });
      expect(updateProfile).toHaveBeenCalledTimes(1);
      const [userId, data] = updateProfile.mock.calls[0]! as [
        string,
        { passwordHash: string },
      ];
      expect(userId).toBe(user.id);
      expect(data.passwordHash).not.toBe('newpass123');
      await expect(bcrypt.compare('newpass123', data.passwordHash)).resolves.toBe(
        true,
      );
      expect(resetToken.delete).toHaveBeenCalledWith({
        where: { id: 'token-1' },
      });
    });
  });
});
