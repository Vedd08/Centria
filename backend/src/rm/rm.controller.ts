import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { RmService } from './rm.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

/** The desk itself is the RM's; owners can look over any manager's shoulder. */
const DESK_ROLES = ['SUPER_ADMIN', 'MASTER', 'RM'] as const;

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('rm')
export class RmController {
  constructor(private readonly rmService: RmService) {}

  @Roles(...DESK_ROLES)
  @Get('desk')
  getDesk(@CurrentUser() user: any, @Query('rmId') rmId?: string) {
    return this.rmService.getDesk(user.clinicId, rmId, user);
  }

  @Roles(...DESK_ROLES)
  @Get('clients')
  getClients(@CurrentUser() user: any, @Query('rmId') rmId?: string, @Query('search') search?: string) {
    return this.rmService.getClients(user.clinicId, rmId, user, search);
  }

  @Roles(...DESK_ROLES)
  @Get('managers')
  listManagers(@CurrentUser() user: any) {
    return this.rmService.listManagers(user.clinicId);
  }

  @Roles(...DESK_ROLES)
  @Patch('clients/:patientId/assign')
  assign(@CurrentUser() user: any, @Param('patientId') patientId: string, @Query('rmId') rmId?: string) {
    return this.rmService.assignPatient(user.clinicId, patientId, rmId, user);
  }

  @Roles(...DESK_ROLES)
  @Patch('clients/:patientId/release')
  release(@CurrentUser() user: any, @Param('patientId') patientId: string) {
    return this.rmService.releasePatient(user.clinicId, patientId, user);
  }
}
