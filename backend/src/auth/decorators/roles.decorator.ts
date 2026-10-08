import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export type UserRole =
  | 'SUPER_ADMIN'
  | 'MASTER'
  | 'DOCTOR'
  | 'RM'
  | 'RECEPTION'
  | 'PHARMACY'
  | 'ACCOUNT'
  | 'NURSE'
  | 'STAFF';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
