import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWardDto } from './dto/create-ward.dto';
import { UpdateWardDto } from './dto/update-ward.dto';
import { CreateBedDto } from './dto/create-bed.dto';
import { UpdateBedDto } from './dto/update-bed.dto';

@Injectable()
export class WardsService {
  constructor(private prisma: PrismaService) {}

  async createWard(clinicId: string, dto: CreateWardDto) {
    return this.prisma.ward.create({
      data: { clinicId, name: dto.name.trim(), floor: dto.floor },
    });
  }

  async findAllWards(clinicId: string) {
    return this.prisma.ward.findMany({
      where: { clinicId },
      include: { beds: { orderBy: { bedNumber: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOneWard(clinicId: string, id: string) {
    const ward = await this.prisma.ward.findFirst({
      where: { id, clinicId },
      include: { beds: { orderBy: { bedNumber: 'asc' } } },
    });
    if (!ward) {
      throw new NotFoundException(`Ward ID ${id} not found`);
    }
    return ward;
  }

  async updateWard(clinicId: string, id: string, dto: UpdateWardDto) {
    await this.findOneWard(clinicId, id);
    return this.prisma.ward.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.floor !== undefined ? { floor: dto.floor } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async addBed(clinicId: string, wardId: string, dto: CreateBedDto) {
    const ward = await this.findOneWard(clinicId, wardId);
    return this.prisma.bed.create({
      data: { clinicId, wardId: ward.id, bedNumber: dto.bedNumber.trim() },
    });
  }

  async findAllBeds(clinicId: string, filters: { wardId?: string; status?: string } = {}) {
    return this.prisma.bed.findMany({
      where: {
        clinicId,
        ...(filters.wardId ? { wardId: filters.wardId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      include: { ward: true },
      orderBy: [{ ward: { name: 'asc' } }, { bedNumber: 'asc' }],
    });
  }

  private async findOneBed(clinicId: string, id: string) {
    const bed = await this.prisma.bed.findFirst({ where: { id, clinicId }, include: { ward: true } });
    if (!bed) {
      throw new NotFoundException(`Bed ID ${id} not found`);
    }
    return bed;
  }

  async updateBed(clinicId: string, id: string, dto: UpdateBedDto) {
    const bed = await this.findOneBed(clinicId, id);

    if (dto.status !== undefined && bed.status === 'OCCUPIED') {
      throw new BadRequestException(
        'This bed currently has an admitted patient — discharge the patient before changing its status',
      );
    }

    return this.prisma.bed.update({
      where: { id },
      data: {
        ...(dto.bedNumber !== undefined ? { bedNumber: dto.bedNumber.trim() } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }
}
