# Skills de diseño seleccionadas

Inventario curado desde [recent.design/skills](https://recent.design/skills). Se guardan como referencias de trabajo; no agregan librerías de runtime ni dependencias de producción.

## Pulido y crítica visual
| Skill | Fuente | Uso en Cines PY |
|---|---|---|
| `distill` | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | Quitar complejidad visual sin perder identidad. |
| `critique` | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | Evaluación UX y priorización de defectos. |
| `polish` | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | Pase final de espaciado, alineación y consistencia. |
| `web-design-guidelines` | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | Auditoría de diseño, accesibilidad y patrones web. |
| `emil-design-eng` | [emilkowalski/skills](https://github.com/emilkowalski/skills) | Detalle de interacción, componentes y calidad visual. |
| `make-interfaces-feel-better` | [jakubkrehel/make-interfaces-feel-better](https://github.com/jakubkrehel/make-interfaces-feel-better) | Hover, estados, bordes, sombras y microinteracciones. |

## Animación y movimiento
| Skill | Fuente | Uso en Cines PY |
|---|---|---|
| `apple-design` | [emilkowalski/skills](https://github.com/emilkowalski/skills) | Movimiento fluido, físico y discreto en interacciones. |
| `animation-vocabulary` | [emilkowalski/skills](https://github.com/emilkowalski/skills) | Nombrar y elegir patrones de movimiento concretos. |
| `review-animations` | [emilkowalski/skills](https://github.com/emilkowalski/skills) | Revisar duración, easing, origen, rendimiento y accesibilidad. |
| `prototype` | [emilkowalski/skills](https://github.com/emilkowalski/skills) | Comparar direcciones visuales antes de fijar una solución. |

## Uso
- Primero definir dirección en `DESIGN.md`; las skills no sustituyen la identidad visual.
- Aplicar `distill` y `critique` durante rediseño; `emil-design-eng` y `make-interfaces-feel-better` al pulir interacciones; `apple-design` y `review-animations` al trabajar movimiento; `polish` y `web-design-guidelines` antes de publicar.
- Las animaciones deben mejorar orientación o feedback; no se agregan solo para decorar.
- Las skills son herramientas de agente. El sitio final sigue siendo HTML/CSS/JS estático y liviano.

## Estándar de plataforma
[GoogleChrome/modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance): consultar con `npx modern-web-guidance@latest search "..." `, recuperar la guía aplicable y usar `legacy-scan .` como revisión de patrones antiguos cuando el entorno tenga acceso al CLI.

## SEO
[Agricidaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo): adoptar sus listas de verificación para SEO técnico, metadatos, datos estructurados, sitemap, contenido útil, Core Web Vitals y rastreabilidad. El plugin es para Claude Code; el proyecto documenta y aplica sus criterios sin declarar que el plugin se ejecutó aquí.
