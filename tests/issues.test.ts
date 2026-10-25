import { describe, expect, test } from "vitest";
import { detect } from "../src/detectors.js";
import { findIssues, topIssues } from "../src/issues.js";
import { capture, GA4_OK, METRIKA_OK } from "./helpers.js";

const titles = (c: ReturnType<typeof capture>) => findIssues(detect(c)).map((i) => i.title);

describe("findIssues", () => {
  test("нет никакой аналитики — критично", () => {
    const issues = findIssues(detect(capture()));
    expect(issues[0]?.severity).toBe("high");
    expect(issues[0]?.title).toMatch(/Нет веб-аналитики/);
  });

  test("только GTM без сработавших счётчиков — не пишем «нет аналитики»", () => {
    const c = capture({ html: "<script>(function(w,d,s,l,i){})(window,document,'script','dataLayer','GTM-ABC1234');</script>" });
    const t = titles(c);
    expect(t.some((x) => /Нет веб-аналитики/.test(x))).toBe(false);
    expect(t).toContain("Метрика и Google Analytics не видны снаружи");
  });

  test("Метрика без отправки данных — критично", () => {
    const c = capture({ requests: ["https://mc.yandex.ru/metrika/tag.js"], html: 'ym(12345678,"init",{})' });
    expect(titles(c)).toContain("Код Яндекс Метрики есть, но данные не отправляются");
  });

  test("исправная Метрика и GA4 — нет замечаний про аналитику", () => {
    const c = capture({
      requests: [...METRIKA_OK.requests, ...GA4_OK.requests],
      html: METRIKA_OK.html,
      links: [{ href: "/policy", text: "Политика обработки персональных данных" }],
      text: "cookie",
    });
    const t = titles(c);
    expect(t.some((x) => /Метрик|Analytics|аналитик/.test(x))).toBe(false);
  });

  test("телефоны без коллтрекинга", () => {
    const c = capture({ ...METRIKA_OK, links: [{ href: "tel:+70000000000", text: "" }] });
    expect(titles(c)).toContain("Звонки не связаны с рекламой");
  });

  test("внешний виджет записи", () => {
    const c = capture({ ...METRIKA_OK, requests: [...METRIKA_OK.requests, "https://n123.yclients.com/"] });
    expect(titles(c)).toContain("Запись идёт через внешний виджет (YCLIENTS)");
  });

  test("нет ссылки на политику ПДн при наличии форм", () => {
    const c = capture({ ...METRIKA_OK, formsCount: 1 });
    expect(titles(c)).toContain("Не нашли политику обработки персональных данных");
  });

  test("сайт не открылся — одна проблема про доступность", () => {
    const issues = findIssues(detect(capture({ error: "timeout" })), "timeout");
    expect(issues).toHaveLength(1);
    expect(issues[0]?.title).toMatch(/не удалось проверить/);
  });
});

describe("topIssues", () => {
  test("сортирует по важности и режет до n", () => {
    const top = topIssues(findIssues(detect(capture({ finalUrl: "http://example.net/", formsCount: 1 }))), 3);
    expect(top).toHaveLength(3);
    expect(top[0]?.severity).toBe("high");
    const order = { high: 0, medium: 1, low: 2 } as const;
    const ranks = top.map((i) => order[i.severity]);
    expect([...ranks].sort()).toEqual(ranks);
  });
});
