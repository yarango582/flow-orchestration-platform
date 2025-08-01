import { PartialType } from '@nestjs/swagger';
import { CreateScheduleDto } from './create-schedule.dto';

export class UpdateScheduleDto extends PartialType(CreateScheduleDto) {
  // Inherits all properties from CreateScheduleDto as optional
}