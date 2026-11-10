/* PASI — seletor segmentado animado (painel web — portado do protótipo)
   O destaque desliza até a opção escolhida; também dá para arrastá-lo com o mouse ou o dedo.
   Teclado e leitor de tela continuam usando os próprios botões. */
// Comportamento global (delegação de eventos no documento): funciona com os
// componentes React sem precisar de estado próprio. Instalado uma vez em main.tsx.
export function installSeg() {
  if (window.__pasiSeg) return;
  window.__pasiSeg = true;
  var d = document, drag = null, suppress = false, raf = 0;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function buttons(seg) { return Array.prototype.filter.call(seg.querySelectorAll('button'), function (b) { return b.closest('.ps-seg') === seg; }); }
  function selected(seg) { return buttons(seg).filter(function (b) { return b.classList.contains('is-selected'); })[0]; }
  function off(seg) { return seg.getAttribute('aria-disabled') === 'true' || buttons(seg).every(function (b) { return b.disabled; }); }
  function thumbOf(seg) {
    var t = seg.__thumb;
    if (!t || !t.isConnected || t.parentNode !== seg) {
      t = d.createElement('span'); t.className = 'seg-thumb'; t.setAttribute('aria-hidden', 'true');
      seg.appendChild(t); seg.__thumb = t;
    }
    return t;
  }
  function moveTo(seg, b, animate) {
    var t = thumbOf(seg);
    if (!b) { t.style.opacity = '0'; return; }
    t.style.opacity = '1';
    t.classList.toggle('no-anim', !animate || reduce);
    t.style.width = b.offsetWidth + 'px';
    t.style.height = b.offsetHeight + 'px';
    t.style.transform = 'translate(' + b.offsetLeft + 'px,' + b.offsetTop + 'px)';
  }
  function sync() {
    raf = 0;
    Array.prototype.forEach.call(d.querySelectorAll('.ps-seg'), function (seg) {
      if (off(seg)) return;
      var first = !seg.classList.contains('seg-js');
      if (first) seg.classList.add('seg-js');
      if (drag && drag.seg === seg) return;
      moveTo(seg, selected(seg), !first);
    });
  }
  function later() { if (!raf) raf = requestAnimationFrame(sync); }

  // Botões sem lógica própria (ex.: "Sexo" estático): troca a seleção aqui mesmo.
  function choose(seg, b) {
    if (b.classList.contains('is-selected')) return;
    b.click();
    setTimeout(function () {
      if (b.classList.contains('is-selected')) return;
      buttons(seg).forEach(function (x) { var on = x === b; x.classList.toggle('is-selected', on); if (x.hasAttribute('aria-pressed')) x.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      later();
    }, 60);
  }

  d.addEventListener('click', function (e) {
    if (suppress) { suppress = false; e.stopPropagation(); e.preventDefault(); return; }
    var b = e.target.closest && e.target.closest('.ps-seg button');
    if (!b) return;
    var seg = b.closest('.ps-seg');
    if (!seg || off(seg) || b.classList.contains('is-selected') || b.__fromSeg) return;
    // dá a chance do próprio componente tratar; se nada mudar, troca aqui
    setTimeout(function () {
      if (b.classList.contains('is-selected')) return;
      buttons(seg).forEach(function (x) { var on = x === b; x.classList.toggle('is-selected', on); if (x.hasAttribute('aria-pressed')) x.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      later();
    }, 60);
  }, true);

  d.addEventListener('pointerdown', function (e) {
    var b = e.target.closest && e.target.closest('.ps-seg button');
    if (!b || e.button > 0) return;
    var seg = b.closest('.ps-seg');
    if (!seg || off(seg) || !b.classList.contains('is-selected')) return;
    var t = thumbOf(seg);
    drag = { seg: seg, x0: e.clientX, left0: b.offsetLeft, moved: false, id: e.pointerId };
    try { seg.setPointerCapture(e.pointerId); } catch (_) {}
  });
  d.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var dx = e.clientX - drag.x0;
    if (!drag.moved && Math.abs(dx) < 4) return;
    if (!drag.moved) { drag.moved = true; drag.seg.classList.add('is-dragging'); }
    var seg = drag.seg, bs = buttons(seg), t = thumbOf(seg);
    var minL = bs[0].offsetLeft, last = bs[bs.length - 1], maxL = last.offsetLeft + last.offsetWidth - t.offsetWidth;
    var x = Math.max(minL, Math.min(drag.left0 + dx, maxL));
    t.classList.add('no-anim');
    t.style.transform = 'translate(' + x + 'px,' + selected(seg).offsetTop + 'px)';
    // opção mais próxima fica realçada durante o arraste
    var mid = x + t.offsetWidth / 2, near = nearest(bs, mid);
    bs.forEach(function (b) { b.classList.toggle('is-near', b === near); });
  });
  function nearest(bs, mid) {
    var best = bs[0], dist = Infinity;
    bs.forEach(function (b) { var c = b.offsetLeft + b.offsetWidth / 2, dd = Math.abs(c - mid); if (dd < dist) { dist = dd; best = b; } });
    return best;
  }
  function end(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var g = drag; drag = null;
    if (!g.moved) return;
    var seg = g.seg, bs = buttons(seg), t = thumbOf(seg);
    var x = new DOMMatrixReadOnly(getComputedStyle(t).transform).m41;
    var b = nearest(bs, x + t.offsetWidth / 2);
    bs.forEach(function (x) { x.classList.remove('is-near'); });
    seg.classList.remove('is-dragging');
    suppress = true; setTimeout(function () { suppress = false; }, 0);
    moveTo(seg, b, true);
    setTimeout(function () { choose(seg, b); later(); }, 0);
  }
  d.addEventListener('pointerup', end);
  d.addEventListener('pointercancel', end);

  new MutationObserver(later).observe(d.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
  window.addEventListener('resize', later);
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', later); else later();
}
