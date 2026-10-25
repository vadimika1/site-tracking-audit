import type { Detection, Issue, PageCapture, Severity, TagDetection } from "./types.js";
import { topIssues } from "./issues.js";
import { domainOf } from "./urls.js";

export interface SiteResult {
  readonly capture: PageCapture;
  readonly detection: Detection;
  readonly issues: readonly Issue[];
  /** Почему выводы по странице делать нельзя; тогда отчёт — только про ручную проверку. */
  readonly unreachable?: string;
}

const SEVERITY_LABEL: Record<Severity, string> = { high: "Критично", medium: "Важно", low: "Стоит поправить" };

function tagCell(t: TagDetection): string {
  if (!t.present) return "нет";
  const ids = t.ids.length ? ` (${t.ids.join(", ")})` : "";
  return `${t.hitSent ? "есть, данные уходят" : "код есть, данных нет"}${ids}`;
}

function listCell(items: readonly string[]): string {
  return items.length ? items.join(", ") : "нет";
}

export function renderMarkdown(result: SiteResult, checkedAt: string): string {
  const { capture, detection: d, issues } = result;
  const domain = domainOf(capture.finalUrl || capture.inputUrl);
  const top = topIssues(issues, 3);

  if (result.unreachable) {
    return [
      `# Аудит трекинга: ${domain}`,
      "",
      `Проверено ${checkedAt}. Адрес: ${capture.inputUrl}`,
      "",
      "## Не проверен автоматически",
      "",
      `Причина: ${result.unreachable}.`,
      "",
      "Выводов о трекинге по этому сайту нет. Открыть вручную в обычном браузере.",
      "",
    ].join("\n");
  }

  const rows: ReadonlyArray<readonly [string, string]> = [
    ["Яндекс Метрика", tagCell(d.metrika) + (d.metrika.webvisor ? ", вебвизор включён" : "")],
    ["Google Analytics 4", tagCell(d.ga4)],
    ["Google Tag Manager", d.gtm.present ? d.gtm.ids.join(", ") : "нет"],
    ["Google Ads", tagCell(d.googleAds)],
    ["VK Реклама / Top.Mail.ru", tagCell(d.vkPixel)],
    ["Meta Pixel", tagCell(d.metaPixel)],
    ["TikTok Pixel", tagCell(d.tiktokPixel)],
    ["Коллтрекинг", listCell(d.calltracking)],
    ["Онлайн-чат / CRM", listCell(d.chats)],
    ["Виджет записи", listCell(d.bookingWidgets)],
    ["Телефоны на странице", String(d.telLinks)],
    ["Мессенджеры", listCell(d.messengerLinks)],
    ["Формы", String(d.formsCount)],
    ["Политика ПДн", d.privacyPolicy ? "есть" : "не нашли"],
    ["Уведомление о cookie", d.cookieNotice ? "есть" : "не нашли"],
    ["Готовность главной", `${(d.loadMs / 1000).toFixed(1)} с`],
  ];

  const lines = [
    `# Аудит трекинга: ${domain}`,
    "",
    `Проверено ${checkedAt}. Адрес: ${capture.finalUrl}`,
    "",
    "## Главное",
    "",
    ...(top.length ? top.map((i, n) => `${n + 1}. ${i.title}. ${i.detail}`) : ["Серьёзных проблем на главной странице не нашли."]),
    "",
    "## Что стоит на сайте",
    "",
    "| Что | Результат |",
    "| --- | --- |",
    ...rows.map(([k, v]) => `| ${k} | ${v} |`),
    "",
    "## Все замечания",
    "",
    ...(issues.length ? issues.map((i) => `- ${SEVERITY_LABEL[i.severity]}: ${i.title}. ${i.detail}`) : ["- Нет."]),
    "",
    "## Ограничения проверки",
    "",
    "Проверена только главная страница, снаружи, без доступа к кабинетам. Цели, конверсии и передача продаж",
    "внутри Метрики, GA4 и рекламных кабинетов извне не видны: их видно только изнутри кабинетов.",
    "",
  ];
  return lines.join("\n");
}

const CSV_HEADER = [
  "domain",
  "final_url",
  "error",
  "metrika",
  "ga4",
  "gtm",
  "google_ads",
  "vk_pixel",
  "meta_pixel",
  "calltracking",
  "booking",
  "chats",
  "high",
  "medium",
  "low",
  "top_issue",
];

function csvEscape(value: string): string {
  return /[",\n;]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function tagFlag(t: TagDetection): string {
  if (!t.present) return "нет";
  return t.hitSent ? "ок" : "без данных";
}

export function csvHeader(): string {
  return CSV_HEADER.join(",");
}

export function csvRow(result: SiteResult): string {
  const { capture, detection: d, issues } = result;
  const count = (s: Severity) => String(issues.filter((i) => i.severity === s).length);
  const values = [
    domainOf(capture.finalUrl || capture.inputUrl),
    capture.finalUrl,
    result.unreachable ?? "",
    tagFlag(d.metrika),
    tagFlag(d.ga4),
    d.gtm.present ? "да" : "нет",
    tagFlag(d.googleAds),
    tagFlag(d.vkPixel),
    tagFlag(d.metaPixel),
    d.calltracking.join(" / "),
    d.bookingWidgets.join(" / "),
    d.chats.join(" / "),
    count("high"),
    count("medium"),
    count("low"),
    topIssues(issues, 1)[0]?.title ?? "",
  ];
  return values.map(csvEscape).join(",");
}
