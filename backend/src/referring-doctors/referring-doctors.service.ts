import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReferringDoctorDto } from './dto/create-referring-doctor.dto';

/**
 * What reception typed for "no referral" before this list existed — including the
 * common typo "Sekf" seen in the imported registers.
 */
const NOT_A_REFERRAL = /^(s[ae][lk]f|walk[\s-]?in|self[\s-]?walk[\s-]?in|none|nil|null|no|na|n\/a|-+|\.+)$/i;

const normalise = (name: string) => name.trim().replace(/\s+/g, ' ');

@Injectable()
export class ReferringDoctorsService {
  constructor(private prisma: PrismaService) {}

  async findAll(clinicId: string) {
    await this.importLegacyNames(clinicId);
    return this.prisma.referringDoctor.findMany({
      where: { clinicId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async create(clinicId: string, dto: CreateReferringDoctorDto) {
    const name = normalise(dto.name);
    // Case-insensitive, so "dr. mehta" isn't registered next to "Dr. Mehta". The list
    // is one clinic's referrers, small enough to compare in memory on both databases.
    const registered = await this.prisma.referringDoctor.findMany({ where: { clinicId }, select: { name: true } });
    const clash = registered.find((d) => d.name.toLowerCase() === name.toLowerCase());
    if (clash) {
      throw new ConflictException(`${clash.name} is already registered`);
    }
    try {
      return await this.prisma.referringDoctor.create({
        data: {
          clinicId,
          name,
          phone: dto.phone?.trim() || null,
          hospital: dto.hospital?.trim() || null,
          speciality: dto.speciality?.trim() || null,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`${name} is already registered`);
      }
      throw error;
    }
  }

  /**
   * Patients registered before the list existed carry the referring doctor as free
   * text. The first time a clinic opens the list, those names are registered so
   * reception can keep picking them instead of retyping them.
   */
  private async importLegacyNames(clinicId: string) {
    const registered = await this.prisma.referringDoctor.count({ where: { clinicId } });
    if (registered > 0) return;

    const rows = await this.prisma.patient.findMany({
      where: { clinicId, referringDoctor: { not: null } },
      select: { referringDoctor: true },
      distinct: ['referringDoctor'],
    });
    // Keep the first spelling of each name, ignoring case ("Nil" / "nil").
    const byLower = new Map<string, string>();
    for (const r of rows) {
      const n = normalise(r.referringDoctor ?? '');
      if (n && !NOT_A_REFERRAL.test(n) && !byLower.has(n.toLowerCase())) byLower.set(n.toLowerCase(), n);
    }
    const names = Array.from(byLower.values());
    if (names.length === 0) return;

    // createMany has no skipDuplicates on SQLite, so insert one at a time and let
    // the unique index absorb a concurrent first load.
    for (const name of names) {
      try {
        await this.prisma.referringDoctor.create({ data: { clinicId, name } });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
      }
    }
  }
}
