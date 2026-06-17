const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
    serverComponentsExternalPackages: ["ioredis", "bullmq", "@prisma/client", "bcryptjs"],
  },
};

const sentryOptions = {
  // 上报所有错误
  errorHandler: (err) => {
    console.error("Unhandled error:", err);
    throw err;
  },
};

module.exports = withSentryConfig(nextConfig, sentryOptions);
