import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertDepartmentDto } from './dto/upsert-department.dto';

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService) {}

  async create(clinicId: string, dto: UpsertDepartmentDto) {
    return this.prisma.department.create({
      data: {
        clinicId,
        name: dto.name.trim(),
        code: dto.code.trim().toUpperCase(),
        description: dto.description,
        isActive: dto.isActive ?? true,
      },
    });
  }

  /** Includes the doctors in each department, so reception can pick in one step. */
  async findAll(clinicId: string, activeOnly = false) {
    return this.prisma.department.findMany({
      where: { clinicId, ...(activeOnly ? { isActive: true } : {}) },
      include: {
        users: {
          where: { role: { in: ['DOCTOR', 'MASTER'] } },
          select: { id: true, name: true, role: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(clinicId: string, id: string) {
    const dept = await this.prisma.department.findFirst({
      where: { id, clinicId },
      include: { users: { select: { id: true, name: true, role: true } } },
    });
    if (!dept) throw new NotFoundException(`Department ${id} not found`);
    return dept;
  }

  async update(clinicId: string, id: string, dto: UpsertDepartmentDto) {
    await this.findOne(clinicId, id);
    return this.prisma.department.update({
      where: { id },
      data: {
        name: dto.name.trim(),
        code: dto.code.trim().toUpperCase(),
        description: dto.description,
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async remove(clinicId: string, id: string) {
    const dept = await this.findOne(clinicId, id);

    // History must keep pointing at a real department, so a used one is retired
    // rather than deleted.
    const inUse = await this.prisma.patientQueue.count({ where: { departmentId: id, clinicId } });
    if (inUse > 0) {
      throw new BadRequestException(
        `${dept.name} has ${inUse} patient visit(s) on record. Mark it inactive instead of deleting it.`,
      );
    }

    await this.prisma.user.updateMany({ where: { departmentId: id }, data: { departmentId: null } });
    await this.prisma.department.delete({ where: { id } });
    return { id, deleted: true };
  }
}
