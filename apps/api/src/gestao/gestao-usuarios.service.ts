import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import {
  AcaoGestao,
  SituacaoUsuario,
  TipoUsuario,
  ehProfissional,
} from '../common/constants';
import type { AuthUser } from '../auth/current-user.decorator';
import { AcessoService } from '../acesso/acesso.service';
import { LogGestaoService } from '../acesso/log-gestao.service';
import { VinculoUnidadeService } from '../acesso/vinculo-unidade.service';
import { expiracaoSenhaProvisoria, gerarSenhaProvisoria, hashSenha } from '../acesso/senha';
import { QueryUsuariosDto } from './dto/query-usuarios.dto';
import { CreateProfissionalDto } from './dto/create-profissional.dto';

const PERFIL_POR_NOME: Record<string, number> = {
  intermediario: TipoUsuario.INTERMEDIARIO,
  maximo: TipoUsuario.MAXIMO,
  paciente: TipoUsuario.PACIENTE,
};

type UsuarioBase = {
  id_usuario: number;
  id_tipo_usuario: number;
  id_situacao_usuario: number;
  ativo: boolean;
};

/**
 * Gestão de usuários — exclusiva do perfil máximo (RN-USR-10 a RN-USR-19).
 * Entre máximos, a única operação é ver os dados (RN-USR-14), exceto
 * reenviar a senha provisória (RN-USR-19) e corrigir o e-mail de um
 * cadastro que ainda está em Pendência I (decisão de 08/nov).
 */
@Injectable()
export class GestaoUsuariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly acesso: AcessoService,
    private readonly log: LogGestaoService,
    private readonly vinculos: VinculoUnidadeService,
  ) {}

  // ----------------------------------------------------------------
  // Listagem com filtros e contagem por situação (abas)
  // ----------------------------------------------------------------
  async listar(query: QueryUsuariosDto, user: AuthUser) {
    this.acesso.exigirMaximo(user);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const base: Prisma.usuarioWhereInput = {};
    if (query.perfil) base.id_tipo_usuario = PERFIL_POR_NOME[query.perfil];
    if (query.acesso === 'ativos') base.ativo = true;
    if (query.acesso === 'inativos') base.ativo = false;
    if (query.id_profissao) base.id_profissao = query.id_profissao;
    if (query.search?.trim()) {
      const termo = query.search.trim();
      const digitos = termo.replace(/\D/g, '');
      const ids = await this.idsPorNomeSemAcento(termo);
      base.OR = [
        ids ? { id_usuario: { in: ids } } : { nome: { contains: termo, mode: 'insensitive' } },
        { email: { contains: termo.toLowerCase() } },
        ...(digitos.length >= 3 ? [{ cpf: { contains: digitos } }] : []),
      ];
    }

    const where: Prisma.usuarioWhereInput = query.situacao
      ? { ...base, id_situacao_usuario: query.situacao }
      : base;

    const orderBy: Prisma.usuarioOrderByWithRelationInput =
      query.ordenar === 'recentes'
        ? { id_usuario: 'desc' }
        : query.ordenar === 'antigos'
          ? { id_usuario: 'asc' }
          : { nome: 'asc' };

    const [usuarios, total, porSituacao] = await Promise.all([
      this.prisma.usuario.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          tipo_usuario: { select: { nome: true } },
          situacao_usuario: { select: { nome: true } },
          profissao: { select: { id_profissao: true, nome: true } },
        },
      }),
      this.prisma.usuario.count({ where }),
      this.prisma.usuario.groupBy({ by: ['id_situacao_usuario'], where: base, _count: { _all: true } }),
    ]);

    const inativadoEm = await this.datasInativacao(usuarios.filter((u) => !u.ativo).map((u) => u.id_usuario));
    const contagem = { todos: 0, pendencia_i: 0, pendencia_ii: 0, deferido: 0 };
    for (const g of porSituacao) {
      contagem.todos += g._count._all;
      if (g.id_situacao_usuario === SituacaoUsuario.PENDENCIA_I) contagem.pendencia_i = g._count._all;
      if (g.id_situacao_usuario === SituacaoUsuario.PENDENCIA_II) contagem.pendencia_ii = g._count._all;
      if (g.id_situacao_usuario === SituacaoUsuario.DEFERIDO) contagem.deferido = g._count._all;
    }

    return {
      data: usuarios.map((u) => ({
        id_usuario: u.id_usuario,
        nome: u.nome,
        email: u.email,
        cpf: u.cpf,
        id_tipo_usuario: u.id_tipo_usuario,
        perfil: this.nomePerfil(u.id_tipo_usuario),
        profissao: u.profissao,
        id_situacao_usuario: u.id_situacao_usuario,
        situacao: u.situacao_usuario.nome,
        ativo: u.ativo,
        inativado_em: inativadoEm.get(u.id_usuario) ?? null,
        senha_provisoria_expira_em: u.senha_provisoria_expira_em,
        dt_cadastro: u.dt_cadastro,
        eu: u.id_usuario === user.id_usuario,
        permissoes: this.permissoes(u, user),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      contagem,
    };
  }

  // ----------------------------------------------------------------
  // Detalhe: dados, unidades, histórico (log) e o que dá para fazer
  // ----------------------------------------------------------------
  async detalhar(id: number, user: AuthUser) {
    this.acesso.exigirMaximo(user);
    const u = await this.prisma.usuario.findUnique({
      where: { id_usuario: id },
      include: {
        tipo_usuario: { select: { nome: true } },
        situacao_usuario: { select: { nome: true } },
        profissao: { select: { id_profissao: true, nome: true } },
        genero: { select: { id_genero: true, nome: true } },
      },
    });
    if (!u) throw new NotFoundException('Usuário não encontrado.');

    const [unidades, historico, cadastro] = await Promise.all([
      ehProfissional(u.id_tipo_usuario) ? this.vinculos.listar(id) : Promise.resolve([]),
      this.prisma.log_adm_geral.findMany({
        where: { id_usuario_alvo: id },
        orderBy: { id_log_adm_geral: 'desc' },
        take: 100,
        include: {
          acao: { select: { nome: true } },
          usuario: { select: { id_usuario: true, nome: true } },
        },
      }),
      this.prisma.log_adm_geral.findFirst({
        where: { id_usuario_alvo: id, acao: { nome: AcaoGestao.CADASTRAR } },
        include: { usuario: { select: { id_usuario: true, nome: true } } },
      }),
    ]);
    const inativadoEm = u.ativo ? null : ((await this.datasInativacao([id])).get(id) ?? null);

    const { senha_hash, senha_reset_token, senha_reset_expira_em, ...dados } = u;
    void senha_hash;
    void senha_reset_token;
    void senha_reset_expira_em;

    return {
      ...dados,
      perfil: this.nomePerfil(u.id_tipo_usuario),
      situacao: u.situacao_usuario.nome,
      inativado_em: inativadoEm,
      cadastrado_por: cadastro?.usuario ?? null,
      eu: u.id_usuario === user.id_usuario,
      unidades,
      historico: historico.map((h) => ({
        id: h.id_log_adm_geral,
        data: h.dt_hora_acao,
        acao: h.acao.nome,
        detalhe: h.detalhe,
        por: h.usuario,
      })),
      permissoes: this.permissoes(u, user),
    };
  }

  // ----------------------------------------------------------------
  // Cadastrar profissional (intermediário ou máximo) com senha provisória
  // ----------------------------------------------------------------
  async cadastrarProfissional(dto: CreateProfissionalDto, user: AuthUser) {
    this.acesso.exigirMaximo(user);

    const ids = dto.unidades.map((x) => x.id_unidade_atendimento);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('A mesma unidade foi informada mais de uma vez.');
    }
    if (dto.unidades.filter((x) => x.sede).length !== 1) {
      throw new BadRequestException('Escolha exatamente uma unidade como sede.');
    }
    const existentes = await this.prisma.unidade_atendimento.count({ where: { id_unidade_atendimento: { in: ids } } });
    if (existentes !== ids.length) {
      throw new BadRequestException('Alguma unidade de atendimento informada não existe.');
    }

    const senha = gerarSenhaProvisoria();
    const expira = expiracaoSenhaProvisoria();
    const tipo = dto.perfil === 'maximo' ? TipoUsuario.MAXIMO : TipoUsuario.INTERMEDIARIO;
    const sede = dto.unidades.find((x) => x.sede)!;

    let criado: { id_usuario: number; nome: string; email: string };
    try {
      criado = await this.prisma.$transaction(async (tx) => {
        const novo = await tx.usuario.create({
          data: {
            tipo_usuario: { connect: { id_tipo_usuario: tipo } },
            situacao_usuario: { connect: { id_situacao_usuario: SituacaoUsuario.PENDENCIA_I } },
            ativo: true,
            nome: dto.nome.trim(),
            cpf: dto.cpf,
            email: dto.email.trim().toLowerCase(),
            tel_celular: dto.tel_celular,
            sexo: dto.sexo,
            profissao: { connect: { id_profissao: dto.id_profissao } },
            ...(dto.id_genero ? { genero: { connect: { id_genero: dto.id_genero } } } : {}),
            senha_hash: await hashSenha(senha),
            senha_provisoria_expira_em: expira,
          },
          select: { id_usuario: true, nome: true, email: true },
        });
        await tx.usuario_unidade.createMany({
          data: dto.unidades.map((x) => ({
            id_usuario: novo.id_usuario,
            id_unidade_atendimento: x.id_unidade_atendimento,
            sede: x.sede,
          })),
        });
        const nomeSede = await tx.unidade_atendimento.findUnique({
          where: { id_unidade_atendimento: sede.id_unidade_atendimento },
          select: { nome: true },
        });
        await this.log.registrar(
          {
            acao: AcaoGestao.CADASTRAR,
            idAutor: user.id_usuario,
            idAlvo: novo.id_usuario,
            detalhe: `${this.nomePerfil(tipo)} · sede ${nomeSede?.nome ?? '—'} · senha provisória enviada por e-mail`,
          },
          tx,
        );
        return novo;
      });
    } catch (e) {
      throw this.tratarErroUnico(e);
    }

    const emailEnviado = await this.mail.enviarSenhaProvisoria(criado.email, criado.nome, senha, expira);
    return {
      usuario: await this.detalhar(criado.id_usuario, user),
      email_enviado: emailEnviado,
      senha_provisoria_expira_em: expira,
    };
  }

  // ----------------------------------------------------------------
  // Reenviar senha provisória (RN-USR-19)
  // ----------------------------------------------------------------
  async reenviarSenha(id: number, user: AuthUser) {
    this.acesso.exigirMaximo(user);
    const alvo = await this.exigirUsuario(id);
    if (!ehProfissional(alvo.id_tipo_usuario) || alvo.id_situacao_usuario !== SituacaoUsuario.PENDENCIA_I) {
      throw new BadRequestException('Só dá para reenviar a senha provisória de profissionais em Pendência I.');
    }
    if (!alvo.ativo) throw new BadRequestException('Reative o usuário antes de reenviar a senha.');

    const senha = gerarSenhaProvisoria();
    const expira = expiracaoSenhaProvisoria();
    await this.prisma.$transaction(async (tx) => {
      await tx.usuario.update({
        where: { id_usuario: id },
        data: { senha_hash: await hashSenha(senha), senha_provisoria_expira_em: expira },
      });
      await this.log.registrar(
        { acao: AcaoGestao.REENVIAR_SENHA, idAutor: user.id_usuario, idAlvo: id, detalhe: `Enviada para ${alvo.email}` },
        tx,
      );
    });
    const emailEnviado = await this.mail.enviarSenhaProvisoria(alvo.email, alvo.nome, senha, expira);
    return { email_enviado: emailEnviado, senha_provisoria_expira_em: expira };
  }

  // ----------------------------------------------------------------
  // Corrigir o e-mail de um cadastro em Pendência I (decisão de 08/nov):
  // salva o e-mail novo e já envia uma nova senha provisória para ele.
  // ----------------------------------------------------------------
  async corrigirEmail(id: number, email: string, user: AuthUser) {
    this.acesso.exigirMaximo(user);
    const alvo = await this.exigirUsuario(id);
    if (!ehProfissional(alvo.id_tipo_usuario) || alvo.id_situacao_usuario !== SituacaoUsuario.PENDENCIA_I) {
      throw new BadRequestException('O e-mail só pode ser corrigido pela gestão enquanto o cadastro está em Pendência I.');
    }
    const novo = email.trim().toLowerCase();
    if (novo === alvo.email) throw new BadRequestException('O e-mail informado é o mesmo do cadastro.');

    const senha = gerarSenhaProvisoria();
    const expira = expiracaoSenhaProvisoria();
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.usuario.update({
          where: { id_usuario: id },
          data: { email: novo, senha_hash: await hashSenha(senha), senha_provisoria_expira_em: expira },
        });
        await this.log.registrar(
          { acao: AcaoGestao.CORRIGIR_EMAIL, idAutor: user.id_usuario, idAlvo: id, detalhe: `${alvo.email} → ${novo}` },
          tx,
        );
      });
    } catch (e) {
      throw this.tratarErroUnico(e);
    }
    const emailEnviado = await this.mail.enviarSenhaProvisoria(novo, alvo.nome, senha, expira);
    return { email_enviado: emailEnviado, senha_provisoria_expira_em: expira };
  }

  // ----------------------------------------------------------------
  // Inativar / reativar (RN-USR-12): intermediários e pacientes
  // ----------------------------------------------------------------
  async inativar(id: number, user: AuthUser) {
    this.acesso.exigirMaximo(user);
    const alvo = await this.exigirUsuario(id);
    this.exigirNaoMaximo(alvo, user);
    if (!alvo.ativo) throw new BadRequestException('Este usuário já está inativo.');
    await this.mudarAtivo(id, false, AcaoGestao.INATIVAR, user);
    return this.detalhar(id, user);
  }

  async reativar(id: number, user: AuthUser) {
    this.acesso.exigirMaximo(user);
    const alvo = await this.exigirUsuario(id);
    this.exigirNaoMaximo(alvo, user);
    if (alvo.ativo) throw new BadRequestException('Este usuário já está ativo.');
    await this.mudarAtivo(id, true, AcaoGestao.REATIVAR, user);
    return this.detalhar(id, user);
  }

  // ----------------------------------------------------------------
  // Promover intermediário ativo a máximo (RN-USR-13); irreversível pela tela
  // ----------------------------------------------------------------
  async promover(id: number, user: AuthUser) {
    this.acesso.exigirMaximo(user);
    const alvo = await this.exigirUsuario(id);
    if (alvo.id_tipo_usuario !== TipoUsuario.INTERMEDIARIO || !alvo.ativo) {
      throw new BadRequestException('Só intermediários ativos podem ser promovidos a máximo.');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.usuario.update({
        where: { id_usuario: id },
        data: { tipo_usuario: { connect: { id_tipo_usuario: TipoUsuario.MAXIMO } } },
      });
      await this.log.registrar(
        { acao: AcaoGestao.PROMOVER, idAutor: user.id_usuario, idAlvo: id, detalhe: 'Intermediário → Máximo' },
        tx,
      );
    });
    return this.detalhar(id, user);
  }

  // ----------------------------------------------------------------
  // Unidades de um intermediário (RN-USR-15 a 17)
  // ----------------------------------------------------------------
  async vincularUnidade(id: number, idUnidade: number, sede: boolean, user: AuthUser) {
    await this.exigirIntermediario(id, user);
    return this.vinculos.vincular(id, idUnidade, sede, user.id_usuario);
  }

  async desvincularUnidade(id: number, idUnidade: number, user: AuthUser) {
    await this.exigirIntermediario(id, user);
    return this.vinculos.desvincular(id, idUnidade, user.id_usuario);
  }

  async trocarSede(id: number, idUnidade: number, user: AuthUser) {
    await this.exigirIntermediario(id, user);
    return this.vinculos.trocarSede(id, idUnidade, user.id_usuario);
  }

  // ----------------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------------
  private async exigirUsuario(id: number) {
    const u = await this.prisma.usuario.findUnique({ where: { id_usuario: id } });
    if (!u) throw new NotFoundException('Usuário não encontrado.');
    return u;
  }

  private exigirNaoMaximo(alvo: UsuarioBase, user: AuthUser) {
    if (alvo.id_tipo_usuario === TipoUsuario.MAXIMO || alvo.id_usuario === user.id_usuario) {
      throw new ForbiddenException('Um máximo não altera nem inativa outro máximo, nem a si mesmo.');
    }
  }

  private async exigirIntermediario(id: number, user: AuthUser) {
    this.acesso.exigirMaximo(user);
    const alvo = await this.exigirUsuario(id);
    if (alvo.id_tipo_usuario !== TipoUsuario.INTERMEDIARIO) {
      throw new ForbiddenException(
        'As unidades só podem ser geridas aqui para intermediários. O máximo cuida das próprias no Meu perfil.',
      );
    }
  }

  private async mudarAtivo(id: number, ativo: boolean, acao: string, user: AuthUser) {
    await this.prisma.$transaction(async (tx) => {
      await tx.usuario.update({ where: { id_usuario: id }, data: { ativo } });
      await this.log.registrar({ acao, idAutor: user.id_usuario, idAlvo: id }, tx);
    });
  }

  /** O que o máximo logado pode fazer com este usuário (para a tela). */
  private permissoes(u: UsuarioBase, user: AuthUser) {
    const eu = u.id_usuario === user.id_usuario;
    const maximo = u.id_tipo_usuario === TipoUsuario.MAXIMO;
    const profissional = ehProfissional(u.id_tipo_usuario);
    const pendenciaI = u.id_situacao_usuario === SituacaoUsuario.PENDENCIA_I;
    return {
      somente_leitura: maximo && !eu,
      reenviar_senha: profissional && pendenciaI && u.ativo,
      corrigir_email: profissional && pendenciaI,
      promover: u.id_tipo_usuario === TipoUsuario.INTERMEDIARIO && u.ativo,
      inativar: !maximo && !eu && u.ativo,
      reativar: !maximo && !eu && !u.ativo,
      gerir_unidades: u.id_tipo_usuario === TipoUsuario.INTERMEDIARIO,
    };
  }

  private nomePerfil(tipo: number): string {
    if (tipo === TipoUsuario.MAXIMO) return 'Máximo';
    if (tipo === TipoUsuario.INTERMEDIARIO) return 'Intermediário';
    return 'Paciente';
  }

  /** Data da última inativação de cada usuário (vem do log). */
  private async datasInativacao(ids: number[]): Promise<Map<number, Date | null>> {
    const mapa = new Map<number, Date | null>();
    if (ids.length === 0) return mapa;
    const logs = await this.prisma.log_adm_geral.findMany({
      where: { id_usuario_alvo: { in: ids }, acao: { nome: AcaoGestao.INATIVAR } },
      orderBy: { id_log_adm_geral: 'desc' },
      select: { id_usuario_alvo: true, dt_hora_acao: true },
    });
    for (const l of logs) {
      if (l.id_usuario_alvo !== null && !mapa.has(l.id_usuario_alvo)) mapa.set(l.id_usuario_alvo, l.dt_hora_acao);
    }
    return mapa;
  }

  private async idsPorNomeSemAcento(termo: string): Promise<number[] | null> {
    const like = `%${termo}%`;
    try {
      const rows = await this.prisma.$queryRaw<{ id: number }[]>`
        SELECT id_usuario AS id FROM usuario
        WHERE unaccent(lower(nome)) LIKE unaccent(lower(${like}))
      `;
      return rows.map((r) => Number(r.id));
    } catch {
      return null;
    }
  }

  private tratarErroUnico(e: unknown): Error {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const alvo = String(e.meta?.target ?? '');
      const campo = alvo.includes('cpf') ? 'CPF' : alvo.includes('email') ? 'e-mail' : alvo.includes('tel') ? 'celular' : 'dado';
      return new ConflictException(`Já existe um usuário com este ${campo}, de profissional ou de paciente.`);
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === 'P2025' || e.code === 'P2003')) {
      return new BadRequestException('Profissão, gênero ou unidade informada não existe.');
    }
    return e as Error;
  }
}
