import { describe, expect, test } from "vitest";
import { isStopped, normalizeUrl, parseList, parseStoplist } from "../src/urls.js";

describe("urls", () => {
  test("добавляет https и пропускает комментарии", () => {
    expect(normalizeUrl("clinic.example")).toBe("https://clinic.example/");
    expect(normalizeUrl("  # коммент")).toBeNull();
    expect(normalizeUrl("")).toBeNull();
    expect(parseList("a.example\n\n# x\nhttp://b.example/page")).toEqual(["https://a.example/", "http://b.example/page"]);
  });

  test("стоп-лист ловит домен, www и поддомены, но не похожие домены", () => {
    const stop = parseStoplist("www.client.example\nother.test");
    expect(isStopped("https://client.example/", stop)).toBe(true);
    expect(isStopped("https://msk.client.example/", stop)).toBe(true);
    expect(isStopped("https://www.other.test/x", stop)).toBe(true);
    expect(isStopped("https://notclient.example/", stop)).toBe(false);
  });
});
