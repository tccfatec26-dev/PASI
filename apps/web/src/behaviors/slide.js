/* PASI — "Deslize para encerrar" (painel web — portado do protótipo)
   Arrastar o puxador até o fim conclui a ação; soltar antes faz ele voltar.
   Teclado: setas avançam/recuam 25%, End conclui, Home volta. Clicar não faz nada. */
// Comportamento global (delegação de eventos no documento): funciona com os
// componentes React sem precisar de estado próprio. Instalado uma vez em main.tsx.
export function installSlide() {
  if (window.__pasiSlide) return;
  window.__pasiSlide = true;
  var d = document, drag = null;
  function track(k) { return k.closest('.slide'); }
  function max(k) { var t = track(k), cs = getComputedStyle(t); return t.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - k.offsetWidth; }
  function off(k) { return k.getAttribute('aria-disabled') === 'true' || track(k).classList.contains('is-done'); }
  function set(k, x, anim) {
    var t = track(k), m = max(k), txt = t.querySelector('.slide-txt'), fill = t.querySelector('.slide-fill');
    x = Math.max(0, Math.min(x, m)); k.__x = x;
    var tr = anim ? '.35s cubic-bezier(.2,.8,.2,1)' : '0s';
    k.style.transition = 'transform ' + tr + ', box-shadow .45s, color .45s';
    k.style.transform = 'translateX(' + x + 'px)';
    if (txt) { txt.style.transition = 'opacity ' + tr; txt.style.opacity = String(Math.max(0, 1 - x / (m * 0.55))); }
    if (fill) { fill.style.transition = 'width ' + tr; fill.style.width = (x + k.offsetWidth) + 'px'; }
    k.setAttribute('aria-valuenow', String(Math.round(m ? (x / m) * 100 : 0)));
    return x;
  }
  function done(k) {
    var t = track(k); set(k, max(k), true); t.classList.add('is-done');
    setTimeout(function () { var b = t.querySelector('.slide-done'); if (b) b.click(); }, 420);
  }
  // Volta o puxador ao início (ex.: quando a pessoa cancela a confirmação)
  window.pasiSlideReset = function () {
    Array.prototype.forEach.call(d.querySelectorAll('.slide.is-done'), function (t) {
      t.classList.remove('is-done');
      var k = t.querySelector('.slide-knob'); if (k) { set(k, 0, true); try { k.focus({ preventScroll: true }); } catch (_) {} }
    });
  };
  d.addEventListener('pointerdown', function (e) {
    var k = e.target.closest && e.target.closest('.slide-knob');
    if (!k || off(k)) return;
    e.preventDefault();
    drag = { k: k, start: e.clientX - (k.__x || 0), id: e.pointerId };
    try { k.setPointerCapture(e.pointerId); } catch (_) {}
    k.classList.add('is-drag');
  });
  d.addEventListener('pointermove', function (e) { if (drag && e.pointerId === drag.id) set(drag.k, e.clientX - drag.start, false); });
  function end(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var k = drag.k; drag = null; k.classList.remove('is-drag');
    if ((k.__x || 0) >= max(k) * 0.9) done(k); else set(k, 0, true);
  }
  d.addEventListener('pointerup', end);
  d.addEventListener('pointercancel', end);
  d.addEventListener('keydown', function (e) {
    var k = e.target.closest && e.target.closest('.slide-knob');
    if (!k || off(k)) return;
    var m = max(k), x = k.__x || 0;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); x = set(k, x + m * 0.25, true); if (x >= m - 0.5) done(k); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); set(k, x - m * 0.25, true); }
    else if (e.key === 'End') { e.preventDefault(); done(k); }
    else if (e.key === 'Home') { e.preventDefault(); set(k, 0, true); }
  });
}
