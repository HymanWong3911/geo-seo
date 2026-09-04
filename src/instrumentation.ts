import * as Sentry from "@sentry/nextjs";

function sentryEnabled() {
  return Boolean(process.env.SENTRY_DSN)
    && (process.env.NODE_ENV === "production" || process.env.SENTRY_ENABLED === "true");
}

export async function register() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    enabled: sentryEnabled(),
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,
    ignoreErrors: [
      "TypeError: Failed to fetch",
      "TypeError: Network request failed",
      "AbortError",
      "NEXT_REDIRECT",
    ],
  });
}

export const onRequestError = Sentry.captureRequestError;
