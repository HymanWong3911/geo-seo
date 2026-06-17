// Rate limit for signin (Redis-based).
// 独立模块，auth.ts 动态 import，避免 middleware 沙箱报错。
import { redis } from "@/lib/queue";

const MAX_FAILS = 5;
const WINDOW_SEC = 15 * 60;

export async function checkAndIncrementSigninFails(
  email: string,
  onFail: boolean,
  reset: boolean = false,
): Promise<{ fails: number; locked: boolean }> {
  const key = `signin:fail:${email}`;
  if (reset) {
    await redis.del(key);
    return { fails: 0, locked: false };
  }
  const current = Number(await redis.get(key)) || 0;
  if (current >= MAX_FAILS) {
    return { fails: current, locked: true };
  }
  if (onFail) {
    const newVal = await redis.incr(key);
    await redis.expire(key, WINDOW_SEC);
    return { fails: newVal, locked: newVal >= MAX_FAILS };
  }
  return { fails: current, locked: false };
}
