import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { SENHA_MENSAGEM, SENHA_REGEX } from '../../common/constants';

/** Primeiro acesso (Pendência I): troca da senha provisória. */
export class PrimeiroAcessoDto {
  @ApiProperty({ example: 'MinhaSenha@2026' })
  @Matches(SENHA_REGEX, { message: SENHA_MENSAGEM })
  nova_senha: string;
}

/** "Esqueci a senha": define a nova senha a partir do link do e-mail. */
export class RedefinirSenhaDto {
  @ApiProperty({ description: 'Token recebido no link do e-mail' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ example: 'MinhaSenha@2026' })
  @Matches(SENHA_REGEX, { message: SENHA_MENSAGEM })
  nova_senha: string;
}

/** Troca de senha com o usuário logado (card Segurança do Meu perfil). */
export class TrocarSenhaDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  senha_atual: string;

  @ApiProperty({ example: 'MinhaSenha@2026' })
  @Matches(SENHA_REGEX, { message: SENHA_MENSAGEM })
  nova_senha: string;
}
