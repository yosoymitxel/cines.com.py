# Anti-slop UI — reglas aplicadas al proyecto

Fuente: [miqdadbadjuber/anti-slop](https://github.com/miqdadbadjuber/anti-slop), skill [antislop-ui](https://github.com/miqdadbadjuber/anti-slop/tree/main/skills/antislop-ui). Modo de trabajo: **DURING** (aplicar durante el diseño y la implementación).

## Lectura de diseño
Cartelera editorial local, ENERGY 2 / RHYTHM 3 / MOTION 1. La composición prioriza afiches reales, jerarquía tipográfica y navegación clara; no debe parecer un dashboard ni una plantilla SaaS.

## Reglas visuales
- Rechazar gradientes azul-violeta, glow generalizado, glassmorphism repetido y modo oscuro sin justificación.
- Limitar la paleta activa a neutros + un acento con función concreta.
- Evitar radios excesivos, sombras suaves en todos los elementos y badges decorativos. Usar Font Awesome para iconos funcionales.
- No usar bento, grids repetitivos ni secciones de plantilla si el contenido no lo necesita.
- Dar jerarquía distinta a contenido principal, catálogo, salas, horarios y metadatos.
- No mostrar cifras, precios, disponibilidad, reseñas ni contenido sin fuente verificable.
- Medios con dimensiones estables, prioridad correcta y fallback accesible.
- Animación justificada, breve y compatible con `prefers-reduced-motion`.
- Controles reales con estados visibles, foco de teclado, cursor y etiquetas correctas.

## Revisión de entrega
Cada revisión debe terminar en PASS/FAIL para:
1. Identidad visual propia y coherente.
2. Jerarquía y ritmo de lectura.
3. Accesibilidad y contraste.
4. Responsive y tap targets.
5. Interacciones y estados.
6. Rendimiento, carga de imágenes y movimiento.
7. Veracidad del contenido y SEO técnico.

Un screenshot atractivo no sustituye la validación funcional. Una regla que no se pudo probar se reporta como NO VERIFICADA, nunca como PASS.
