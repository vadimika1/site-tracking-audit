# site-tracking-audit

Аудит трекинга сайта снаружи. Сканер открывает главную страницу в настоящем браузере (Chromium через Playwright), записывает все сетевые запросы и смотрит, что на сайте стоит и работает ли оно:

- Яндекс Метрика (id счётчика, вебвизор), Google Analytics 4, Google Tag Manager;
- пиксели Google Ads, VK Рекламы (Top.Mail.ru), Meta и TikTok;
- коллтрекинг (Calltouch, CoMagic / UIS, Roistat, Mango Office, Callibri, Ringostat и другие), онлайн-чаты и CRM-виджеты, виджеты онлайн-записи (YCLIENTS, DIKIDI, Fresha, Calendly и другие);
- ссылки на телефоны и мессенджеры, формы, ссылку на политику обработки персональных данных, уведомление о cookie;
- HTTPS и время до готовности страницы.

Главное отличие от «посмотреть исходный код»: проверяется не только наличие кода, но и ушли ли данные. Если код Метрики на странице есть, а хит в `mc.yandex.ru/watch/…` не отправился, это отдельное замечание. То же для GA4, Google Ads, Meta, VK Рекламы и TikTok.

По найденному сканер составляет список замечаний трёх уровней («Критично», «Важно», «Стоит поправить») и пишет отчёт в Markdown на каждый сайт плюс общий `summary.csv`.

## Запуск

Нужны Node.js (проверено на 24) и pnpm.

```bash
pnpm i
npx playwright install chromium        # один раз
pnpm scan example.com                  # один сайт
pnpm scan site-a.example site-b.example --out out/batch
pnpm scan sites.txt --out out/batch    # список из файла
```

В файле со списком — один сайт в строке, строки с `#` пропускаются. Без `--out` отчёты пишутся в `out/<дата>/`: файл `<домен>.md` на каждый сайт и `summary.csv` (открывается в Excel и Numbers). Сайты проверяются по три параллельно.

### Стоп-лист

Домены, которые проверять нельзя, кладутся в `stoplist.local.txt` в корне или в файл, указанный через `--stoplist файл`. Поддомены из стоп-листа тоже пропускаются. Файлы `*.local.txt` в git не попадают.

## Пример вывода

`pnpm scan example.com`:

```text
✓ example.com — замечаний 1, критичных 1

Готово: 1 сайтов. Отчёты и summary.csv в out/2026-10-25
```

`out/2026-10-25/example.com.md` (таблица сокращена):

```markdown
# Аудит трекинга: example.com

Проверено 25 октября 2026 г. в 19:05. Адрес: https://example.com/

## Главное

1. Нет веб-аналитики. Не нашли ни Яндекс Метрику, ни Google Analytics: неизвестно, откуда приходят посетители и какая реклама приводит заявки.

## Что стоит на сайте

| Что | Результат |
| --- | --- |
| Яндекс Метрика | нет |
| Google Analytics 4 | нет |
| Google Tag Manager | нет |
| Meta Pixel | нет |
| Коллтрекинг | нет |
| Виджет записи | нет |
| Телефоны на странице | 0 |
| Формы | 0 |
| Политика ПДн | не нашли |
| Уведомление о cookie | не нашли |
| Готовность главной | 0.5 с |

## Все замечания

- Критично: Нет веб-аналитики. Не нашли ни Яндекс Метрику, ни Google Analytics: …
```

На сайте со счётчиками строка выглядит так: `| Яндекс Метрика | есть, данные уходят (12345678), вебвизор включён |` или `код есть, данных нет`, если хит не ушёл.

## Ограничения

- Проверяется только главная страница и только снаружи. Цели, конверсии и передача продаж внутри Метрики, GA4 и рекламных кабинетов не видны, об этом написано в каждом отчёте.
- Сайт с ответом 4xx/5xx, страницей проверки на бота или заглушкой помечается «не проверен, посмотреть вручную», без выводов о трекинге. Под это правило попадают и очень короткие страницы: меньше 400 символов текста и меньше 5 ссылок.
- Если стоит Google Tag Manager, а Метрика и GA4 при открытии страницы не сработали, сканер не пишет «нет аналитики»: счётчики могут ждать согласия на cookie или быть спрятаны в контейнере. Это надо смотреть в самом GTM.
- Сервисы определяются по известным адресам их скриптов и запросов. Сервис, которого нет в списке в `src/detectors.ts`, не найдётся.
- Скорость — время до готовности страницы (`domcontentloaded`), а не до последней картинки.
- Часть замечаний написана под российский рынок: VK Реклама, 152-ФЗ про политику персональных данных.

## Тесты

```bash
pnpm typecheck
pnpm test
```

Тесты проверяют детекторы, правила замечаний, отчёт, разбор списков и определение заглушек на подготовленных данных страниц. Браузер и сеть для них не нужны.

## English

site-tracking-audit checks a website's tracking setup from the outside. It loads the home page in headless Chromium (Playwright), records every network request and reports which tools are installed: Yandex Metrica, GA4, Google Tag Manager, Google Ads, VK Ads, Meta and TikTok pixels, call tracking, chat and booking widgets, phone and messenger links, forms, privacy policy link, cookie notice, HTTPS and page-ready time. For each tag it also checks whether a hit was actually sent, not just whether the code is present. Output is a Markdown report per site plus `summary.csv`; report text is in Russian. Run with `pnpm i`, `npx playwright install chromium`, `pnpm scan <url>`. Only the home page is checked, from the outside; goals and conversions inside analytics accounts are not visible, and pages behind bot protection are marked for manual review instead of being judged.

## Автор

Вадим Антонович, [vadim.tabletools.ru](https://vadim.tabletools.ru)
