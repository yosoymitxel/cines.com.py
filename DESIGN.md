# Cines PY — dirección visual y sistema de interfaz

## Producto
Guía para consultar la cartelera de cine en Paraguay. La tarea principal es encontrar una película, comparar salas y leer los horarios publicados de manera inmediata y cómoda desde cualquier dispositivo.

## Dirección de arte: cartelera moderna y experiencia cinematográfica
La dirección visual es inmersiva, nítida y fiel al entorno cinematográfico. El afiche de la película es protagonista absoluto y la lectura de horarios es ágil, tabular y de alto contraste sobre un fondo oscuro de sala de cine.

- **Paleta:** lienzo cinematográfico oscuro `#0C0F14`, superficies elevadas `#141824` y `#1B2130`, acento rojo cine `#E50914`, toques dorados `#F5C518` para destacar salas y formatos, texto de alto contraste `#F8FAFC` y neutro pizarra `#94A3B8`.
- **Tipografía:** tipografía de sistema moderna, limpia, legible y proporcional (`system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`). Títulos contundentes y elegantes; horarios con numerales tabulares.
- **Composición:** cabecera sticky con navegación directa; apertura con película destacada en cartelera; catálogo adaptable en grilla proporcional; salas y horarios presentados en bloques nítidos y ordenados.
- **Materialidad:** superficies oscuras con bordes sutiles (`rgba(255, 255, 255, 0.08)`), radios refinados (4 a 8px) y sombras suaves. Sin gradientes chillones, glassmorphism abusivo ni sellos postales decorativos.
- **Ritmo:** jerarquía clara entre película destacada, cartelera completa, directorio de salas y funciones por complejo.

## Interacción y movimiento
- Microinteracciones sobrias y directas; feedback táctil y visual en enlaces y afiches.
- Sin autoplay, loops perpetuos, parallax forzado ni scroll-jacking.
- `prefers-reduced-motion` desactiva animaciones y transiciones.
- El menú móvil comunica su estado accesible (`aria-expanded`) y se cierra con Escape.
- Búsqueda y filtros por género conservan sus estados activos y filtros instantáneos.

## Responsive y accesibilidad
- Validado en 1440, 1024, 768, 390 y 360 CSS px.
- Sin desbordamiento horizontal ni controles táctiles menores de 44px (`min-height: 44px`).
- Foco visible de alto contraste, legibilidad conforme a WCAG AA en todos los elementos.
- Textos alternativos en afiches y fallbacks elegantes si la imagen no está disponible.

## Veracidad del contenido
`data/cines.json` aporta títulos, afiches, géneros, salas y textos originales de horarios. Datos ausentes no se inventan. Las cadenas de horarios se mantienen intactas sin parseos destructivos.

## Hosting y SEO
- HTML estático por ruta, compatible con GitHub Pages bajo `/cines.com.py/`.
- `SITE_URL` representa únicamente el origen (`https://yosoymitxel.github.io`); `BASE_PATH` representa el subdirectorio (`/cines.com.py/`).
- Cada página indexable incluye title, description, canonical, Open Graph, Twitter Card y JSON-LD.
- Sitemap y robots.txt usan las URLs públicas exactas.
- No depende de JavaScript para indexación.

## Anti-slop UI — gate de calidad
- Sin paletas genéricas de plantilla, ni fondos beige desgastados que no correspondan al cine.
- Sin convertir secciones en tarjetas idénticas sin jerarquía.
- Sin flechas decorativas repetidas en cada palabra o enlace.
- Sin inventar métricas, testimonios ni controles de compra inexistentes.
- Verificación en navegador real y en todos los anchos definidos.
