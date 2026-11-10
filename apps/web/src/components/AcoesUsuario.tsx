import { useState } from 'react';
import * as gestao from '../api/gestao';
import { mensagemErro } from '../api/client';
import { TipoUsuario } from '../api/types';
import { Modal } from './Modal';
import { D, Ic } from './icons';
import { dataHora } from '../lib/format';

export type AcaoUsuario = 'reenviar' | 'promover' | 'inativar' | 'reativar' | 'email';

interface Alvo {
  id_usuario: number;
  nome: string;
  email: string;
  id_tipo_usuario: number;
}

const ICONES: Record<AcaoUsuario, { cls: string; d: string }> = {
  reenviar: { cls: 'ico', d: 'M3 6h18v12H3zM3 7l9 6 9-6' },
  email: { cls: 'ico', d: 'M3 6h18v12H3zM3 7l9 6 9-6' },
  promover: { cls: 'ico warning', d: 'M12 19V5M5 12l7-7 7 7' },
  inativar: { cls: 'ico error', d: D.proibido },
  reativar: { cls: 'ico', d: D.check },
};

/**
 * Confirmação das ações de gestão (reenviar senha, corrigir e-mail, promover,
 * inativar, reativar), com a chamada à API e o resultado.
 */
export function ModalAcaoUsuario({
  acao,
  alvo,
  aoFechar,
  aoConcluir,
}: {
  acao: AcaoUsuario;
  alvo: Alvo;
  aoFechar: () => void;
  aoConcluir: (mensagem: string) => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [email, setEmail] = useState(alvo.email);
  const paciente = alvo.id_tipo_usuario === TipoUsuario.PACIENTE;
  const onde = paciente ? 'no app' : 'no painel';

  const textos: Record<AcaoUsuario, { t: string; x: string; b: string; bc: string }> = {
    reenviar: {
      t: 'Reenviar senha provisória?',
      x: `Uma nova senha provisória, válida por 24 horas, será enviada para ${alvo.email}. A senha anterior deixa de valer. ${alvo.nome} continua em Pendência I até trocar a senha.`,
      b: 'Gerar e enviar',
      bc: 'ps-btn primary',
    },
    email: {
      t: 'Corrigir e-mail',
      x: `O e-mail de ${alvo.nome} será trocado e uma nova senha provisória, válida por 24 horas, irá para o e-mail corrigido. A senha anterior deixa de valer.`,
      b: 'Corrigir e enviar senha',
      bc: 'ps-btn primary',
    },
    promover: {
      t: 'Promover a privilégio máximo?',
      x: `${alvo.nome} passa a cadastrar profissionais, gerenciar usuários e ver todas as unidades, mantendo as unidades e a sede atuais. Depois disso, nenhum máximo pode alterar ou rebaixar este usuário.`,
      b: 'Promover',
      bc: 'ps-btn primary',
    },
    inativar: {
      t: 'Inativar usuário?',
      x: `${alvo.nome} deixa de conseguir entrar ${onde}. A situação do cadastro não muda; atendimentos, respostas e avaliações continuam no sistema, e dá para reativar depois.`,
      b: 'Inativar',
      bc: 'ps-btn danger',
    },
    reativar: { t: 'Reativar usuário?', x: `${alvo.nome} volta a conseguir entrar ${onde}.`, b: 'Reativar', bc: 'ps-btn primary' },
  };
  const m = textos[acao];
  const emailValido = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  async function confirmar() {
    if (ocupado) return;
    if (acao === 'email' && (!emailValido || email.trim().toLowerCase() === alvo.email)) {
      setErro(emailValido ? 'Informe um e-mail diferente do atual.' : 'Informe um e-mail válido.');
      return;
    }
    setOcupado(true);
    setErro(null);
    try {
      let msg = '';
      if (acao === 'reenviar') {
        const r = await gestao.reenviarSenha(alvo.id_usuario);
        msg = r.email_enviado
          ? `Nova senha provisória enviada para ${alvo.email}. Vale até ${dataHora(r.senha_provisoria_expira_em)}.`
          : 'A senha foi gerada, mas o e-mail não saiu. Tente reenviar em alguns minutos.';
      } else if (acao === 'email') {
        const novo = email.trim().toLowerCase();
        const r = await gestao.corrigirEmail(alvo.id_usuario, novo);
        msg = r.email_enviado
          ? `E-mail corrigido. A nova senha provisória foi enviada para ${novo}.`
          : 'E-mail corrigido, mas a mensagem não saiu. Use “Reenviar senha provisória” em alguns minutos.';
      } else if (acao === 'promover') {
        await gestao.promover(alvo.id_usuario);
        msg = `${alvo.nome} agora tem privilégio máximo.`;
      } else if (acao === 'inativar') {
        await gestao.inativar(alvo.id_usuario);
        msg = `${alvo.nome} foi inativado(a).`;
      } else {
        await gestao.reativar(alvo.id_usuario);
        msg = `${alvo.nome} foi reativado(a).`;
      }
      aoConcluir(msg);
    } catch (e) {
      setErro(mensagemErro(e));
      setOcupado(false);
    }
  }

  return (
    <Modal
      alerta
      icone={
        <div className={ICONES[acao].cls}>
          <Ic d={ICONES[acao].d} lg />
        </div>
      }
      titulo={m.t}
      aoFechar={ocupado ? undefined : aoFechar}
      estiloCorpo={acao === 'email' ? { display: 'flex', flexDirection: 'column', gap: 12 } : undefined}
      rodape={
        <>
          <button type="button" className="ps-btn secondary cancelar" onClick={aoFechar} disabled={ocupado}>
            Cancelar
          </button>
          <button type="button" className={m.bc} onClick={() => void confirmar()} aria-busy={ocupado}>
            {ocupado ? 'Aguarde…' : m.b}
          </button>
        </>
      }
    >
      <span>{m.x}</span>
      {acao === 'email' && (
        <div className="ps-field">
          <label className="ps-label" htmlFor="novo-email">
            E-mail correto
          </label>
          <div className={'ps-control' + (erro ? ' is-error' : '')}>
            <input id="novo-email" type="email" maxLength={50} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
      )}
      {erro && <div className="ps-helper error">{erro}</div>}
    </Modal>
  );
}
