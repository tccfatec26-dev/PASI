import { BadRequestException, Type, ValidationPipe } from '@nestjs/common';
import { LoginDto } from '../auth/dto/login.dto';
import { RedefinirSenhaDto } from '../auth/dto/nova-senha.dto';
import { CreateAvaliacaoDto } from '../avaliacoes/dto/create-avaliacao.dto';
import { CreateProfissionalDto } from '../gestao/dto/create-profissional.dto';
import { SalvarRespostasDto } from '../respostas/dto/salvar-respostas.dto';
import { CreatePacienteDto } from '../usuarios/dto/create-paciente.dto';

/** Mesma configuração do ValidationPipe global em main.ts. */
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});

const validar = (metatype: Type<unknown>, value: unknown) =>
  pipe.transform(value, { type: 'body', metatype });

const mensagens = (metatype: Type<unknown>, value: unknown) =>
  validar(metatype, value).catch((e: BadRequestException) =>
    (e.getResponse() as { message: string[] }).message.join(' | '),
  );

describe('Validação de entrada (DTOs)', () => {
  describe('LoginDto', () => {
    it('aceita login e senha', async () => {
      await expect(
        validar(LoginDto, { login: 'a@b.com', senha: 'x', canal: 'web' }),
      ).resolves.toBeInstanceOf(LoginDto);
    });

    it('recusa campo desconhecido no corpo', async () => {
      await expect(
        mensagens(LoginDto, { login: 'a', senha: 'x', admin: true }),
      ).resolves.toContain('property admin should not exist');
    });

    it('recusa canal fora da lista', async () => {
      await expect(
        validar(LoginDto, { login: 'a', senha: 'x', canal: 'desktop' }),
      ).rejects.toThrow(BadRequestException);
    });

    it.each(['login', 'senha'])('exige o campo %s', async (campo) => {
      await expect(
        validar(LoginDto, { login: 'a', senha: 'x', [campo]: '' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('CreatePacienteDto', () => {
    const valido = {
      nome: 'João Silva',
      cpf: '98765432100',
      email: 'joao@email.com',
      tel_celular: '11988887777',
      sexo: 'M',
      senha: 'Senha@123',
    };

    it('aceita um cadastro válido', async () => {
      await expect(validar(CreatePacienteDto, valido)).resolves.toBeInstanceOf(
        CreatePacienteDto,
      );
    });

    it.each([
      [
        'CPF com máscara',
        { cpf: '987.654.321-00' },
        'CPF deve conter 11 dígitos',
      ],
      ['CPF curto', { cpf: '123' }, 'CPF deve conter 11 dígitos'],
      ['e-mail inválido', { email: 'joao' }, 'email must be an email'],
      [
        'senha fraca',
        { senha: 'senha123' },
        'A senha deve ter no mínimo 8 caracteres',
      ],
      ['sexo com mais de um caractere', { sexo: 'MM' }, 'sexo must be'],
      ['UF com três letras', { estado: 'SPO' }, 'estado must be'],
      [
        'data inválida',
        { dt_nascimento: '31/12/2015' },
        'dt_nascimento must be',
      ],
      ['nome acima do limite', { nome: 'x'.repeat(71) }, 'nome must be'],
    ])('recusa %s', async (_nome, extra, mensagem) => {
      await expect(
        mensagens(CreatePacienteDto, { ...valido, ...extra }),
      ).resolves.toContain(mensagem);
    });
  });

  describe('RedefinirSenhaDto', () => {
    it('recusa senha fora da política', async () => {
      await expect(
        mensagens(RedefinirSenhaDto, { token: 'abc', nova_senha: 'fraca' }),
      ).resolves.toContain('A senha deve ter no mínimo 8 caracteres');
    });

    it('exige o token', async () => {
      await expect(
        validar(RedefinirSenhaDto, { token: '', nova_senha: 'Nova@1234' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('CreateProfissionalDto', () => {
    const valido = {
      nome: 'Rafael',
      cpf: '21488741030',
      email: 'rafael@email.com',
      tel_celular: '11977771020',
      sexo: 'M',
      id_profissao: 1,
      perfil: 'intermediario',
      unidades: [{ id_unidade_atendimento: 1, sede: true }],
    };

    it('aceita um cadastro válido', async () => {
      await expect(
        validar(CreateProfissionalDto, valido),
      ).resolves.toBeInstanceOf(CreateProfissionalDto);
    });

    it('exige ao menos uma unidade', async () => {
      await expect(
        mensagens(CreateProfissionalDto, { ...valido, unidades: [] }),
      ).resolves.toContain('Marque pelo menos uma unidade');
    });

    it('não aceita cadastrar perfil paciente por esta rota', async () => {
      await expect(
        validar(CreateProfissionalDto, { ...valido, perfil: 'paciente' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('valida cada unidade da lista', async () => {
      await expect(
        mensagens(CreateProfissionalDto, {
          ...valido,
          unidades: [{ id_unidade_atendimento: 1 }],
        }),
      ).resolves.toContain('sede must be a boolean');
    });
  });

  describe('SalvarRespostasDto', () => {
    it('aceita uma resposta válida', async () => {
      await expect(
        validar(SalvarRespostasDto, {
          respostas: [{ id_pergunta: 1, valor_texto: 'ok' }],
        }),
      ).resolves.toBeInstanceOf(SalvarRespostasDto);
    });

    it('exige ao menos uma resposta', async () => {
      await expect(
        validar(SalvarRespostasDto, { respostas: [] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('recusa opção repetida', async () => {
      await expect(
        validar(SalvarRespostasDto, {
          respostas: [{ id_pergunta: 1, id_opcoes: [1, 1] }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('limita o texto a 300 caracteres', async () => {
      await expect(
        validar(SalvarRespostasDto, {
          respostas: [{ id_pergunta: 1, valor_texto: 'x'.repeat(301) }],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('CreateAvaliacaoDto', () => {
    it('exige a observação', async () => {
      await expect(
        validar(CreateAvaliacaoDto, { observacao: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('limita a observação a 500 caracteres', async () => {
      await expect(
        validar(CreateAvaliacaoDto, { observacao: 'x'.repeat(501) }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
