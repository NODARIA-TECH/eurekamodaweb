/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cargamos Google Fonts por <link> en runtime; desactivamos la optimización
  // en build (que intenta descargar la hoja de estilos y fallaría sin red).
  optimizeFonts: false,
  images: { remotePatterns: [{ protocol: 'https', hostname: 'images.pexels.com' }] },
};
export default nextConfig;
