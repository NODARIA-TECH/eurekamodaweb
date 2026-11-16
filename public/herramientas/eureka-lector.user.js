// ==UserScript==
// @name         EUREKA · Lector de códigos (FacturaScripts / TPVneo)
// @namespace    https://eurekamoda.com/
// @version      1.6
// @description  La pistola escribe PEK'0897 (teclado en inglés): esto lo corrige a PEK-0897 al momento, y lleva SIEMPRE la lectura al buscador del TPV: aunque se haya perdido el foco o el cursor se haya quedado en otra casilla (cantidad, precio…) al borrar una línea.
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
    // Ojo: el buscador del TPV puede ser de solo lectura (escribe su propio JS): también cuenta.
    return !!el && !el.disabled &&
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
  var huella = null;           // id/name del buscador, por si el TPV lo vuelve a crear
  function pareceBuscador(el) {
    var s = (el.id || '') + ' ' + (el.name || '') + ' ' + (el.placeholder || '') + ' ' + (typeof el.className === 'string' ? el.className : '');
    return PISTA.test(s) && !/client|nombre|email|correo|telef|direcc|nota|observ|cantidad|precio|dto|descuento/i.test(s);
  }
  function recordar(el) {
    if (huella && !pareceBuscador(el) && ultimoCampo && ultimoCampo.isConnected) return;   // no cambiar el buscador por una casilla cualquiera
    if (ultimoCampo !== el) log('buscador del TPV detectado: ' + desc(el));
    ultimoCampo = el; huella = { id: el.id, name: el.name, ph: el.placeholder };
  }
  function campoDelTpv() {
    var bcTpv = document.forms['barcodeForm'] && document.forms['barcodeForm'].elements && document.forms['barcodeForm'].elements['barcode'];
    if (bcTpv && bcTpv.tagName && visible(bcTpv)) return bcTpv;   // TPVneo: siempre su casilla de código de barras
    if (ultimoCampo && visible(ultimoCampo) && campo(ultimoCampo)) return ultimoCampo;
    var todos = document.querySelectorAll('input, textarea');
    if (!huella) {   // aún no se ha picado nada: el campo que tenga pinta de código de barras
      for (var k = 0; k < todos.length; k++) if (campo(todos[k]) && visible(todos[k]) && pareceBuscador(todos[k])) return todos[k];
      return null;
    }
    for (var i = 0; i < todos.length; i++) {
      var c = todos[i];
      if (!campo(c) || !visible(c)) continue;
      if ((huella.id && c.id === huella.id) || (huella.name && c.name === huella.name) || (huella.ph && c.placeholder === huella.ph)) { ultimoCampo = c; return c; }
    }
    return null;
  }

  // ---- Modo diagnóstico (Ctrl + Alt + D): panel con lo que pasa al picar ----
  var diag = false, panel = null, lineas = [];
  try { diag = localStorage.getItem('eurekaLectorDiag') === '1'; } catch (x) {}
  function desc(el) {
    if (!el || !el.tagName) return String(el);
    var d = el.tagName + (el.id ? '#' + el.id : '') + (el.name ? '[name=' + el.name + ']' : '');
    if (el.placeholder) d += ' «' + el.placeholder + '»';
    else if (!el.id && el.className && typeof el.className === 'string') d += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.');
    if (el.tagName === 'INPUT' && !visible(el)) d += ' (oculto)';
    return d;
  }
  function log(msg) {
    if (!diag) return;
    var h = new Date(); lineas.push(('0' + h.getMinutes()).slice(-2) + ':' + ('0' + h.getSeconds()).slice(-2) + '  ' + msg);
    lineas = lineas.slice(-14); pintar();
  }
  function pintar() {
    if (!diag) { if (panel) panel.remove(); panel = null; return; }
    if (!document.body) return;
    if (!panel) {
      panel = document.createElement('div');
      panel.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:2147483647;width:min(560px,96vw);max-height:46vh;overflow:auto;background:rgba(20,16,12,.92);color:#fff;font:12px/1.45 monospace;padding:10px 12px;border-radius:10px;pointer-events:none;white-space:pre-wrap;box-shadow:0 6px 24px rgba(0,0,0,.35)';
    }
    if (!panel.isConnected) document.body.appendChild(panel);
    panel.textContent = 'EUREKA lector 1.6 · diagnóstico (Ctrl+Alt+D para cerrar)\nfoco ahora: ' + desc(document.activeElement) + '\nbuscador: ' + (ultimoCampo ? desc(ultimoCampo) + (ultimoCampo.isConnected ? '' : ' (ya no existe)') : '—') + '\n────────\n' + lineas.join('\n');
  }
  document.addEventListener('focusin', function (e) { log('foco → ' + desc(e.target)); }, true);
  document.addEventListener('mousedown', function (e) { log('clic en ' + desc(e.target)); }, true);
  window.addEventListener('error', function (e) { log('ERROR JS: ' + (e.message || e.error)); }, true);
  window.addEventListener('unhandledrejection', function (e) { log('ERROR JS (promesa): ' + (e.reason && e.reason.message || e.reason)); });

  // Lectura en curso (para el diagnóstico y para reconocer la pistola)
  var lect = { txt: '', el: null, t: 0, fuera: false };
  function teclaVista(e) {
    var ahora = Date.now();
    if (ahora - lect.t > 120) lect = { txt: '', el: e.target, t: ahora, fuera: !campo(e.target) };
    lect.t = ahora;
    if (e.key === 'Enter') {
      if (lect.txt.length >= 3) {
        var v = campo(e.target) ? ' → en el campo queda «' + e.target.value + '»' : '';
        log('lectura «' + lect.txt + '» ⏎ en ' + desc(e.target) + (lect.fuera ? ' (empezó sin campo)' : '') + v);
      }
      lect.txt = '';
    } else if (e.key && e.key.length === 1) lect.txt += e.key;
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

  // ---- Ráfaga de la pistola que cae en una casilla equivocada (cantidad, precio, otra línea…) ----
  // La pistola teclea muy rápido (pocos ms entre teclas); una persona, no. A la 4.ª tecla rápida
  // seguida, si no está en el buscador del TPV: se deja esa casilla como estaba y la lectura entera
  // pasa al buscador. Lo que queda de la ráfaga (y su Enter) ya entra ahí directamente.
  var RAFAGA_MS = 45, RAFAGA_N = 4;
  var rf = { el: null, t: 0, txt: '', n: 0, antes: null, movida: false };
  function poner0(el, v) {
    var set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set;
    set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function inicioLectura(t) {
    return t.replace(/^([A-Z]{2,5})['´`’]/, '$1-').replace(/^(PEK|EUR)(\d)/i, function (_, a, b) { return a.toUpperCase() + '-' + b; });
  }
  function rafagaFueraDeSitio(e) {
    var ahora = Date.now(), el = e.target;
    if (ahora - rf.t > RAFAGA_MS || rf.el !== el && !rf.movida) {
      var conValor = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
      rf = { el: el, t: ahora, txt: '', n: 0, antes: conValor ? el.value : null, movida: false };
    }
    rf.t = ahora; rf.n++; rf.txt += e.key;
    if (rf.movida || rf.n < RAFAGA_N) return false;
    var dest = campoDelTpv();
    if (!dest || dest === el) return false;
    // La casilla equivocada vuelve a lo que tenía antes de la ráfaga
    if (rf.antes != null && rf.el && rf.el.isConnected && rf.el.value !== rf.antes) { try { poner0(rf.el, rf.antes); } catch (x) {} }
    e.preventDefault();
    e.stopImmediatePropagation();
    log('lectura rápida en ' + desc(el) + ' (no es el buscador) → la paso entera al buscador');
    dest.focus();
    try { dest.select(); } catch (x) {}
    insertar(dest, inicioLectura(rf.txt));
    rf.movida = true;
    anotar(dest); anotar(dest); anotar(dest); anotar(dest);
    return true;
  }

  // ---- TPVneo (FacturaScripts): la lectura va a SU formulario del código de barras ----
  // TPVneo busca con <form name="barcodeForm" onsubmit="return addBarcode()"> y su casilla «barcode».
  // Al borrar una línea redibuja el carrito (y si queda vacío cambia de pestaña): el cursor se pierde
  // y la casilla puede quedar oculta. Si una ráfaga de la pistola no está entrando en esa casilla, se
  // recoge entera aquí y, con su Enter, se escribe en la casilla y se envía su formulario: TPVneo hace
  // exactamente lo mismo que al picar con el cursor bien puesto, esté visible o no.
  function tpvneoCampo() {
    var f = document.forms['barcodeForm'];
    var c = f && f.elements && f.elements['barcode'];
    return c && c.tagName ? c : null;
  }
  var tn = { activa: false, txt: '', t: 0, n: 0, el: null, antes: null };
  function enviarTpvneo(bc, codigo) {
    poner0(bc, codigo);
    var f = bc.form;
    if (f.requestSubmit) f.requestSubmit();
    else { var ev = new Event('submit', { bubbles: true, cancelable: true }); if (f.dispatchEvent(ev) && typeof f.onsubmit === 'function') f.onsubmit(ev); }
    if (visible(bc)) { try { bc.focus(); } catch (x) {} }
  }
  function tpvneoTecla(e) {
    var bc = tpvneoCampo();
    if (!bc) return false;
    var el = e.target, ahora = Date.now();
    if (el === bc && document.activeElement === bc && visible(bc)) { tn.activa = false; return false; }   // camino normal
    if (e.key === 'Enter') {
      if (!tn.activa || ahora - tn.t > 300) return false;
      e.preventDefault();
      e.stopImmediatePropagation();
      var codigo = normaliza(tn.txt);
      log('TPVneo: lectura «' + tn.txt + '» → envío «' + codigo + '» al buscador de códigos (el cursor estaba en ' + desc(el) + (visible(bc) ? '' : '; la casilla estaba oculta') + ')');
      tn = { activa: false, txt: '', t: 0, n: 0, el: null, antes: null };
      enviarTpvneo(bc, codigo);
      return true;
    }
    if (!(e.key && e.key.length === 1) || e.key === ' ') return false;
    if (ahora - tn.t > RAFAGA_MS) {
      var conValor = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
      tn = { activa: false, txt: '', t: ahora, n: 0, el: el, antes: conValor ? el.value : null };
    }
    tn.t = ahora; tn.n++; tn.txt += e.key;
    if (!tn.activa && tn.n >= RAFAGA_N) {
      tn.activa = true;
      if (tn.antes != null && tn.el && tn.el !== bc && tn.el.isConnected && tn.el.value !== tn.antes) { try { poner0(tn.el, tn.antes); } catch (x) {} }
      if (tn.el === bc) { try { poner0(bc, ''); } catch (x) {} }
    }
    if (tn.activa) { e.preventDefault(); e.stopImmediatePropagation(); return true; }
    return false;
  }

  // Diagnóstico: qué pide el TPV al servidor y qué contesta (solo con el diagnóstico activo)
  try {
    var fetchOriginal = window.fetch;
    if (fetchOriginal) window.fetch = function (url, opts) {
      var accion = null;
      try { if (diag && opts && opts.body instanceof FormData && opts.body.get('action')) accion = opts.body.get('action') + (opts.body.get('action-code') ? ' «' + opts.body.get('action-code') + '»' : ''); } catch (x) {}
      if (accion) log('TPV → servidor: ' + accion);
      var pr = fetchOriginal.apply(this, arguments);
      if (accion) pr.then(function (r) { return r.clone().json().then(function (d) { var m = (d && d.messages || []).map(function (x) { return x.level + ': ' + String(x.message).replace(/<[^>]*>/g, ''); }); log('servidor → TPV (' + accion + '): ' + r.status + (m.length ? ' · ' + m.join(' | ') : ' · ok')); }); }).catch(function (x) { log('servidor → TPV (' + accion + '): FALLO ' + (x && x.message || x)); });
      return pr;
    };
    var alertOriginal = window.alert;
    window.alert = function (m) { log('aviso del TPV: ' + m); return alertOriginal.apply(this, arguments); };
  } catch (x) {}

  // En window y en captura: así va antes que cualquier código del TPV.
  window.addEventListener('keydown', function (e) {
    if (e.__eureka) return;
    if (e.ctrlKey && e.altKey && e.code === 'KeyD') {
      diag = !diag; try { localStorage.setItem('eurekaLectorDiag', diag ? '1' : '0'); } catch (x) {}
      e.preventDefault(); lineas = []; log('diagnóstico activado'); pintar(); return;
    }
    teclaVista(e);
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    var el = e.target;
    var imprimible = e.key && e.key.length === 1;
    if (tpvneoTecla(e)) return;
    if (imprimible && e.key !== ' ' && rafagaFueraDeSitio(e)) return;

    if (!campo(el)) {
      if (!imprimible || e.key === ' ') return;
      if (el && (el.tagName === 'SELECT' || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      // Devolver la lectura al buscador del TPV
      var destino = campoDelTpv();
      if (destino) {
        e.preventDefault();
        e.stopImmediatePropagation();
        log('tecla sin campo (foco en ' + desc(el) + ') → la devuelvo al buscador');
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
        log('sin buscador conocido: cambio \' por - para el TPV (foco en ' + desc(el) + ')');
        teclaSintetica(el, '-', 'Minus', 189);
        return;
      }
      bufferSuelto = (bufferSuelto + e.key).slice(-20);
      return;
    }

    // Dentro de un campo:
    //    · PEK' → PEK-   (pistola con teclado inglés, etiquetas antiguas)
    //    · PEK0 → PEK-0  (etiquetas nuevas, sin guion)
    if (imprimible) { anotar(el); if (racha.n >= 4) recordar(el); }   // ráfaga de la pistola
    // Al pulsar Enter (la pistola lo manda al final), la referencia se deja bien SIEMPRE,
    // entre lo que haya hecho el TPV: PEK'0897 / PEK0897 / pek0897 → PEK-0897. Va antes que el TPV.
    if (e.key === 'Enter' || e.key === 'Tab') {
      var bien = normaliza(el.value || '');
      if (bien !== el.value) {
        log('al pulsar ' + e.key + ': «' + el.value + '» → «' + bien + '»');
        poner(el, bien);
      }
      return;
    }
    var antes = (el.value || '').slice(0, el.selectionStart == null ? el.value.length : el.selectionStart);
    if (e.key === "'" && PREFIX.test(antes)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      insertar(el, '-');
    } else if (/^[0-9]$/.test(e.key) && OWN.test(antes)) {
      insertar(el, '-');            // el número entra después, normal
    }
  }, true);

  function normaliza(v) {
    return v.replace(/\b([A-Z]{2,5})'(\d{2,})/g, '$1-$2').replace(/\b(PEK|EUR)\s?[-'´`’]?\s?(\d{3,})\b/gi, function (_, p, n) { return p.toUpperCase() + '-' + n; });
  }
  function poner(el, v) {
    var set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set;
    set.call(el, v);
    try { el.setSelectionRange(v.length, v.length); } catch (x) {}
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

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
  if (diag) document.addEventListener('DOMContentLoaded', function () { log('diagnóstico activo'); });
})();
