import { describe, it, expect } from "vitest";
import { analyzeSeo, type SeoAnalysisInput } from "./analyzer";

const baseInput: Omit<SeoAnalysisInput, "html"> = {
  url: "https://example.com/test",
  finalUrl: "https://example.com/test",
  statusCode: 200,
  performance: { ttfb: 100, fcp: 500, lcp: 1000, tbt: 50 },
};

describe("analyzeSeo", () => {
  it("returns score 100 for a perfect page", () => {
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>This is a great title with proper length and keywords</title>
  <meta name="description" content="This is a comprehensive meta description that has enough characters to satisfy the minimum length requirement and provides useful information." />
  <link rel="canonical" href="https://example.com/test" />
  <script type="application/ld+json">{"@context":"https://schema.org"}</script>
  <meta property="og:title" content="OG title" />
  <meta property="og:image" content="https://example.com/og.jpg" />
  <meta property="og:description" content="OG desc" />
</head>
<body>
  <h1>Main Heading</h1>
  <p>${"This is body content. ".repeat(100)}</p>
  <a href="/about">About</a>
  <img src="/x.jpg" alt="x" />
</body>
</html>`;

    const r = analyzeSeo({ ...baseInput, html });
    expect(r.indexable).toBe(true);
    expect(r.findings).toHaveLength(0);
    expect(r.score).toBe(100);
  });

  it("flags missing title", () => {
    const html = `<html><head></head><body><h1>X</h1></body></html>`;
    const r = analyzeSeo({ ...baseInput, html });
    expect(r.findings.some((f) => f.code === "MISSING_TITLE")).toBe(true);
    expect(r.score).toBeLessThan(100);
  });

  it("flags title too short / too long", () => {
    const shortHtml = `<html><head><title>Hi</title></head><body></body></html>`;
    const r1 = analyzeSeo({ ...baseInput, html: shortHtml });
    expect(r1.findings.some((f) => f.code === "TITLE_TOO_SHORT")).toBe(true);

    const longHtml = `<html><head><title>${"x".repeat(100)}</title></head><body></body></html>`;
    const r2 = analyzeSeo({ ...baseInput, html: longHtml });
    expect(r2.findings.some((f) => f.code === "TITLE_TOO_LONG")).toBe(true);
  });

  it("flags missing H1", () => {
    const html = `<html><head><title>Test page title for analyzer</title></head><body><p>Content</p></body></html>`;
    const r = analyzeSeo({ ...baseInput, html });
    expect(r.findings.some((f) => f.code === "MISSING_H1")).toBe(true);
  });

  it("flags multiple H1s", () => {
    const html = `<html><head><title>Test page title for analyzer</title></head><body><h1>One</h1><h1>Two</h1></body></html>`;
    const r = analyzeSeo({ ...baseInput, html });
    expect(r.findings.some((f) => f.code === "MULTIPLE_H1")).toBe(true);
  });

  it("flags noindex", () => {
    const html = `<html><head><title>Test</title><meta name="robots" content="noindex"></head><body></body></html>`;
    const r = analyzeSeo({ ...baseInput, html });
    expect(r.indexable).toBe(false);
    expect(r.findings.some((f) => f.code === "NON_INDEXABLE")).toBe(true);
  });

  it("flags 4xx/5xx status", () => {
    const r = analyzeSeo({ ...baseInput, statusCode: 404, html: "<html></html>" });
    expect(r.indexable).toBe(false);
    expect(r.findings.some((f) => f.code === "NON_INDEXABLE")).toBe(true);
  });

  it("flags image missing alt", () => {
    const html = `<html><head><title>Test</title></head><body>
      <img src="/a.jpg" />
      <img src="/b.jpg" alt="b" />
      <img src="/c.jpg" alt="" />
    </body></html>`;
    const r = analyzeSeo({ ...baseInput, html });
    const f = r.findings.find((x) => x.code === "IMAGE_MISSING_ALT");
    expect(f).toBeDefined();
    expect(f?.currentValue).toBe(2);  // a.jpg and c.jpg (empty alt)
  });

  it("flags no internal links", () => {
    const html = `<html><head><title>Test</title></head><body><a href="https://other.com">x</a></body></html>`;
    const r = analyzeSeo({ ...baseInput, html });
    expect(r.findings.some((f) => f.code === "NO_INTERNAL_LINKS")).toBe(true);
  });

  it("flags low word count", () => {
    const html = `<html><head><title>Test page title for analyzer</title></head><body><p>Short.</p></body></html>`;
    const r = analyzeSeo({ ...baseInput, html });
    expect(r.findings.some((f) => f.code === "LOW_WORD_COUNT")).toBe(true);
  });

  it("flags slow LCP", () => {
    const html = `<html><head><title>Test page title for analyzer</title></head><body><h1>x</h1></body></html>`;
    const r = analyzeSeo({
      ...baseInput,
      html,
      performance: { ttfb: 100, fcp: 500, lcp: 5000, tbt: 50 },
    });
    const f = r.findings.find((x) => x.code === "SLOW_LCP");
    expect(f).toBeDefined();
    expect(f?.severity).toBe("high");
  });

  it("computes score with severity penalties", () => {
    const html = `<html><head><meta name="robots" content="noindex"></head><body><h1>x</h1></body></html>`;
    const r = analyzeSeo({ ...baseInput, html });
    // missing title (-20) + missing description (-10) + noindex (-20) + low word count (-10) + missing schema (-3) + missing OG (-3) + no canonical (-10) = 76
    expect(r.score).toBeLessThan(100);
    expect(r.score).toBeGreaterThan(0);
  });
});
