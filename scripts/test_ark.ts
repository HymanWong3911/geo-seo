import "dotenv/config";
import { ARKProvider } from "../src/lib/llm/ark";

async function main() {
  const provider = new ARKProvider();
  const start = Date.now();
  try {
    const result = await provider.completeWithUsage({
      prompt: "用一句话说 GEO 是什么",
      system: "你是一个搜索助手",
      temperature: 0.3,
      maxTokens: 200,
    });
    const ms = Date.now() - start;
    console.log("✅ ARK 真实渠道 OK (" + ms + "ms)");
    console.log("  Content: " + result.content.slice(0, 100));
    console.log("  Usage:", JSON.stringify(result.usage));
  } catch (e: any) {
    console.log("❌ ARK 渠道失败: " + e.message);
    process.exit(1);
  }
}
main();
