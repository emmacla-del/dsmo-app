import { IsString, IsEnum, IsOptional, IsInt, Min, Max, Length } from 'class-validator';
import { PositionType } from '@prisma/client';

export class CreatePositionDto {
  @IsString()
  @Length(2, 50)
  serviceCode!: string;

  @IsEnum(PositionType)
  positionType!: PositionType;

  @IsString()
  @Length(2, 200)
  title!: string;

  @IsOptional()
  @IsString()
  @Length(2, 200)
  titleEn?: string;

  @IsInt()
  @Min(1)
  @Max(4)
  level!: number;

  @IsInt()
  @Min(0)
  orderIndex!: number;
}
