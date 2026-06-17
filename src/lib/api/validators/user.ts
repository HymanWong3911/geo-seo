// 用户相关 zod 校验。
import { z } from "zod";
import { UserRole } from "@prisma/client";

export const createUserSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  name: z.string().min(1, "姓名必填").max(100),
  role: z.nativeEnum(UserRole).default("MEMBER"),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.nativeEnum(UserRole).optional(),
  active: z.boolean().optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "请输入当前密码"),
    newPassword: z.string().min(8, "新密码至少 8 位"),
  })
  .strict();

export const firstLoginChangePasswordSchema = z
  .object({
    newPassword: z.string().min(8, "新密码至少 8 位"),
  })
  .strict();

export const resetPasswordByEmailSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordByTokenSchema = z
  .object({
    token: z.string().min(1),
    newPassword: z.string().min(8, "新密码至少 8 位"),
  })
  .strict();
