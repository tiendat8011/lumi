import { StudentAccountsService } from './student-accounts.service';

describe('StudentAccountsService', () => {
  let service: StudentAccountsService;

  beforeEach(() => {
    service = new StudentAccountsService();
  });

  it('rejects when limit would be exceeded', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'teacher-id' }]),
      user: {
        count: jest.fn().mockResolvedValue(499),
        create: jest.fn(),
      },
      classroomMember: { create: jest.fn() },
    } as any;

    await expect(
      service.createStudents(
        tx,
        'teacher-id',
        [
          { displayName: 'Student A' },
          { displayName: 'Student B' },
        ],
      ),
    ).rejects.toMatchObject({
      response: { code: 'STUDENT_CREATION_LIMIT_REACHED' },
    });
  });

  it('allows creation within the limit', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'teacher-id' }]),
      user: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({
          id: 'new-id',
          email: 'student_abc@lumi.local',
          displayName: 'Test Student',
        }),
      },
      classroomMember: { create: jest.fn() },
    } as any;

    const result = await service.createStudents(
      tx,
      'teacher-id',
      [{ displayName: 'Test Student' }],
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.temporaryPassword).toBeDefined();
    expect(tx.user.create).toHaveBeenCalledTimes(1);
  });
});
