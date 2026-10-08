import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_SETTINGS: Record<string, string> = {
  clinicName: 'Aesthetic Care Clinic',
  clinicAddress: '123 MG Road, Bangalore, Karnataka 560001',
  clinicPhone: '+91-80-41234567',
  clinicEmail: 'info@aestheticcare.in',
  gstin: '29AAAAA0000A1Z5',
  stateCode: '29',
  stateName: 'Karnataka',
};

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getSettings() {
    // Settings are stored as key-value pairs in the database
    const rows = await this.prisma.setting.findMany();
    if (rows.length === 0) {
      return { ...DEFAULT_SETTINGS };
    }

    const stored: Record<string, string> = {};
    for (const row of rows) {
      stored[row.key] = row.value;
    }

    return { ...DEFAULT_SETTINGS, ...stored };
  }

  async updateSettings(settings: Record<string, string>) {
    for (const [key, value] of Object.entries(settings)) {
      if (key === 'message') continue;
      await this.prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
    }

    return { ...(await this.getSettings()), message: 'Settings updated successfully' };
  }
}
