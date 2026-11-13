import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { Tx, lockUser } from '../../common/db/locks';
import { fail } from '../../common/errors/app-error';

const MAX_CREATED_STUDENTS = 500;
const BCRYPT_ROUNDS = 12;

export type StudentEntry = {
  displayName: string;
  email?: string;
  password?: string;
};

export type CreatedStudent = {
  id: string;
  email: string;
  displayName: string;
  temporaryPassword: string;
};

@Injectable()
export class StudentAccountsService {
  async createStudents(
    tx: Tx,
    teacherId: string,
    entries: StudentEntry[],
    classroomId?: string,
  ): Promise<CreatedStudent[]> {
    await lockUser(tx, teacherId);

    const existing = await tx.user.count({
      where: { createdByTeacherId: teacherId },
    });
    if (existing + entries.length > MAX_CREATED_STUDENTS) {
      throw fail(
        400,
        'STUDENT_CREATION_LIMIT_REACHED',
        `Bạn đã tạo ${existing}/${MAX_CREATED_STUDENTS} tài khoản học sinh. Chỉ có thể tạo thêm ${MAX_CREATED_STUDENTS - existing} tài khoản`,
      );
    }

    const results: CreatedStudent[] = [];
    for (const entry of entries) {
      const email =
        entry.email ||
        `student_${randomBytes(4).toString('hex')}@lumi.local`;
      const password =
        entry.password || randomBytes(4).toString('hex');
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          displayName: entry.displayName,
          role: 'STUDENT',
          createdByTeacherId: teacherId,
        },
      });

      if (classroomId) {
        await tx.classroomMember.create({
          data: { classroomId, userId: user.id },
        });
      }

      results.push({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        temporaryPassword: password,
      });
    }

    return results;
  }
}
