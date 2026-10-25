import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";
import { collect } from "./collect.js";
import { detect } from "./detectors.js";
import { findIssues } from "./issues.js";
import { unreachableReason } from "./reachability.js";
import { csvHeader, csvRow, renderMarkdown, type SiteResult } from "./report.js";
import { domainOf, isStopped, normalizeUrl, parseList, parseStoplist } from "./urls.js";

const CONCURRENCY = 3;
const DEFAULT_STOPLIST = "stoplist.local.txt";

interface Options {
  readonly targets: readonly string[];
  readonly stoplistPath: string;
  readonly outDir: string;
}

const USAGE = `Использование:
  pnpm scan <сайт или файл со списком> [ещё сайты...] [--stoplist файл] [--out папка]

Примеры:
  pnpm scan example.com
  pnpm scan sites.txt --out out/batch

Стоп-лист по умолчанию: ${DEFAULT_STOPLIST} (один домен в строке). Эти сайты не проверяются.`;

function parseArgs(argv: readonly string[]): Options {
  const flag = (name: string) => {
    const i = argv.indexOf(name);
    if (i < 0) return undefined;
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) {
      console.error(`У флага ${name} нет значения.\n\n${USAGE}`);
      process.exit(1);
    }
    return value;
  };
  const flagValues = new Set(["--stoplist", "--out"].map(flag).filter(Boolean));
  const targets = argv.filter((a) => !a.startsWith("--") && !flagValues.has(a));
  return {
    targets,
    stoplistPath: flag("--stoplist") ?? DEFAULT_STOPLIST,
    outDir: flag("--out") ?? join("out", new Date().toISOString().slice(0, 10)),
  };
}

async function resolveUrls(targets: readonly string[]): Promise<string[]> {
  const lists = await Promise.all(
    targets.map(async (t) => (existsSync(t) ? parseList(await readFile(t, "utf8")) : [normalizeUrl(t)].filter((u): u is string => u !== null))),
  );
  return [...new Set(lists.flat())];
}

async function runPool<T, R>(items: readonly T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index] as T);
    }
  });
  await Promise.all(lanes);
  return results;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (options.targets.length === 0) {
    console.error(USAGE);
    process.exit(1);
  }

  const stoplist = existsSync(options.stoplistPath) ? parseStoplist(await readFile(options.stoplistPath, "utf8")) : new Set<string>();
  const all = await resolveUrls(options.targets);
  const skipped = all.filter((u) => isStopped(u, stoplist));
  const urls = all.filter((u) => !isStopped(u, stoplist));

  if (skipped.length) console.log(`Пропущено по стоп-листу: ${skipped.map(domainOf).join(", ")}`);
  if (urls.length === 0) {
    console.error("Нечего проверять.");
    process.exit(1);
  }

  await mkdir(options.outDir, { recursive: true });
  const checkedAt = new Date().toLocaleString("ru-RU", { dateStyle: "long", timeStyle: "short" });
  const browser = await chromium.launch();

  try {
    const results = await runPool(urls, CONCURRENCY, async (url): Promise<SiteResult> => {
      const capture = await collect(browser, url);
      const detection = detect(capture);
      const unreachable = unreachableReason(capture);
      const result: SiteResult = { capture, detection, issues: findIssues(detection, unreachable), unreachable };
      const file = join(options.outDir, `${domainOf(url)}.md`);
      await writeFile(file, renderMarkdown(result, checkedAt));
      const high = result.issues.filter((i) => i.severity === "high").length;
      console.log(
        unreachable
          ? `✗ ${domainOf(url)} — не проверен: ${unreachable}`
          : `✓ ${domainOf(url)} — замечаний ${result.issues.length}, критичных ${high}`,
      );
      return result;
    });

    const csv = [csvHeader(), ...results.map(csvRow)].join("\n");
    await writeFile(join(options.outDir, "summary.csv"), `﻿${csv}\n`);
    console.log(`\nГотово: ${results.length} сайтов. Отчёты и summary.csv в ${options.outDir}`);
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
