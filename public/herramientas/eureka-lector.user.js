// ==UserScript==
// @name         EUREKA · Lector de códigos (FacturaScripts / TPVneo)
// @namespace    https://eurekamoda.com/
// @version      1.2
// @description  La pistola escribe PEK'0897 (teclado en inglés): esto lo corrige a PEK-0897 al momento, y devuelve la lectura al buscador del TPV aunque se haya perdido el foco (p. ej. al borrar una línea).
// @match        *://*/*
// @run-at       document-start
// @grant        none
// @downloadURL  https://eurekamoda.com/herramientas/eureka-lector.user.js
// @updateURL    https://eurekamoda.com/herramientas/eureka-lector.user.js
// ==/UserScript==
(function () {
  'use strict';
  // Solo actúa cuando justo antes del apóstrofo hay un prefijo de referencia en MAYÚSCULAS (PEK, EUR…).
  // Escribir a mano (en minúsculas, o un apóstrofo normal) no se ve afectado.
  var PREFIX = /(^|[^A-Za-z])[A-Z]{2,5}$/;
  // Referencias de la tienda: PEK-0897 (y EUR- por si queda alguna antigua).
  var OWN = /(^|[^A-Za-z])(PEK|EUR)$/;
  // Campos que suelen ser el buscador / lector del TPV
  var PISTA = /cod.?barra|barcode|ean|referencia|buscar|search|codigo|code|producto|articulo/i;

  function campo(el) {
    return !!el && !el.disabled && !el.readOnly &&
      (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && /^(text|search|tel|)$/i.test(el.type || '')));
  }
  function visible(el) {
    if (!el || !el.isConnected) return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  }
  function insertar(el, txt) {
    if (!document.execCommand || !document.execCommand('insertText', false, txt)) {
      var s = el.selectionStart, f = el.selectionEnd, v = el.value;
      if (s == null) { s = f = v.length; }
      var set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set;
      set.call(el, v.slice(0, s) + txt + v.slice(f));
      try { el.setSelectionRange(s + txt.length, s + txt.length); } catch (x) {}
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  // ---- Recordar en qué campo se pica (el buscador del TPV) ----
  var ultimoCampo = null;      // último campo donde entró una lectura de la pistola
  var racha = { el: null, n: 0, t: 0 };
  function anotar(el) {
    var ahora = Date.now();
    if (racha.el === el && ahora - racha.t < 80) racha.n++; else { racha.el = el; racha.n = 1; }
    racha.t = ahora;
  }
  function campoDelTpv() {
    if (ultimoCampo && visible(ultimoCampo) && campo(ultimoCampo)) return ultimoCampo;
    // Si el TPV ha redibujado la pantalla, buscar uno parecido
    var todos = document.querySelectorAll('input, textarea');
    for (var i = 0; i < todos.length; i++) {
      var c = todos[i];
      if (!campo(c) || !visible(c)) continue;
      var pistas = [c.name, c.id, c.placeholder, c.className, c.getAttribute('aria-label')].join(' ');
      if (PISTA.test(pistas)) return c;
    }
    return null;
  }

  // ---- Lecturas sin campo enfocado (p. ej. después de borrar una línea, el foco queda en el botón) ----
  var bufferSuelto = '';
  var tSuelto = 0;
  function teclaSintetica(target, key, code, keyCode) {
    ['keydown', 'keypress', 'keyup'].forEach(function (tipo) {
      var ev = new KeyboardEvent(tipo, { key: key, code: code, keyCode: keyCode, which: keyCode, charCode: tipo === 'keypress' ? key.charCodeAt(0) : 0, bubbles: true, cancelable: true });
      try {
        Object.defineProperty(ev, 'keyCode', { get: function () { return keyCode; } });
        Object.defineProperty(ev, 'which', { get: function () { return tipo === 'keypress' ? key.charCodeAt(0) : keyCode; } });
      } catch (x) {}
      ev.__eureka = true;
      target.dispatchEvent(ev);
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.__eureka || e.ctrlKey || e.altKey || e.metaKey) return;
    var el = e.target;
    var imprimible = e.key && e.key.length === 1;

    if (!campo(el)) {
      if (!imprimible || e.key === ' ') return;
      if (el && (el.tagName === 'SELECT' || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      // Devolver la lectura al buscador del TPV
      var destino = campoDelTpv();
      if (destino) {
        e.preventDefault();
        e.stopImmediatePropagation();
        destino.focus();
        try { destino.select(); } catch (x) {}   // lo que hubiera quedado escrito se sustituye
        var c = e.key;
        if (c === "'" ) c = '-';                 // primera tecla no puede ser PEK', pero por si acaso
        insertar(destino, c);
        anotar(destino);
        return;
      }
      // Sin campo que usar: el TPV escucha la página entera → cambiar ' por - en la propia tecla
      var ahora = Date.now();
      if (ahora - tSuelto > 300) bufferSuelto = '';
      tSuelto = ahora;
      if (e.key === "'" && PREFIX.test(bufferSuelto)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        bufferSuelto += '-';
        teclaSintetica(el, '-', 'Minus', 189);
        return;
      }
      bufferSuelto = (bufferSuelto + e.key).slice(-20);
      return;
    }

    // Dentro de un campo:
    //    · PEK' → PEK-   (pistola con teclado inglés, etiquetas antiguas)
    //    · PEK0 → PEK-0  (etiquetas nuevas, sin guion)
    if (imprimible) anotar(el);
    if (e.key === 'Enter' && racha.el === el && racha.n >= 4 && Date.now() - racha.t < 300) ultimoCampo = el;
    var antes = (el.value || '').slice(0, el.selectionStart == null ? el.value.length : el.selectionStart);
    if (e.key === "'" && PREFIX.test(antes)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      insertar(el, '-');
    } else if (/^[0-9]$/.test(e.key) && OWN.test(antes)) {
      insertar(el, '-');            // el número entra después, normal
    }
  }, true);

  // Red de seguridad (pegar, autocompletar…): si aun así entra PEK'0897, se corrige.
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
