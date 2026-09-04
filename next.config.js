const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  serverExternalPackages: ["ioredis", "bullmq", "@prisma/client", "bcryptjs"],
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

const sentryOptions = {
  // 未配置上传凭据时仍保留运行时错误采集，但不尝试上传 sourcemap。
  silent: true,
  telemetry: false,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
};

module.exports = withSentryConfig(nextConfig, sentryOptions);
