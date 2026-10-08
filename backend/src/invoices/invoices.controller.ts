import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Roles('SUPER_ADMIN', 'MASTER', 'RECEPTION', 'PHARMACY')
  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateInvoiceDto) {
    return this.invoicesService.create(user.clinicId, dto);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR', 'RM', 'RECEPTION', 'ACCOUNT')
  @Get()
  findAll(
    @CurrentUser() user: any,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('reconciled') reconciled?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.invoicesService.findAll(
      user.clinicId,
      { search, from, to, reconciled },
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
    );
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR', 'RM', 'RECEPTION', 'ACCOUNT')
  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.invoicesService.findOne(user.clinicId, id);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'ACCOUNT')
  @Patch(':id/reconcile')
  reconcile(@CurrentUser() user: any, @Param('id') id: string) {
    return this.invoicesService.toggleReconcile(user.clinicId, id);
  }

  @Roles('SUPER_ADMIN', 'MASTER')
  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.invoicesService.remove(user.clinicId, id);
  }
}
