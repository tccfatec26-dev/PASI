import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { NovaOpcao, NovaPergunta } from '../api/formularios';
import { lerArquivos, LeituraCancelada, MAX_IMAGENS, TAMANHO_MAXIMO, TIPOS_ACEITOS, type Andamento, type Fonte } from '../lib/ocr/ler';
import { contarPaginas, ehPdf, fecharPdfs, miniaturaDaPagina } from '../lib/ocr/pdf';
import { lerOpcoesComuns, montarFormulario, type Segmento } from '../lib/ocr/montar';
import { nomeTipoPergunta, temOpcoes, TipoPergunta } from '../lib/perguntas';
import { plural } from '../lib/format';
import { Modal } from './Modal';
import { Alerta, MensagemErro } from './Form';
import { D, Ic, IcCheck, IcFechar, IcMais } from './icons';

export interface FormularioImportado {
  titulo?: string;
  descricao?: string;
  perguntas: NovaPergunta[];
}

/** Uma página na janela: foto ou página de PDF, com a miniatura. */
interface Imagem {
  fonte: Fonte;
  url: string;
  nome: string;
}

type Etapa = 'selecao' | 'processando' | 'pronto';

const DICA =
  'Anexe fotos ou PDF de um formulário em papel (até 5 páginas por vez, do mesmo formulário) para digitalizá-lo: as perguntas são criadas para você revisar antes de salvar.';
const TIPOS_IMAGEM = TIPOS_ACEITOS.split(',').filter((t) => t.startsWith('image/'));

const escalaParaTexto = (ops: NovaOpcao[]) =>
  ops.map((o) => (o.valor_opcao !== undefined ? `${o.texto_opcao} = ${o.valor_opcao}` : o.texto_opcao)).join('\n');

/**
 * Transforma os arquivos escolhidos em páginas com miniatura: foto = 1 página,
 * PDF = uma por página. Para no limite de `vagas` e diz o que ficou de fora.
 */
async function paraPaginas(arquivos: File[], vagas: number): Promise<{ novas: Imagem[]; aviso: string | null }> {
  const avisos: string[] = [];
  const novas: Imagem[] = [];
  let foraDoLimite = 0;
  for (const f of arquivos) {
    const pdf = ehPdf(f);
    if (!pdf && !TIPOS_IMAGEM.includes(f.type)) {
      avisos.push(`“${f.name}” não é imagem (PNG, JPG ou WEBP) nem PDF.`);
      continue;
    }
    if (f.size > TAMANHO_MAXIMO) {
      avisos.push(`“${f.name}” passa de 20 MB.`);
      continue;
    }
    if (!pdf) {
      if (novas.length >= vagas) foraDoLimite++;
      else novas.push({ fonte: { arquivo: f }, url: URL.createObjectURL(f), nome: f.name });
      continue;
    }
    try {
      const total = await contarPaginas(f);
      for (let n = 1; n <= total; n++) {
        if (novas.length >= vagas) {
          foraDoLimite += total - n + 1;
          break;
        }
        novas.push({ fonte: { arquivo: f, pagina: n }, url: await miniaturaDaPagina(f, n), nome: total > 1 ? `${f.name} (pág. ${n})` : f.name });
      }
    } catch {
      avisos.push(`Não foi possível abrir “${f.name}”: o PDF pode estar protegido por senha ou corrompido.`);
    }
  }
  if (foraDoLimite)
    avisos.push(`São até ${MAX_IMAGENS} páginas por vez: ${plural(foraDoLimite, 'ficou de fora', 'ficaram de fora')}.`);
  return { novas, aviso: avisos.join(' ') || null };
}

/**
 * Botão "Escanear com IA" e a janela da digitalização. O botão abre a escolha
 * de fotos ou PDF; escolhidos, a janela mostra as miniaturas das páginas e, ao
 * processar, cada uma ganha a animação de leitura enquanto é lida (OCR com o
 * Tesseract, rede neural LSTM; PDF com texto é lido direto). Nada é salvo
 * aqui: as perguntas vão para o editor.
 */
export function EscanearComIA({ aoUsar, pequeno = false }: { aoUsar: (f: FormularioImportado) => void; pequeno?: boolean }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [imagens, setImagens] = useState<Imagem[] | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  /** gerando as miniaturas (PDF leva um instante) */
  const [abrindo, setAbrindo] = useState(false);

  // libera as miniaturas da memória quando a janela fecha
  const urls = useRef<string[]>([]);
  useEffect(
    () => () => {
      urls.current.forEach((u) => URL.revokeObjectURL(u));
      fecharPdfs();
    },
    [],
  );

  async function adicionar(lista: FileList | null) {
    const arquivos = Array.from(lista ?? []);
    if (!arquivos.length) return;
    const atuais = imagens ?? [];
    // a janela abre na hora; as miniaturas de PDF chegam em seguida
    setImagens(atuais);
    setAbrindo(true);
    const { novas, aviso: a } = await paraPaginas(arquivos, MAX_IMAGENS - atuais.length);
    urls.current.push(...novas.map((n) => n.url));
    setAbrindo(false);
    setAviso(a);
    setImagens((agora) => (agora ? [...agora, ...novas] : agora));
  }

  function fechar() {
    // libera as miniaturas só depois da animação de saída: a cópia animada da
    // janela ainda mostra as <img> por ~300 ms
    const soltar = urls.current;
    urls.current = [];
    setTimeout(() => soltar.forEach((u) => URL.revokeObjectURL(u)), 1000);
    fecharPdfs();
    setImagens(null);
    setAviso(null);
  }

  return (
    <>
      <button
        type="button"
        className={'btn-escanear' + (pequeno ? ' sm' : '')}
        data-tip={DICA}
        data-tip-pos="bottom"
        onClick={() => entrada.current?.click()}
      >
        <Ic d={D.importar} />
        <strong>Escanear com IA</strong>
      </button>
      <input
        ref={entrada}
        type="file"
        hidden
        multiple
        accept={TIPOS_ACEITOS}
        onChange={(e) => {
          void adicionar(e.target.files);
          e.target.value = '';
        }}
      />
      {/* A janela vai para o contêiner do painel (.ps.app), fora do painel onde
          o botão está (animação/overflow dele atrapalhariam a posição fixa).
          Tem que ficar dentro do .ps: a animação de saída (behaviors/modal.js)
          copia a janela para o mesmo pai, e fora do .ps a cópia sai sem estilo. */}
      {imagens &&
        createPortal(
          <JanelaEscanear
            imagens={imagens}
            aviso={aviso}
            abrindo={abrindo}
            aoMudar={setImagens}
            aoAdicionar={adicionar}
            aoUsar={(f) => {
              fechar();
              aoUsar(f);
            }}
            aoFechar={fechar}
          />,
          document.querySelector('.ps.app') ?? document.body,
        )}
    </>
  );
}

function JanelaEscanear({
  imagens,
  aviso,
  abrindo,
  aoMudar,
  aoAdicionar,
  aoUsar,
  aoFechar,
}: {
  imagens: Imagem[];
  aviso: string | null;
  abrindo: boolean;
  aoMudar: (l: Imagem[]) => void;
  aoAdicionar: (l: FileList | null) => void;
  aoUsar: (f: FormularioImportado) => void;
  aoFechar: () => void;
}) {
  const mais = useRef<HTMLInputElement>(null);
  const [etapa, setEtapa] = useState<Etapa>('selecao');
  const [andamento, setAndamento] = useState<Andamento | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [segmentos, setSegmentos] = useState<Segmento[]>([]);
  const [comuns, setComuns] = useState('');
  const cancelar = useRef<AbortController | null>(null);

  // sem as opções em comum: quantas perguntas ficaram sem opções e a escala achada
  const base = useMemo(() => montarFormulario(segmentos), [segmentos]);
  const resultado = useMemo(() => montarFormulario(segmentos, lerOpcoesComuns(comuns)), [segmentos, comuns]);
  const semOpcoes = base.perguntas.filter((p) => p.id_tipo_pergunta === TipoPergunta.TEXTO).length;
  const nPerg = resultado.perguntas.length;
  const cheio = imagens.length >= MAX_IMAGENS;

  async function processar() {
    setErro(null);
    setEtapa('processando');
    setAndamento({ indice: 0, fase: 'lendo', fracao: 0 });
    const controle = new AbortController();
    cancelar.current = controle;
    try {
      const segs = await lerArquivos(
        imagens.map((i) => i.fonte),
        setAndamento,
        controle.signal,
      );
      const achado = montarFormulario(segs);
      setSegmentos(segs);
      setComuns(achado.escalaSugerida ? escalaParaTexto(achado.escalaSugerida) : '');
      setEtapa('pronto');
    } catch (e) {
      if (e instanceof LeituraCancelada) return;
      setErro(
        'Não foi possível ler as páginas. Na primeira vez o navegador baixa o leitor de texto: confira a internet e tente de novo.' +
          (e instanceof Error && e.message ? ` (${e.message})` : ''),
      );
      setEtapa('selecao');
    } finally {
      cancelar.current = null;
    }
  }

  function fechar() {
    cancelar.current?.abort();
    aoFechar();
  }

  /** estado de cada miniatura durante a leitura */
  const estadoDa = (i: number): 'espera' | 'lendo' | 'pronta' => {
    if (etapa === 'pronto') return 'pronta';
    if (etapa !== 'processando' || !andamento) return 'espera';
    if (i < andamento.indice || (i === andamento.indice && andamento.fase === 'concluida')) return 'pronta';
    return i === andamento.indice ? 'lendo' : 'espera';
  };

  const status = abrindo
    ? 'Preparando as miniaturas…'
    : etapa === 'processando' && andamento
      ? andamento.fase === 'preparando'
        ? 'Preparando o leitor (só na primeira vez demora mais)…'
        : `Lendo ${imagens.length > 1 ? `a página ${Math.min(andamento.indice + 1, imagens.length)} de ${imagens.length}` : 'a página'}…`
      : null;

  const rodape =
    etapa === 'selecao' ? (
      <>
        {(erro || aviso) && (
          <div className="erro-rodape">
            <MensagemErro>{erro ?? aviso}</MensagemErro>
          </div>
        )}
        <button type="button" className="ps-btn secondary cancelar" onClick={fechar}>
          Cancelar
        </button>
        <button
          type="button"
          className="ps-btn secondary"
          onClick={() => mais.current?.click()}
          disabled={cheio || abrindo}
        >
          <IcMais />
          Selecionar mais imagens
        </button>
        <button type="button" className="ps-btn primary" onClick={() => void processar()} disabled={!imagens.length || abrindo}>
          Processar
        </button>
      </>
    ) : etapa === 'processando' ? (
      <button type="button" className="ps-btn secondary cancelar" onClick={fechar}>
        Cancelar
      </button>
    ) : (
      <>
        <button type="button" className="ps-btn secondary cancelar" onClick={fechar}>
          Cancelar
        </button>
        <button type="button" className="ps-btn secondary" onClick={() => setEtapa('selecao')}>
          Voltar às imagens
        </button>
        <button
          type="button"
          className="ps-btn primary"
          disabled={!nPerg}
          onClick={() =>
            aoUsar({
              titulo: resultado.titulo,
              descricao: resultado.descricao,
              perguntas: resultado.perguntas,
            })
          }
        >
          {nPerg ? `Usar ${plural(nPerg, 'pergunta', 'perguntas')}` : 'Usar perguntas'}
        </button>
      </>
    );

  return (
    <Modal
      vidro
      alta
      largura={760}
      titulo="Escanear formulário com IA"
      subtitulo={
        etapa === 'pronto'
          ? 'Confira o que foi lido. Depois você ainda revisa cada pergunta no editor antes de salvar.'
          : `Fotos e PDF são lidos aqui no seu navegador, na ordem das páginas. Até ${MAX_IMAGENS} páginas por vez.`
      }
      aoFechar={fechar}
      fecharNoX
      estiloCorpo={{ display: 'flex', flexDirection: 'column', gap: 16 }}
      rodape={rodape}
    >
      <ol className={'escanear-miniaturas is-' + etapa} aria-label="Imagens do formulário">
        {imagens.map((img, i) => {
          const estado = estadoDa(i);
          const fracao = estado === 'lendo' && andamento?.fase === 'lendo' ? (andamento.fracao ?? 0) : undefined;
          return (
            <li
              key={img.url}
              className={'miniatura is-' + estado}
              aria-label={`Página ${i + 1}: ${img.nome}${estado === 'lendo' ? ', em leitura' : estado === 'pronta' ? ', lida' : ''}`}
            >
              <img src={img.url} alt="" />
              {estado === 'lendo' && <span className="brilho" aria-hidden="true" />}
              {estado === 'pronta' && (
                <span className="selo-ok" aria-hidden="true">
                  <IcCheck />
                </span>
              )}
              {fracao !== undefined && (
                <span className="barra" aria-hidden="true">
                  <i style={{ width: `${Math.round(fracao * 100)}%` }} />
                </span>
              )}
              <span className="pag" aria-hidden="true">
                {i + 1}
              </span>
              {etapa === 'selecao' && (
                <button
                  type="button"
                  className="tirar"
                  aria-label={`Tirar a página ${i + 1}`}
                  data-tip="Tirar esta página"
                  onClick={() => {
                    const resto = imagens.filter((_, j) => j !== i);
                    if (resto.length) {
                      aoMudar(resto);
                      setTimeout(() => URL.revokeObjectURL(img.url), 1000);
                    } else fechar();
                  }}
                >
                  <IcFechar />
                </button>
              )}
            </li>
          );
        })}
      </ol>
      <input
        ref={mais}
        type="file"
        hidden
        multiple
        accept={TIPOS_ACEITOS}
        onChange={(e) => {
          aoAdicionar(e.target.files);
          e.target.value = '';
        }}
      />

      {etapa === 'selecao' && (
        <p className="escanear-dica">
          Dica: fotografe a folha inteira, de frente, com boa luz e sem sombra. Se tiver o formulário em PDF, prefira ele: a leitura é
          mais precisa. Com mais de uma página, envie na ordem.
        </p>
      )}

      {status && (
        <p className="escanear-status" role="status" aria-live="polite">
          {status}
        </p>
      )}

      {etapa === 'pronto' && (
        <>
          {nPerg === 0 ? (
            <Alerta tipo="warning" titulo="Nenhuma pergunta encontrada">
              Não deu para reconhecer perguntas nessas páginas. Tente uma foto mais nítida e de frente. Perguntas são reconhecidas quando
              começam com número ou letra (“1.”, “01”, “a.”), terminam com “?” ou têm caixas de marcar.
            </Alerta>
          ) : (
            <Alerta tipo="info" titulo={plural(nPerg, 'pergunta encontrada', 'perguntas encontradas')}>
              A leitura automática pode trocar letras ou juntar palavras. Confira os textos e os tipos de resposta.
            </Alerta>
          )}

          {(semOpcoes > 0 || comuns) && (
            <div className="ps-field">
              <label className="ps-label" htmlFor="ocr-comuns">
                Opções para as perguntas sem opções <span className="opt">(opcional)</span>
              </label>
              <div className="ps-control ps-textarea" style={{ alignItems: 'flex-start' }}>
                <textarea
                  id="ocr-comuns"
                  style={{ minHeight: 88 }}
                  value={comuns}
                  onChange={(e) => setComuns(e.target.value)}
                  aria-describedby="ocr-comuns-ajuda"
                />
              </div>
              <div className="ps-helper" id="ocr-comuns-ajuda">
                Para escalas como a do SCARED: uma opção por linha, com a pontuação depois do “=” (ex.: Não verdadeiro = 0). Vazio,{' '}
                {semOpcoes === 1 ? 'a pergunta sem opções vira' : 'as perguntas sem opções viram'} texto longo.
                {base.escalaSugerida && ' A escala foi preenchida a partir do cabeçalho da tabela: confira.'}
              </div>
            </div>
          )}

          {nPerg > 0 && (
            <ol className="ocr-lista">
              {resultado.perguntas.map((p, i) => (
                <li key={i}>
                  <strong>{p.pergunta}</strong>
                  <span className="selos-linha">
                    <span className="ps-badge info">{nomeTipoPergunta(p.id_tipo_pergunta, p.valor_minimo, p.valor_maximo)}</span>
                  </span>
                  {temOpcoes(p.id_tipo_pergunta) && p.opcoes && (
                    <span className="ocr-opcoes">
                      {p.opcoes
                        .map((o) => (o.valor_opcao !== undefined ? `${o.texto_opcao} (${o.valor_opcao})` : o.texto_opcao))
                        .join(' · ')}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )}

          {resultado.ignoradas.length > 0 && (
            <details className="ocr-ignoradas">
              <summary>Textos da imagem que não viraram pergunta ({resultado.ignoradas.length})</summary>
              <p>
                Títulos, cabeçalhos de coluna e notas que a leitura encontrou, mas não usou como pergunta nem como opção. Confira se
                nenhuma pergunta ficou aqui; se ficou, inclua no editor com “Adicionar perguntas”.
              </p>
              <ul>
                {resultado.ignoradas.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </Modal>
  );
}
