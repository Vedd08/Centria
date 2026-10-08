import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
// HealthModule relies on PrismaService (injected into HealthController).
// PrismaModule is @Global(), so no explicit import is needed here.
