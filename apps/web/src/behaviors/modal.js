/* PASI — animação de saída das janelas (painel web — portado do protótipo)
   Quando uma janela some, mostra uma cópia visual dela fazendo o caminho inverso
   (desce e esmaece, enquanto o fundo clareia) e depois a remove. */
// Comportamento global (delegação de eventos no documento): funciona com os
// componentes React sem precisar de estado próprio. Instalado uma vez em main.tsx.
export function installModal() {
  if (window.__pasiModal) return;
  window.__pasiModal = true;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function scrimOf(n) {
    if (n.nodeType !== 1) return null;
    if (n.classList.contains('ps-scrim')) return n;
    return n.querySelector ? n.querySelector('.ps-scrim') : null;
  }
  new MutationObserver(function (muts) {
    if (reduce) return;
    var entrou = muts.some(function (m) { return Array.prototype.some.call(m.addedNodes, function (n) { return !!scrimOf(n) && !(n.classList && n.classList.contains('is-saindo')); }); });
    muts.forEach(function (m) {
      Array.prototype.forEach.call(m.removedNodes, function (n) {
        var sc = scrimOf(n);
        if (!sc || sc.classList.contains('is-saindo') || !m.target.isConnected) return;
        var c = sc.cloneNode(true);
        c.classList.add('is-saindo');
        if (entrou) c.classList.add('so-janela');
        c.setAttribute('aria-hidden', 'true');
        c.setAttribute('inert', '');
        Array.prototype.forEach.call(c.querySelectorAll('[id]'), function (x) { x.removeAttribute('id'); });
        m.target.appendChild(c);
        setTimeout(function () { if (c.parentNode) c.parentNode.removeChild(c); }, 300);
      });
    });
  }).observe(document.documentElement, { childList: true, subtree: true });
}
