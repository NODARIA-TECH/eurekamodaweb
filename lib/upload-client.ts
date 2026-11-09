// Navegador: sube un archivo a /admin/api/fotos en trozos de 768 KB (por debajo del límite de 1 MB
// que Nginx trae por defecto), reintentando cada trozo si falla la conexión.
export type UploadDone = { src?: string; staged?: string; width?: number; height?: number; name: string };

const CHUNK = 768 * 1024;

export class UploadError extends Error {}

function newId() {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 20);
}

function sendChunk(url: string, body: Blob, onProgress: (loaded: number) => void): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.timeout = 180000;
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded);
    xhr.onload = () => {
      let j: any = null;
      try { j = JSON.parse(xhr.responseText); } catch { /* respuesta no JSON (Nginx, Cloudflare…) */ }
      if (xhr.status === 401 || xhr.responseURL.includes('/admin/login')) return reject(new UploadError('La sesión ha caducado: vuelve a entrar en el panel (no se ha perdido nada de lo que ya estaba guardado).'));
      if (xhr.status >= 200 && xhr.status < 300 && j) return resolve(j);
      if (j?.error) return reject(new UploadError(j.error));
      if (xhr.status === 413) return reject(new UploadError('El servidor rechaza el archivo por tamaño (413). Hay que subir client_max_body_size en Nginx.'));
      if (xhr.status === 502 || xhr.status === 504) return reject(Object.assign(new Error('El servidor tardó demasiado en responder (' + xhr.status + ').'), { retry: true }));
      reject(Object.assign(new Error('Error del servidor (' + xhr.status + ').'), { retry: xhr.status >= 500 }));
    };
    xhr.onerror = () => reject(Object.assign(new Error('Sin conexión con el servidor.'), { retry: true }));
    xhr.ontimeout = () => reject(Object.assign(new Error('La subida tardó demasiado.'), { retry: true }));
    xhr.send(body);
  });
}

export async function uploadFile(
  file: File,
  opts: { uso?: 'foto' | 'lote'; onProgress?: (fraction: number, phase: 'subiendo' | 'procesando') => void } = {},
): Promise<UploadDone> {
  if (!file.size) throw new UploadError('El archivo está vacío.');
  const id = newId();
  const n = Math.max(1, Math.ceil(file.size / CHUNK));
  const name = file.name || 'foto';
  let last: any = null;
  for (let i = 0; i < n; i++) {
    const part = file.slice(i * CHUNK, Math.min(file.size, (i + 1) * CHUNK));
    const url = `/admin/api/fotos?id=${id}&i=${i}&n=${n}&uso=${opts.uso || 'foto'}&name=${encodeURIComponent(name)}`;
    for (let intento = 1; ; intento++) {
      try {
        last = await sendChunk(url, part, (loaded) => {
          const f = (i * CHUNK + loaded) / file.size;
          opts.onProgress?.(Math.min(1, f), i === n - 1 && loaded >= part.size ? 'procesando' : 'subiendo');
        });
        break;
      } catch (e: any) {
        if (e instanceof UploadError || !e.retry || intento >= 4) throw e instanceof UploadError ? e : new UploadError(e.message + ' Prueba de nuevo.');
        await new Promise((r) => setTimeout(r, 800 * intento));
      }
    }
  }
  return { ...last, name };
}

export const isImageFile = (f: File) =>
  f.type.startsWith('image/') || !f.type || /\.(heic|heif|jpe?g|jfif|png|webp|avif|gif|tiff?|bmp)$/i.test(f.name);
