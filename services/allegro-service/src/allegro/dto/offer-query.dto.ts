/**
 * Offer Query DTO
 */

import { IsOptional, IsNumber, IsString, Type } from 'class-validator';
import { Transform } from 'class-transformer';

export class OfferQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;
}

