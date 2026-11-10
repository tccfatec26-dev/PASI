import { useLayoutEffect, type RefObject } from 'react';

const DURACAO = 420;
const CURVA = 'cubic-bezier(.22,.8,.24,1)';
// histerese: compacta depois de 16px de rolagem e só expande perto do topo,
// para a barra não "piscar" no limite
const COMPACTA_EM = 16;
const EXPANDE_EM = 4;

/**
 * Cabeçalho que vira uma barra única de vidro ao rolar: o título vai para a
 * esquerda e as migalhas para a direita, na mesma linha (classe .is-compact).
 *
 * A troca de layout é animada com FLIP (mede antes e depois e anima a
 * diferença). O espaço que o cabeçalho ocupa no fluxo da página não muda —
 * a altura que ele perde vira margem embaixo —, então o conteúdo não pula.
 */
export function useCabecalhoCompacto(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const head = ref.current;
    if (!head) return;
    const semMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let compacto = false;
    let alturaCheia = 0;
    let quadro = 0;
    let animacoes: Animation[] = [];

    const alternar = (novo: boolean, animar: boolean) => {
      const titulo = head.querySelector<HTMLElement>('.ph-title');
      const migalhas = head.querySelector<HTMLElement>('.crumbs');
      animacoes.forEach((a) => a.cancel());
      animacoes = [];

      // antes
      const altAntes = head.getBoundingClientRect().height;
      const margemAntes = parseFloat(getComputedStyle(head).marginBottom) || 0;
      const rT = titulo?.getBoundingClientRect();
      const rM = migalhas?.getBoundingClientRect();
      if (novo) alturaCheia = altAntes;

      head.classList.toggle('is-compact', novo);
      head.style.marginBottom = '';

      // depois
      const altDepois = head.getBoundingClientRect().height;
      const margemBase = parseFloat(getComputedStyle(head).marginBottom) || 0;
      const margemDepois = novo ? margemBase + Math.max(0, alturaCheia - altDepois) : margemBase;
      head.style.marginBottom = `${margemDepois}px`;
      compacto = novo;
      if (!animar || semMovimento) return;

      const opcoes: KeyframeAnimationOptions = { duration: DURACAO, easing: CURVA };
      animacoes.push(
        head.animate(
          [
            { height: `${altAntes}px`, marginBottom: `${margemAntes}px` },
            { height: `${altDepois}px`, marginBottom: `${margemDepois}px` },
          ],
          opcoes,
        ),
      );
      if (titulo && rT) {
        const r2 = titulo.getBoundingClientRect();
        const escala = r2.height ? rT.height / r2.height : 1;
        titulo.style.transformOrigin = '0 0';
        animacoes.push(
          titulo.animate(
            [{ transform: `translate(${rT.left - r2.left}px, ${rT.top - r2.top}px) scale(${escala})` }, { transform: 'none' }],
            opcoes,
          ),
        );
      }
      if (migalhas && rM) {
        const r2 = migalhas.getBoundingClientRect();
        animacoes.push(
          migalhas.animate(
            [{ transform: `translate(${rM.left - r2.left}px, ${rM.top - r2.top}px)`, opacity: 0.4 }, { transform: 'none', opacity: 1 }],
            opcoes,
          ),
        );
      }
    };

    const ler = () => {
      quadro = 0;
      const y = window.scrollY;
      const novo = compacto ? y > EXPANDE_EM : y > COMPACTA_EM;
      if (novo !== compacto) alternar(novo, true);
    };
    const aoRolar = () => {
      if (!quadro) quadro = requestAnimationFrame(ler);
    };

    if (window.scrollY > COMPACTA_EM) alternar(true, false);
    window.addEventListener('scroll', aoRolar, { passive: true });
    return () => {
      window.removeEventListener('scroll', aoRolar);
      if (quadro) cancelAnimationFrame(quadro);
      animacoes.forEach((a) => a.cancel());
    };
  }, [ref]);
}
