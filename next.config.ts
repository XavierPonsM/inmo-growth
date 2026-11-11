import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Solo en desarrollo: permite abrir el servidor local desde el móvil en la misma wifi (http://<IP del Mac>:3000).
  // Si la IP del Mac cambia, actualízala aquí (Ajustes del sistema > Wi-Fi > Detalles).
  allowedDevOrigins: ["192.168.1.136"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
