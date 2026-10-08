import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

/** Money is the accounts desk's business — and the owner's. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'MASTER', 'ACCOUNT')
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get('summary')
  getSummary(@CurrentUser() user: any, @Query('from') from?: string, @Query('to') to?: string) {
    return this.accountsService.getSummary(user.clinicId, from, to);
  }

  @Get('ledger')
  getLedger(@CurrentUser() user: any, @Query('from') from?: string, @Query('to') to?: string) {
    return this.accountsService.getLedger(user.clinicId, from, to);
  }
}
