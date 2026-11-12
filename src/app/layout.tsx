import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Inmo Growth",
  description: "Dónde invertir en vivienda: los municipios de España con más crecimiento",
  appleWebApp: { capable: true, title: "Inmo Growth", statusBarStyle: "default" }, // instalada en iPhone se abre a pantalla completa
};

export const viewport: Viewport = { themeColor: "#ffffff" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
