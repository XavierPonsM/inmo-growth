# Inmo Growth

Mapa y ranking de los municipios de España con más crecimiento, hecho con datos abiertos. Para cada municipio combina población, inversión pública,
universidad, comercios, precios, planeamiento urbanístico previsto y calidad de la zona, y los resume en un **índice de crecimiento** de 0 a 100.

> No es asesoramiento financiero. Son indicadores estadísticos y aproximados; antes de decidir nada, contrasta con el ayuntamiento y fuentes locales.

## Qué hace

- **Mapa** con una burbuja por municipio: el tamaño y el color dependen del índice.
- **Lista** ordenada por índice, con buscador y **filtros** (ámbito, tamaño, crecimiento, planeamiento, zona, precio, cercanía a una ciudad grande, extras).
- **Ficha** de cada municipio: por qué tiene esa puntuación (qué suma y qué resta), calidad de la zona, proyectos concretos, sectores de planeamiento y enlace a idealista.

## Cómo se calcula el índice

Media ponderada de percentiles entre los municipios de 1.000 habitantes o más. Si falta un indicador se reponderan los demás.

| Peso | Indicador | Fuente |
|---|---|---|
| 23 % | Población: crecimiento total, último año y personas ganadas | INE (padrón) |
| 8 % | Inversión pública por habitante (capítulo 6, media 2019/2024) | Ministerio de Hacienda (CONPREL) |
| 9 % | Universidad: tamaño del campus, rebajado si está lejos del centro | Wikidata y OpenStreetMap |
| 5 % | Negocios nuevos: supermercados y gimnasios por habitante (nov-2020 frente a hoy) | OpenStreetMap |
| 20 % | **Futuro**: vivienda prevista en el planeamiento (9), obra nueva (7), suelo para actividad económica (4) | SIU (Ministerio de Vivienda), Catastro |
| 8 % | Población joven: edad media y % de menores de 18 años | INE (Atlas de renta) |
| 11 % | Empleo: paro registrado sobre población de 18-64 (7) y su variación interanual (4) | SEPE |
| 10 % | Cercanía a una ciudad de más de 100.000 habitantes (línea recta) | Cálculo propio con INE |
| 6 % | Cercanía al mar (solo cuenta si está a menos de 60 km; el interior no se penaliza) | Natural Earth |

Se han descartado del índice, por poco informativos: suelo urbano y precio de la vivienda (reflejan precio, no crecimiento, y solo hay datos provinciales o
de municipios grandes), proyección provincial de población (igual para todo el municipio de una provincia), solares (capacidad, no demanda) y la lista
curada de proyectos (muestra incompleta; sigue visible en la ficha).

La **calidad de la zona** (seguridad, renta, pobreza y okupación provincial) se muestra aparte y **no entra en el índice**. Solo se valora cuando hay
seguridad municipal (Interior publica criminalidad solo para capitales y municipios de más de 20.000 habitantes); si no, aparece como "sin valorar".

## Ejecutar la web

```bash
npm install      # también copia el worker de MapLibre a public/maplibre
npm run dev      # http://localhost:3000
```

La web lee `public/municipios.json` y `public/sectores.json`, que ya van en el repositorio.

## Regenerar los datos

Los datos intermedios (`data/raw/*.csv`) también están versionados, así que basta con:

```bash
pip install numpy pandas openpyxl xlrd
python3 scripts/build_dataset.py        # genera public/municipios.json
```

Cada fuente tiene su script en `scripts/` (descarga y procesado): `fetch_osm.py`, `fetch_osm_hist.py`, `process_osm.py`, `process_gasto.py`,
`process_uni.py`, `process_suelo.py`, `process_tasado.py`, `process_futuro.py`, `process_siu.py`, `process_sectores.py`, `fetch_edad.py`, `process_paro.py`, `process_costa.py`, `fetch_renta.py` y
`process_seguridad.py`. La cabecera de cada uno explica de dónde descarga y qué genera. Los proyectos concretos están en
`data/curated/proyectos.json` (cada entrada necesita código INE, nombre, tipo, estado y una URL).

## Limitaciones importantes

- La **okupación** solo existe por provincia (Interior no la publica por municipio).
- El **planeamiento (SIU)** son planes sobre el papel: muchos son antiguos y no se construirán.
- Los puntos de **OpenStreetMap** se asignan al municipio más cercano (no hay polígonos) y su mapeo mejora con los años.
- El **Catastro** no cubre País Vasco ni Navarra.
- La lista de **proyectos concretos** es una muestra, no un censo.

## Datos y licencias

INE, Ministerio de Hacienda, Ministerio de Transportes, Ministerio de Vivienda y Agenda Urbana (SIU), Dirección General del Catastro y Ministerio del
Interior publican sus datos como información reutilizable. Contiene datos de © colaboradores de [OpenStreetMap](https://www.openstreetmap.org/copyright)
(licencia ODbL) y de [Wikidata](https://www.wikidata.org) (CC0). Mapa base: OpenFreeMap / OpenMapTiles.
