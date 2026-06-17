// 分发适配器基类
export interface DistributionInput {
  title: string;
  content: string;
  excerpt?: string;
  url?: string;  // 原始文章链接
  author?: string;
}

export interface DistributionResult {
  success: boolean;
  externalId?: string;
  externalUrl?: string;
  error?: string;
}

export interface DistributionAdapter {
  readonly platform: string;
  readonly name: string;
  
  // 验证配置是否完整
  validateConfig(config: Record<string, unknown>): { valid: boolean; missing: string[] };
  
  // 执行分发
  distribute(config: Record<string, unknown>, input: DistributionInput): Promise<DistributionResult>;
  
  // 可选：获取访问令牌
  refreshToken?(config: Record<string, unknown>): Promise<Record<string, unknown>>;
}
