# Cines PY — dirección visual y sistema de interfaz

## Producto
Guía independiente para consultar cartelera de cine en Paraguay. La tarea principal es encontrar una película, comparar salas y leer los horarios publicados; la interfaz no vende entradas ni promete disponibilidad.

## Dirección de arte: programa editorial de cine
La dirección visual anterior queda descartada: era demasiado rígida, oscura y uniforme. La nueva interfaz toma referencias de una publicación cultural impresa y de una cartelera editorial contemporánea. Debe sentirse como una guía de cine local, no como un dashboard ni como una plantilla de streaming.

- **Paleta:** tinta azul-negra `#171B22`, papel cálido `#F5EFE5`, coral `#EF5638`. El acento se reserva para acciones, selección y jerarquía puntual.
- **Tipografía:** titulares condensados y contundentes; texto sobrio y legible; horarios con numerales tabulares.
- **Composición:** masthead compacto; apertura editorial con una película real, su afiche real y una lista de programación; catálogo de afiches sin tarjetas flotantes; directorio de salas como lista navegable.
- **Materialidad:** papel cálido, tinta, reglas finas y cortes de composición inspirados en programas impresos. Sin gradients decorativos, glassmorphism, glow, radios redondeados por defecto ni iconos decorativos.
- **Ritmo:** secciones con composiciones distintas según su contenido. No repetir título centrado + tarjetas.

## Interacción y movimiento
- Entrada corta y no repetitiva para el contenido principal; feedback discreto en enlaces, afiches y acciones.
- Sin autoplay, loops perpetuos, parallax ni scroll-jacking.
- `prefers-reduced-motion` elimina animaciones no esenciales.
- El menú móvil comunica su estado y se cierra con Escape.
- Búsqueda y filtros conservan sus estados funcionales.

## Responsive y accesibilidad
- Validar 1440, 1024, 768, 390 y 360 CSS px.
- Sin desbordamiento horizontal ni controles táctiles menores de 44px.
- Mantener foco visible, contraste legible, etiquetas accesibles y alternativas de texto.
- No esconder información esencial detrás de hover o animaciones.

## Veracidad del contenido
`data/cines.json` aporta títulos, afiches, géneros, enlaces oficiales, salas y textos originales de horarios. Datos ausentes (direcciones, disponibilidad, reseñas, duración, clasificación o precios) no se inventan. La información de fichas oficiales solo se muestra cuando se recupera y atribuye.

## Hosting y SEO
- HTML estático por ruta, compatible con GitHub Pages bajo `/cines.com.py/`.
- `SITE_URL` representa únicamente el origen (`https://yosoymitxel.github.io`); `BASE_PATH` representa el subdirectorio (`/cines.com.py/`). No concatenar el subdirectorio dos veces.
- Cada página indexable tiene title, description, canonical correcto, Open Graph, Twitter Card y JSON-LD apropiado.
- Sitemap y robots.txt usan las URLs públicas exactas.
- No depender de JavaScript para que buscadores lean el contenido principal.

## Anti-slop UI — gate obligatorio
Antes de cerrar una tarea visual, revisar explícitamente:
- No usar paleta, gradiente, composición, card grid o tipografía de una plantilla genérica.
- No convertir cada sección en tarjetas idénticas.
- No agregar iconos, badges, sombras, radios o acentos sin función.
- No inventar métricas, testimonios, metadatos, estados ni controles.
- Verificar contraste, foco, teclado, estados hover/active/disabled y affordances.
- Verificar tamaños de medios y prioridad de carga.
- Revisar en navegador real y en los cinco anchos definidos.
- Ejecutar informe PASS/FAIL; cualquier regla no probada queda NO VERIFICADA.

## Modern Web Guidance
Priorizar HTML semántico, CSS moderno, APIs nativas, carga eficiente, accesibilidad y fallbacks responsables. Consultar las guías de Chrome antes de introducir APIs recientes; no añadir polyfills o dependencias por moda.
