import { describe, expect, test } from "vitest";
import { detect } from "../src/detectors.js";
import { findIssues } from "../src/issues.js";
import { csvHeader, csvRow, renderMarkdown } from "../src/report.js";
import { capture, METRIKA_OK } from "./helpers.js";

function result(overrides: Parameters<typeof capture>[0]) {
  const c = capture(overrides);
  const detection = detect(c);
  return { capture: c, detection, issues: findIssues(detection, c.error), unreachable: c.error };
}

describe("report", () => {
  test("markdown содержит домен, главное и таблицу", () => {
    const md = renderMarkdown(result({ ...METRIKA_OK, formsCount: 1 }), "23 сентября 2026");
    expect(md).toContain("# Аудит трекинга: example.com");
    expect(md).toContain("## Главное");
    expect(md).toContain("| Яндекс Метрика | есть, данные уходят (12345678), вебвизор включён |");
    expect(md).toContain("Не нашли политику обработки персональных данных");
  });

  test("csv: столько же колонок, сколько в заголовке, запятые экранированы", () => {
    const row = csvRow(result({ ...METRIKA_OK, requests: [...METRIKA_OK.requests, "https://calltouch.ru/x", "https://roistat.com/y"] }));
    const cols = row.match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.filter((c) => c !== "") ?? [];
    expect(cols.length).toBe(csvHeader().split(",").length);
    expect(row).toContain("Calltouch / Roistat");
  });

  test("непроверенный сайт: в отчёте нет таблицы с ложными «нет»", () => {
    const md = renderMarkdown(result({ error: "сервер ответил 403" }), "23 сентября 2026");
    expect(md).toContain("## Не проверен автоматически");
    expect(md).not.toContain("| Яндекс Метрика | нет |");
  });

  test("ошибка загрузки попадает в csv", () => {
    const row = csvRow(result({ error: "net::ERR_NAME_NOT_RESOLVED" }));
    expect(row).toContain("net::ERR_NAME_NOT_RESOLVED");
  });
});
