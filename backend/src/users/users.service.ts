import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto, UpdateUserDto } from './users.controller';

/** Never select passwordHash — this list feeds client-side staff dropdowns. */
const STAFF_FIELDS = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
  assignedDoctorId: true,
  assignedDoctor: { select: { id: true, name: true } },
  departmentId: true,
  department: { select: { id: true, name: true, code: true } },
} as const;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Lists clinic staff for assignment dropdowns (attending doctor, relationship
   * manager, dispensing pharmacist). `role` accepts a comma-separated list so a
   * caller can ask for e.g. `?role=DOCTOR,MASTER` in one request.
   */
  async findAll(clinicId: string, role?: string, search?: string, limit?: number) {
    const roles = role
      ? role
          .split(',')
          .map((r) => r.trim().toUpperCase())
          .filter(Boolean)
      : undefined;

    const term = search?.trim();

    // Callers are mostly filling a picker, so this is capped rather than paged.
    // A hospital with hundreds of staff searches instead of scrolling.
    return this.prisma.user.findMany({
      where: {
        clinicId,
        ...(roles && roles.length > 0 ? { role: { in: roles } } : {}),
        ...(term ? { OR: [{ name: { contains: term } }, { email: { contains: term } }] } : {}),
      },
      select: STAFF_FIELDS,
      orderBy: { name: 'asc' },
      take: Math.min(limit ?? 200, 500),
    });
  }

  async findOne(clinicId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, clinicId },
      select: STAFF_FIELDS,
    });
    if (!user) {
      throw new NotFoundException(`User ID ${id} not found`);
    }
    return user;
  }

  async create(clinicId: string, dto: CreateUserDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.user.create({
      data: {
        clinicId,
        email: dto.email.toLowerCase().trim(),
        passwordHash,
        name: dto.name.trim(),
        role: dto.role,
        assignedDoctorId: dto.assignedDoctorId || null,
        departmentId: dto.departmentId || null,
      },
      select: STAFF_FIELDS,
    });
  }

  async remove(clinicId: string, id: string, requestorRole: string) {
    const targetUser = await this.findOne(clinicId, id);
    if (targetUser.role === 'SUPER_ADMIN' && requestorRole !== 'SUPER_ADMIN') {
      throw new Error('Only SUPER_ADMIN can delete another SUPER_ADMIN');
    }
    await this.prisma.user.delete({ where: { id } });
    return { message: 'User deleted successfully' };
  }

  async update(clinicId: string, id: string, dto: UpdateUserDto, requestorRole: string) {
    const existing = await this.findOne(clinicId, id);
    if (existing.role === 'SUPER_ADMIN' && requestorRole !== 'SUPER_ADMIN' && dto.role && dto.role !== 'SUPER_ADMIN') {
      throw new Error('Only SUPER_ADMIN can demote another SUPER_ADMIN');
    }

    const data: any = {};
    if (dto.email !== undefined) data.email = dto.email.toLowerCase().trim();
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.password !== undefined) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
    }
    // Empty string clears the link; undefined leaves it untouched.
    if (dto.assignedDoctorId !== undefined) {
      data.assignedDoctorId = dto.assignedDoctorId || null;
    }
    if (dto.departmentId !== undefined) {
      data.departmentId = dto.departmentId || null;
    }
    if (requestorRole === 'SUPER_ADMIN' && dto.clinicId !== undefined) {
      data.clinicId = dto.clinicId;
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: STAFF_FIELDS,
    });
  }
}
