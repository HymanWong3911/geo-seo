// 2026-07-23: 内置最小 .env 解析器,先于其它 worker 模块 import。
//
// 原因:
//   * tsx 不自动加载 .env
//   * 兼容历史环境中 --env-file 对空值覆盖不一致的问题
//   * dotenv 没有被项目直接依赖
//
// 行为:把 .env 里的 KV 同步写进 process.env,已存在的优先。

import fs from "node:fs";
import path from "node:path";

function loadEnvFile(filePath: string): void {
  let txt: string;
  try {
    txt = fs.readFileSync(filePath, "utf8");
  } catch {
    return;
  }
  for (const rawLine of txt.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1];
    // 注意:Shell 里可能存在 ARK_API_KEY="" 等"已定义但空"的项,会被 Node
    // 继承为 defined 空串。用 truthy 检查让它走覆盖路径,这样 .env 的真值能生效。
    if (process.env[key]) continue;
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

function findEnv(): string | null {
  // 优先 cwd,然后逐级向上找最近一份。pnpm worker 从 cwd 启动,这里直接命中项目根 .env。
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, ".env");
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

const envPath = findEnv();
if (envPath) loadEnvFile(envPath);
