import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional } from 'class-validator';

export class VincularUnidadeDto {
  @ApiProperty({ example: 2, description: 'FK para unidade_atendimento' })
  @IsInt()
  id_unidade_atendimento: number;

  @ApiPropertyOptional({ example: false, description: 'Marcar como a nova sede' })
  @IsOptional()
  @IsBoolean()
  sede?: boolean;
}
