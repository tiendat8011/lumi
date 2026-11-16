import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../../database/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.googleClient = new OAuth2Client(
      this.configService.get<string>('GOOGLE_CLIENT_ID'),
    );
  }

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      displayName: dto.displayName,
      role: dto.role,
    });

    return this.sanitizeUser(user);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException(
        'Tài khoản này sử dụng đăng nhập Google. Vui lòng đăng nhập bằng Google.',
      );
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user.id, user.role);
    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async googleLogin(dto: GoogleLoginDto) {
    const googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    if (!googleClientId) {
      throw new BadRequestException('Google login is not configured');
    }

    let payload;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: dto.credential,
        audience: googleClientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Invalid Google token');
    }

    if (!payload || !payload.email) {
      throw new UnauthorizedException('Invalid Google token payload');
    }

    const googleId = payload.sub;
    const email = payload.email;
    const displayName = payload.name || email.split('@')[0] || 'User';
    const avatarUrl = payload.picture || undefined;

    // 1. Check if user exists by googleId
    let user = await this.usersService.findByGoogleId(googleId);
    if (user) {
      const tokens = await this.generateTokens(user.id, user.role);
      return { user: this.sanitizeUser(user), ...tokens };
    }

    // 2. Check if user exists by email — link Google account
    user = await this.usersService.findByEmail(email);
    if (user) {
      await this.usersService.linkGoogle(user.id, { googleId, avatarUrl });
      const tokens = await this.generateTokens(user.id, user.role);
      return { user: this.sanitizeUser(user), ...tokens };
    }

    // 3. Create new user (no password needed)
    user = await this.usersService.create({
      email,
      displayName,
      role: dto.role,
      googleId,
      avatarUrl,
    });

    const tokens = await this.generateTokens(user.id, user.role);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException();

    const updateData: { displayName?: string; passwordHash?: string } = {};

    if (dto.displayName) {
      updateData.displayName = dto.displayName;
    }

    if (dto.newPassword) {
      if (user.passwordHash) {
        // User has a password — require current password
        if (!dto.currentPassword) {
          throw new BadRequestException('Current password is required');
        }
        const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
        if (!valid) {
          throw new BadRequestException('Current password is incorrect');
        }
      }
      // Google-only users can set a password without providing current password
      updateData.passwordHash = await bcrypt.hash(dto.newPassword, 12);
    }

    const updated = await this.usersService.updateProfile(userId, updateData);
    return this.sanitizeUser(updated);
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) return { message: 'If the email exists, a reset link has been sent' };

    await this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + 3600_000);

    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    // In production: send email with token. For now, return it.
    return { message: 'If the email exists, a reset link has been sent', resetToken: token };
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = this.hashToken(token);
    const stored = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.usersService.updateProfile(stored.userId, { passwordHash });
    await this.prisma.passwordResetToken.delete({ where: { id: stored.id } });

    return { message: 'Password reset successfully' };
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);

    const stored = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        expiresAt: { gt: new Date() },
      },
    });

    if (!stored) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.prisma.refreshToken.delete({ where: { id: stored.id } });

    const user = await this.usersService.findById(stored.userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.generateTokens(user.id, user.role);
  }

  async logout(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.deleteMany({ where: { tokenHash } });
  }

  private async generateTokens(userId: string, role: string) {
    const payload = { sub: userId, role };

    const accessToken = this.jwtService.sign(payload);

    const refreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(refreshToken);

    const refreshExpiresIn = this.configService.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      '7d',
    );
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.parseDays(refreshExpiresIn));

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private sanitizeUser(user: {
    id: string;
    email: string;
    displayName: string;
    role: string;
    createdAt: Date;
  }) {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      createdAt: user.createdAt,
    };
  }

  private parseDays(value: string): number {
    const match = value.match(/^(\d+)d$/);
    return match ? parseInt(match[1]!, 10) : 7;
  }
}
