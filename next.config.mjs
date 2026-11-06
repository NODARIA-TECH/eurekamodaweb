/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cargamos Google Fonts por <link> en runtime; desactivamos la optimización
  // en build (que intenta descargar la hoja de estilos y fallaría sin red).
  optimizeFonts: false,
  // Fotos del móvil (3-8 MB) desde el panel: el límite por defecto de las server actions es 1 MB.
  experimental: { serverActions: { bodySizeLimit: '30mb' } },
  images: { remotePatterns: [{ protocol: 'https', hostname: 'images.pexels.com' }] },
};
export default nextConfig;
