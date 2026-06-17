// 邮件重置密码：发送重置链接。
// 详细说明见 dev doc v1.2 15.4 节。
import { NextRequest } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { resetPasswordByEmailSchema } from "@/lib/api/validators/user";
import { Errors, handleError, success } from "@/lib/api/response";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = resetPasswordByEmailSchema.safeParse(body);
    if (!parsed.success) {
      throw Errors.badRequest("参数错误", parsed.error.flatten());
    }

    // 不暴露邮箱是否存在：无论用户存不存在都返回 success
    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email, active: true },
    });

    if (user) {
      // 生成 32 字节随机 token，存哈希
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 分钟

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });

      const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
      const link = `${baseUrl}/reset-password?token=${rawToken}`;

      await sendMail({
        to: user.email,
        subject: "重置密码",
        text: `你好，\n\n点击以下链接重置密码（30 分钟内有效）：\n\n${link}\n\n如果不是本人操作，请忽略此邮件。`,
        html: `<p>你好，</p><p>点击以下链接重置密码（30 分钟内有效）：</p><p><a href="${link}">${link}</a></p><p>如果不是本人操作，请忽略此邮件。</p>`,
      });
    }

    return success({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
