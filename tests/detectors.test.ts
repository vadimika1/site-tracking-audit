import { describe, expect, test } from "vitest";
import { detect } from "../src/detectors.js";
import { capture, GA4_OK, METRIKA_OK } from "./helpers.js";

describe("detect: Яндекс Метрика", () => {
  test("находит счётчик, id, отправленный хит и вебвизор", () => {
    const d = detect(capture(METRIKA_OK));
    expect(d.metrika).toEqual({ present: true, ids: ["12345678"], hitSent: true, webvisor: true });
  });

  test("код есть, но хит не ушёл", () => {
    const d = detect(capture({ requests: ["https://mc.yandex.ru/metrika/tag.js"], html: 'ym(87654321,"init",{})' }));
    expect(d.metrika.present).toBe(true);
    expect(d.metrika.hitSent).toBe(false);
    expect(d.metrika.ids).toEqual(["87654321"]);
  });

  test("два разных счётчика", () => {
    const d = detect(capture({ html: 'ym(11111111,"init",{}); ym(22222222,"init",{})' }));
    expect(d.metrika.ids).toEqual(["11111111", "22222222"]);
  });

  test("хиты чужих счётчиков из виджетов не считаются дублями", () => {
    const d = detect(
      capture({
        html: 'ym(11112222,"init",{})',
        requests: [
          "https://mc.yandex.ru/watch/11112222?x=1",
          "https://mc.yandex.ru/watch/33334444?x=1",
          "https://mc.yandex.ru/watch/55556666?x=1",
        ],
      }),
    );
    expect(d.metrika.ids).toEqual(["11112222"]);
  });

  test("пустая страница — ничего нет", () => {
    const d = detect(capture());
    expect(d.metrika.present).toBe(false);
    expect(d.ga4.present).toBe(false);
  });
});

describe("detect: Google", () => {
  test("GA4 с хитом", () => {
    const d = detect(capture(GA4_OK));
    expect(d.ga4).toEqual({ present: true, ids: ["G-ABC123XYZ"], hitSent: true });
  });

  test("GTM и Google Ads", () => {
    const d = detect(
      capture({
        requests: [
          "https://www.googletagmanager.com/gtm.js?id=GTM-AB12CD",
          "https://www.googletagmanager.com/gtag/js?id=AW-987654321",
          "https://googleads.g.doubleclick.net/pagead/viewthroughconversion/987654321/",
        ],
      }),
    );
    expect(d.gtm.ids).toEqual(["GTM-AB12CD"]);
    expect(d.googleAds).toEqual({ present: true, ids: ["AW-987654321"], hitSent: true });
  });
});

describe("detect: рекламные пиксели", () => {
  test("Meta Pixel без хита", () => {
    const d = detect(
      capture({
        requests: ["https://connect.facebook.net/en_US/fbevents.js"],
        html: "fbq('init', '1234567890123');",
      }),
    );
    expect(d.metaPixel).toEqual({ present: true, ids: ["1234567890123"], hitSent: false });
  });

  test("пиксель VK Рекламы (Top.Mail.ru)", () => {
    const d = detect(
      capture({
        requests: ["https://top-fwz1.mail.ru/js/code.js", "https://top-fwz1.mail.ru/counter?id=3456789;js=na"],
      }),
    );
    expect(d.vkPixel).toEqual({ present: true, ids: ["3456789"], hitSent: true });
  });
});

describe("detect: сервисы и точки конверсии", () => {
  test("коллтрекинг, чат и виджет записи", () => {
    const d = detect(
      capture({
        requests: [
          "https://mod.calltouch.ru/init.js?id=abc",
          "https://code.jivo.ru/widget/xyz",
          "https://w12345.yclients.com/",
        ],
      }),
    );
    expect(d.calltracking).toEqual(["Calltouch"]);
    expect(d.chats).toEqual(["JivoSite"]);
    expect(d.bookingWidgets).toEqual(["YCLIENTS"]);
  });

  test("Ringostat тоже считается коллтрекингом", () => {
    expect(detect(capture({ requests: ["https://script.ringostat.com/v4/ab/cd.js"] })).calltracking).toEqual(["Ringostat"]);
  });

  test("телефоны, мессенджеры, политика, cookie", () => {
    const d = detect(
      capture({
        links: [
          { href: "tel:+70000000000", text: "+7 000 000-00-00" },
          { href: "tel:+70000000001", text: "позвонить" },
          { href: "https://wa.me/70000000000", text: "WhatsApp" },
          { href: "https://t.me/example", text: "Telegram" },
          { href: "/privacy", text: "Политика конфиденциальности" },
        ],
        text: "Мы используем файлы cookie. Принять",
        formsCount: 2,
      }),
    );
    expect(d.telLinks).toBe(2);
    expect(d.messengerLinks).toEqual(["WhatsApp", "Telegram"]);
    expect(d.privacyPolicy).toBe(true);
    expect(d.cookieNotice).toBe(true);
    expect(d.formsCount).toBe(2);
  });

  test("http без шифрования", () => {
    expect(detect(capture({ finalUrl: "http://example.com/" })).https).toBe(false);
  });
});
