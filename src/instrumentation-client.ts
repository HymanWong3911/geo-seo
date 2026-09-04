import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const enabled = Boolean(dsn)
  && (process.env.NODE_ENV === "production"
    || process.env.NEXT_PUBLIC_SENTRY_ENABLED === "true");

Sentry.init({
  dsn,
  enabled,
  environment: process.env.NODE_ENV ?? "development",
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,
  ignoreErrors: [
    "TypeError: Failed to fetch",
    "TypeError: Network request failed",
    "AbortError",
    "NEXT_REDIRECT",
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
