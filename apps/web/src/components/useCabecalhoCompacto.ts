import { useLayoutEffect, type RefObject } from 'react';

const DURACAO = 420;
const CURVA = 'cubic-bezier(.22,.8,.24,1)';
// histerese: depois de compactar, só expande alguns pixels acima do ponto
const FOLGA = 6;

/**
 * Cabeçalho que vira uma barra única de vidro ao rolar: o título vai para a
 * esquerda e as migalhas para a direita, na mesma linha (classe .is-compact).
 *
 * Expandido, o cabeçalho rola junto com a página. A barra só aparece quando o
 * conteúdo chega até ela, ou seja, quando o topo do primeiro bloco da página
 * encostaria na barra compacta. Daí em diante ela fica fixa no topo.
 *
 * A troca é animada com FLIP (mede antes e depois e anima a diferença). O
 * espaço do cabeçalho no fluxo não muda — a altura que ele perde vira margem
 * embaixo —, então o conteúdo não pula.
 */
export function useCabecalhoCompacto(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const head = ref.current;
    if (!head) return;
    const semMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let compacto = false;
    let alturaCheia = 0;
    let limiar = Infinity;
    let alturaCompacta = 0;
    let quadro = 0;
    let animacoes: Animation[] = [];

    /** Rolagem em que o conteúdo encosta na barra compacta. */
    const calcularLimiar = (medirBarra = false) => {
      if (compacto || animacoes.some((a) => a.playState === 'running')) return;
      const corpo = head.nextElementSibling as HTMLElement | null;
      const primeiro = (corpo?.firstElementChild as HTMLElement | null) ?? corpo;
      if (!primeiro) return;
      if (medirBarra || !alturaCompacta) {
        head.classList.add('is-compact');
        alturaCompacta = head.getBoundingClientRect().height;
        head.classList.remove('is-compact');
      }
      const topoConteudo = primeiro.getBoundingClientRect().top + window.scrollY;
      limiar = Math.max(1, topoConteudo - alturaCompacta);
    };

    const alternar = (novo: boolean, animar: boolean) => {
      const titulo = head.querySelector<HTMLElement>('.ph-title');
      const migalhas = head.querySelector<HTMLElement>('.crumbs');

      // antes (inclusive no meio de uma animação anterior)
      const rH = head.getBoundingClientRect();
      const margemAntes = parseFloat(getComputedStyle(head).marginBottom) || 0;
      const rT = titulo?.getBoundingClientRect();
      const rM = migalhas?.getBoundingClientRect();
      animacoes.forEach((a) => a.cancel());
      animacoes = [];
      if (novo && !compacto) alturaCheia = head.getBoundingClientRect().height;

      head.classList.toggle('is-compact', novo);
      head.style.marginBottom = '';

      // depois
      const altDepois = head.getBoundingClientRect().height;
      const margemBase = parseFloat(getComputedStyle(head).marginBottom) || 0;
      const margemDepois = novo ? margemBase + Math.max(0, alturaCheia - altDepois) : margemBase;
      head.style.marginBottom = `${margemDepois}px`;
      const rH2 = head.getBoundingClientRect();
      compacto = novo;
      if (!animar || semMovimento) return;

      const opcoes: KeyframeAnimationOptions = { duration: DURACAO, easing: CURVA };
      // a caixa do cabeçalho vai da posição/altura de antes para a de depois
      animacoes.push(
        head.animate(
          [
            { top: `${rH.top}px`, height: `${rH.height}px`, marginBottom: `${margemAntes}px` },
            { top: `${rH2.top}px`, height: `${rH2.height}px`, marginBottom: `${margemDepois}px` },
          ],
          opcoes,
        ),
      );
      // título e migalhas: deslocamento relativo à caixa (ela mesma também anda)
      const flip = (el: HTMLElement, r: DOMRect, escalar: boolean) => {
        const r2 = el.getBoundingClientRect();
        const dx = r.left - rH.left - (r2.left - rH2.left);
        const dy = r.top - rH.top - (r2.top - rH2.top);
        const s = escalar && r2.height ? r.height / r2.height : 1;
        el.style.transformOrigin = '0 0';
        animacoes.push(
          el.animate([{ transform: `translate(${dx}px, ${dy}px) scale(${s})` }, { transform: 'none' }], opcoes),
        );
      };
      if (titulo && rT) flip(titulo, rT, true);
      if (migalhas && rM) flip(migalhas, rM, false);
    };

    const ler = () => {
      quadro = 0;
      const y = window.scrollY;
      const novo = compacto ? y > limiar - FOLGA : y >= limiar;
      if (novo !== compacto) alternar(novo, true);
    };
    const aoRolar = () => {
      if (!quadro) quadro = requestAnimationFrame(ler);
    };
    const aoRedimensionar = () => {
      calcularLimiar(true);
      aoRolar();
    };

    calcularLimiar();
    if (window.scrollY >= limiar) alternar(true, false);
    window.addEventListener('scroll', aoRolar, { passive: true });
    window.addEventListener('resize', aoRedimensionar);
    // o conteúdo pode mudar de altura depois de carregar (avisos, listas)
    const observador = new ResizeObserver(() => calcularLimiar());
    if (head.nextElementSibling) observador.observe(head.nextElementSibling);
    return () => {
      window.removeEventListener('scroll', aoRolar);
      window.removeEventListener('resize', aoRedimensionar);
      observador.disconnect();
      if (quadro) cancelAnimationFrame(quadro);
      animacoes.forEach((a) => a.cancel());
    };
  }, [ref]);
}
