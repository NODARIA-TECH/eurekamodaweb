// ==UserScript==
// @name         EUREKA · Lector de códigos (FacturaScripts / TPVneo)
// @namespace    https://eurekamoda.com/
// @version      1.1
// @description  La pistola escribe PEK'0897 (teclado en inglés): esto lo corrige a PEK-0897 al momento.
// @match        *://*/*
// @run-at       document-start
// @grant        none
// ==/UserScript==
(function () {
  'use strict';
  // Solo actúa cuando justo antes del apóstrofo hay un prefijo de referencia en MAYÚSCULAS (PEK, EUR…).
  // Escribir a mano (en minúsculas, o un apóstrofo normal) no se ve afectado.
  var PREFIX = /(^|[^A-Za-z])[A-Z]{2,5}$/;
  function campo(el) {
    return el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && /^(text|search|tel|)$/i.test(el.type || '')));
  }
  // Referencias de la tienda: PEK-0897 (y EUR- por si queda alguna antigua).
  var OWN = /(^|[^A-Za-z])(PEK|EUR)$/;
  function guion(el) {
    if (!document.execCommand || !document.execCommand('insertText', false, '-')) {
      var s = el.selectionStart, f = el.selectionEnd, v = el.value;
      var set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set;
      set.call(el, v.slice(0, s) + '-' + v.slice(f));
      el.setSelectionRange(s + 1, s + 1);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  // 1) Al pulsar la tecla, antes de que llegue al campo:
  //    · PEK' → PEK-   (pistola con teclado inglés, etiquetas antiguas)
  //    · PEK0 → PEK-0  (etiquetas nuevas, sin guion)
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    var el = e.target;
    if (!campo(el)) return;
    var antes = (el.value || '').slice(0, el.selectionStart == null ? el.value.length : el.selectionStart);
    if (e.key === "'" && PREFIX.test(antes)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      guion(el);
    } else if (/^[0-9]$/.test(e.key) && OWN.test(antes)) {
      guion(el);            // el número entra después, normal
    }
  }, true);
  // 2) Red de seguridad (pegar, autocompletar…): si aun así entra PEK'0897, se corrige.
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (!campo(el) || !/'|(PEK|EUR)\d/.test(el.value || '')) return;
    var v = el.value.replace(/\b([A-Z]{2,5})'(\d{2,})/g, '$1-$2').replace(/\b(PEK|EUR)(\d{3,})\b/g, '$1-$2');
    if (v === el.value) return;
    var pos = el.selectionStart;
    var set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set;
    set.call(el, v);
    try { el.setSelectionRange(pos, pos); } catch (x) {}
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, true);
})();
