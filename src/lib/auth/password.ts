// 密码策略校验。
// 详细说明见 dev doc v1.1 15.4 节。
// - 最低 8 位
// - 必须包含大写、小写、数字
// - 用 zxcvbn 检测常见弱口令
import zxcvbn from "zxcvbn";

export interface PasswordValidation {
  ok: boolean;
  errors: string[];
  score: number;       // 0-4，越高越强
  warning?: string;
}

const COMMON_WEAK = new Set([
  "password", "12345678", "123456789", "qwerty", "abc12345",
  "password1", "iloveyou", "admin123", "welcome1",
]);

export function validatePassword(password: string): PasswordValidation {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("密码至少 8 位");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("密码必须包含小写字母");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("密码必须包含大写字母");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("密码必须包含数字");
  }
  if (COMMON_WEAK.has(password.toLowerCase())) {
    errors.push("密码太常见，请换一个");
  }

  const result = zxcvbn(password);
  const score = result.score;

  if (score < 2 && errors.length === 0) {
    errors.push("密码强度太低，请使用更复杂的组合");
  }

  return {
    ok: errors.length === 0,
    errors,
    score,
    warning: result.feedback.warning,
  };
}

// 生成 16 位随机密码（仅字母数字）
export function generateRandomPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let result = "";
  for (let i = 0; i < 16; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}
