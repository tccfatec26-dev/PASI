import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class UnidadeCadastroDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  id_unidade_atendimento: number;

  @ApiProperty({ example: true, description: 'Exatamente uma unidade deve ser a sede' })
  @IsBoolean()
  sede: boolean;
}

/**
 * Cadastro de profissional pelo máximo (RN-USR-02/03/04/11): mesmos campos
 * do cadastro do app, sem a senha, mais o perfil e as unidades com a sede.
 */
export class CreateProfissionalDto {
  @ApiProperty({ example: 'Rafael Oliveira' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(70)
  nome: string;

  @ApiProperty({ example: '21488741030', description: 'CPF somente números' })
  @Matches(/^\d{11}$/, { message: 'CPF deve conter 11 dígitos numéricos' })
  cpf: string;

  @ApiProperty({ example: 'rafael.o@email.com' })
  @IsEmail({}, { message: 'E-mail inválido' })
  @MaxLength(50)
  email: string;

  @ApiProperty({ example: '11977771020' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(15)
  tel_celular: string;

  @ApiProperty({ example: 'M', description: 'F, M ou O' })
  @IsString()
  @Length(1, 1)
  sexo: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  id_profissao: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  id_genero?: number;

  @ApiProperty({ enum: ['intermediario', 'maximo'], default: 'intermediario' })
  @IsIn(['intermediario', 'maximo'])
  perfil: 'intermediario' | 'maximo';

  @ApiProperty({ type: [UnidadeCadastroDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Marque pelo menos uma unidade de atendimento.' })
  @ValidateNested({ each: true })
  @Type(() => UnidadeCadastroDto)
  unidades: UnidadeCadastroDto[];
}

export class CorrigirEmailDto {
  @ApiProperty({ example: 'rafael.oliveira@email.com' })
  @IsEmail({}, { message: 'E-mail inválido' })
  @MaxLength(50)
  email: string;
}
