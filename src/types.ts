export interface PageLink {
  readonly href: string;
  readonly text: string;
}

/** Всё, что собрано с одной страницы в браузере. Детекторы работают только с этим. */
export interface PageCapture {
  readonly inputUrl: string;
  readonly finalUrl: string;
  readonly status: number | null;
  readonly requests: readonly string[];
  readonly html: string;
  readonly text: string;
  readonly links: readonly PageLink[];
  readonly formsCount: number;
  readonly loadMs: number;
  readonly error?: string;
}

export interface TagDetection {
  readonly present: boolean;
  readonly ids: readonly string[];
  /** Ушёл ли хоть один запрос с данными (хит), а не только загрузился код. */
  readonly hitSent: boolean;
}

export interface Detection {
  readonly https: boolean;
  readonly metrika: TagDetection & { readonly webvisor: boolean };
  readonly ga4: TagDetection;
  readonly gtm: TagDetection;
  readonly googleAds: TagDetection;
  readonly metaPixel: TagDetection;
  readonly vkPixel: TagDetection;
  readonly tiktokPixel: TagDetection;
  readonly calltracking: readonly string[];
  readonly chats: readonly string[];
  readonly bookingWidgets: readonly string[];
  readonly cookieNotice: boolean;
  readonly privacyPolicy: boolean;
  readonly telLinks: number;
  readonly messengerLinks: readonly string[];
  readonly formsCount: number;
  readonly loadMs: number;
}

export type Severity = "high" | "medium" | "low";

export interface Issue {
  readonly severity: Severity;
  readonly title: string;
  readonly detail: string;
}
