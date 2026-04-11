import { IsEnum, IsOptional, IsBoolean, IsInt, IsString, Min, Max, Length } from 'class-validator';
import { PositionType } from '@prisma/client';

export class UpdatePositionDto {
  @IsOptional()
  @IsEnum(PositionType)
  positionType?: PositionType;

  @IsOptional()
  @IsString()
  @Length(2, 200)
  title?: string;

  @IsOptional()
  @IsString()
  @Length(2, 200)
  titleEn?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  level?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
