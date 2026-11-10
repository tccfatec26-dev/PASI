/* PASI — tooltip acessível (painel web — portado do protótipo)
   - Abre com mouse, foco do teclado ou toque; fecha com Esc, ao sair ou ao tocar fora.
   - O tooltip pode receber o mouse (dá para passar o cursor por cima sem ele sumir).
   - Reposiciona sozinho para nunca sair da tela.
   - Liga o texto ao elemento com aria-describedby (quando o texto não é o próprio nome do elemento).
   Sem este script, os tooltips em CSS (::after) continuam funcionando como reserva. */
// Comportamento global (delegação de eventos no documento): funciona com os
// componentes React sem precisar de estado próprio. Instalado uma vez em main.tsx.
export function installTooltip() {
  if (window.__pasiTooltip) return;
  window.__pasiTooltip = true;
  var doc = document, root = doc.documentElement;
  root.classList.add('js-tt');
  var tip = null, cur = null, hideT = null, outT = null, ID = 'pasi-tooltip';

  function ensure() {
    if (tip) return tip;
    tip = doc.createElement('div');
    tip.id = ID; tip.className = 'pasi-tt'; tip.setAttribute('role', 'tooltip'); tip.hidden = true;
    tip.addEventListener('pointerenter', function () { clearTimeout(hideT); });
    tip.addEventListener('pointerleave', function () { schedule(); });
    doc.body.appendChild(tip);
    return tip;
  }
  function trig(el) { return el && el.closest ? el.closest('[data-tip]') : null; }
  function pref(el) {
    if (el.getAttribute('data-tip-pos')) return el.getAttribute('data-tip-pos');
    var c = el.classList;
    if (c.contains('info-tip')) return 'right';
    if (c.contains('dot')) return 'left';
    if (c.contains('nav-item')) return 'right';
    if (c.contains('back-btn') || c.contains('btn-filtro')) return 'bottom';
    return 'top';
  }
  function place(el) {
    var r = el.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight, g = 10, m = 8;
    tip.style.left = '0px'; tip.style.top = '0px';
    tip.style.maxWidth = Math.min(360, vw - 2 * m) + 'px';
    var w = tip.offsetWidth, h = tip.offsetHeight;
    var order = [pref(el), 'right', 'bottom', 'top', 'left'].filter(function (v, i, a) { return a.indexOf(v) === i; });
    var pos = null;
    for (var i = 0; i < order.length; i++) {
      var p = order[i], x, y, ok;
      if (p === 'right') { x = r.right + g; y = r.top + r.height / 2 - h / 2; ok = x + w <= vw - m; }
      else if (p === 'left') { x = r.left - g - w; y = r.top + r.height / 2 - h / 2; ok = x >= m; }
      else if (p === 'bottom') { x = r.left + r.width / 2 - w / 2; y = r.bottom + g; ok = y + h <= vh - m; }
      else { x = r.left + r.width / 2 - w / 2; y = r.top - g - h; ok = y >= m; }
      if (ok) { pos = { p: p, x: x, y: y }; break; }
    }
    if (!pos) pos = { p: 'bottom', x: r.left + r.width / 2 - w / 2, y: r.bottom + g };
    pos.x = Math.max(m, Math.min(pos.x, vw - m - w));
    pos.y = Math.max(m, Math.min(pos.y, vh - m - h));
    tip.style.left = Math.round(pos.x) + 'px'; tip.style.top = Math.round(pos.y) + 'px';
    tip.setAttribute('data-pos', pos.p);
    // o balão "nasce" do centro do ícone; a pontinha aponta para ele
    var ax = r.left + r.width / 2 - pos.x, ay = r.top + r.height / 2 - pos.y;
    tip.style.transformOrigin = Math.round(ax) + 'px ' + Math.round(ay) + 'px';
    tip.style.setProperty('--tail-x', Math.round(Math.max(14, Math.min(ax, w - 14))) + 'px');
    tip.style.setProperty('--tail-y', Math.round(Math.max(12, Math.min(ay, h - 12))) + 'px');
  }
  function link(el, txt) {
    var label = (el.getAttribute('aria-label') || '').trim();
    if (label === txt) return;
    var d = (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
    if (d.indexOf(ID) < 0) { d.push(ID); el.setAttribute('aria-describedby', d.join(' ')); el.__ttLinked = true; }
  }
  function unlink(el) {
    if (!el || !el.__ttLinked) return;
    var d = (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(function (x) { return x && x !== ID; });
    if (d.length) el.setAttribute('aria-describedby', d.join(' ')); else el.removeAttribute('aria-describedby');
    el.__ttLinked = false;
  }
  function show(el) {
    var txt = (el.getAttribute('data-tip') || '').trim();
    if (!txt) { hide(); return; }
    clearTimeout(hideT); ensure();
    if (cur && cur !== el) unlink(cur);
    var nova = tip.hidden || tip.classList.contains('is-out') || cur !== el;
    clearTimeout(outT); tip.classList.remove('is-out');
    cur = el; tip.textContent = txt; tip.hidden = false;
    place(el); link(el, txt);
    if (nova) { tip.classList.remove('is-in'); void tip.offsetWidth; tip.classList.add('is-in'); }
  }
  function hide() {
    clearTimeout(hideT); unlink(cur); cur = null;
    if (!tip || tip.hidden) return;
    tip.classList.remove('is-in'); tip.classList.add('is-out');
    clearTimeout(outT);
    outT = setTimeout(function () { tip.hidden = true; tip.classList.remove('is-out'); }, 130);
  }
  function schedule() { clearTimeout(hideT); hideT = setTimeout(hide, 160); }

  doc.addEventListener('pointerover', function (e) {
    if (e.pointerType === 'touch') return;
    var el = trig(e.target);
    if (el) { if (el !== cur) show(el); else clearTimeout(hideT); }
  });
  doc.addEventListener('pointerout', function (e) {
    if (e.pointerType === 'touch' || !cur) return;
    var el = trig(e.target); if (el !== cur) return;
    var to = e.relatedTarget;
    if (to && (cur.contains(to) || (tip && tip.contains(to)))) return;
    schedule();
  });
  doc.addEventListener('focusin', function (e) { var el = trig(e.target); if (el) show(el); else if (cur) hide(); });
  doc.addEventListener('focusout', function (e) { if (cur && trig(e.target) === cur) schedule(); });
  doc.addEventListener('pointerdown', function (e) {
    if (e.pointerType !== 'touch') return;
    var el = trig(e.target);
    if (el) { if (el === cur && tip && !tip.hidden) hide(); else show(el); }
    else if (!(tip && tip.contains(e.target))) hide();
  }, true);
  doc.addEventListener('keydown', function (e) {
    if ((e.key === 'Escape' || e.key === 'Esc') && tip && !tip.hidden) { hide(); }
  }, true);
  window.addEventListener('scroll', function () { if (cur && tip && !tip.hidden) { if (doc.contains(cur)) place(cur); else hide(); } }, true);
  window.addEventListener('resize', function () { if (cur) hide(); });
}
