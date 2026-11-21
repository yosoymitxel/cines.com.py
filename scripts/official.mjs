const OFFICIAL_HOSTS = new Set(['cines.com.py', 'www.cines.com.py']);

export const normaliseOfficialName = value => String(value || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('es')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

function decodeHtml(value) {
  return String(value || '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#039;|&apos;/gi, "'")
    .replace(/&aacute;/gi, 'á').replace(/&eacute;/gi, 'é')
    .replace(/&iacute;/gi, 'í').replace(/&oacute;/gi, 'ó')
    .replace(/&uacute;/gi, 'ú').replace(/&ntilde;/gi, 'ñ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

export function extractCinemaLinks(html, baseUrl = 'https://www.cines.com.py/') {
  const links = [];
  const anchorPattern = /<a\b([^>]*?)href\s*=\s*(['"])(.*?)\2([^>]*)>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorPattern)) {
    let url;
    try { url = new URL(decodeHtml(match[3]), baseUrl); } catch { continue; }
    if (!OFFICIAL_HOSTS.has(url.hostname.toLowerCase()) || !/^\/cine\//i.test(url.pathname)) continue;
    const label = decodeHtml(match[5].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')).trim().replace(/^\d+\s*/, '');
    if (!label) continue;
    if (!links.some(link => link.url === url.href)) links.push({ name: label, key: normaliseOfficialName(label), url: url.href });
  }
  return links;
}

function plainLines(html) {
  return decodeHtml(String(html || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<!--([\s\S]*?)-->/g, '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(?:p|div|li|tr|section|article|h[1-6])\s*>/gi, '\n')
    .replace(/<(?:p|div|li|tr|section|article|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .split(/\n+/)
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function headingBlocks(html) {
  const headings = [...String(html || '').matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)];
  return headings.map((heading, index) => ({
    title: decodeHtml(heading[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')).trim(),
    content: html.slice(heading.index + heading[0].length, headings[index + 1]?.index ?? html.length)
  }));
}

function filmFacts(lines) {
  const aliases = [
    ['director', /^(?:DIRECCI[ÓO]N)\s*:?\s*(.+)$/i],
    ['cast', /^(?:ACTORES SECUNDARIOS|ACTORES|VOCES ORIGINALES)\s*:?\s*(.+)$/i],
    ['origin', /^(?:ORIGEN)\s*:?\s*(.+)$/i],
    ['runtime', /^(?:DURACI[ÓO]N)\s*:?\s*(.+)$/i],
    ['rating', /^(?:CALIFICACI[ÓO]N)\s*:?\s*(.+)$/i],
    ['distributor', /^(?:DISTRIBUIDORA)\s*:?\s*(.+)$/i],
    ['genres', /^(?:G[ÉE]NERO)\s*:?\s*(.+)$/i]
  ];
  const result = {};
  for (const line of lines) {
    for (const [key, pattern] of aliases) {
      const match = line.match(pattern);
      if (!match) continue;
      if (key === 'cast' && result.cast) result.cast = `${result.cast}, ${match[1]}`;
      else if (!result[key]) result[key] = match[1].trim();
      break;
    }
  }
  return result;
}

function tariffLines(lines) {
  const tariffs = [];
  let current = null;
  for (const line of lines) {
    const heading = line.match(/^(2D|3D|4D)\s*:?$/i);
    if (heading) {
      current = { format: heading[1].toUpperCase(), lines: [] };
      tariffs.push(current);
      continue;
    }
    if (!current) continue;
    if (/^#\s*$/.test(line) || /^horarios\b/i.test(line) || /^info$/i.test(line)) {
      current = null;
      continue;
    }
    current.lines.push(line);
  }
  return tariffs.filter(block => block.lines.length);
}

export function extractCinemaPageData(html, movies = []) {
  const lines = plainLines(html);
  const blocks = headingBlocks(html);
  const headingTariffs = blocks
    .filter(block => /^(2D|3D|4D)$/i.test(block.title))
    .map(block => ({ format: block.title.toUpperCase(), lines: plainLines(block.content) }))
    .filter(block => block.lines.length);
  // Some Cines cinema pages style 2D/3D/4D as plain text, not semantic headings.
  const tariffs = headingTariffs.length ? headingTariffs : tariffLines(lines);
  const starts = movies.map(movie => {
    const target = normaliseOfficialName(movie.title);
    const index = lines.findIndex(line => {
      const candidate = normaliseOfficialName(line.replace(/^#\s*/, '').replace(/^\d+\s+/, ''));
      return candidate === target || candidate.startsWith(`${target} `);
    });
    return { movie, index };
  }).filter(item => item.index >= 0).sort((a, b) => a.index - b.index);

  const filmDetails = {};
  for (let index = 0; index < starts.length; index++) {
    const current = starts[index];
    const nextIndex = starts[index + 1]?.index ?? lines.length;
    const facts = filmFacts(lines.slice(current.index + 1, nextIndex));
    if (Object.keys(facts).length) filmDetails[current.movie.id] = facts;
  }
  return { tariffs, filmDetails };
}
