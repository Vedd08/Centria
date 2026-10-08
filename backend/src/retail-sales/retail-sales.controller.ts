import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { RetailSalesService } from './retail-sales.service';
import { CreateRetailSaleDto } from './dto/create-retail-sale.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('retail-sales')
export class RetailSalesController {
  constructor(private readonly retailSalesService: RetailSalesService) {}

  @Roles('SUPER_ADMIN', 'MASTER', 'PHARMACY')
  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateRetailSaleDto) {
    return this.retailSalesService.create(user.clinicId, dto, user);
  }
}
