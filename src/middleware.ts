// 路由级权限校验。
// 详细说明见 dev doc v1.2 15.4 节。
//
// NextAuth/Jose 需要完整的 Node.js crypto/compression API；Next 15.5 已稳定
// 支持 Node.js middleware，因此显式选择 nodejs runtime。

import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  authStateProbeTimeoutMs,
  readAuthStateProbe,
} from "@/lib/auth/state-probe";

const AUTH_STATE_PROBE_PATH = "/api/__auth-state-boundary-feasibility";

function probeRequestIsAuthorized(req: Request): boolean {
  const expected = process.env.AUTH_STATE_PROBE_KEY;
  const supplied = req.headers.get("x-auth-state-probe-key");
  return Boolean(expected && expected.length >= 16 && supplied === expected);
}

async function handleAuthStateProbe(req: Request): Promise<Response> {
  if (!probeRequestIsAuthorized(req)) {
    return NextResponse.json(
      { data: null, error: { code: "NOT_FOUND", message: "Not found" } },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  const userId = req.headers.get("x-auth-state-probe-user-id") ?? "";
  const result = await readAuthStateProbe({
    userId,
    timeoutMs: authStateProbeTimeoutMs(),
  });

  if (result.status === "unavailable") {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "AUTH_STATE_UNAVAILABLE",
          message: "Authoritative auth state is unavailable",
        },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      data: {
        found: result.state !== null,
        active: result.state?.active ?? null,
        mustChangePassword: result.state?.mustChangePassword ?? null,
      },
      error: null,
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

const PUBLIC_PATHS = [
  "/login",
  "/reset-password",
  "/forgot-password",
];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.some((p) => pathname === p)) return true;
  if (pathname.startsWith("/api/auth/")) return true;
  if (pathname.startsWith("/api/health")) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname === "/favicon.ico") return true;
  return false;
}

export default async function middleware(req: Request) {
  const url = new URL(req.url);
  const { pathname } = url;

  if (
    pathname === AUTH_STATE_PROBE_PATH &&
    process.env.AUTH_STATE_PROBE_ENABLED === "1"
  ) {
    return handleAuthStateProbe(req);
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
  });

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { data: null, error: { code: "UNAUTHORIZED", message: "未登录" } },
        { status: 401 },
      );
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (token.mustChangePassword && pathname !== "/change-password") {
    return NextResponse.redirect(new URL("/change-password", req.url));
  }

  if (!token.mustChangePassword && pathname === "/change-password") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
