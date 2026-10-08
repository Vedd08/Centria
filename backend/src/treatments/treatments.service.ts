import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTreatmentDto } from './dto/create-treatment.dto';
import { UpdateTreatmentDto } from './dto/update-treatment.dto';

@Injectable()
export class TreatmentsService {
  constructor(private prisma: PrismaService) {}

  async create(clinicId: string, createTreatmentDto: CreateTreatmentDto) {
    return this.prisma.treatmentMaster.create({
      data: {
        clinicId,
        name: createTreatmentDto.name.trim(),
        isGstTaxable: createTreatmentDto.isGstTaxable,
        ...(createTreatmentDto.price !== undefined ? { price: createTreatmentDto.price } : {}),
        ...(createTreatmentDto.hsnCode !== undefined ? { hsnCode: createTreatmentDto.hsnCode } : {}),
        ...(createTreatmentDto.taxRate !== undefined ? { taxRate: createTreatmentDto.taxRate } : {}),
      },
    });
  }

  async findAll(clinicId: string) {
    return this.prisma.treatmentMaster.findMany({
      where: { clinicId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(clinicId: string, id: string) {
    const treatment = await this.prisma.treatmentMaster.findFirst({
      where: { id, clinicId },
    });
    if (!treatment) {
      throw new NotFoundException(`Treatment ID ${id} not found`);
    }
    return treatment;
  }

  async update(clinicId: string, id: string, updateTreatmentDto: UpdateTreatmentDto) {
    await this.findOne(clinicId, id);
    return this.prisma.treatmentMaster.update({
      where: { id },
      data: updateTreatmentDto,
    });
  }

  async remove(clinicId: string, id: string) {
    const result = await this.prisma.treatmentMaster.deleteMany({ where: { id, clinicId } });
    if (result.count === 0) {
      throw new NotFoundException(`Treatment ID ${id} not found`);
    }
    return { message: 'Treatment deleted successfully' };
  }
}
