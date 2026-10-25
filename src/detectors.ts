import type { Detection, PageCapture, TagDetection } from "./types.js";

type NamedPattern = readonly [name: string, pattern: RegExp];

const CALLTRACKING: readonly NamedPattern[] = [
  ["Calltouch", /calltouch\.ru/i],
  ["CoMagic / UIS", /comagic\.ru|uiscom\.ru/i],
  ["Roistat", /roistat\.com/i],
  ["Mango Office", /mango-office\.ru/i],
  ["Callibri", /callibri\.ru/i],
  ["Alloka", /alloka\.ru/i],
  ["Calltracking.ru", /calltracking\.ru/i],
  ["Ringostat", /ringostat\.(com|net)/i],
  ["Novofon / Zadarma", /novofon\.(ru|com)|zadarma\.com/i],
  ["Sipuni", /sipuni\.com/i],
  ["Телфин", /telphin\.ru/i],
  ["Гравител", /gravitel\.ru/i],
  ["МТС Коллтрекинг", /ct\.mts\.ru|calltracking\.mts/i],
  ["Envybox Calltracking", /envycrm|envybox\.io\/calltracking/i],
];

const CHATS: readonly NamedPattern[] = [
  ["JivoSite", /jivosite\.com|jivo\.ru/i],
  ["Битрикс24", /bitrix24\.(ru|by|com|kz)/i],
  ["amoCRM / Kommo", /amocrm\.ru|kommo\.com/i],
  ["Carrot quest", /carrotquest\.(io|app)/i],
  ["Envybox", /envybox\.io/i],
  ["Wazzup", /wazzup24\./i],
  ["Talk-Me", /talk-me\.ru/i],
  ["Tidio", /tidio\.co/i],
  ["HubSpot", /hs-scripts\.com|hubspot\.com/i],
];

const BOOKING: readonly NamedPattern[] = [
  ["YCLIENTS", /yclients\.com/i],
  ["DIKIDI", /dikidi\.(net|ru)/i],
  ["EasyWeek", /easyweek\./i],
  ["Sonline", /sonline\.su/i],
  ["MedFlex", /medflex\.ru/i],
  // ПроДокторов не в списке: клиники ставят его в основном как значок рейтинга, а не как запись.
  ["Fresha", /fresha\.com/i],
  ["Booksy", /booksy\.com/i],
  ["Calendly", /calendly\.com/i],
  ["Peek", /book\.peek\.com|peek\.com\/widget/i],
  ["FareHarbor", /fareharbor\.com/i],
];

const MESSENGERS: readonly NamedPattern[] = [
  ["WhatsApp", /wa\.me\/|api\.whatsapp\.com|whatsapp:\/\//i],
  ["Telegram", /t\.me\/|tg:\/\//i],
  ["Viber", /viber:\/\//i],
  ["VK", /vk\.me\//i],
  ["MAX", /max\.ru\//i],
];

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function matchAll(sources: readonly string[], pattern: RegExp): string[] {
  const global = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  return unique(sources.flatMap((s) => [...s.matchAll(global)].map((m) => m[1] ?? m[0])));
}

function namesMatching(haystack: string, patterns: readonly NamedPattern[]): string[] {
  return patterns.filter(([, re]) => re.test(haystack)).map(([name]) => name);
}

function tag(present: boolean, ids: readonly string[], hitSent: boolean): TagDetection {
  return { present: present || ids.length > 0 || hitSent, ids, hitSent };
}

export function detect(page: PageCapture): Detection {
  const reqs = page.requests;
  const all = [...reqs, page.html];
  const reqText = reqs.join("\n");
  const everything = `${reqText}\n${page.html}`;
  const has = (re: RegExp) => re.test(everything);
  const sent = (re: RegExp) => re.test(reqText);

  // Свои счётчики — те, что сайт сам инициализирует. Хиты с другими id шлют встроенные виджеты
  // (антифрод, онлайн-запись, квизы): это не дубли сайта, и считать их нельзя.
  const ownMetrikaIds = matchAll([page.html], /ym\(\s*(\d{5,10})\s*,\s*['"]init/);
  const metrikaIds =
    ownMetrikaIds.length > 0 ? ownMetrikaIds : matchAll(reqs, /mc\.yandex\.[a-z]+\/(?:watch|webvisor)\/(\d{5,10})/).slice(0, 1);

  const ga4Ids = unique([
    ...matchAll(reqs, /[?&](?:id|tid)=(G-[A-Z0-9]{4,})/),
    ...matchAll([page.html], /['"](G-[A-Z0-9]{6,})['"]/),
  ]);

  const adsIds = unique([...matchAll(all, /(AW-\d{6,})/)]);
  const metaIds = unique([
    ...matchAll([page.html], /fbq\(\s*['"]init['"]\s*,\s*['"](\d{8,20})['"]/),
    ...matchAll(reqs, /facebook\.com\/tr\/?\?id=(\d{8,20})/),
  ]);
  const vkIds = unique([
    ...matchAll(reqs, /top-fwz1\.mail\.ru\/counter\?id=(\d+)/),
    ...matchAll([page.html], /_tmr\.push\(\s*\{\s*id:\s*['"](\d+)['"]/),
  ]);

  const linkHaystack = page.links.map((l) => `${l.href} ${l.text}`);
  const messengerLinks = MESSENGERS.filter(([, re]) => page.links.some((l) => re.test(l.href))).map(([n]) => n);

  return {
    https: page.finalUrl.startsWith("https://"),
    metrika: {
      ...tag(has(/mc\.yandex\.[a-z]+\/metrika\/(tag|watch)\.js/), metrikaIds, sent(/mc\.yandex\.[a-z]+\/watch\/\d+/)),
      webvisor: /webvisor\s*:\s*true/.test(page.html) || sent(/mc\.yandex\.[a-z]+\/webvisor\/\d+/),
    },
    ga4: tag(false, ga4Ids, sent(/\/g\/collect\?[^\n]*tid=G-/)),
    gtm: tag(false, unique(matchAll(all, /(GTM-[A-Z0-9]{4,})/)), false),
    googleAds: tag(
      false,
      adsIds,
      sent(/googleadservices\.com\/pagead\/conversion|googleads\.g\.doubleclick\.net\/pagead\/(viewthrough)?conversion/),
    ),
    metaPixel: tag(has(/connect\.facebook\.net\/[^/\s]+\/fbevents\.js/), metaIds, sent(/facebook\.com\/tr\/?\?/)),
    vkPixel: tag(has(/top-fwz1\.mail\.ru\/js\/code\.js|vk\.com\/rtrg|VK\.Retargeting/), vkIds, sent(/top-fwz1\.mail\.ru\/counter|vk\.com\/rtrg/)),
    tiktokPixel: tag(has(/analytics\.tiktok\.com/), [], sent(/analytics\.tiktok\.com\/api/)),
    calltracking: namesMatching(everything, CALLTRACKING),
    chats: namesMatching(everything, CHATS),
    bookingWidgets: namesMatching(`${everything}\n${linkHaystack.join("\n")}`, BOOKING),
    cookieNotice: /cookie|куки/i.test(page.text),
    privacyPolicy: linkHaystack.some((s) => /политик|privacy|конфиденциальн|персональн/i.test(s)),
    telLinks: page.links.filter((l) => l.href.startsWith("tel:")).length,
    messengerLinks,
    formsCount: page.formsCount,
    loadMs: page.loadMs,
  };
}
