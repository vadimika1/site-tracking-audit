import type { PageCapture } from "./types.js";

/** Меньше этого на странице почти наверняка заглушка, капча или блок, а не сайт. */
const MIN_TEXT_CHARS = 400;
const MIN_LINKS = 5;
/** Страницы проверки на бота бывают длинными и со ссылками — ловим их по тексту. */
const CHALLENGE_TEXT_MAX_CHARS = 3000;
const CHALLENGE_PATTERN =
  /checking your browser|just a moment|ddos-guard|cloudflare ray id|attention required|access denied|verify you are human|проверка браузера|подтвердите, что вы не робот|вы не робот|доступ (к сайту )?запрещ|проверяем ваш браузер/i;

/**
 * Почему по странице нельзя делать выводы. Любой вывод «нет аналитики» по заглушке
 * будет ложным, поэтому такие сайты уходят на ручную проверку.
 */
export function unreachableReason(page: PageCapture): string | undefined {
  if (page.error) return page.error;
  if (page.status !== null && page.status >= 400) {
    return `сервер ответил ${page.status}: сайт закрыт для автоматической проверки, посмотреть вручную`;
  }
  const text = page.text.trim();
  if (text.length < CHALLENGE_TEXT_MAX_CHARS && CHALLENGE_PATTERN.test(text)) {
    return "открылась проверка на бота или блокировка, посмотреть вручную";
  }
  if (text.length < MIN_TEXT_CHARS && page.links.length < MIN_LINKS) {
    return "страница похожа на заглушку или защиту от ботов, посмотреть вручную";
  }
  return undefined;
}
