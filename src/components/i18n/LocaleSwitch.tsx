"use client";

import { useI18n, LOCALE_LABELS, type Locale } from "@/lib/i18n";

export function LocaleSwitch() {
  const { locale, setLocale } = useI18n();
  return (
    <div className="inline-flex items-center border border-border font-mono text-[10px] uppercase tracking-[0.15em]">
      {(Object.keys(LOCALE_LABELS) as Locale[]).map((l, i) => (
        <button
          key={l}
          onClick={() => setLocale(l)}
          className={`px-2.5 py-1 transition-colors ${
            l === locale
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          } ${i > 0 ? "border-l border-border" : ""}`}
        >
          {LOCALE_LABELS[l]}
        </button>
      ))}
    </div>
  );
}