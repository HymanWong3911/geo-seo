import { describe, it, expect } from "vitest";
import { Errors, HttpError } from "./response";

describe("HttpError", () => {
  it("captures code, message, status", () => {
    const e = new HttpError("TEST_CODE", "测试消息", 418);
    expect(e.code).toBe("TEST_CODE");
    expect(e.message).toBe("测试消息");
    expect(e.status).toBe(418);
  });
});

describe("Errors factory", () => {
  it("unauthorized", () => {
    const e = Errors.unauthorized();
    expect(e.code).toBe("UNAUTHORIZED");
    expect(e.status).toBe(401);
  });

  it("forbidden with default message", () => {
    const e = Errors.forbidden();
    expect(e.message).toBe("无权访问");
  });

  it("forbidden with custom message", () => {
    const e = Errors.forbidden("自定义");
    expect(e.message).toBe("自定义");
  });

  it("notFound default", () => {
    const e = Errors.notFound();
    expect(e.message).toBe("资源不存在");
  });

  it("notFound with resource name", () => {
    const e = Errors.notFound("用户");
    expect(e.message).toBe("用户不存在");
  });

  it("badRequest with details", () => {
    const e = Errors.badRequest("校验失败", { field: "x" });
    expect(e.status).toBe(400);
    expect(e.details).toEqual({ field: "x" });
  });

  it("mustChangePassword", () => {
    const e = Errors.mustChangePassword();
    expect(e.status).toBe(403);
    expect(e.code).toBe("MUST_CHANGE_PASSWORD");
  });
});
