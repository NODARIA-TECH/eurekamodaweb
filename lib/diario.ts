// Diario de EUREKA: una entrada al día para Google (contenido fresco con productos reales).
// Cada día se prepara un BORRADOR automático; la tienda lo revisa y lo publica con un clic en
// el panel (Panel → Diario). Nada se publica solo. Se guarda en data/diario.json.
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import type { Product, Category } from './types';
import { RECOGIDA } from './envio';

export type DiarioEstado = 'borrador' | 'publicada' | 'descartada';
export type DiarioEntrada = {
  id: string;
  slug: string;
  date: string;          // día (Europa/Madrid) para el que se preparó: AAAA-MM-DD
  tema: string;
  title: string;
  intro: string;
  body: string;          // párrafos separados por una línea en blanco; **negrita** permitida
  productIds: string[];
  image?: string;
  status: DiarioEstado;
  createdAt: string;
  publishedAt?: string;
  updatedAt?: string;
};
type Archivo = { entries: DiarioEntrada[] };

const FILE = path.join(process.cwd(), 'data', 'diario.json');
let cola: Promise<unknown> = Promise.resolve();
function enCola<T>(fn: () => Promise<T>): Promise<T> {   // una escritura detrás de otra
  const r = cola.then(fn, fn);
  cola = r.catch(() => undefined);
  return r;
}
async function leer(): Promise<Archivo> {
  try { const d = JSON.parse(await fs.readFile(FILE, 'utf8')); return { entries: Array.isArray(d.entries) ? d.entries : [] }; }
  catch { return { entries: [] }; }
}
async function guardar(a: Archivo): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.${randomUUID().slice(0, 8)}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(a, null, 2) + '\n', 'utf8');
  await fs.rename(tmp, FILE);
}

export const hoy = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());

/* ------------------------------ lecturas ------------------------------ */
export async function listarDiario(): Promise<DiarioEntrada[]> {
  return (await leer()).entries.sort((a, b) => (b.publishedAt || b.createdAt).localeCompare(a.publishedAt || a.createdAt));
}
export async function publicadas(): Promise<DiarioEntrada[]> {
  return (await listarDiario()).filter((e) => e.status === 'publicada');
}
export async function entradaPorSlug(slug: string): Promise<DiarioEntrada | undefined> {
  return (await leer()).entries.find((e) => e.slug === slug && e.status === 'publicada');
}
export async function borradorDeHoy(): Promise<DiarioEntrada | undefined> {
  return (await leer()).entries.find((e) => e.date === hoy() && e.status === 'borrador');
}

/* ------------------------------ generador ------------------------------ */
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const eur = (c: number) => (c / 100).toFixed(2).replace('.', ',') + ' €';
const stockDe = (p: Product) => (p.variants?.length ? p.variants.reduce((s, v) => s + (v.stock || 0), 0) : p.stock || 0);
function slugify(s: string) { return norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70).replace(/-+$/, ''); }

// Grupos de prendas por categoría (slug) o nombre
const GRUPOS: Record<string, RegExp> = {
  conjunto: /conjunto/,
  arriba: /punto|jersey|sudadera|camiset|top|blusa|camisa|cardigan|chaleco|polo/,
  abajo: /pantal|jean|vaquer|falda|legging|short/,
  vestido: /vestido|mono/,
  abrigo: /abrigo|blazer|chaqueta|trench|cazadora|plumifero/,
  accesorio: /accesor|bolso|panolet|bufand|panuel|cinturon|deportiva|zapatilla|bota/,
  pijama: /pijama/,
  hogar: /ambientador/,
};
function grupo(p: Product): string {
  const t = norm(`${p.category} ${p.name}`);
  for (const [g, re] of Object.entries(GRUPOS)) if (re.test(t)) return g;
  return 'otro';
}

// Pequeño generador pseudoaleatorio con semilla (mismo día y semilla = mismo borrador)
function rng(seed: number) {
  let s = (seed >>> 0) || 1;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const elegir = <T,>(r: () => number, l: T[]): T => l[Math.floor(r() * l.length)];
function barajar<T>(r: () => number, l: T[]): T[] { const a = [...l]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

const LUGAR = ['en nuestra tienda de Écija', 'en EUREKA, tu tienda de moda en Écija', 'en la tienda, en la calle La Victoria de Écija', 'aquí en Écija y en la web'];
const CIERRE = [
  `Todo lo puedes pedir en eurekamoda.com con envío en 24–48 h, o comprarlo online y recogerlo gratis en la tienda: ${RECOGIDA.direccion}.`,
  `¿Prefieres probártelo? Pásate por la tienda en ${RECOGIDA.direccion}; si lo compras online, la recogida en tienda es gratis.`,
  'Si tienes dudas con la talla o quieres que te aconsejemos un look, escríbenos o ven a vernos: te atendemos encantadas.',
  'Quedan pocas unidades de algunas prendas: si te gusta algo, no lo dejes pasar. Envío en 24–48 h o recogida gratis en tienda.',
];
const CONSEJO: Record<string, string[]> = {
  arriba: ['Queda genial con vaqueros rectos y botines para el día a día.', 'Combínalo con un pantalón de pinza para un look más arreglado.', 'Ideal con falda midi y botas altas.', 'Perfecto con leggings y zapatillas para ir cómoda.'],
  abajo: ['Combina con jerséis oversize y con camisetas básicas.', 'Con una blusa y tacón tienes look de tarde en un momento.', 'Ponle una sudadera y zapatillas para un estilo más informal.', 'Estiliza muchísimo con un top ajustado metido por dentro.'],
  conjunto: ['Viene completo: solo te falta elegir el calzado.', 'Las dos piezas también se pueden llevar por separado.', 'Cómodo como un chándal y arreglado como un traje.'],
  vestido: ['Con botas altas y una chaqueta lo llevas también en invierno.', 'Añádele un cinturón para marcar cintura.', 'Con zapatillas blancas queda más desenfadado.', 'Perfecto para comidas, celebraciones y salir por Écija.'],
  abrigo: ['La prenda que salva cualquier look de entretiempo.', 'Queda bien tanto con vaqueros como con vestido.', 'Un básico que se amortiza en una sola temporada.'],
  accesorio: ['El detalle que cambia por completo un look sencillo.', 'Un regalo que siempre acierta.', 'Pequeño, pero da muchísimo juego.'],
  pijama: ['Calentito y suave para las noches de frío.', 'Un regalo perfecto para Navidad o para darte un capricho.', 'Para estar en casa cómoda y guapa.'],
  hogar: ['El aroma de la tienda, ahora también en tu casa.', 'Un detalle perfecto para regalar.'],
  otro: ['Una prenda con mucho estilo para tu armario.', 'Combina con todo lo que ya tienes.'],
};

type Tema = { id: string; titulo: (ps: Product[], r: () => number, extra: string) => string; intro: (r: () => number, extra: string) => string; elegir: (cand: Product[], r: () => number, cats: Category[], ctx: Ctx) => { ps: Product[]; extra: string } | null };
type Ctx = { catsRecientes: Set<string> };

let mesActual = 1;   // mes del borrador que se está preparando
function temporada(mes: number) {
  if (mes === 12) return { nombre: 'Navidad', titulo: 'Ideas para regalar estas Navidades', intro: 'Se acercan las fiestas y aquí tienes ideas de regalo que siempre aciertan', grupos: ['pijama', 'accesorio', 'arriba', 'hogar'] };
  if (mes <= 2 || mes === 11) return { nombre: 'frío', titulo: 'Prendas calentitas para el frío', intro: 'Ha llegado el frío a Écija y estas son nuestras prendas más calentitas', grupos: ['arriba', 'abrigo', 'pijama'] };
  if (mes <= 5) return { nombre: 'primavera', titulo: 'Looks de primavera', intro: 'Llega el buen tiempo y apetece renovar el armario con prendas ligeras', grupos: ['vestido', 'arriba', 'abajo'] };
  if (mes <= 9) return { nombre: 'verano', titulo: 'Prendas frescas para el calor', intro: 'Con el calor de Écija hay que ir cómoda y fresca', grupos: ['vestido', 'arriba', 'accesorio'] };
  return { nombre: 'otoño', titulo: 'Básicos de otoño', intro: 'Empieza el otoño y estas prendas son las que más vas a usar', grupos: ['arriba', 'abrigo', 'abajo'] };
}

const TEMAS: Tema[] = [
  {
    id: 'look',
    titulo: (ps) => `Look del día: ${ps[0].name.toLowerCase()} con ${ps[1].name.toLowerCase()}`,
    intro: (r) => `Hoy te proponemos un look completo que puedes encontrar ${elegir(r, LUGAR)}. Fácil de llevar, cómodo y con mucho estilo.`,
    elegir: (cand, r) => {
      if (r() < 0.35) {   // a veces, look con vestido o conjunto
        const v = barajar(r, cand.filter((p) => ['vestido', 'conjunto'].includes(grupo(p))));
        const c = barajar(r, cand.filter((p) => ['accesorio', 'abrigo'].includes(grupo(p))));
        if (v.length && c.length) return { ps: [v[0], c[0], ...(c[1] ? [c[1]] : [])], extra: '' };
      }
      const a = barajar(r, cand.filter((p) => grupo(p) === 'arriba'));
      const b = barajar(r, cand.filter((p) => grupo(p) === 'abajo'));
      const c = barajar(r, cand.filter((p) => ['accesorio', 'abrigo'].includes(grupo(p))));
      if (a.length && b.length) return { ps: [a[0], b[0], ...(c.length ? [c[0]] : [])], extra: '' };
      const v = barajar(r, cand.filter((p) => ['vestido', 'conjunto'].includes(grupo(p))));
      if (v.length && c.length) return { ps: [v[0], c[0]], extra: '' };
      return null;
    },
  },
  {
    id: 'novedades',
    titulo: (_ps, r) => elegir(r, ['Novedades de la semana en EUREKA', 'Lo último que ha llegado a la tienda', 'Recién llegado a EUREKA: novedades de moda mujer']),
    intro: (r) => `Esta semana han llegado prendas nuevas ${elegir(r, LUGAR)} y no queríamos que te las perdieras.`,
    elegir: (cand) => {
      const limite = new Date(Date.now() - 21 * 864e5).toISOString();
      const ps = cand.filter((p) => (p.createdAt || '') >= limite).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 4);
      return ps.length >= 2 ? { ps, extra: '' } : null;
    },
  },
  {
    id: 'categoria',
    titulo: (_ps, r, extra) => elegir(r, [`${extra}: nuestras favoritas de esta semana`, `${extra} de mujer que te van a enamorar`, `Selección de ${extra.toLowerCase()} en EUREKA`]),
    intro: (r, extra) => `Hoy nos centramos en ${extra.toLowerCase()}: te enseñamos las que más nos gustan ${elegir(r, LUGAR)}.`,
    elegir: (cand, r, cats, ctx) => {
      const por: Record<string, Product[]> = {};
      for (const p of cand) if (grupo(p) !== 'hogar' && !ctx.catsRecientes.has(p.category)) (por[p.category] ||= []).push(p);
      const ok = barajar(r, Object.entries(por).filter(([, l]) => l.length >= 3));
      if (!ok.length) return null;
      const [slug, l] = ok[0];
      return { ps: barajar(r, l).slice(0, 4), extra: cats.find((c) => c.slug === slug)?.name || slug };
    },
  },
  {
    id: 'temporada',
    titulo: (_ps, _r, extra) => extra,
    intro: (r) => {
      const t = temporada(mesActual);
      return `${t.intro}. Todas las tienes ${elegir(r, LUGAR)}.`;
    },
    elegir: (cand, r) => {
      const t = temporada(mesActual);
      const ps: Product[] = [];
      for (const g of t.grupos) { const l = barajar(r, cand.filter((p) => grupo(p) === g && !ps.includes(p))); if (l[0]) ps.push(l[0]); if (l[1] && ps.length < 4 && g === t.grupos[0]) ps.push(l[1]); }
      // Si faltan prendas de temporada, se completa con complementos (bolsos, pañoletas…) que siempre encajan
      for (const p of barajar(r, cand.filter((p) => grupo(p) === 'accesorio' && !ps.includes(p)))) if (ps.length < 3) ps.push(p);
      return ps.length >= 3 ? { ps: ps.slice(0, 4), extra: t.titulo } : null;
    },
  },
  {
    id: 'basicos',
    titulo: (_ps, r) => elegir(r, ['Básicos de fondo de armario que nunca fallan', 'Los básicos que más usamos en EUREKA', 'Prendas básicas para combinar con todo']),
    intro: (r) => `Hay prendas que se ponen una y otra vez. Estos son nuestros básicos favoritos, todos ${elegir(r, LUGAR)}.`,
    elegir: (cand, r) => {
      const ps = barajar(r, cand.filter((p) => /basic/.test(norm(p.name)) || (p.price <= 2000 && ['arriba', 'abajo'].includes(grupo(p))))).slice(0, 4);
      return ps.length >= 3 ? { ps, extra: '' } : null;
    },
  },
  {
    id: 'caprichos',
    titulo: (_ps, r) => elegir(r, ['Caprichos por menos de 20 €', 'Moda bonita y barata: todo por menos de 20 €', 'Para darte un capricho sin gastar mucho']),
    intro: (r) => `No hace falta gastar mucho para estrenar. Te dejamos ideas por menos de 20 € ${elegir(r, LUGAR)}.`,
    elegir: (cand, r) => {
      const ps = barajar(r, cand.filter((p) => p.price > 0 && p.price < 2000)).slice(0, 4);
      return ps.length >= 3 ? { ps, extra: '' } : null;
    },
  },
];

function parrafoProducto(p: Product, r: () => number): string {
  const desc = (p.description || '').replace(/\s+/g, ' ').trim();
  const frases = desc.match(/[^.!?]+[.!?]+/g) || (desc ? [desc + '.'] : []);
  const base = frases.slice(0, 2).join(' ').trim();
  const cs = p.colors || [];
  const colores = cs.length > 1 ? ` Disponible en ${cs.slice(0, -1).join(', ').toLowerCase()} y ${cs[cs.length - 1].toLowerCase()}.` : cs.length === 1 ? ` Color: ${cs[0].toLowerCase()}.` : '';
  const consejo = elegir(r, CONSEJO[grupo(p)] || CONSEJO.otro);
  return `**${p.name}** (${eur(p.price)}). ${base ? base + ' ' : ''}${consejo}${colores}`.replace(/\s+/g, ' ').trim();
}

function primeraMayuscula(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

export function generarEntrada(productos: Product[], categorias: Category[], previas: DiarioEntrada[], fecha: string, semilla: number): Omit<DiarioEntrada, 'id' | 'createdAt' | 'status'> | null {
  const r = rng(semilla);
  mesActual = Number(fecha.slice(5, 7)) || 1;
  const vivas = previas.filter((e) => e.status !== 'descartada');
  const conStock = productos.filter((p) => stockDe(p) > 0 && p.price > 0);
  if (conStock.length < 2) return null;
  // No repetir prendas de las últimas entradas mientras quede donde elegir
  let cand = conStock;
  for (const n of [14, 10, 7, 4, 2]) {
    const usadas = new Set(vivas.slice(0, n).flatMap((e) => e.productIds));
    const frescos = conStock.filter((p) => !usadas.has(p.id));
    if (frescos.length >= 8) { cand = frescos; break; }
  }
  const porId = new Map(productos.map((p) => [p.id, p]));
  const catsRecientes = new Set(vivas.slice(0, 10).filter((e) => e.tema === 'categoria').flatMap((e) => e.productIds.map((id) => porId.get(id)?.category || '')));
  // Temas: rotan por día; no se repite el de las 2 últimas entradas; temporada al menos 1 de cada 5;
  // novedades como mucho 1 de cada 5 (y solo si hay prendas nuevas de verdad)
  const ult = vivas.slice(0, 5).map((e) => e.tema);
  const dia = Math.floor(Date.parse(fecha + 'T12:00:00Z') / 864e5);
  const giro = TEMAS.map((_, i) => TEMAS[(dia + i) % TEMAS.length]);
  const prioridad = !ult.includes('temporada') ? giro.filter((t) => t.id === 'temporada') : [];
  const orden = [...prioridad, ...giro].filter((t) => !ult.slice(0, 2).includes(t.id) && !(t.id === 'novedades' && ult.includes('novedades')));
  for (const t of [...orden, ...TEMAS.filter((t) => !orden.includes(t))]) {
    const sel = t.elegir(cand, r, categorias, { catsRecientes });
    if (!sel) continue;
    let title = primeraMayuscula(t.titulo(sel.ps, r, sel.extra));
    // Títulos únicos (Google penaliza los repetidos): si ya existe, se añade la prenda principal
    if (previas.some((e) => norm(e.title) === norm(title))) title = `${title}: ${sel.ps[0].name.toLowerCase()}`;
    if (previas.some((e) => norm(e.title) === norm(title))) title = `${title} (${fecha.slice(8, 10)}/${fecha.slice(5, 7)})`;
    const intro = t.intro(r, sel.extra);
    const body = [...sel.ps.map((p) => parrafoProducto(p, r)), elegir(r, CIERRE)].join('\n\n');
    return { slug: `${fecha}-${slugify(title)}`, date: fecha, tema: t.id, title, intro, body, productIds: sel.ps.map((p) => p.id), image: sel.ps[0].image };
  }
  return null;
}

/* ------------------------------ escrituras ------------------------------ */
// Prepara el borrador de hoy si no hay ninguna entrada de hoy (ni borrador, ni publicada, ni descartada).
export function asegurarBorradorDeHoy(productos: Product[], categorias: Category[]): Promise<DiarioEntrada | null> {
  return enCola(async () => {
    const a = await leer();
    const f = hoy();
    // Borradores viejos sin publicar (más de 14 días): fuera
    const limite = new Date(Date.now() - 14 * 864e5).toISOString();
    a.entries = a.entries.filter((e) => !(e.status !== 'publicada' && e.createdAt < limite));
    const existente = a.entries.find((e) => e.date === f);
    if (existente) return existente.status === 'borrador' ? existente : null;
    const previas = [...a.entries].sort((x, y) => y.createdAt.localeCompare(x.createdAt));
    const g = generarEntrada(productos, categorias, previas, f, Number(f.replace(/-/g, '')));
    if (!g) return null;
    const e: DiarioEntrada = { ...g, id: randomUUID().slice(0, 8), status: 'borrador', createdAt: new Date().toISOString() };
    a.entries.push(e);
    await guardar(a);
    return e;
  });
}

export function regenerarBorrador(id: string, productos: Product[], categorias: Category[]): Promise<DiarioEntrada | null> {
  return enCola(async () => {
    const a = await leer();
    const e = a.entries.find((x) => x.id === id && x.status === 'borrador');
    if (!e) return null;
    const previas = a.entries.filter((x) => x !== e).sort((x, y) => y.createdAt.localeCompare(x.createdAt));
    const g = generarEntrada(productos, categorias, [{ ...e, status: 'borrador' }, ...previas], e.date, Date.now() & 0x7fffffff);
    if (!g) return null;
    Object.assign(e, g, { updatedAt: new Date().toISOString() });
    await guardar(a);
    return e;
  });
}

export function guardarEntrada(id: string, datos: { title: string; intro: string; body: string; publicar?: boolean; productIds?: string[] }): Promise<DiarioEntrada | null> {
  return enCola(async () => {
    const a = await leer();
    const e = a.entries.find((x) => x.id === id);
    if (!e) return null;
    const ahora = new Date().toISOString();
    e.title = datos.title.trim().slice(0, 140) || e.title;
    e.intro = datos.intro.trim().slice(0, 600);
    e.body = datos.body.replace(/\r\n/g, '\n').trim().slice(0, 8000);
    if (datos.productIds) e.productIds = datos.productIds;
    e.updatedAt = ahora;
    if (datos.publicar && e.status !== 'publicada') {
      // El enlace definitivo usa el título final y el día de publicación; nunca se repite
      const base = `${hoy()}-${slugify(e.title)}`;
      let slug = base, n = 2;
      while (a.entries.some((x) => x !== e && x.slug === slug)) slug = `${base}-${n++}`;
      e.slug = slug;
      e.status = 'publicada';
      e.publishedAt = ahora;
    }
    await guardar(a);
    return e;
  });
}

export function cambiarEstado(id: string, status: DiarioEstado): Promise<boolean> {
  return enCola(async () => {
    const a = await leer();
    const e = a.entries.find((x) => x.id === id);
    if (!e) return false;
    e.status = status;
    e.updatedAt = new Date().toISOString();
    await guardar(a);
    return true;
  });
}

// Texto con **negrita** → trozos para pintar sin HTML crudo
export function trozos(parrafo: string): { b: boolean; t: string }[] {
  return parrafo.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((t) => (t.startsWith('**') && t.endsWith('**') ? { b: true, t: t.slice(2, -2) } : { b: false, t }));
}
