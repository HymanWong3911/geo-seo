"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { LocaleSwitch } from "@/components/i18n/LocaleSwitch";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const { t } = useI18n();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<"email" | "password" | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const csrfRes = await fetch("/api/auth/csrf");
    const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

    const body = new URLSearchParams({
      email,
      password,
      csrfToken,
      callbackUrl,
      json: "true",
    });

    const res = await fetch("/api/auth/callback/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (res.ok && res.url.includes("/dashboard")) {
      router.push(callbackUrl);
      router.refresh();
      return;
    }

    setLoading(false);
    setError(t.errors.authFailed);
    try {
      const json = (await res.json()) as { url?: string };
      if (json.url?.includes("error=")) setError(t.errors.authFailed);
    } catch {
      /* noop */
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-12">
      <div>
        <div className="eyebrow">// 01 — credentials</div>
        <div className="mt-4 font-mono text-xs text-muted-foreground">→ {t.login.subtitle}</div>
      </div>

      <div>
        <label
          className={`mono-line block transition-colors ${
            focused === "email" ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          {t.login.emailLabel}
        </label>
        <div className="mt-2 flex items-center gap-2 border-b border-border py-2 transition-colors focus-within:border-foreground">
          <span className="mono-line text-muted-foreground">›</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={() => setFocused("email")}
            onBlur={() => setFocused(null)}
            className="flex-1 bg-transparent font-mono text-sm outline-none"
            placeholder={t.login.emailPlaceholder}
            autoComplete="email"
          />
        </div>
      </div>

      <div>
        <label
          className={`mono-line block transition-colors ${
            focused === "password" ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          {t.login.passwordLabel}
        </label>
        <div className="mt-2 flex items-center gap-2 border-b border-border py-2 transition-colors focus-within:border-foreground">
          <span className="mono-line text-muted-foreground">›</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => setFocused("password")}
            onBlur={() => setFocused(null)}
            className="flex-1 bg-transparent font-mono text-sm outline-none"
            autoComplete="current-password"
          />
        </div>
      </div>

      {error && (
        <div className="border border-destructive bg-destructive/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.15em] text-destructive">
          [ {t.common.unknownError} ] {error} — {t.login.errorHint}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="group flex w-full items-center justify-between border border-foreground px-4 py-3 font-mono text-[11px] uppercase tracking-[0.15em] text-foreground transition-all duration-300 hover:bg-foreground hover:text-background disabled:cursor-not-allowed disabled:opacity-30"
      >
        <span>{loading ? t.login.submitting : t.login.submit}</span>
        <span className="transition-transform group-hover:translate-x-1">→</span>
      </button>

      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
        <span>// {t.common.hint} :: admin@example.com</span>
        <Link href="/forgot-password" className="text-foreground hover:text-primary">
          {t.login.forgotLink}
        </Link>
      </div>
    </form>
  );
}

export default function LoginPage() {
  const [now, setNow] = useState("");
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNow(
        `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`,
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* 左：品牌装饰区 */}
      <aside className="relative hidden border-r border-border lg:block">
        <div className="absolute inset-0 flex flex-col justify-between p-16">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              // system · v1.2
            </div>
            <div className="mt-3 text-2xl tracking-tight">GEO/SEO</div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              search visibility console
            </div>
          </div>

          {/* 大装饰：十字标线 + ASCII art */}
          <div className="relative my-auto">
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              <pre className="text-foreground">{`
   ╔══════════════════════════════════╗
   ║                                  ║
   ║    GEO · SEO · AI SEARCH        ║
   ║                                  ║
   ║    visibility operations at      ║
   ║    scale                        ║
   ║                                  ║
   ╚══════════════════════════════════╝
              `}</pre>
            </div>
          </div>

          <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="status-dot online" />
              <span>online · {now}</span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-4">
              <div>
                <div>// projects</div>
                <div className="text-foreground">3</div>
              </div>
              <div>
                <div>// audits</div>
                <div className="text-foreground">4</div>
              </div>
              <div>
                <div>// runs</div>
                <div className="text-foreground">14+</div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* 右：表单 */}
      <main className="flex items-center justify-center p-8 lg:p-16">
        <div className="w-full max-w-md">
          {/* 顶部状态条 */}
          <div className="mb-12 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            <span>// auth_session</span>
            <span>{now.split(" ")[1]}</span>
          </div>

          {/* 语言切换 + 主题 */}
          <div className="mb-8 flex items-center justify-end gap-3">
            <LocaleSwitch />
            <ThemeToggle />
          </div>

          {/* 标题 */}
          <div className="mb-12">
            <h1 className="text-3xl tracking-tight">登录 / Sign in</h1>
            <div className="mt-2 font-mono text-xs text-muted-foreground">
              → continue to operations dashboard
            </div>
          </div>

          {/* 表单 */}
          <Suspense
            fallback={
              <div className="border border-border p-8 text-center font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground">
                <span className="status-dot idle" /> loading_session
              </div>
            }
          >
            <LoginForm />
          </Suspense>

          <div className="mt-16 border-t border-border pt-6 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            // hint :: 默认 admin@example.com / Admin@2026
          </div>
        </div>
      </main>
    </div>
  );
}
