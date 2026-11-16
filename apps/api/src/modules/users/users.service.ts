import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByGoogleId(googleId: string) {
    return this.prisma.user.findUnique({ where: { googleId } });
  }

  async create(data: {
    email: string;
    passwordHash?: string;
    displayName: string;
    role: Role;
    googleId?: string;
    avatarUrl?: string;
  }) {
    return this.prisma.user.create({ data });
  }

  async linkGoogle(id: string, data: { googleId: string; avatarUrl?: string }) {
    return this.prisma.user.update({
      where: { id },
      data: {
        googleId: data.googleId,
        ...(data.avatarUrl && { avatarUrl: data.avatarUrl }),
      },
    });
  }

  async updateProfile(id: string, data: { displayName?: string; passwordHash?: string }) {
    const updateData: Record<string, string> = {};
    if (data.displayName) updateData.displayName = data.displayName;
    if (data.passwordHash) updateData.passwordHash = data.passwordHash;
    return this.prisma.user.update({
      where: { id },
      data: updateData,
    });
  }
}
