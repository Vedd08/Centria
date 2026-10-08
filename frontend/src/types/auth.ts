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

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}
