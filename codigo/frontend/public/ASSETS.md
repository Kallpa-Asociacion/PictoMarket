# Procedencia de recursos

## Arte proporcionado para la interfaz

Los originales están en `img/`, en la raíz del repositorio:

| Recurso público   | Fuente          | Transformación                                                  |
| ----------------- | --------------- | --------------------------------------------------------------- |
| `art/market.webp` | `img/fondo.png` | Conversión a WebP                                               |
| `art/awning.webp` | `img/fondo.png` | Recorte del toldo                                               |
| `art/shelf.webp`  | `img/fondo.png` | Recorte de madera y cajones                                     |
| `art/guide.webp`  | `img/ui.png`    | Recorte decorativo del rostro del guía                          |
| `art/kallpa.webp` | `img/ui.png`    | Recorte del logotipo y eliminación del fondo conectado al borde |

La bienvenida también usa estos recursos decorativos locales:

| Recurso público           | Fuente                                   | Transformación                                                                |
| ------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------- |
| `art/welcome-market.webp` | `img/fondo.png`                          | Plaza recompuesta con el lateral derecho y su reflejo, sin duplicar el puesto |
| `art/welcome-awning.webp` | `img/fondo.png`                          | Recorte del toldo con máscara transparente                                    |
| `art/welcome-guide.webp`  | `img/ui.png`                             | Silueta del guía con máscara trazada, sin textos ni controles                 |
| `art/welcome-basket.svg`  | Dibujo vectorial creado para el frontend | Carrito y alimentos decorativos                                               |
| `art/welcome-crate.svg`   | Dibujo vectorial creado para el frontend | Cajón y alimentos decorativos                                                 |

La imagen de inicio adjunta en la conversación inspira la composición; no está incluida como una captura de pantalla ni se usa como interfaz. El arte se adapta a los originales disponibles y a estos SVG. Las ilustraciones de alimentos de bienvenida **no sustituyen los pictogramas ARASAAC del juego**.

`img/ui.png` sirve como referencia visual; no se renderiza como pantalla, ni contiene los controles activos. Todos los textos, tarjetas, precios, botones y estados de la aplicación se crean con React.

Los recortes se pueden reproducir con `scripts/prepare-art.py`. **No se dispone de información de licencia de las imágenes suministradas ni de autorización de uso de la marca Kallpa.** Su presencia reproduce la referencia solicitada; no afirma patrocinio ni afiliación. Validar permisos antes de publicar o redistribuir estos recursos.

## Pictogramas

- Autor: **Sergio Palao**.
- Origen: **ARASAAC**, <https://arasaac.org>.
- Propietario: **Gobierno de Aragón**.
- Licencia: **Creative Commons BY-NC-SA**.
- Fuente de cada archivo: `https://static.arasaac.org/pictograms/{id}/{id}_300.png`.

Se conservan los 30 IDs y sus nombres tal como aparecen en `datos/escenarios.json`. Los archivos PNG de `pictograms/` no se redibujan ni reemplazan por iconos de la captura. `scripts/download-pictograms.mjs` reproduce las descargas y valida la firma PNG.

### Pictogramas de función (oración de pictogramas)

Las palabras de función de la consulta del agente (`BUSCAR + PRODUCTO`, pistas, éxito) usan pictogramas reales de **ARASAAC** (autor **Sergio Palao**, **Gobierno de Aragón**, licencia **CC BY-NC-SA**, <https://arasaac.org>). Los IDs, la palabra clave y la búsqueda de origen están en `datos/pictogramas_funcion.json`; `scripts/download-function-pictograms.mjs` los descarga y valida la firma PNG.

| ID    | Palabra ARASAAC        | Uso               |
| ----- | ---------------------- | ----------------- |
| 6947  | buscar                 | consulta y pistas |
| 8986  | comprar                | reservado         |
| 30618 | carrito de la compra   | éxito             |
| 11599 | éxito                  | éxito (MUY BIEN)  |
| 37162 | otra vez               | pista a4          |
| 6564  | ver, mirar, observar   | pista a3          |
| 5382  | aquí                   | pista a3          |
| 19524 | ayuda                  | pista a2          |
| 11751 | quitar, sacar, extraer | pista a2          |

## Fuentes e iconos

- **Nunito**, Google Fonts, fuentes locales 700 y 900. Licencia **SIL Open Font License 1.1**, incluida en `fonts/OFL.txt`. Fuente: <https://github.com/google/fonts/tree/main/ofl/nunito>.
- **Lucide**, iconos SVG a través de `lucide-react`, licencia ISC: <https://lucide.dev/license>.
- Las monedas son dibujos CSS y los emojis decorativos dependen del sistema operativo.

## Inti animado (`public/art/inti/`)

Ilustraciones del personaje proporcionadas por el equipo del proyecto. Se alinearon a un mismo lienzo (642 × 521 px) tomando como base la pose «habla abierta», se les quitó el fondo cuando venía pintado y se exportaron en WebP.

| Archivo | Uso |
|---|---|
| `reposo`, `habla-media`, `habla-abierta`, `parpadeo` | Hablar, callar y parpadear (mismo cuerpo, cambia la cara) |
| `saludo` | Inicio |
| `senala` | Explicar un elemento de la pantalla |
| `sorpresa` | Explicar sin señalar |
| `piensa` | Pista |
| `animo` | Después de un error (no se usa ninguna cara de enojo) |
| `pulgar` | Acierto |
| `celebra` | Compra completa |

Una pose nueva debe usar el mismo lienzo y encuadre para que el personaje no salte.
