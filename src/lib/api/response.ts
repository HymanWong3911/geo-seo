// 统一 API 响应格式。
// 详细说明见 dev doc v1.2 9.0 节。
import { NextResponse } from "next/server";

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiMeta {
  page?: number;
  pageSize?: number;
  total?: number;
  requestId?: string;
  [key: string]: unknown;
}

export class HttpError extends Error {
  constructor(
    public code: string,
    public message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function success<T>(data: T, meta?: ApiMeta, status = 200) {
  return NextResponse.json(
    { data, error: null, ...(meta ? { meta } : {}) },
    { status },
  );
}

export function created<T>(data: T, meta?: ApiMeta) {
  return success(data, meta, 201);
}

export function paginated<T>(data: T[], total: number, page: number, pageSize: number) {
  return success(data, { total, page, pageSize });
}

export function fail(code: string, message: string, status: number, details?: unknown) {
  return NextResponse.json(
    { data: null, error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

export function handleError(err: unknown) {
  if (err instanceof HttpError) {
    return fail(err.code, err.message, err.status, err.details);
  }
  if (err instanceof Error) {
    // eslint-disable-next-line no-console
    console.error("[api] unhandled error:", err);
    return fail("INTERNAL_ERROR", "服务器内部错误", 500);
  }
  return fail("INTERNAL_ERROR", "未知错误", 500);
}

// 常用错误快捷方式
export const Errors = {
  unauthorized: () => new HttpError("UNAUTHORIZED", "未登录", 401),
  forbidden: (msg = "无权访问") => new HttpError("FORBIDDEN", msg, 403),
  notFound: (resource = "资源") => new HttpError("NOT_FOUND", `${resource}不存在`, 404),
  badRequest: (msg: string, details?: unknown) => new HttpError("VALIDATION_ERROR", msg, 400, details),
  conflict: (msg: string) => new HttpError("CONFLICT", msg, 409),
  mustChangePassword: () =>
    new HttpError("MUST_CHANGE_PASSWORD", "请先修改初始密码", 403),
  accountLocked: () =>
    new HttpError("ACCOUNT_LOCKED", "账号已被锁定，请 15 分钟后重试", 423),
  invalidCredentials: () =>
    new HttpError("INVALID_CREDENTIALS", "邮箱或密码错误", 401),
  tokenExpired: () =>
    new HttpError("TOKEN_EXPIRED", "链接已过期", 401),
};
