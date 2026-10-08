import { CallHandler, ExecutionContext, ForbiddenException, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';

/** Header a platform admin sends to work inside one of their client hospitals. */
export const CLINIC_CONTEXT_HEADER = 'x-clinic-id';

/**
 * Lets a platform admin (SUPER_ADMIN) step into a client hospital.
 *
 * Every service in this codebase scopes its queries by `user.clinicId`. Rather than
 * thread a second "which hospital" argument through all of them, this swaps the
 * clinicId on the request once, after authentication — so every existing endpoint
 * returns that hospital's data unchanged.
 *
 * Only SUPER_ADMIN may do this. For every other role the header is ignored outright,
 * so a hospital's own staff can never read across into another hospital.
 */
@Injectable()
export class ClinicContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const requested = request.headers?.[CLINIC_CONTEXT_HEADER];

    if (requested && request.user) {
      if (request.user.role !== 'SUPER_ADMIN') {
        throw new ForbiddenException('Only platform administrators can view another hospital');
      }
      request.user = {
        ...request.user,
        clinicId: Array.isArray(requested) ? requested[0] : requested,
        // Kept so handlers and audit logging can tell a platform visit from
        // the admin working in their own clinic.
        actingAsPlatformAdmin: true,
      };
    }

    return next.handle();
  }
}
