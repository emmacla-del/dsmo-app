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

/**
 * A registration claim. expectedAssigneeId is who the screen showed holding
 * the file (null: nobody); when sent, the write lands only if that is still
 * true. Left out, the assignment is last-write-wins.
 */
export class AssignRegistrationDto extends AssignRecordDto {
  @IsOptional()
  @IsString()
  expectedAssigneeId?: string | null;
}
