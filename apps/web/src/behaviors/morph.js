/* PASI — "morph" estilo Dynamic Island (painel web — portado do protótipo)
   Elementos com a classe .morph mudam de largura com mola e o conteúdo entra
   com um leve desfoque, quando o texto ou a cor deles muda. */
// Comportamento global (delegação de eventos no documento): funciona com os
// componentes React sem precisar de estado próprio. Instalado uma vez em main.tsx.
export function installMorph() {
  if (window.__pasiMorph) return;
  window.__pasiMorph = true;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function sig(el) { return el.className.replace(/\s*morph-pulo/g, '') + '|' + el.textContent; }
  function natural(el) { var w = el.style.width; el.style.width = ''; var n = el.getBoundingClientRect().width; el.style.width = w; return n; }
  function scan() {
    Array.prototype.forEach.call(document.querySelectorAll('.morph'), function (el) {
      var s = sig(el);
      if (el.__sig === undefined) { el.__sig = s; el.__w = el.getBoundingClientRect().width; return; }
      if (s === el.__sig) return;
      el.__sig = s;
      var from = el.__w || natural(el), to = natural(el);
      el.__w = to;
      if (reduce) return;
      var c = el.querySelector('.morph-c');
      if (c) { c.classList.remove('morph-in'); void c.offsetWidth; c.classList.add('morph-in'); }
      el.classList.remove('morph-pulo'); void el.offsetWidth; el.classList.add('morph-pulo');
      el.style.transition = 'none'; el.style.width = from + 'px'; void el.offsetWidth;
      el.style.transition = '';
      el.style.width = to + 'px';
      clearTimeout(el.__t);
      el.__t = setTimeout(function () { el.style.width = ''; }, 650);
    });
  }
  new MutationObserver(function () { requestAnimationFrame(scan); })
    .observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class'] });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan); else scan();
}
