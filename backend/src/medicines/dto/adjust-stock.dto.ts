import { IsInt, IsOptional, IsString } from 'class-validator';

export class AdjustStockDto {
  /**
   * Signed delta applied to the current stock level: positive for a goods-received
   * entry, negative for wastage or a manual correction. A relative adjustment avoids
   * the lost-update problem two staff members would hit by both PUTting an absolute
   * stockQty they each read a moment earlier.
   */
  @IsInt({ message: 'Stock adjustment must be a whole number of units' })
  delta: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
