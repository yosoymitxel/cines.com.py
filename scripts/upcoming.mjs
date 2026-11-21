export function extractUpcoming(html) {
  const clean = value => value
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#039;|&apos;/gi, "'")
    .replace(/&aacute;/gi, 'á').replace(/&eacute;/gi, 'é')
    .replace(/&iacute;/gi, 'í').replace(/&oacute;/gi, 'ó')
    .replace(/&uacute;/gi, 'ú').replace(/&ntilde;/gi, 'ñ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/\s+/g, ' ')
    .trim();

  // Cines.com.py uses h3 for the film title, h2 for its release date and a
  // paragraph for the synopsis. Keep the synopsis attached to that film.
  const blocks = [...html.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3\b|$)/gi)];
  const items = [];
  for (const block of blocks) {
    const title = clean(block[1]);
    const remainder = block[2];
    const dateHeading = remainder.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i);
    if (!title || !dateHeading || title.length > 120 || /cartelera|estrenos|principal/i.test(title)) continue;
    const date = clean(dateHeading[1]);
    if (!/\b\d{1,2}\s+de\s+[a-záéíóú]+(?:\s+de\s+\d{4})?/i.test(date)) continue;
    const afterDate = remainder.slice(dateHeading.index + dateHeading[0].length);
    const synopsis = afterDate.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
    const description = clean(synopsis?.[1] || '').slice(0, 420);
    if (!items.some(item => item.title.toLocaleLowerCase('es') === title.toLocaleLowerCase('es'))) {
      items.push({ title, date, description });
    }
  }
  return items;
}

export function isFutureRelease(item, now = new Date()) {
  const match = String(item.date || '').match(/(\d{1,2})\s+de\s+([a-záéíóú]+)(?:\s+de\s+(\d{4}))?/i);
  if (!match) return true;
  const months = { enero:0, febrero:1, marzo:2, abril:3, mayo:4, junio:5, julio:6, agosto:7, septiembre:8, setiembre:8, octubre:9, noviembre:10, diciembre:11 };
  const month = months[match[2].toLocaleLowerCase('es')];
  if (month == null) return true;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Asuncion', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(now).reduce((result, part) => ({ ...result, [part.type]: Number(part.value) }), {});
  const today = new Date(parts.year, parts.month - 1, parts.day);
  let year = Number(match[3] || parts.year);
  let release = new Date(year, month, Number(match[1]));
  if (!match[3] && release < today) {
    year += 1;
    release = new Date(year, month, Number(match[1]));
  }
  return release >= today;
}
