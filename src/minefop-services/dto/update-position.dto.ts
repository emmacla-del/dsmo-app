import { IsOptional, IsBoolean, IsInt, IsString, Min, Max, Length } from 'class-validator';

export class UpdatePositionDto {
  @IsOptional()
  @IsString()
  positionType?: string;

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