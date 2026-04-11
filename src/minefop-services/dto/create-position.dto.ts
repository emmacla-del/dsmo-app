// src/minefop-services/dto/create-position.dto.ts
import { IsString, IsEnum, IsOptional, IsInt, Min, Max, Length } from 'class-validator';
import { PositionType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePositionDto {
  @ApiProperty({ example: 'DRMOE', description: 'Service code' })
  @IsString()
  @Length(2, 50)
  serviceCode!: string;

  @ApiProperty({ enum: PositionType, example: 'HEAD' })
  @IsEnum(PositionType)
  positionType!: PositionType;

  @ApiProperty({ example: "Directeur de la Régulation de la Main-d'Oeuvre" })
  @IsString()
  @Length(2, 200)
  title!: string;

  @ApiPropertyOptional({ example: 'Director of Labour Regulation' })
  @IsOptional()
  @IsString()
  @Length(2, 200)
  titleEn?: string;

  @ApiProperty({ example: 1, description: 'Position level (1=Head, 2=Deputy, 3=Officer, 4=Assistant)' })
  @IsInt()
  @Min(1)
  @Max(4)
  level!: number;

  @ApiProperty({ example: 1, description: 'Display order within service' })
  @IsInt()
  @Min(0)
  orderIndex!: number;
}
