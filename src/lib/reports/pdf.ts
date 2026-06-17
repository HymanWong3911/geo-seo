// PDF 导出工具。
// 使用 Playwright 生成 PDF。
import { generateReport, type ReportType } from "./generator";

export interface GeneratePDFOptions {
  projectId: string;
  type: ReportType;
  fromDays?: number;
  auditId?: string;
}

/**
 * 生成 Markdown 报告内容
 */
export async function generateReportContent(options: GeneratePDFOptions): Promise<string> {
  return generateReport({
    projectId: options.projectId,
    type: options.type,
    fromDays: options.fromDays,
    auditId: options.auditId,
  });
}

/**
 * 将 Markdown 转换为 HTML（用于 PDF 生成）
 */
export function markdownToHtml(markdown: string, title?: string): string {
  // 简单的 Markdown 到 HTML 转换（支持基本语法）
  let html = markdown
    // 代码块
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
    // 标题
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>')
    // 粗体和斜体
    .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // 链接
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
    // 列表
    .replace(/^- (.*)$/gm, '<li>$1</li>')
    // 表格（简化处理）
    .replace(/\|(.+)\|/g, (match) => {
      const cells = match.split('|').filter(Boolean).map((c) => c.trim());
      return `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`;
    })
    // 水平线
    .replace(/^---$/gm, '<hr/>')
    // 换行
    .replace(/\n\n/g, '</p><p>')
    // 包裹列表项
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title ?? 'GEO/SEO Report'}</title>
  <style>
    :root {
      --bg: #0a0a0f;
      --text: #e4e4e7;
      --accent: #f472b6;
      --muted: #71717a;
      --border: #27272a;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: var(--text);
      background: var(--bg);
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }
    h1 { font-size: 24px; color: var(--accent); margin-bottom: 16px; border-bottom: 1px solid var(--border); padding-bottom: 8px; }
    h2 { font-size: 18px; color: var(--text); margin: 24px 0 12px; }
    h3 { font-size: 16px; color: var(--text); margin: 20px 0 8px; }
    p { margin: 12px 0; }
    a { color: var(--accent); }
    strong { color: var(--accent); font-weight: 600; }
    em { color: var(--muted); font-style: italic; }
    code { 
      background: #1a1a1f; 
      padding: 2px 6px; 
      border-radius: 4px; 
      font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
      font-size: 12px;
    }
    pre {
      background: #1a1a1f;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      margin: 16px 0;
      border: 1px solid var(--border);
    }
    pre code { background: transparent; padding: 0; }
    ul, ol { margin: 12px 0; padding-left: 24px; }
    li { margin: 4px 0; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 13px;
    }
    th, td {
      border: 1px solid var(--border);
      padding: 8px 12px;
      text-align: left;
    }
    th { background: #1a1a1f; color: var(--accent); }
    tr:nth-child(even) { background: rgba(255,255,255,0.02); }
    hr { border: none; border-top: 1px solid var(--border); margin: 24px 0; }
    @media print {
      body { background: white; color: black; }
      h1, strong { color: #be185d; }
      pre, code { background: #f5f5f5; border-color: #e5e5e5; }
      th { background: #f5f5f5; color: #be185d; }
    }
  </style>
</head>
<body>
  <p>${html}</p>
</body>
</html>`;
}

/**
 * 使用 Playwright 生成 PDF
 */
export async function generatePdfFromHtml(html: string): Promise<Buffer> {
  const { chromium } = await import("playwright");
  
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.setContent(html, { waitUntil: "networkidle" });
  
  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: {
      top: "20mm",
      right: "20mm",
      bottom: "20mm",
      left: "20mm",
    },
  });
  
  await browser.close();
  
  return Buffer.from(pdfBuffer);
}

/**
 * 生成 PDF 报告
 */
export async function generatePdfReport(options: GeneratePDFOptions): Promise<Buffer> {
  const markdown = await generateReportContent(options);
  const html = markdownToHtml(markdown, `${options.type} Report`);
  return generatePdfFromHtml(html);
}
