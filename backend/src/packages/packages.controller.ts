import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { PackagesService } from './packages.service';
import { CreatePackageTypeDto } from './dto/create-package-type.dto';
import { PurchasePackageDto } from './dto/purchase-package.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('packages')
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  @Roles('SUPER_ADMIN', 'MASTER')
  @Post('types')
  createType(@CurrentUser() user: any, @Body() dto: CreatePackageTypeDto) {
    return this.packagesService.createPackageType(user.clinicId, dto);
  }

  @Roles('SUPER_ADMIN', 'MASTER')
  @Put('types/:id')
  updateType(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: CreatePackageTypeDto) {
    return this.packagesService.updatePackageType(user.clinicId, id, dto);
  }

  @Roles('SUPER_ADMIN', 'MASTER')
  @Delete('types/:id')
  removeType(@CurrentUser() user: any, @Param('id') id: string) {
    return this.packagesService.removePackageType(user.clinicId, id);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR', 'RM', 'RECEPTION', 'ACCOUNT')
  @Get('types')
  findAllTypes(@CurrentUser() user: any) {
    return this.packagesService.findAllPackageTypes(user.clinicId);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'RM', 'RECEPTION')
  @Post('purchases')
  purchasePackage(@CurrentUser() user: any, @Body() dto: PurchasePackageDto) {
    return this.packagesService.purchasePackage(user.clinicId, dto);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR', 'RM', 'RECEPTION', 'ACCOUNT')
  @Get('purchases')
  findAllPurchases(@CurrentUser() user: any, @Query('patientId') patientId?: string) {
    return this.packagesService.findAllPurchases(user.clinicId, patientId);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR', 'RM', 'RECEPTION', 'ACCOUNT')
  @Get('purchases/active')
  findActivePurchases(@CurrentUser() user: any, @Query('patientId') patientId: string) {
    return this.packagesService.findActivePurchasesByPatient(user.clinicId, patientId);
  }
}
