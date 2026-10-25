import type { PageCapture } from "../src/types.js";

export function capture(overrides: Partial<PageCapture> = {}): PageCapture {
  return {
    inputUrl: "https://example.com",
    finalUrl: "https://example.com/",
    status: 200,
    requests: [],
    html: "<html><body></body></html>",
    text: "",
    links: [],
    formsCount: 0,
    loadMs: 1500,
    ...overrides,
  };
}

export const METRIKA_OK = {
  requests: [
    "https://mc.yandex.ru/metrika/tag.js",
    "https://mc.yandex.ru/watch/12345678?page-url=https%3A%2F%2Fexample.com",
  ],
  html: '<script>ym(12345678, "init", {clickmap:true, webvisor:true});</script>',
};

export const GA4_OK = {
  requests: [
    "https://www.googletagmanager.com/gtag/js?id=G-ABC123XYZ",
    "https://region1.google-analytics.com/g/collect?v=2&tid=G-ABC123XYZ&en=page_view",
  ],
};
