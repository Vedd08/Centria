import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { PackagesService } from './packages.service';
import { CreatePackageTypeDto } from './dto/create-package-type.dto';
import { UpdatePackagePlanDto, DoctorDelayDto, PatientLapseDto, CreateHolidayDto } from './dto/package-plan.dto';
import { PurchasePackageDto } from './dto/purchase-package.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('packages')
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR')
  @Post('types')
  createType(@CurrentUser() user: any, @Body() dto: CreatePackageTypeDto) {
    return this.packagesService.createPackageType(user, dto);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR')
  @Put('types/:id')
  updateType(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: CreatePackageTypeDto) {
    return this.packagesService.updatePackageType(user, id, dto);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR')
  @Delete('types/:id')
  removeType(@CurrentUser() user: any, @Param('id') id: string) {
    return this.packagesService.removePackageType(user, id);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR', 'RM', 'RECEPTION', 'ACCOUNT')
  @Get('types')
  findAllTypes(@CurrentUser() user: any) {
    return this.packagesService.findAllPackageTypes(user.clinicId);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'RM', 'RECEPTION')
  @Post('purchases')
  purchasePackage(@CurrentUser() user: any, @Body() dto: PurchasePackageDto) {
    // The signed-in user is recorded as whoever gave any discount on this sale.
    return this.packagesService.purchasePackage(user.clinicId, dto, user);
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

  // --- Clinic holidays: sittings that land on one move to the next open day ---

  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR', 'RM', 'RECEPTION', 'ACCOUNT', 'NURSE', 'STAFF')
  @Get('holidays')
  listHolidays(@CurrentUser() user: any) {
    return this.packagesService.listHolidays(user.clinicId);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR')
  @Post('holidays')
  addHoliday(@CurrentUser() user: any, @Body() dto: CreateHolidayDto) {
    return this.packagesService.addHoliday(user.clinicId, dto);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR')
  @Delete('holidays/:id')
  removeHoliday(@CurrentUser() user: any, @Param('id') id: string) {
    return this.packagesService.removeHoliday(user.clinicId, id);
  }

  // --- Sitting plan of one sold package (declared after purchases/active) ---

  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR', 'RM', 'RECEPTION', 'ACCOUNT')
  @Get('purchases/:id')
  findOnePurchase(@CurrentUser() user: any, @Param('id') id: string) {
    return this.packagesService.findOnePurchase(user.clinicId, id);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR')
  @Patch('purchases/:id/plan')
  updatePlan(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdatePackagePlanDto) {
    return this.packagesService.updatePlan(user, id, dto);
  }

  /** Delay caused by the doctor/clinic: extends the package, no charge (red notice). */
  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR')
  @Post('purchases/:id/doctor-delay')
  doctorDelay(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: DoctorDelayDto) {
    return this.packagesService.doctorDelay(user, id, dto);
  }

  /** Missed by the patient: the package lapses and they buy again. */
  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR')
  @Post('purchases/:id/lapse')
  patientLapse(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: PatientLapseDto) {
    return this.packagesService.patientLapse(user, id, dto);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR')
  @Post('purchases/:id/reinstate')
  reinstate(@CurrentUser() user: any, @Param('id') id: string, @Body('note') note?: string) {
    return this.packagesService.reinstate(user, id, note);
  }
}
