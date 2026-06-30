import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class PrepareQuantityCommandDto {
  @IsUUID()
  offerId!: string;

  @IsInt()
  @Min(0)
  targetQuantity!: number;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class ConfirmQuantityCommandDto {
  @IsString()
  @IsNotEmpty()
  previewToken!: string;
}

export class QuantityCommandQueryDto {
  @IsOptional()
  @IsUUID()
  offerId?: string;

  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}
