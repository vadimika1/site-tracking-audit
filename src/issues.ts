import type { Detection, Issue, Severity } from "./types.js";

const SLOW_LOAD_MS = 5000;
const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

type Rule = (d: Detection) => Issue | null;

const hasAnalytics = (d: Detection) => d.metrika.present || d.ga4.present;
/** GTM может прятать GA4/Метрику внутри контейнера или держать их до согласия на cookie. */
const mayHideAnalytics = (d: Detection) => d.gtm.present;
const adPixels = (d: Detection) =>
  [
    d.googleAds.present && "Google Ads",
    d.metaPixel.present && "Meta",
    d.vkPixel.present && "VK Реклама",
    d.tiktokPixel.present && "TikTok",
  ].filter((x): x is string => Boolean(x));

const RULES: readonly Rule[] = [
  (d) =>
    d.https
      ? null
      : {
          severity: "high",
          title: "Сайт открывается без HTTPS",
          detail: "Браузеры помечают такой сайт как небезопасный, часть посетителей уходит, а рекламные системы хуже доверяют конверсиям.",
        },
  (d) =>
    hasAnalytics(d) || mayHideAnalytics(d)
      ? null
      : {
          severity: "high",
          title: "Нет веб-аналитики",
          detail:
            adPixels(d).length > 0
              ? `Рекламные пиксели стоят (${adPixels(d).join(", ")}), но нет ни Яндекс Метрики, ни Google Analytics: нельзя сравнить каналы и понять, какая реклама приводит заявки.`
              : "Не нашли ни Яндекс Метрику, ни Google Analytics: неизвестно, откуда приходят посетители и какая реклама приводит заявки.",
        },
  (d) =>
    !hasAnalytics(d) && mayHideAnalytics(d)
      ? {
          severity: "low",
          title: "Метрика и Google Analytics не видны снаружи",
          detail: "Стоит Google Tag Manager, но счётчики при открытии страницы не сработали. Они могут ждать согласия на cookie или быть настроены с ошибкой: это надо смотреть в контейнере GTM.",
        }
      : null,
  (d) =>
    d.metrika.present && !d.metrika.hitSent
      ? {
          severity: "high",
          title: "Код Яндекс Метрики есть, но данные не отправляются",
          detail: "Счётчик загружается, но при открытии страницы не ушло ни одного визита. Отчёты Метрики, скорее всего, пустые или неполные.",
        }
      : null,
  (d) =>
    d.ga4.present && !d.ga4.hitSent
      ? {
          severity: "medium",
          title: "Google Analytics установлен, но не отправляет данные",
          detail: "Тег GA4 найден, но просмотр страницы не отправился. Возможно, он ждёт согласия на cookie или настроен с ошибкой.",
        }
      : null,
  (d) =>
    d.metrika.ids.length > 1
      ? {
          severity: "medium",
          title: `Несколько счётчиков Метрики (${d.metrika.ids.length})`,
          detail: `На странице счётчики ${d.metrika.ids.join(", ")}. Если это не осознанное решение, данные дублируются или расходятся между отчётами.`,
        }
      : null,
  (d) =>
    d.ga4.ids.length > 1
      ? {
          severity: "low",
          title: `Несколько потоков Google Analytics (${d.ga4.ids.length})`,
          detail: `Найдены ${d.ga4.ids.join(", ")}. Проверьте, что это не дубль одного и того же потока.`,
        }
      : null,
  (d) =>
    d.metaPixel.present && !d.metaPixel.hitSent
      ? {
          severity: "medium",
          title: "Пиксель Meta загружен, но не срабатывает",
          detail: "Код пикселя есть, событие просмотра не отправилось. Реклама не получает данные для оптимизации.",
        }
      : null,
  (d) =>
    d.telLinks > 0 && d.calltracking.length === 0
      ? {
          severity: "medium",
          title: "Звонки не связаны с рекламой",
          detail: "На сайте есть телефоны, но не нашли коллтрекинг из известных сервисов. Без него звонки с рекламы не отличить от остальных, и часть заявок выпадает из оценки окупаемости.",
        }
      : null,
  (d) =>
    d.bookingWidgets.length > 0
      ? {
          severity: "medium",
          title: `Запись идёт через внешний виджет (${d.bookingWidgets.join(", ")})`,
          detail: "Без отдельной настройки передачи событий записи и оплаты из виджета не попадают в аналитику и рекламные кабинеты. Обычно это главная дыра в оценке рекламы.",
        }
      : null,
  (d) =>
    d.formsCount > 0 && !d.privacyPolicy
      ? {
          severity: "medium",
          title: "Не нашли политику обработки персональных данных",
          detail: "На странице есть формы, но нет ссылки на политику. По 152-ФЗ это риск штрафа, а часть рекламных систем может отклонить объявления.",
        }
      : null,
  (d) =>
    d.messengerLinks.length > 0
      ? {
          severity: "low",
          title: `Переходы в мессенджеры (${d.messengerLinks.join(", ")}) обычно не считаются заявками`,
          detail: "Клик по кнопке WhatsApp или Telegram — часто главная заявка, но без цели в аналитике её не видно. Проверьте, настроены ли такие цели.",
        }
      : null,
  // Яндекс Директу отдельный пиксель не нужен — он работает через Метрику.
  (d) =>
    d.ga4.present && !d.metrika.present && adPixels(d).length === 0
      ? {
          severity: "low",
          title: "Нет пикселей рекламных систем",
          detail: "Не нашли ни Метрику, ни пиксели VK Рекламы, Google Ads и др. Рекламе не на чем учиться, а догонять посетителей сайта нечем.",
        }
      : null,
  (d) =>
    d.metrika.present && !d.vkPixel.present
      ? {
          severity: "low",
          title: "Нет пикселя VK Рекламы",
          detail: "Без него нельзя показывать рекламу в VK тем, кто уже был на сайте, и обучать кампании VK на заявках.",
        }
      : null,
  (d) =>
    hasAnalytics(d) && !d.cookieNotice
      ? {
          severity: "low",
          title: "Нет уведомления о cookie",
          detail: "Аналитика ставит cookie, а уведомления о них на странице не нашли.",
        }
      : null,
  (d) =>
    d.loadMs > SLOW_LOAD_MS
      ? {
          severity: "low",
          title: `Главная открывается медленно (${(d.loadMs / 1000).toFixed(1)} с до готовности страницы)`,
          detail: "Часть посетителей с рекламы уходит до загрузки, за клики при этом уже заплачено.",
        }
      : null,
];

export function findIssues(detection: Detection, loadError?: string): Issue[] {
  if (loadError) {
    return [
      {
        severity: "high",
        title: "Сайт не удалось проверить автоматически",
        detail: `Причина: ${loadError}.`,
      },
    ];
  }
  return sortBySeverity(RULES.map((rule) => rule(detection)).filter((i): i is Issue => i !== null));
}

export function sortBySeverity(issues: readonly Issue[]): Issue[] {
  return [...issues].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

export function topIssues(issues: readonly Issue[], n: number): Issue[] {
  return sortBySeverity(issues).slice(0, n);
}
