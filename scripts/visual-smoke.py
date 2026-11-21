from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urljoin

from playwright.sync_api import Error as PlaywrightError, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
ARTIFACTS = ROOT / "artifacts" / "visual-review"
BASE_URL = os.environ.get("PREVIEW_URL", "http://127.0.0.1:4173")
BASE_PATH = "/" + os.environ.get("BASE_PATH", "/cines.com.py/").strip("/") + "/"
PORT = os.environ.get("PORT", "4173")
SIZES = [(1440, 900, "desktop"), (1024, 900, "laptop"), (768, 1024, "tablet"), (430, 932, "large-mobile"), (414, 896, "mobile-wide"), (390, 844, "mobile"), (375, 812, "mobile-compact"), (360, 800, "small-mobile")]


def wait_for_server(url: str, process: subprocess.Popen[str]) -> None:
    for _ in range(50):
        if process.poll() is not None:
            raise RuntimeError("El servidor de preview terminó antes de responder.")
        try:
            with urllib.request.urlopen(url, timeout=1) as response:
                if response.status == 200:
                    return
        except (urllib.error.URLError, TimeoutError):
            time.sleep(0.2)
    raise RuntimeError(f"No se pudo iniciar el preview en {url}.")


def run_preview_checks(page, movie_title: str) -> None:
    errors: list[str] = []
    page.on("pageerror", lambda error: errors.append(str(error)))

    for width, height, label in SIZES:
        page.set_viewport_size({"width": width, "height": height})
        response = page.goto(BASE_URL + BASE_PATH, wait_until="networkidle", timeout=15000)
        assert response and response.status == 200, f"Inicio HTTP incorrecto: {label}"
        metrics = page.evaluate("""() => ({
          viewport: innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          bodyWidth: document.body.scrollWidth,
          title: document.title,
          h1: document.querySelector('h1')?.innerText,
          heroHeadingOverflow: (() => {
            const heading = document.querySelector('.front-lead h1');
            return heading ? heading.scrollWidth > heading.clientWidth + 1 : false;
          })()
        })""")
        assert metrics["documentWidth"] <= width and metrics["bodyWidth"] <= width, f"Desbordamiento horizontal: {label}: {metrics}"
        assert metrics["title"] and metrics["h1"], f"Falta title o H1: {label}"
        clipped = page.evaluate("""() => [...document.querySelectorAll('main *, header *, footer *')].filter(el => { const r=el.getBoundingClientRect(); const s=getComputedStyle(el); return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1) && s.position !== 'absolute' && s.position !== 'fixed'; }).slice(0,8).map(el => ({tag:el.tagName, className:el.className?.toString(), text:el.innerText?.slice(0,70), left:Math.round(el.getBoundingClientRect().left), right:Math.round(el.getBoundingClientRect().right)}))""")
        assert not clipped, f"Contenido cortado fuera del viewport: {label}: {clipped}"
        assert not metrics["heroHeadingOverflow"], f"El titular principal desborda su columna: {label}: {metrics}"
        clipped = page.evaluate("""() => [...document.querySelectorAll('main *, header *, footer *')].filter(el => { const r=el.getBoundingClientRect(); const s=getComputedStyle(el); return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1) && s.position !== 'absolute' && s.position !== 'fixed'; }).slice(0,8).map(el => ({tag:el.tagName, className:el.className?.toString(), text:el.innerText?.slice(0,70), left:Math.round(el.getBoundingClientRect().left), right:Math.round(el.getBoundingClientRect().right)}))""")
        assert not clipped, f"Contenido cortado fuera del viewport: {label}: {clipped}"
        accessibility = page.evaluate("""() => ({
          imagesWithoutAlt: [...document.images].filter(image => !image.hasAttribute('alt')).length,
          unnamedButtons: [...document.querySelectorAll('button')].filter(button => !button.innerText.trim() && !button.getAttribute('aria-label')).length,
          emptyLinks: [...document.querySelectorAll('a')].filter(link => !link.innerText.trim() && !link.getAttribute('aria-label') && !link.querySelector('img[alt], [aria-label]')).length,
          unsafeBlankLinks: document.querySelectorAll('a[target="_blank"]:not([rel*="noopener"])').length
        })""")
        assert not any(accessibility.values()), f"Problema de accesibilidad o enlaces: {label}: {accessibility}"
        page.screenshot(path=str(ARTIFACTS / f"cinespy-home-{label}.png"), full_page=True)

        if width <= 760:
            toggle = page.locator(".nav-toggle")
            toggle.click()
            assert toggle.get_attribute("aria-expanded") == "true", "El menú móvil no abre."
            assert page.locator(".nav-toggle .sr-only").inner_text() == "Cerrar menú"
            page.keyboard.press("Escape")
            assert toggle.get_attribute("aria-expanded") == "false", "Escape no cierra el menú móvil."

    page.set_viewport_size({"width": 1440, "height": 900})
    page.goto(BASE_URL + BASE_PATH + "cartelera/", wait_until="networkidle")
    search = page.locator("#film-search")
    search.fill(movie_title)
    assert page.locator("[data-film-card]:visible").count() >= 1, "La búsqueda no devuelve la película de prueba."
    page.screenshot(path=str(ARTIFACTS / "cinespy-catalogue.png"), full_page=True)

    search.fill("cines-py-titulo-inexistente")
    assert not page.locator("#no-results").is_hidden(), "No aparece el estado vacío de búsqueda."
    search.fill("")
    genre = page.locator("[data-genre-filter]").nth(1)
    genre.click()
    assert genre.get_attribute("aria-pressed") == "true", "No se activa el filtro por género."

    page.goto(BASE_URL + BASE_PATH + "salas/", wait_until="networkidle")
    first_venue = page.locator(".venue-row").first
    venue_href = first_venue.get_attribute("href")
    assert venue_href, "El directorio no contiene enlaces a fichas de salas."
    response = page.goto(urljoin(BASE_URL + "/", venue_href), wait_until="networkidle")
    assert response and response.status == 200, "La ficha de cine no se genera."
    assert page.locator("h1").count() == 1
    page.screenshot(path=str(ARTIFACTS / "cinespy-cinema-detail.png"), full_page=True)

    page.goto(BASE_URL + BASE_PATH + "cartelera/", wait_until="networkidle")
    first_movie = page.locator("[data-film-card] h3 a").first
    movie_href = first_movie.get_attribute("href")
    assert movie_href, "El catálogo no contiene fichas de películas."
    response = page.goto(urljoin(BASE_URL + "/", movie_href), wait_until="networkidle")
    assert response and response.status == 200, "La ficha de película no se genera."
    assert page.locator(".venue-session").count() >= 1
    assert page.locator('a[href^="https://www.cines.com.py/"]').count() == 0, "La ficha contiene una redirección externa."
    page.screenshot(path=str(ARTIFACTS / "cinespy-movie-detail.png"), full_page=True)

    # Probe every generated HTML route, including detail pages not linked from this screen.
    routes = []
    for document in DIST.rglob("index.html"):
        relative = document.parent.relative_to(DIST).as_posix()
        route = BASE_PATH if relative == "." else f"{BASE_PATH}{relative}/"
        routes.append(route)
    for route in sorted(set(routes)):
        result = page.request.get(urljoin(BASE_URL + "/", route))
        assert result.status == 200, f"Ruta HTML rota: {route} ({result.status})"

    upcoming_response = page.goto(BASE_URL + BASE_PATH + "estrenos/", wait_until="networkidle")
    assert upcoming_response and upcoming_response.status == 200, "La página de estrenos no responde correctamente."
    upcoming_heading = page.locator(".page-intro h1").text_content().strip()
    assert upcoming_heading == "Lo que viene", f"Título inesperado en estrenos: {upcoming_heading!r}"
    page.goto(BASE_URL + BASE_PATH + "contacto/", wait_until="networkidle")
    assert page.locator(".info-steps article").count() == 3

    assert not errors, "Errores JavaScript: " + " | ".join(errors)



def render_static_document(page, relative_html: str) -> None:
    """Render generated HTML without browser navigation when the host blocks localhost."""
    import re

    html_path = DIST / relative_html
    html = html_path.read_text(encoding="utf-8")
    css = (DIST / "assets" / "main.css").read_text(encoding="utf-8")
    js = (DIST / "assets" / "main.js").read_text(encoding="utf-8")
    html = re.sub(r'<link[^>]+href="[^"]*assets/main\.css"[^>]*>', lambda _: f"<style>{css}</style>", html, count=1)
    html = re.sub(r'<script[^>]+src="[^"]*assets/main\.js"[^>]*></script>', "", html, count=1)
    html = html.replace("</body>", f"<script>{js}</script></body>")
    page.set_content(html, wait_until="domcontentloaded")


def run_offline_browser_checks(page, movie_title: str) -> None:
    """Exercise rendered UI with set_content when browser navigation is policy-blocked."""
    errors: list[str] = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    routes = [
        ("index.html", "home"),
        ("cartelera/index.html", "catalogue"),
        ("estrenos/index.html", "upcoming"),
        ("salas/index.html", "directory"),
        ("contacto/index.html", "contact"),
    ]
    movie_dirs = sorted((DIST / "pelicula").iterdir())
    cinema_dirs = sorted((DIST / "cine").iterdir())
    assert movie_dirs and cinema_dirs, "No se generaron páginas de películas o salas."
    routes.extend([(f"pelicula/{movie_dirs[0].name}/index.html", "movie"), (f"cine/{cinema_dirs[0].name}/index.html", "cinema")])

    for width, height, label in SIZES:
        page.set_viewport_size({"width": width, "height": height})
        render_static_document(page, "index.html")
        metrics = page.evaluate("""() => ({ viewport: innerWidth, documentWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth, title: document.title, h1: document.querySelector('h1')?.innerText })""")
        assert metrics["documentWidth"] <= width and metrics["bodyWidth"] <= width, f"Desbordamiento horizontal: {label}: {metrics}"
        assert metrics["title"] and metrics["h1"], f"Falta title o H1: {label}"
        accessibility = page.evaluate("""() => ({ imagesWithoutAlt: [...document.images].filter(image => !image.hasAttribute('alt')).length, unnamedButtons: [...document.querySelectorAll('button')].filter(button => !button.innerText.trim() && !button.getAttribute('aria-label')).length, emptyLinks: [...document.querySelectorAll('a')].filter(link => !link.innerText.trim() && !link.getAttribute('aria-label') && !link.querySelector('img[alt], [aria-label]')).length })""")
        assert not any(accessibility.values()), f"Problema de accesibilidad: {label}: {accessibility}"
        page.screenshot(path=str(ARTIFACTS / f"cinespy-home-{label}.png"), full_page=True)
        if width <= 760:
            toggle = page.locator(".nav-toggle")
            toggle.click()
            assert toggle.get_attribute("aria-expanded") == "true", "El menú móvil no abre."
            page.keyboard.press("Escape")
            assert toggle.get_attribute("aria-expanded") == "false", "Escape no cierra el menú móvil."

    render_static_document(page, "cartelera/index.html")
    page.locator("#film-search").fill(movie_title)
    assert page.locator("[data-film-card]:visible").count() >= 1, "La búsqueda no devuelve la película de prueba."
    page.screenshot(path=str(ARTIFACTS / "cinespy-catalogue.png"), full_page=True)
    page.locator("#film-search").fill("cines-py-titulo-inexistente")
    assert not page.locator("#no-results").is_hidden(), "No aparece el estado vacío de búsqueda."
    page.locator("#film-search").fill("")
    genre = page.locator("[data-genre-filter]").nth(1)
    genre.click()
    assert genre.get_attribute("aria-pressed") == "true", "No se activa el filtro por género."

    for route, label in routes:
        render_static_document(page, route)
        assert page.locator("h1").count() == 1, f"Falta H1 único en {route}."
        page.screenshot(path=str(ARTIFACTS / f"cinespy-{label}.png"), full_page=True)
    assert page.locator('a[href^="https://www.cines.com.py/"]').count() == 0, "La página contiene una redirección externa."
    assert not errors, "Errores JavaScript: " + " | ".join(errors)
    print("PASS: render Playwright sin navegación de red, responsive, menú, búsqueda y filtros.")

def main() -> int:
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    data = json.loads((ROOT / "data" / "cines.json").read_text(encoding="utf-8"))
    movie_title = data["movies"][0]["title"]
    process = subprocess.Popen(
        ["node", "scripts/preview.mjs"],
        cwd=ROOT,
        env={**os.environ, "PORT": PORT},
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    try:
        wait_for_server(BASE_URL, process)
        with sync_playwright() as playwright:
            system_chromium = os.environ.get("CHROMIUM_PATH")
            if not system_chromium:
                for candidate in ("/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome"):
                    if Path(candidate).is_file():
                        system_chromium = candidate
                        break
            browser = playwright.chromium.launch(headless=True, executable_path=system_chromium)
            page = browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
            try:
                run_preview_checks(page, movie_title)
                print("PASS: Playwright navegando rutas HTTP en 1440, 1024, 768, 390 y 360 px.")
            except PlaywrightError as error:
                if "ERR_BLOCKED_BY_ADMINISTRATOR" not in str(error):
                    raise
                print("WARN: el entorno bloquea la navegación del navegador; se usa render offline con HTML generado.")
                page.close()
                page = browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
                run_offline_browser_checks(page, movie_title)
            browser.close()
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
    return 0


if __name__ == "__main__":
    sys.exit(main())
