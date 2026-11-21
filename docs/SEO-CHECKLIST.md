# SEO técnico — checklist de publicación

Metodología de referencia: [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo). Esta implementación adopta los criterios técnicos relevantes para un sitio editorial estático; no afirma haber ejecutado el plugin de Claude Code.

## SEO on-page
- Un title y una meta description descriptivos por ruta.
- Canonical absoluto con el origen y el subdirectorio correctos de GitHub Pages.
- Idioma `es-PY`, Open Graph `es_PY` y Twitter Card.
- H1 único y jerarquía de encabezados semántica.
- Enlaces internos rastreables a cada ficha de película y sala.
- Imágenes con alt, dimensiones y prioridad de carga apropiada.

## Datos estructurados
- `WebSite` para la portada.
- `ItemList` para listados.
- `Movie` para fichas de películas.
- `MovieTheater` para fichas de salas.
- No añadir propiedades de dirección, precio, clasificación, disponibilidad o reseñas sin fuente verificable.
- Validar que cada bloque JSON-LD sea JSON válido.

## Rastreo e indexación
- Todas las rutas se generan como HTML estático antes de publicar.
- Sitemap XML contiene todas las rutas públicas y no duplica `/cines.com.py/`.
- `robots.txt` declara la ubicación del sitemap.
- RSS ofrece descubrimiento alternativo de la cartelera.
- El sitio no depende de JS para el contenido indexable.

## Rendimiento y experiencia
- No cargar fuentes remotas ni frameworks en runtime.
- Afiches con dimensiones reservadas, `decoding=async` y lazy loading excepto el principal.
- Evitar scripts de terceros bloqueantes.
- Revisar LCP, CLS e INP con PageSpeed Insights / CrUX después del despliegue; no declarar Core Web Vitals aprobados sin datos de campo.

## Limitación de GitHub Pages
Este proyecto usa un subdirectorio: `https://yosoymitxel.github.io/cines.com.py/`. Los robots.txt alojados en un subdirectorio no sustituyen al archivo `https://yosoymitxel.github.io/robots.txt` del origen. El sitemap se puede enviar directamente desde Search Console; para controlar el robots.txt del origen hace falta gestionar el dominio raíz o usar un dominio propio con su archivo en la raíz.

## Validación automatizada
`npm test` comprueba rutas generadas, canonical, sitemap, robots, JSON-LD y metadatos sociales. Playwright comprueba navegación, búsqueda, filtros, fichas, tamaños responsive y errores JS. Los Core Web Vitals reales requieren medición externa posterior al despliegue.
