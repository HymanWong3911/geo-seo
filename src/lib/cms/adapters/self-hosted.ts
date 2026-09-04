// 自建网站 CMS 适配器。
// 详细说明见 dev doc v1.2 21.7 节。
// 等开发同事按规格实现后端 7 个端点，本适配器直接对接。

import type { ArticleInput, ArticleResult, CmsAdapter, MediaResult, Category, Tag } from "../index";
import { outboundFetch, parseHostAllowlist } from "@/lib/http/outbound";

const ENDPOINTS = {
  articles: "/api/cms/articles",
  articleById: (id: string) => `/api/cms/articles/${id}`,
  media: "/api/cms/media",
  categories: "/api/cms/categories",
  tags: "/api/cms/tags",
} as const;

export class SelfHostedCmsAdapter implements CmsAdapter {
  name = "self-hosted";
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(options: { baseUrl: string; apiKey: string }) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await outboundFetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    }, this.outboundPolicy());
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`CMS ${res.status}: ${text}`);
    }
    const json = (await res.json()) as { data: T; error?: unknown };
    if (json.error) throw new Error(`CMS error: ${JSON.stringify(json.error)}`);
    return json.data;
  }

  async createArticle(article: ArticleInput): Promise<ArticleResult> {
    return this.request<ArticleResult>(ENDPOINTS.articles, {
      method: "POST",
      body: JSON.stringify(article),
    });
  }

  async updateArticle(id: string, article: Partial<ArticleInput>): Promise<ArticleResult> {
    return this.request<ArticleResult>(ENDPOINTS.articleById(id), {
      method: "PATCH",
      body: JSON.stringify(article),
    });
  }

  async deleteArticle(id: string): Promise<void> {
    await this.request(ENDPOINTS.articleById(id), { method: "DELETE" });
  }

  async getArticle(id: string): Promise<ArticleResult | null> {
    try {
      return await this.request<ArticleResult>(ENDPOINTS.articleById(id));
    } catch {
      return null;
    }
  }

  async uploadMedia(file: Buffer, filename: string): Promise<MediaResult> {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(file)]);
    formData.append("file", blob, filename);
    const res = await outboundFetch(`${this.baseUrl}${ENDPOINTS.media}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        // 不设置 Content-Type，浏览器自动加 multipart 边界
      },
      body: formData,
    }, this.outboundPolicy());
    if (!res.ok) throw new Error(`CMS media ${res.status}`);
    const json = (await res.json()) as { data: MediaResult };
    return json.data;
  }

  async listCategories(): Promise<Category[]> {
    return this.request<Category[]>(ENDPOINTS.categories);
  }

  async listTags(): Promise<Tag[]> {
    return this.request<Tag[]>(ENDPOINTS.tags);
  }

  private outboundPolicy() {
    return {
      validateUrl: true,
      allowHttp: process.env.CMS_ALLOW_HTTP === "true",
      allowPrivate: process.env.CMS_ALLOW_PRIVATE_HOSTS === "true",
      allowedHosts: parseHostAllowlist(process.env.CMS_EGRESS_ALLOWLIST),
      maxRedirects: 0,
    } as const;
  }
}
