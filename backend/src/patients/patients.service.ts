import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';

@Injectable()
export class PatientsService {
  constructor(private prisma: PrismaService) {}

  private async generateNextUHID(clinicId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `UHID-${year}-`;

    const count = await this.prisma.patient.count({ where: { clinicId } });
    const nextNumber = (count + 1).toString().padStart(4, '0');
    let candidate = `${prefix}${nextNumber}`;

    // Ensure uniqueness within the clinic
    let existing = await this.prisma.patient.findFirst({ where: { uhid: candidate, clinicId } });
    let counter = count + 1;
    while (existing) {
      counter++;
      candidate = `${prefix}${counter.toString().padStart(4, '0')}`;
      existing = await this.prisma.patient.findFirst({ where: { uhid: candidate, clinicId } });
    }

    return candidate;
  }

  async create(clinicId: string, createPatientDto: CreatePatientDto) {
    let retries = 3;
    while (retries > 0) {
      try {
        const uhid = await this.generateNextUHID(clinicId);
        
        return await this.prisma.patient.create({
          data: {
            clinicId,
            uhid,
            name: createPatientDto.name,
            phone: createPatientDto.phone,
            dob: createPatientDto.dob,
            gender: createPatientDto.gender,
            address: createPatientDto.address,
            allergyNotes: createPatientDto.allergyNotes,
            referringDoctor: createPatientDto.referringDoctor,
            howHeardAboutUs: createPatientDto.howHeardAboutUs,
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          retries--;
          if (retries === 0) throw error;
        } else {
          throw error;
        }
      }
    }
  }

  async findAll(clinicId: string, search?: string, page: number = 1, pageSize: number = 20) {
    const where: Prisma.PatientWhereInput = { clinicId };
    const term = search?.trim();
    
    if (term) {
      where.OR = [
        { name: { contains: term } },
        { phone: { contains: term } },
        { uhid: { contains: term } },
        { referringDoctor: { contains: term } },
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.patient.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.patient.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findOne(clinicId: string, id: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { id, clinicId },
    });
    if (!patient) {
      throw new NotFoundException(`Patient with ID ${id} not found`);
    }
    return patient;
  }

  /**
   * Lifetime value, mirroring the clinic's spreadsheet formula:
   *   OPD(cash+bank) + IPD(cash+bank) + Packages(cash+bank)
   * Returned alongside the OPD/IPD split so the patient header can show the breakdown.
   */
  async getLifetimeValue(clinicId: string, id: string) {
    await this.findOne(clinicId, id); // Ensure existence and clinic ownership

    const [visitTotals, packageTotals] = await Promise.all([
      this.prisma.visit.groupBy({
        by: ['visitType'],
        where: { patientId: id, clinicId },
        _sum: { cashAmount: true, bankAmount: true },
        _count: { _all: true },
      }),
      this.prisma.packagePurchase.aggregate({
        where: { patientId: id, clinicId },
        _sum: { cashAmount: true, bankAmount: true },
        _count: { _all: true },
      }),
    ]);

    const sumFor = (type: string) => {
      const row = visitTotals.find((v) => v.visitType === type);
      return Number(row?._sum.cashAmount ?? 0) + Number(row?._sum.bankAmount ?? 0);
    };
    const countFor = (type: string) => visitTotals.find((v) => v.visitType === type)?._count._all ?? 0;

    const opdValue = sumFor('OPD');
    const ipdValue = sumFor('IPD');
    const packageValue = Number(packageTotals._sum.cashAmount ?? 0) + Number(packageTotals._sum.bankAmount ?? 0);

    return {
      lifetimeValue: opdValue + ipdValue + packageValue,
      opdValue,
      ipdValue,
      packageValue,
      opdVisits: countFor('OPD'),
      ipdVisits: countFor('IPD'),
      packages: packageTotals._count._all,
    };
  }

  async update(clinicId: string, id: string, updatePatientDto: UpdatePatientDto) {
    // Ensure patient belongs to clinic
    await this.findOne(clinicId, id);
    return this.prisma.patient.update({
      where: { id },
      data: updatePatientDto,
    });
  }

  async remove(clinicId: string, id: string) {
    const result = await this.prisma.patient.deleteMany({ where: { id, clinicId } });
    if (result.count === 0) {
      throw new NotFoundException(`Patient with ID ${id} not found`);
    }
    return { message: 'Patient deleted successfully' };
  }
}
