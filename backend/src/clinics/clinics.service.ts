import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { CreateClinicDto } from './dto/create-clinic.dto';
import { UpdateClinicDto } from './dto/update-clinic.dto';

@Injectable()
export class ClinicsService {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
  ) {}

  /**
   * The letterhead a clinic's paperwork prints under: its own record, with the GST
   * identifiers merged in from settings.
   *
   * Name, address and contact come from the clinic row because those are per-tenant.
   * GSTIN and the state code live in settings — there is no per-clinic column for them
   * yet — and settings also supply the fallback for a caller with no clinic of their
   * own, such as a platform admin who has not stepped into one.
   */
  async letterhead(clinicId: string | null | undefined) {
    const settings = await this.settings.getSettings();
    const clinic = clinicId
      ? await this.prisma.clinic.findUnique({ where: { id: clinicId } })
      : null;

    return {
      name: clinic?.name ?? settings.clinicName,
      address: clinic?.address ?? settings.clinicAddress,
      phone: clinic?.phone ?? settings.clinicPhone,
      email: clinic?.email ?? settings.clinicEmail,
      gstin: settings.gstin,
      stateCode: settings.stateCode,
      stateName: settings.stateName,
    };
  }

  async create(dto: CreateClinicDto) {
    return this.prisma.clinic.create({
      data: {
        name: dto.name.trim(),
        address: dto.address?.trim(),
        phone: dto.phone?.trim(),
        email: dto.email?.trim(),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async findAll() {
    return this.prisma.clinic.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const clinic = await this.prisma.clinic.findUnique({ where: { id } });
    if (!clinic) throw new NotFoundException(`Clinic ID ${id} not found`);
    return clinic;
  }

  async update(id: string, dto: UpdateClinicDto) {
    return this.prisma.clinic.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.address !== undefined ? { address: dto.address.trim() } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone.trim() } : {}),
        ...(dto.email !== undefined ? { email: dto.email.trim() } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }
}
