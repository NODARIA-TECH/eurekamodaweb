// Convierte HEIC/HEIF → JPEG en un hilo aparte. El decodificador (WebAssembly) reserva ~400 MB
// y no los devuelve; al cerrar el hilo se libera toda esa memoria (el VPS es pequeño).
const { parentPort } = require('worker_threads');
const convert = require('heic-convert');
parentPort.on('message', async ({ id, buffer }) => {
  try {
    const out = await convert({ buffer: Buffer.from(buffer), format: 'JPEG', quality: 0.95 });
    const ab = out instanceof ArrayBuffer ? out : Buffer.from(out).buffer;
    parentPort.postMessage({ id, ok: true, data: ab }, [ab]);
  } catch (e) {
    parentPort.postMessage({ id, ok: false, error: (e && e.message) || String(e) });
  }
});
