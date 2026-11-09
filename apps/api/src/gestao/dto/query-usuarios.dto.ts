import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryUsuariosDto {
  @ApiPropertyOptional({ enum: ['intermediario', 'maximo', 'paciente'] })
  @IsOptional()
  @IsIn(['intermediario', 'maximo', 'paciente'])
  perfil?: 'intermediario' | 'maximo' | 'paciente';

  @ApiPropertyOptional({ description: 'situacao_usuario: 1 Pendência I, 2 Pendência II, 3 Deferido' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  situacao?: number;

  @ApiPropertyOptional({ enum: ['ativos', 'inativos', 'todos'], default: 'todos' })
  @IsOptional()
  @IsIn(['ativos', 'inativos', 'todos'])
  acesso?: 'ativos' | 'inativos' | 'todos';

  @ApiPropertyOptional({ description: 'Filtra pela profissão (id_profissao)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id_profissao?: number;

  @ApiPropertyOptional({ description: 'Nome, CPF ou e-mail' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['nome', 'recentes', 'antigos'], default: 'nome' })
  @IsOptional()
  @IsIn(['nome', 'recentes', 'antigos'])
  ordenar?: 'nome' | 'recentes' | 'antigos';

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
