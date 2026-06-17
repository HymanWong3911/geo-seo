"use client";

import React from "react";
import { ConfigProvider, App } from "antd";
import { themeConfig, darkThemeConfig } from "./theme";

interface AntdProviderProps {
  children: React.ReactNode;
  isDark?: boolean;
}

export function AntdProvider({ children, isDark = false }: AntdProviderProps) {
  const config = isDark ? { ...themeConfig, ...darkThemeConfig, algorithm: undefined } : themeConfig;

  return (
    <ConfigProvider theme={config}>
      <App>{children}</App>
    </ConfigProvider>
  );
}

export { themeConfig, darkThemeConfig };
