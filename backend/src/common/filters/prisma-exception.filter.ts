import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

/**
 * Without this, any Prisma error reaches the client as a bare
 * `{"statusCode":500,"message":"Internal server error"}` — which hides actionable
 * causes such as a duplicate UHID, a transaction that outran its timeout, or a
 * database that is simply unreachable. Each is mapped to the status and message a
 * front-desk user can act on.
 */
@Catch(
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientValidationError,
  Prisma.PrismaClientInitializationError,
)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Unexpected database error';
    let error = 'Internal Server Error';

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002': {
          const target = (exception.meta?.target as string[] | undefined)?.join(', ');
          status = HttpStatus.CONFLICT;
          error = 'Conflict';
          message = target
            ? `A record with this ${target} already exists`
            : 'A record with these unique values already exists';
          break;
        }
        case 'P2003':
          status = HttpStatus.BAD_REQUEST;
          error = 'Bad Request';
          message = 'Referenced record does not exist (foreign key constraint failed)';
          break;
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          error = 'Not Found';
          message = (exception.meta?.cause as string) ?? 'Record not found';
          break;
        case 'P2028':
          status = HttpStatus.SERVICE_UNAVAILABLE;
          error = 'Service Unavailable';
          message =
            'The database transaction timed out. The record was not saved — please retry.';
          break;
        default:
          message = `Database error (${exception.code})`;
      }
    } else if (exception instanceof Prisma.PrismaClientInitializationError) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      error = 'Service Unavailable';
      message = 'Cannot reach the database. Please check the connection and retry.';
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      error = 'Bad Request';
      message = 'The request did not match the expected data shape';
    }

    // Log the full error server-side; the client only receives the mapped summary.
    this.logger.error(exception instanceof Error ? exception.message : String(exception));

    response.status(status).json({ statusCode: status, error, message });
  }
}
