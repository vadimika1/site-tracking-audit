/** Приводит строку из списка к URL: добавляет https://, отбрасывает пустые и комментарии. */
export function normalizeUrl(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withScheme).toString();
  } catch {
    return null;
  }
}

export function domainOf(url: string): string {
  return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
}

/** Домен в стоп-листе, если совпадает сам или является его поддоменом. */
export function isStopped(url: string, stoplist: ReadonlySet<string>): boolean {
  const domain = domainOf(url);
  return [...stoplist].some((s) => domain === s || domain.endsWith(`.${s}`));
}

export function parseList(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map(normalizeUrl)
    .filter((u): u is string => u !== null);
}

export function parseStoplist(content: string): Set<string> {
  return new Set(parseList(content).map(domainOf));
}
