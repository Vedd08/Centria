import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    let dbStatus = 'disconnected';
    let dbDetails = '';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
    } catch (err: any) {
      dbStatus = 'error';
      dbDetails = err?.message || 'Database connection unreachable';
    }

    return {
      status: 'ok',
      service: 'HMS NestJS Backend',
      timestamp: new Date().toISOString(),
      database: {
        provider: 'postgresql',
        status: dbStatus,
        details: dbDetails,
      },
    };
  }
}
