import { execSync } from 'child_process';

// Versión compilada (se ve en Panel → Diagnóstico): así se sabe si el VPS tiene lo último.
let build = 'desconocida';
try { build = execSync('git log -1 --format=%h·%cd --date=format:%d/%m/%Y_%H:%M', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch {}

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: { EUREKA_BUILD: build, EUREKA_BUILT_AT: new Date().toISOString() },
  // Cargamos Google Fonts por <link> en runtime; desactivamos la optimización
  // en build (que intenta descargar la hoja de estilos y fallaría sin red).
  optimizeFonts: false,
  // Varias fotos HEIC/JPG del móvil o de InShot a la vez: hasta 80 MB por envío.
  // El decodificador HEIC (WebAssembly) se carga tal cual, sin empaquetar.
  experimental: {
    serverActions: { bodySizeLimit: '80mb' },
    serverComponentsExternalPackages: ['heic-convert', 'heic-decode', 'libheif-js', 'sharp'],
  },
  images: { remotePatterns: [{ protocol: 'https', hostname: 'images.pexels.com' }] },
};
export default nextConfig;
