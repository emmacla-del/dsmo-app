import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ArchiveRecordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;
}

export class RestoreRecordDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
