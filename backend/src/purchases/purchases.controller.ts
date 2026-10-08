import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Roles('SUPER_ADMIN', 'MASTER', 'ACCOUNT', 'PHARMACY')
  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreatePurchaseDto) {
    return this.purchasesService.create(user.clinicId, dto, user);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'ACCOUNT', 'PHARMACY')
  @Get()
  findAll(@CurrentUser() user: any, @Query('search') search?: string) {
    return this.purchasesService.findAll(user.clinicId, search);
  }

  // Declared before the `:id` route so "itc-summary" is not captured as an id.
  @Roles('SUPER_ADMIN', 'MASTER', 'ACCOUNT', 'PHARMACY')
  @Get('itc-summary')
  itcSummary(@CurrentUser() user: any, @Query('fromDate') fromDate?: string, @Query('toDate') toDate?: string) {
    return this.purchasesService.itcSummary(user.clinicId, fromDate, toDate);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'ACCOUNT', 'PHARMACY')
  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.purchasesService.findOne(user.clinicId, id);
  }
}
