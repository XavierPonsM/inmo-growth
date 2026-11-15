import type { Metadata } from "next";
import { SharedFicha } from "@/components/Explorer";

export const metadata: Metadata = { title: "Ficha de municipio · Inmo Growth", robots: { index: false } };

// Ficha para compartir con un cliente: /f?id=<código INE>&a=<agencia>&m=<viv|inv>
// "a" es una clave de public/agencias.json (logo, nombre y contacto); sin ella la ficha sale con la marca de la app.
// La página es estática: los parámetros se leen en el navegador (con parámetros de servidor la carga se quedaba esperando).
export default function Page() {
  return <SharedFicha />;
}
