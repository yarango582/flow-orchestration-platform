import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { FlowStatus } from '../../database/entities/flow.entity';
import { CreateFlowDto } from './create-flow.dto';

export class UpdateFlowDto extends PartialType(CreateFlowDto) {
  @ApiProperty({
    description: 'Flow status',
    enum: FlowStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(FlowStatus)
  status?: FlowStatus;
}