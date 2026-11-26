import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/** Token de push do Expo: ExponentPushToken[...] (ou ExpoPushToken[...]). */
const TOKEN_EXPO = /^Expo(nent)?PushToken\[[^\]]+\]$/;

export class RegistrarDispositivoDto {
  @ApiProperty({ example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]' })
  @IsString()
  @MaxLength(255)
  @Matches(TOKEN_EXPO, { message: 'token deve ser um token de push do Expo' })
  token: string;

  @ApiPropertyOptional({ example: 'android', enum: ['android', 'ios'] })
  @IsOptional()
  @IsIn(['android', 'ios'])
  plataforma?: string;
}

export class RemoverDispositivoDto {
  @ApiProperty({ example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]' })
  @IsString()
  @MaxLength(255)
  token: string;
}
