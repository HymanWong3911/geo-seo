// Mock CMS 适配器。
// 用于开发环境：开发同事的 21.7 端点还没实现时，可以用 mock 走通完整流程。
// 用法：env 加 CMS_MOCK=true（默认就是 true 如果没配 CMS_BASE_URL）

import type {
  ArticleInput,
  ArticleResult,
  CmsAdapter,
  MediaResult,
  Category,
  Tag,
} from "../index";

export class MockCmsAdapter implements CmsAdapter {
  name = "mock";

  private store = new Map<string, ArticleResult>();

  async createArticle(article: ArticleInput): Promise<ArticleResult> {
    const id = `mock_${Date.now()}`;
    const now = new Date().toISOString();
    const result: ArticleResult = {
      id,
      url: `https://mock.example.com/blog/${article.slug ?? id}`,
      status: article.status,
      createdAt: now,
      updatedAt: now,
    };
    this.store.set(id, result);
    return result;
  }

  async updateArticle(id: string, article: Partial<ArticleInput>): Promise<ArticleResult> {
    const existing = this.store.get(id);
    const now = new Date().toISOString();
    const result: ArticleResult = existing
      ? { ...existing, status: article.status ?? existing.status, updatedAt: now }
      : {
          id,
          url: `https://mock.example.com/blog/${id}`,
          status: article.status ?? "published",
          createdAt: now,
          updatedAt: now,
        };
    this.store.set(id, result);
    return result;
  }

  async deleteArticle(id: string): Promise<void> {
    this.store.delete(id);
  }

  async getArticle(id: string): Promise<ArticleResult | null> {
    return this.store.get(id) ?? null;
  }

  async uploadMedia(_file: Buffer, filename: string): Promise<MediaResult> {
    return {
      id: `mock_media_${Date.now()}`,
      url: `https://mock.example.com/uploads/${filename}`,
      mimeType: "application/octet-stream",
      size: _file.length,
    };
  }

  async listCategories(): Promise<Category[]> {
    return [
      { id: "c1", name: "SEO", slug: "seo" },
      { id: "c2", name: "GEO", slug: "geo" },
    ];
  }

  async listTags(): Promise<Tag[]> {
    return [
      { id: "t1", name: "工具", slug: "tools" },
      { id: "t2", name: "教程", slug: "tutorial" },
    ];
  }
}
