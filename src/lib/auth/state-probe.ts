import { prisma } from "@/lib/db";

export interface AuthStateProbeSnapshot {
  id: string;
  active: boolean;
  mustChangePassword: boolean;
}

export type AuthStateProbeResult =
  | {
      status: "available";
      state: AuthStateProbeSnapshot | null;
    }
  | {
      status: "unavailable";
      reason: "timeout" | "error";
    };

export type AuthStateProbeLoader = (
  userId: string,
) => Promise<AuthStateProbeSnapshot | null>;

const DEFAULT_TIMEOUT_MS = 500;
const MIN_TIMEOUT_MS = 50;
const MAX_TIMEOUT_MS = 5_000;

class AuthStateProbeTimeoutError extends Error {
  constructor() {
    super("authoritative auth state probe timed out");
    this.name = "AuthStateProbeTimeoutError";
  }
}

export async function loadAuthoritativeAuthState(
  userId: string,
): Promise<AuthStateProbeSnapshot | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      active: true,
      mustChangePassword: true,
    },
  });
}

export function authStateProbeTimeoutMs(
  rawValue = process.env.AUTH_STATE_PROBE_TIMEOUT_MS,
): number {
  if (rawValue === undefined || rawValue === "") return DEFAULT_TIMEOUT_MS;

  const parsed = Number(rawValue);
  if (!Number.isSafeInteger(parsed)) return DEFAULT_TIMEOUT_MS;

  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, parsed));
}

export async function readAuthStateProbe(options: {
  userId: string;
  timeoutMs?: number;
  load?: AuthStateProbeLoader;
}): Promise<AuthStateProbeResult> {
  const userId = options.userId.trim();
  if (userId.length === 0 || userId.length > 128) {
    return { status: "unavailable", reason: "error" };
  }

  const timeoutMs = Math.min(
    MAX_TIMEOUT_MS,
    Math.max(MIN_TIMEOUT_MS, options.timeoutMs ?? authStateProbeTimeoutMs()),
  );
  const load = options.load ?? loadAuthoritativeAuthState;
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const state = await Promise.race([
      load(userId),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new AuthStateProbeTimeoutError()), timeoutMs);
      }),
    ]);

    return { status: "available", state };
  } catch (error) {
    return {
      status: "unavailable",
      reason: error instanceof AuthStateProbeTimeoutError ? "timeout" : "error",
    };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
