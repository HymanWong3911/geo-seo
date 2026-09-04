"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="zh-CN">
      <body className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <main className="max-w-md px-6 text-center">
          <h1 className="text-2xl font-semibold">页面暂时无法加载</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            错误已记录，请稍后重试；如果问题持续出现，请联系管理员。
          </p>
          <button type="button" className="btn-primary mt-6" onClick={reset}>
            重新加载
          </button>
        </main>
      </body>
    </html>
  );
}
