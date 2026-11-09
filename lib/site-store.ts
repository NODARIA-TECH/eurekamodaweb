// Guardado del contenido editable de la portada en data/site.json (no versionado: lo edita la clienta).
// · Borrador y versión publicada por separado: la web solo cambia al pulsar "Publicar".
// · Escritura atómica (archivo temporal + rename): un corte a mitad de guardado nunca deja el archivo roto.
// · Copia de seguridad (.bak) y un historial de las últimas publicaciones para poder volver atrás.
// · Número de revisión (rev) para detectar si se está editando a la vez en dos pestañas.
// · Cola interna: las escrituras nunca se pisan entre sí.
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { unstable_noStore as noStore } from 'next/cache';
import { DEFAULT_CONTENT, normalizeContent, sameContent, type SiteContent } from './site-content';

const FILE = path.join(process.cwd(), 'data', 'site.json');
const BAK = FILE + '.bak';
const MAX_HISTORY = 20;

interface HistoryEntry { id: string; at: string; content: SiteContent }
interface SiteFile {
  rev: number;
  published: SiteContent; publishedAt: string | null;
  draft: SiteContent | null; draftAt: string | null;
  history: HistoryEntry[];
}

export interface EditorState {
  rev: number;
  content: SiteContent;          // lo que se edita (borrador o, si no hay, lo publicado)
  dirty: boolean;                // hay cambios sin publicar
  publishedAt: string | null;
  draftAt: string | null;
  history: { id: string; at: string }[];
}

function fresh(): SiteFile {
  return { rev: 0, published: DEFAULT_CONTENT, publishedAt: null, draft: null, draftAt: null, history: [] };
}

function parse(raw: string): SiteFile {
  const j = JSON.parse(raw);
  return {
    rev: Number.isInteger(j.rev) ? j.rev : 0,
    published: normalizeContent(j.published),
    publishedAt: typeof j.publishedAt === 'string' ? j.publishedAt : null,
    draft: j.draft ? normalizeContent(j.draft) : null,
    draftAt: typeof j.draftAt === 'string' ? j.draftAt : null,
    history: Array.isArray(j.history)
      ? j.history.filter((h: any) => h && typeof h.id === 'string').slice(0, MAX_HISTORY)
          .map((h: any) => ({ id: h.id, at: String(h.at || ''), content: normalizeContent(h.content) }))
      : [],
  };
}

async function load(): Promise<SiteFile> {
  for (const f of [FILE, BAK]) {
    try { return parse(await fs.readFile(f, 'utf8')); } catch (e: any) {
      if (e?.code !== 'ENOENT') console.error(`[site] No se pudo leer ${path.basename(f)}:`, e?.message);
    }
  }
  return fresh();
}

async function save(data: SiteFile): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.${randomUUID().slice(0, 8)}.tmp`;
  const fh = await fs.open(tmp, 'w');
  try {
    await fh.writeFile(JSON.stringify(data, null, 1) + '\n', 'utf8');
    await fh.sync();
  } finally { await fh.close(); }
  await fs.rename(tmp, FILE);
}

// Cola: una operación de escritura detrás de otra.
let queue: Promise<unknown> = Promise.resolve();
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

function toState(f: SiteFile): EditorState {
  const content = f.draft ?? f.published;
  return {
    rev: f.rev, content, dirty: !!f.draft && !sameContent(f.draft, f.published),
    publishedAt: f.publishedAt, draftAt: f.draftAt,
    history: f.history.map(({ id, at }) => ({ id, at })),
  };
}

// ---------- Lectura ----------
export async function getPublishedContent(): Promise<SiteContent> {
  noStore();
  return (await load()).published;
}
export async function getEditorState(): Promise<EditorState> {
  noStore();
  return toState(await load());
}

// ---------- Escritura ----------
export type SaveResult = { ok: true; state: EditorState } | { ok: false; conflict: true; state: EditorState };

export function saveDraft(content: unknown, baseRev: number): Promise<SaveResult> {
  return exclusive(async () => {
    const f = await load();
    const next = normalizeContent(content);
    // Si lo guardado ya es idéntico (p. ej. lo guardó otra pestaña), no hay conflicto real.
    if (sameContent(f.draft ?? f.published, next)) return { ok: true as const, state: toState(f) };
    if (baseRev !== f.rev) return { ok: false as const, conflict: true as const, state: toState(f) };
    f.draft = sameContent(next, f.published) ? null : next;
    f.draftAt = new Date().toISOString();
    f.rev++;
    await save(f);
    return { ok: true as const, state: toState(f) };
  });
}

export function publishDraft(baseRev: number): Promise<SaveResult> {
  return exclusive(async () => {
    const f = await load();
    if (baseRev !== f.rev) return { ok: false as const, conflict: true as const, state: toState(f) };
    if (f.draft && !sameContent(f.draft, f.published)) {
      // Antes de publicar, la versión que estaba en la web pasa al historial y a la copia .bak.
      try { await fs.copyFile(FILE, BAK); } catch { /* primera vez: aún no existe */ }
      f.history.unshift({ id: randomUUID().slice(0, 12), at: f.publishedAt || new Date().toISOString(), content: f.published });
      f.history = f.history.slice(0, MAX_HISTORY);
      f.published = f.draft;
      f.publishedAt = new Date().toISOString();
    }
    f.draft = null; f.draftAt = null;
    f.rev++;
    await save(f);
    return { ok: true as const, state: toState(f) };
  });
}

export function discardDraft(baseRev: number): Promise<SaveResult> {
  return exclusive(async () => {
    const f = await load();
    if (baseRev !== f.rev) return { ok: false as const, conflict: true as const, state: toState(f) };
    f.draft = null; f.draftAt = null; f.rev++;
    await save(f);
    return { ok: true as const, state: toState(f) };
  });
}

// Carga una versión anterior (o los valores originales) como BORRADOR: no se publica sola.
export function restoreVersion(id: string, baseRev: number): Promise<SaveResult | { ok: false; notFound: true }> {
  return exclusive(async () => {
    const f = await load();
    if (baseRev !== f.rev) return { ok: false as const, conflict: true as const, state: toState(f) };
    const src = id === 'original' ? DEFAULT_CONTENT : f.history.find((h) => h.id === id)?.content;
    if (!src) return { ok: false as const, notFound: true as const };
    f.draft = sameContent(src, f.published) ? null : normalizeContent(src);
    f.draftAt = new Date().toISOString();
    f.rev++;
    await save(f);
    return { ok: true as const, state: toState(f) };
  });
}
