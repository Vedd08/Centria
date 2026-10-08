import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Prisma maps `Decimal` columns to decimal.js objects, which JSON.stringify emits
 * as quoted strings ("3500"). The frontend types those fields as `number` and does
 * arithmetic on them, so a string turns `sum + totalAmount` into concatenation and
 * `value.toLocaleString('en-IN')` into an unformatted passthrough.
 *
 * Converting Decimals to numbers on the way out keeps every money field numeric in
 * the API contract. Clinic amounts are far inside IEEE-754 integer-safe range, so
 * the conversion is lossless here.
 */
@Injectable()
export class DecimalSerializerInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => convertDecimals(data)));
  }
}

function convertDecimals(value: any): any {
  if (value === null || value === undefined) {
    return value;
  }

  if (Prisma.Decimal.isDecimal(value)) {
    return (value as Prisma.Decimal).toNumber();
  }

  // Dates serialize to ISO strings on their own; recursing into them would break that.
  if (value instanceof Date) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(convertDecimals);
  }

  if (typeof value === 'object') {
    // Only walk plain objects — class instances (streams, buffers) are passed through.
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      return value;
    }

    const result: Record<string, any> = {};
    for (const [key, nested] of Object.entries(value)) {
      result[key] = convertDecimals(nested);
    }
    return result;
  }

  return value;
}
