"use client";

import * as React from "react";
import { useEffect, useState, createContext, useContext } from "react";
import { zhCN } from "./zh-CN";
import { enUS } from "./en-US";

export type Locale = "zh-CN" | "en-US";

const STORAGE_KEY = "geo-seo:locale";

export const DICTS = {
  "zh-CN": zhCN,
  "en-US": enUS,
};

export type Dict = typeof zhCN;

export const LOCALE_LABELS: Record<Locale, string> = {
  "zh-CN": "中文",
  "en-US": "EN",
};

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Dict;
}

const I18nContext = createContext<I18nContextValue>({
  locale: "zh-CN",
  setLocale: () => {},
  t: zhCN,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("zh-CN");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (stored === "zh-CN" || stored === "en-US") {
      setLocaleState(stored);
    }
  }, []);

  function setLocale(l: Locale) {
    setLocaleState(l);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, l);
    }
  }

  const t = DICTS[locale];
  return React.createElement(
    I18nContext.Provider,
    { value: { locale, setLocale, t } },
    children
  );
}

export function useI18n() {
  return useContext(I18nContext);
}