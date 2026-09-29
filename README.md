# EUREKA — Tienda de moda (Next.js)

Web de EUREKA (tienda online de moda de mujer) — Nodaria Tech.
Arranque del proyecto en **Next.js 14 (App Router) + TypeScript**, con la home portada
del diseño aprobado (editorial beige · madera · dorado).

## Arrancar en local

```bash
npm install
npm run dev        # http://localhost:3000
```

Producción:

```bash
npm run build && npm start
```

> Requiere Node 18+ (probado con Node 22).

## Estructura

```
app/
  layout.tsx      # <html>, fuentes (Google Fonts), CartProvider, metadata
  page.tsx        # composición de la home
  globals.css     # sistema de estilos (paleta beige/madera/dorado)
components/
  Promo.tsx       # barra superior (dismissible)  [client]
  Header.tsx      # cabecera: logo centrado, iconos, menú móvil, contador de cesta  [client]
  Sections.tsx    # Hero, Strip, Categories, EditFeature, Collage, RealBand, Footer  [server]
  ProductRail.tsx # carrusel de novedades + añadir a cesta  [client]
  Newsletter.tsx  # formulario club  [client]
  Cart.tsx        # CartProvider (contexto) + toast  [client]
lib/
  data.ts         # tipos + catálogo/categorías (MOCK) + helper de imágenes
public/
  eureka-logo.png # logo original
```

## Notas importantes

- **Imágenes**: ahora son *placeholders* de Pexels (`lib/data.ts` → `pexels()`), como en la maqueta.
  En producción se sustituyen por las **fotos reales del catálogo** de la clienta.
  Están permitidas en `next.config.mjs` (`images.remotePatterns`).
- **Fuentes**: se cargan por `<link>` a Google Fonts en `app/layout.tsx`.
- **Cesta**: por ahora es un contador en memoria (contexto React) para ver el flujo.

## Roadmap (plan Estándar/Completo)

- [ ] Páginas de **categoría** y **ficha de producto** (rutas dinámicas)
- [ ] **Cesta** y **checkout** (página + estado persistente)
- [ ] **Área de cliente**: cuenta, pedidos e historial/balance
- [ ] **Panel de administración**: catálogo, categorías y **stock**
- [ ] **Base de datos** (p. ej. Prisma + PostgreSQL/SQLite) sustituyendo el mock
- [ ] Pasarela de pago (Stripe/Redsys) y buscador/filtros — *nivel Estándar+*
- [ ] Integración de envíos **GLS** — *siempre aparte*
- [ ] **Preparación para conectar el futuro programa de facturación con el stock** — *nivel Completo, aparte*

---
Diseño y desarrollo por **Nodaria Tech** — nodariatech.es

## Panel interno (admin)

- Ruta: **/admin** (login en `/admin/login`).
- Contraseña demo: `eureka` (configurable con `EUREKA_ADMIN_PASSWORD` en `.env`).
- Secciones: Dashboard, Productos (precio/stock/badge, alta/baja), Categorías, Pedidos (estado), Clientes (balance + movimientos).

## Datos

- Almacén **demo en `data/db.json`** con capa de repositorio en `lib/store.ts`.
  Es una base de datos de fichero para ver el flujo completo; **sustituible por Prisma/PostgreSQL
  o `@nodaria/core`** sin tocar los componentes (misma interfaz de repositorio).
- Precios en **céntimos** (enteros); formato con `lib/money.ts`.

## Flujo de compra

Añadir a cesta (persiste en localStorage) → **/cesta** → "Finalizar compra" crea el pedido,
**descuenta stock** y registra el cliente. Pasarela de pago (Stripe/Redsys) = nivel Estándar+.

## Migrar a PostgreSQL (Prisma) — para el VPS

El proyecto trae ya el esquema y la implementación equivalente del repositorio:

- `prisma/schema.prisma` — modelos (Postgres).
- `lib/store.prisma.ts` — mismo interfaz que `lib/store.ts`, pero con Prisma (excluido del build hasta activarlo).
- `prisma/seed.mjs` — carga inicial desde `data/db.json`.

Pasos en el servidor:

```bash
npm i prisma @prisma/client
# .env -> DATABASE_URL=postgresql://...
npx prisma migrate dev --name init
node prisma/seed.mjs
# activar la versión Prisma:
#   renombra lib/store.ts -> lib/store.file.ts  y  lib/store.prisma.ts -> lib/store.ts
#   (o cambia los imports "@/lib/store" por "@/lib/store.prisma")
#   y quita "lib/store.prisma.ts" del "exclude" de tsconfig.json
```

Los componentes, páginas, cesta y admin **no cambian**: es el mismo interfaz de repositorio.
Igual de directo si en su lugar enganchamos `@nodaria/core`.
