// NextAuth.js v5（Auth.js）鉴权。
// 详细说明见 dev doc v1.1 15.4 节。
// 项目级权限仍走 getUserProjectRole() 应用层判断（见下文）。

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "./db";
import { audit } from "./audit/logger";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 24 * 60 * 60 },
  providers: [
    Credentials({
      async authorize(creds) {
        const parsed = credentialsSchema.safeParse(creds);
        if (!parsed.success) return null;

        // Rate limit 检查（动态 import，避免 middleware 沙箱报错）
        const { checkAndIncrementSigninFails } = await import("./auth/rate-limit");
        const rl = await checkAndIncrementSigninFails(parsed.data.email, false);
        if (rl.locked) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email, active: true },
        });
        if (!user?.passwordHash) {
          await checkAndIncrementSigninFails(parsed.data.email, true);
          return null;
        }

        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) {
          await checkAndIncrementSigninFails(parsed.data.email, true);
          return null;
        }

        // 成功 → 清零
        await checkAndIncrementSigninFails(parsed.data.email, false, true);

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
        return {
          id: user.id,
          email: user.email,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = user.role;
        token.mustChangePassword = user.mustChangePassword;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId ?? "";
      session.user.role = token.role ?? "MEMBER";
      session.user.mustChangePassword = token.mustChangePassword ?? false;
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      await audit("USER_LOGIN", { userId: user.id, metadata: { provider: "credentials" } });
    },
    async signOut(message) {
      // NextAuth v5 signOut 事件签名在 JWT 策略下有 token
      const token = "token" in message ? message.token : null;
      const userId = (token?.userId as string | undefined) ?? null;
      await audit("USER_LOGOUT", { userId });
    },
  },
  pages: { signIn: "/login", error: "/login" },
});

// ============= 项目级权限 =============

import type { ProjectRole, UserRole } from "@prisma/client";

export async function getUserProjectRole(
  userId: string,
  userRole: UserRole,
  projectId: string,
): Promise<ProjectRole | null> {
  // ADMIN 默认拥有所有项目 OWNER 权限
  if (userRole === "ADMIN") return "OWNER";

  const membership = await prisma.userProject.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });
  return membership?.role ?? null;
}

export async function requireProjectRole(
  userId: string,
  userRole: UserRole,
  projectId: string,
  allowed: ProjectRole[],
): Promise<void> {
  const role = await getUserProjectRole(userId, userRole, projectId);
  if (!role || !allowed.includes(role)) {
    throw new Error("Forbidden");
  }
}
