import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { PlatformService } from './platform.service';
import { UpsertSubscriptionDto } from './dto/upsert-subscription.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

/** The vendor's console. Nobody inside a hospital may reach any of this. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@Controller('platform')
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @Get('hospitals')
  listHospitals() {
    return this.platformService.listHospitals();
  }

  @Get('revenue')
  getRevenue() {
    return this.platformService.getPlatformRevenue();
  }

  @Get('hospitals/:id')
  getHospital(@Param('id') id: string) {
    return this.platformService.getHospital(id);
  }

  @Put('hospitals/:id/subscription')
  upsertSubscription(@Param('id') id: string, @Body() dto: UpsertSubscriptionDto) {
    return this.platformService.upsertSubscription(id, dto);
  }

  @Post('hospitals/:id/payments')
  recordPayment(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: RecordPaymentDto) {
    return this.platformService.recordPayment(id, dto, user);
  }
}
