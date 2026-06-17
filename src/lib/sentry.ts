// Sentry 错误监控初始化。
// 详细说明见 dev doc v1.2 27.5 节。
import * as Sentry from "@sentry/nextjs";

const isEnabled = 
  process.env.NODE_ENV === "production" || 
  process.env.SENTRY_ENABLED === "true";

export function initSentry() {
  if (!isEnabled || !process.env.SENTRY_DSN) {
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    
    // 性能监控
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    
    // 环境信息
    environment: process.env.NODE_ENV ?? "development",
    
    // 忽略错误
    ignoreErrors: [
      // 网络错误
      "TypeError: Failed to fetch",
      "TypeError: Network request failed",
      // Next.js hydration 警告
      "Warning: ReactDOM.render",
      // 用户取消的操作
      "AbortError",
      // 认证重定向
      "NEXT_REDIRECT",
    ],
    
    // 自定义标签
    beforeSend(event) {
      // 添加额外上下文
      if (event.tags) {
        event.tags.nodeVersion = process.version;
      }
      return event;
    },
  });
}

export { Sentry };
