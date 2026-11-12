import type { MetadataRoute } from "next";

// Manifiesto web: permite instalar la app desde el navegador (Android: "Instalar app"; iPhone: "Añadir a pantalla de inicio")
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Inmo Growth",
    short_name: "Inmo Growth",
    description: "Dónde invertir en vivienda: los municipios de España con más crecimiento",
    lang: "es",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
