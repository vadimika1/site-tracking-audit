import { describe, expect, test } from "vitest";
import { unreachableReason } from "../src/reachability.js";
import { capture } from "./helpers.js";

const REAL_TEXT = "Клиника. ".repeat(80);
const REAL_LINKS = Array.from({ length: 10 }, (_, i) => ({ href: `/p${i}`, text: `p${i}` }));

describe("unreachableReason", () => {
  test("нормальная страница — можно анализировать", () => {
    expect(unreachableReason(capture({ text: REAL_TEXT, links: REAL_LINKS }))).toBeUndefined();
  });

  test("403 — закрыт для проверки, даже если текст есть", () => {
    expect(unreachableReason(capture({ status: 403, text: REAL_TEXT, links: REAL_LINKS }))).toMatch(/403/);
  });

  test("пустая заглушка с кодом 200", () => {
    expect(unreachableReason(capture({ status: 200, text: "Checking your browser", links: [] }))).toMatch(/заглушк|проверка на бота/);
  });

  test("короткая пустая страница без признаков проверки — заглушка", () => {
    expect(unreachableReason(capture({ status: 200, text: "Скоро открытие", links: [] }))).toMatch(/заглушк/);
  });

  test("длинная страница проверки на бота со ссылками", () => {
    const text = `Проверяем ваш браузер. ${"Пожалуйста, подождите несколько секунд. ".repeat(20)}`;
    expect(unreachableReason(capture({ text, links: REAL_LINKS }))).toMatch(/проверка на бота/);
  });

  test("обычный сайт со словом «робот» в длинном тексте не считается блокировкой", () => {
    const text = `Роботизированная хирургия. ${REAL_TEXT.repeat(10)}`;
    expect(unreachableReason(capture({ text, links: REAL_LINKS }))).toBeUndefined();
  });

  test("ошибка сети пробрасывается как есть", () => {
    expect(unreachableReason(capture({ error: "net::ERR_NAME_NOT_RESOLVED" }))).toBe("net::ERR_NAME_NOT_RESOLVED");
  });
});
