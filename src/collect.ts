import type { Browser } from "playwright";
import type { PageCapture } from "./types.js";

const NAV_TIMEOUT_MS = 30_000;
/** Многие сайты грузят счётчики с задержкой или после первого движения — ждём и «шевелим» страницу. */
const SETTLE_MS = 4_000;
/** Полную загрузку ждём ограниченно: тяжёлые сайты догружают картинки минутами, а счётчики уже стоят. */
const LOAD_WAIT_MS = 15_000;
/** Обычный десктопный Chrome: с «HeadlessChrome» часть сайтов отдаёт заглушку. */
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

export async function collect(browser: Browser, url: string): Promise<PageCapture> {
  const context = await browser.newContext({
    locale: "ru-RU",
    userAgent: USER_AGENT,
    viewport: { width: 1366, height: 900 },
  });
  const page = await context.newPage();
  const requests: string[] = [];
  page.on("request", (req) => {
    requests.push(req.url());
  });

  const started = Date.now();
  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
    // Время до готовой страницы, а не до последней картинки: заниженная оценка честнее для отчёта.
    const loadMs = Date.now() - started;
    await page.waitForLoadState("load", { timeout: LOAD_WAIT_MS }).catch(() => undefined);

    await page.mouse.move(400, 300);
    await page.mouse.wheel(0, 1200);
    await page.waitForTimeout(SETTLE_MS);
    await page.mouse.wheel(0, -1200);

    const html = await page.content();
    const text = await page.evaluate(() => document.body?.innerText ?? "");
    const links = await page.$$eval("a[href]", (as) =>
      as.map((a) => ({ href: a.getAttribute("href") ?? "", text: (a.textContent ?? "").trim().slice(0, 120) })),
    );
    const formsCount = await page.$$eval("form", (fs) => fs.length);

    return {
      inputUrl: url,
      finalUrl: page.url(),
      status: response?.status() ?? null,
      requests: [...requests],
      html,
      text,
      links,
      formsCount,
      loadMs,
    };
  } catch (error) {
    return {
      inputUrl: url,
      finalUrl: url,
      status: null,
      requests: [...requests],
      html: "",
      text: "",
      links: [],
      formsCount: 0,
      loadMs: Date.now() - started,
      error: error instanceof Error ? error.message.split("\n")[0] : String(error),
    };
  } finally {
    await context.close();
  }
}
