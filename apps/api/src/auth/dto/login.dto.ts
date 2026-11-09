import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'maria@email.com',
    description: 'E-mail ou CPF (somente números) do usuário',
  })
  @IsString()
  @IsNotEmpty()
  login: string;

  @ApiProperty({ example: 'Senha@123' })
  @IsString()
  @IsNotEmpty()
  senha: string;

  @ApiPropertyOptional({
    enum: ['web', 'app'],
    description:
      'Onde o login acontece: "web" aceita só profissionais (intermediário e máximo); "app", só pacientes. Sem o campo, aceita todos.',
  })
  @IsOptional()
  @IsIn(['web', 'app'])
  canal?: 'web' | 'app';
}
