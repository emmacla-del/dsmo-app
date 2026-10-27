import { IsOptional, IsString } from 'class-validator';

/**
 * Assignment of a record to a staff agent. A null or absent assigneeId
 * releases the record (unclaim); a string claims it or reassigns it.
 */
export class AssignRecordDto {
  @IsOptional()
  @IsString()
  assigneeId?: string | null;
}
