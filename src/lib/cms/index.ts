// CMS 适配器抽象。
// 详细说明见 dev doc v1.2 18.14 + 21.7 节。

export interface ArticleInput {
  title: string;
  slug?: string;
  content: string;
  excerpt?: string;
  status: "draft" | "published";
  categories?: string[];
  tags?: string[];
  metaTitle?: string;
  metaDescription?: string;
  publishAt?: string;
  authorId?: string;
}

export interface ArticleResult {
  id: string;
  url: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface MediaResult {
  id: string;
  url: string;
  mimeType: string;
  size: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
}

export interface CmsAdapter {
  name: string;
  createArticle(article: ArticleInput): Promise<ArticleResult>;
  updateArticle(id: string, article: Partial<ArticleInput>): Promise<ArticleResult>;
  deleteArticle(id: string): Promise<void>;
  getArticle(id: string): Promise<ArticleResult | null>;
  uploadMedia(file: Buffer, filename: string): Promise<MediaResult>;
  listCategories(): Promise<Category[]>;
  listTags(): Promise<Tag[]>;
}

import { SelfHostedCmsAdapter } from "./adapters/self-hosted";
import { MockCmsAdapter } from "./adapters/mock";

const mock = process.env.CMS_MOCK === "true" || !process.env.CMS_BASE_URL;

export const cmsAdapter: CmsAdapter = mock
  ? new MockCmsAdapter()
  : new SelfHostedCmsAdapter();
