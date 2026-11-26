import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

/** Uma mensagem da conversa com o assistente, para o atendente ler o contexto. */
export class MensagemConversaDto {
  @ApiProperty({ enum: ['paciente', 'assistente'] })
  @IsIn(['paciente', 'assistente'])
  autor: 'paciente' | 'assistente';

  @ApiProperty({ example: 'Como respondo um formulário?' })
  @IsString()
  @MaxLength(600)
  texto: string;
}

export class PedidoAtendenteDto {
  @ApiProperty({ example: 12, description: 'Atendimento do paciente sobre o qual é a dúvida' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_atendimento: number;

  @ApiProperty({ example: 'Dúvida ao responder formulário' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  assunto: string;

  @ApiPropertyOptional({ example: 'Não entendi a pergunta sobre a renda da família.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  mensagem?: string;

  @ApiPropertyOptional({
    type: [MensagemConversaDto],
    description: 'Últimas mensagens da conversa com o assistente',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => MensagemConversaDto)
  conversa?: MensagemConversaDto[];
}
