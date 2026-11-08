import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SituacaoUsuario, TipoUsuario, ehProfissional } from '../common/constants';
import type { AuthUser } from '../auth/current-user.decorator';
import { AcessoService } from '../acesso/acesso.service';
import { VinculoUnidadeService } from '../acesso/vinculo-unidade.service';
import { conferirSenha, hashSenha } from '../acesso/senha';
import { TrocarSenhaDto } from '../auth/dto/nova-senha.dto';
import { CreatePacienteDto } from './dto/create-paciente.dto';
import { UpdateMeDto } from './dto/update-me.dto';

@Injectable()
export class UsuariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acesso: AcessoService,
    private readonly vinculos: VinculoUnidadeService,
  ) {}

  /**
   * Cadastro do paciente pelo app (RN-USR-05): nasce ativo e Deferido.
   * Não cria mais o atendimento de Triagem automaticamente (RN-USR-21).
   */
  async createPaciente(dto: CreatePacienteDto) {
    const senha_hash = await hashSenha(dto.senha);
    try {
      const usuario = await this.prisma.usuario.create({
        data: {
          tipo_usuario: { connect: { id_tipo_usuario: TipoUsuario.PACIENTE } },
          situacao_usuario: { connect: { id_situacao_usuario: SituacaoUsuario.DEFERIDO } },
          ativo: true,
          nome: dto.nome,
          cpf: dto.cpf,
          email: dto.email.toLowerCase(),
          tel_celular: dto.tel_celular,
          sexo: dto.sexo,
          dt_nascimento: dto.dt_nascimento ? new Date(dto.dt_nascimento) : null,
          nac_estrangeira: dto.nac_estrangeira ?? false,
          cep: dto.cep,
          logradouro: dto.logradouro,
          numero: dto.numero,
          complemento: dto.complemento,
          bairro: dto.bairro,
          cidade: dto.cidade,
          estado: dto.estado,
          pais: dto.pais,
          senha_hash,
          ...(dto.id_genero ? { genero: { connect: { id_genero: dto.id_genero } } } : {}),
        },
      });
      return this.semSegredos(usuario);
    } catch (e) {
      throw this.tratarErroUnico(e);
    }
  }

  async listPacientes(search: string | undefined, user: AuthUser) {
    if (!ehProfissional(user.tipo)) {
      throw new ForbiddenException('Apenas profissionais podem listar pacientes.');
    }
    const where: Prisma.usuarioWhereInput = { id_tipo_usuario: TipoUsuario.PACIENTE, ativo: true };
    if (search?.trim()) {
      const digitos = search.replace(/\D/g, '');
      // Busca por nome sem sensibilidade a maiúsculas nem a acentos.
      const ids = await this.idsPacientesSemAcento(search.trim());
      where.OR = [
        ids
          ? { id_usuario: { in: ids } }
          : { nome: { contains: search.trim(), mode: 'insensitive' } },
        // Só busca por CPF quando há dígitos — senão `contains: ''` casaria com todos.
        ...(digitos ? [{ cpf: { contains: digitos } }] : []),
      ];
    }
    return this.prisma.usuario.findMany({
      where,
      select: { id_usuario: true, nome: true, cpf: true, email: true },
      take: 20,
      orderBy: { nome: 'asc' },
    });
  }

  // Retorna null quando a extensão unaccent não está disponível (fallback Prisma).
  private async idsPacientesSemAcento(search: string): Promise<number[] | null> {
    const like = `%${search}%`;
    try {
      const rows = await this.prisma.$queryRaw<{ id: number }[]>`
        SELECT id_usuario AS id
        FROM usuario
        WHERE id_tipo_usuario = ${TipoUsuario.PACIENTE}
          AND unaccent(lower(nome)) LIKE unaccent(lower(${like}))
      `;
      return rows.map((r) => Number(r.id));
    } catch {
      return null;
    }
  }

  /** Cadastro completo do próprio usuário, com perfil, situação e unidades. */
  async findById(id: number) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id_usuario: id },
      include: {
        tipo_usuario: { select: { id_tipo_usuario: true, nome: true, descricao: true } },
        situacao_usuario: true,
        profissao: { select: { id_profissao: true, nome: true } },
        genero: { select: { id_genero: true, nome: true } },
      },
    });
    if (!usuario) {
      throw new NotFoundException('Usuário não encontrado');
    }
    const unidades = ehProfissional(usuario.id_tipo_usuario) ? await this.vinculos.listar(id) : [];
    return { ...this.semSegredos(usuario), unidades };
  }

  /**
   * Atualiza o cadastro do próprio usuário. CPF nunca é alterado.
   * Em Pendência II o e-mail também fica travado (decisão de 08/nov): só a
   * gestão corrige o e-mail. Perfil e unidades não mudam por aqui.
   */
  async updateMe(user: AuthUser, dto: UpdateMeDto) {
    const atual = await this.prisma.usuario.findUnique({ where: { id_usuario: user.id_usuario } });
    if (!atual) throw new NotFoundException('Usuário não encontrado');

    const novoEmail = dto.email?.trim().toLowerCase();
    if (
      novoEmail !== undefined &&
      novoEmail !== atual.email &&
      atual.id_situacao_usuario === SituacaoUsuario.PENDENCIA_II
    ) {
      throw new BadRequestException(
        'O e-mail não pode ser alterado na revisão dos dados. Se estiver errado, fale com a gestão da sua unidade.',
      );
    }
    if (dto.id_profissao !== undefined && !ehProfissional(atual.id_tipo_usuario)) {
      throw new BadRequestException('Profissão só se aplica a profissionais.');
    }

    const data: Prisma.usuarioUpdateInput = {
      nome: dto.nome,
      email: novoEmail,
      tel_celular: dto.tel_celular,
      sexo: dto.sexo,
      dt_nascimento:
        dto.dt_nascimento !== undefined
          ? dto.dt_nascimento
            ? new Date(dto.dt_nascimento)
            : null
          : undefined,
      nac_estrangeira: dto.nac_estrangeira,
      cep: dto.cep,
      logradouro: dto.logradouro,
      numero: dto.numero,
      complemento: dto.complemento,
      bairro: dto.bairro,
      cidade: dto.cidade,
      estado: dto.estado,
      pais: dto.pais,
      ...(dto.id_genero !== undefined ? { genero: { connect: { id_genero: dto.id_genero } } } : {}),
      ...(dto.id_profissao !== undefined ? { profissao: { connect: { id_profissao: dto.id_profissao } } } : {}),
    };

    try {
      await this.prisma.usuario.update({ where: { id_usuario: user.id_usuario }, data });
    } catch (e) {
      throw this.tratarErroUnico(e);
    }
    return this.findById(user.id_usuario);
  }

  /** Pendência II → Deferido (RN-USR-09). */
  async confirmarDados(user: AuthUser) {
    const atual = await this.prisma.usuario.findUniqueOrThrow({ where: { id_usuario: user.id_usuario } });
    if (atual.id_situacao_usuario !== SituacaoUsuario.PENDENCIA_II) {
      throw new BadRequestException('Não há dados pendentes de confirmação.');
    }
    await this.prisma.usuario.update({
      where: { id_usuario: user.id_usuario },
      data: { situacao_usuario: { connect: { id_situacao_usuario: SituacaoUsuario.DEFERIDO } } },
    });
    return this.findById(user.id_usuario);
  }

  /** Troca de senha com o usuário logado (card Segurança). */
  async trocarSenha(user: AuthUser, dto: TrocarSenhaDto) {
    const atual = await this.prisma.usuario.findUniqueOrThrow({ where: { id_usuario: user.id_usuario } });
    if (!(await conferirSenha(dto.senha_atual, atual.senha_hash))) {
      throw new BadRequestException('A senha atual não confere.');
    }
    if (dto.senha_atual === dto.nova_senha) {
      throw new BadRequestException('A nova senha precisa ser diferente da senha atual.');
    }
    await this.prisma.usuario.update({
      where: { id_usuario: user.id_usuario },
      data: { senha_hash: await hashSenha(dto.nova_senha) },
    });
    return { message: 'Senha alterada. Use a nova senha no próximo acesso.' };
  }

  // ---- Unidades do próprio máximo (RN-USR-15) ----
  vincularPropria(user: AuthUser, idUnidade: number, sede: boolean) {
    this.acesso.exigirMaximo(user);
    return this.vinculos.vincular(user.id_usuario, idUnidade, sede, user.id_usuario);
  }

  desvincularPropria(user: AuthUser, idUnidade: number) {
    this.acesso.exigirMaximo(user);
    return this.vinculos.desvincular(user.id_usuario, idUnidade, user.id_usuario);
  }

  trocarSedePropria(user: AuthUser, idUnidade: number) {
    this.acesso.exigirMaximo(user);
    return this.vinculos.trocarSede(user.id_usuario, idUnidade, user.id_usuario);
  }

  private tratarErroUnico(e: unknown): Error {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const campo = String(e.meta?.target ?? 'campo único');
      return new ConflictException(`Já existe um usuário com este ${this.nomeCampoConflito(campo)}.`);
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return new ConflictException('Profissão ou gênero informado não existe.');
    }
    return e as Error;
  }

  private nomeCampoConflito(target: string): string {
    if (target.includes('cpf')) return 'CPF';
    if (target.includes('email')) return 'e-mail';
    if (target.includes('tel')) return 'celular';
    return target;
  }

  private semSegredos<T extends { senha_hash?: string | null; senha_reset_token?: string | null }>(u: T) {
    const { senha_hash, senha_reset_token, ...resto } = u;
    void senha_hash;
    void senha_reset_token;
    return resto;
  }
}
