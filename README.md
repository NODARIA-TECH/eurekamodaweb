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
