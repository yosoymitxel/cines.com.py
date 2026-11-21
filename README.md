# Cines PY — propuesta de rediseño

Prototipo estático e independiente para modernizar la consulta de cartelera de cine en Paraguay. No es un sitio oficial ni está afiliado a Cines.com.py.

## Stack

- Node.js 22+ y APIs nativas.
- Generación estática de HTML: sin framework, backend, base de datos ni dependencias de producción.
- GitHub Pages y GitHub Actions.

## Datos

- Cartelera: `https://yosoymitxel.github.io/Web-scrapping/data/cines.json`.
- El build intenta obtener la versión publicada y utiliza `data/cines.json` como snapshot si la fuente no responde.
- Los estrenos y enlaces de fichas de salas se descubren desde `https://www.cines.com.py/estrenos/`. Las fichas oficiales de cada sala se consultan durante el build para añadir tarifas y metadatos de películas cuando están publicados; `data/estrenos.json` es el respaldo local de estrenos.
- Los textos originales de horarios no se convierten a horas estructuradas ni se alteran.
- Solo se muestran datos que existan en las fuentes. Los precios y metadatos de las fichas oficiales se muestran solo cuando se recuperan; no se inventan domicilios, reseñas ni disponibilidad.

## Desarrollo

```bash
npm run build
npm test
npm run preview
```

Abrí `http://127.0.0.1:4173/` para revisar el sitio local.

Para validar sin conexión, utilizá `OFFLINE=1 npm run build`.

## Despliegue

GitHub Actions compila y publica `dist/` en cada push a `main`, y vuelve a compilar cada seis horas para actualizar la cartelera. En Settings → Pages, seleccionar **GitHub Actions** como fuente de despliegue.

## SEO

Cada película y cada sala tiene HTML propio, title y description, canonical, Open Graph, datos JSON-LD, sitemap, robots.txt y feed RSS. El contenido principal no depende de JavaScript.

## Capturas y pruebas

El flujo de validación utiliza Playwright en 1440, 1024, 768, 390 y 360 px, además de navegación, búsqueda, filtros, fichas y enlaces internos. Intenta capturar también las páginas originales de Cines.com.py para conservar una referencia visual; si la web externa no responde, las capturas originales se omiten sin invalidar las pruebas del prototipo.


## SEO y GitHub Pages

Cada película y sala tiene HTML propio, title, description, canonical, Open Graph, Twitter Cards y JSON-LD. Sitemap, robots.txt y RSS usan la URL pública del proyecto. `SITE_URL` debe ser solo el origen (`https://yosoymitxel.github.io`) y `BASE_PATH` el subdirectorio (`/cines.com.py/`).

## Diseño y calidad

La dirección visual está documentada en `DESIGN.md`. `docs/ANTI-SLOP-UI.md` define el gate antislop-ui; `docs/DESIGN-SKILLS.md` registra las skills de `recent.design` para crítica, animación y pulido. La implementación sigue también [Modern Web Guidance](https://github.com/GoogleChrome/modern-web-guidance) y los criterios de auditoría de [Claude SEO](https://github.com/AgriciDaniel/claude-seo), resumidos en `docs/SEO-CHECKLIST.md`.
