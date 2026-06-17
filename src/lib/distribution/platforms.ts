// 分发平台类型定义

export type DistributionPlatform = string;

// 发布模式
export type PublishMode = "MANUAL" | "AUTO";

// 自动发布触发条件
export type AutoPublishTrigger = "APPROVED" | "PUBLISHED";

// 平台信息
export interface PlatformInfo {
  name: string;
  icon: string;
  description: string;
  docs: string;
  configFields: ConfigField[];
  supportsAutoPublish: boolean;
}

export interface ConfigField {
  key: string;
  label: string;
  labelZh: string;
  type: "text" | "password" | "url" | "number";
  required: boolean;
  placeholder?: string;
}

// 所有平台信息
export const PLATFORMS: Record<string, PlatformInfo> = {
  ZHIHU: { name: "知乎", icon: "💬", description: "知乎专栏文章分发", docs: "https://open.zhihu.com", configFields: [{ key: "token", label: "Access Token", labelZh: "访问令牌", type: "password", required: true }], supportsAutoPublish: true },
  WECHAT_MP: { name: "微信公众号", icon: "💚", description: "微信公众平台图文消息", docs: "https://developers.weixin.qq.com", configFields: [{ key: "appId", label: "AppID", labelZh: "AppID", type: "text", required: true }, { key: "appSecret", label: "AppSecret", labelZh: "AppSecret", type: "password", required: true }], supportsAutoPublish: true },
  FEISHU_DOC: { name: "飞书文档", icon: "✈️", description: "飞书多维表格和文档", docs: "https://open.feishu.cn", configFields: [{ key: "appId", label: "App ID", labelZh: "应用ID", type: "text", required: true }, { key: "appSecret", label: "App Secret", labelZh: "应用密钥", type: "password", required: true }], supportsAutoPublish: true },
  NOTION: { name: "Notion", icon: "📝", description: "Notion 数据库页面", docs: "https://developers.notion.com", configFields: [{ key: "apiKey", label: "API Key", labelZh: "API密钥", type: "password", required: true }, { key: "databaseId", label: "Database ID", labelZh: "数据库ID", type: "text", required: true }], supportsAutoPublish: true },
  CUSTOM_WEBHOOK: { name: "自定义 Webhook", icon: "🔗", description: "通过 Webhook 分发到任意平台", docs: "#", configFields: [{ key: "url", label: "Webhook URL", labelZh: "Webhook地址", type: "url", required: true }], supportsAutoPublish: true },
  BAIJIAHAO: { name: "百家号", icon: "📰", description: "百度百家号文章分发", docs: "https://baijiahao.baidu.com", configFields: [{ key: "apiKey", label: "API Key", labelZh: "API密钥", type: "password", required: true }, { key: "accountId", label: "Account ID", labelZh: "账号ID", type: "text", required: true }], supportsAutoPublish: true },
  DOUYIN: { name: "抖音/头条号", icon: "🎵", description: "字节跳动内容平台", docs: "https://developer.toutiao.com", configFields: [{ key: "clientKey", label: "Client Key", labelZh: "客户端密钥", type: "text", required: true }, { key: "clientSecret", label: "Client Secret", labelZh: "客户端密钥", type: "password", required: true }], supportsAutoPublish: true },
  XIAOHONGSHU: { name: "小红书", icon: "📕", description: "小红书笔记分发", docs: "https://developers.xiaohongshu.com", configFields: [{ key: "token", label: "Access Token", labelZh: "访问令牌", type: "password", required: true }], supportsAutoPublish: false },
  COZE: { name: "字节扣子 (Coze)", icon: "🤖", description: "字节跳动 AI 智能体平台", docs: "https://www.coze.cn/docs", configFields: [{ key: "apiKey", label: "API Key", labelZh: "API密钥", type: "password", required: true }, { key: "botId", label: "Bot ID", labelZh: "机器人ID", type: "text", required: true }], supportsAutoPublish: true },
  BAIDU_WENXIN: { name: "百度文心", icon: "🔍", description: "百度文心一言智能体", docs: "https://cloud.baidu.com/doc/wenxinworkshop", configFields: [{ key: "apiKey", label: "API Key", labelZh: "API密钥", type: "text", required: true }, { key: "secretKey", label: "Secret Key", labelZh: "密钥", type: "password", required: true }], supportsAutoPublish: true },
  TENCENT_YUANBAO: { name: "腾讯元宝", icon: "🐧", description: "腾讯元宝 AI 智能体", docs: "https://yuanbao.tencent.com", configFields: [{ key: "appId", label: "App ID", labelZh: "应用ID", type: "text", required: true }, { key: "appSecret", label: "App Secret", labelZh: "应用密钥", type: "password", required: true }], supportsAutoPublish: true },
  DINGTALK: { name: "钉钉", icon: "📌", description: "钉钉群消息和企业应用", docs: "https://open.dingtalk.com", configFields: [{ key: "clientId", label: "Client ID", labelZh: "Client ID", type: "text", required: true }, { key: "clientSecret", label: "Client Secret", labelZh: "Client Secret", type: "password", required: true }], supportsAutoPublish: true },
  BAIDU_SEARCH: { name: "百度搜索", icon: "🔎", description: "百度搜索资源平台 URL 提交", docs: "https://ziyuan.baidu.com", configFields: [{ key: "siteUrl", label: "Site URL", labelZh: "网站地址", type: "url", required: true }, { key: "token", label: "Push Token", labelZh: "推送Token", type: "password", required: true }], supportsAutoPublish: true },
  SOGOU_SEARCH: { name: "搜狗搜索", icon: "🐶", description: "搜狗搜索 URL 提交", docs: "https://zhanzhang.sogou.com", configFields: [{ key: "siteUrl", label: "Site URL", labelZh: "网站地址", type: "url", required: true }, { key: "token", label: "Push Token", labelZh: "推送Token", type: "password", required: true }], supportsAutoPublish: true },
  SO360_SEARCH: { name: "360搜索", icon: "🔱", description: "360搜索 URL 提交", docs: "https://zhanzhang.so.com", configFields: [{ key: "siteUrl", label: "Site URL", labelZh: "网站地址", type: "url", required: true }, { key: "token", label: "Push Token", labelZh: "推送Token", type: "password", required: true }], supportsAutoPublish: true },
  SHENMA_SEARCH: { name: "神马搜索", icon: "🐴", description: "神马搜索 URL 提交（UC浏览器）", docs: "https://zhanzhang.sm.cn", configFields: [{ key: "siteUrl", label: "Site URL", labelZh: "网站地址", type: "url", required: true }, { key: "token", label: "Push Token", labelZh: "推送Token", type: "password", required: true }], supportsAutoPublish: true },
  CITATION_SITE: { name: "引用站点", icon: "📎", description: "向新闻源、媒体平台提交引用", docs: "#", configFields: [{ key: "siteUrl", label: "Site URL", labelZh: "网站地址", type: "url", required: true }], supportsAutoPublish: true },
  INDEX_SITE: { name: "收录站点", icon: "📑", description: "向导航站、目录站提交收录", docs: "#", configFields: [{ key: "siteUrl", label: "Site URL", labelZh: "网站地址", type: "url", required: true }, { key: "siteName", label: "Site Name", labelZh: "网站名称", type: "text", required: true }], supportsAutoPublish: true },
};

export const PLATFORM_GROUPS = {
  social: ["ZHIHU", "WECHAT_MP", "FEISHU_DOC", "NOTION", "CUSTOM_WEBHOOK"] as const,
  content: ["BAIJIAHAO", "DOUYIN", "XIAOHONGSHU"] as const,
  ai: ["COZE", "BAIDU_WENXIN", "TENCENT_YUANBAO", "DINGTALK"] as const,
  search: ["BAIDU_SEARCH", "SOGOU_SEARCH", "SO360_SEARCH", "SHENMA_SEARCH"] as const,
  citation: ["CITATION_SITE", "INDEX_SITE"] as const,
};

export function getPlatformInfo(platform: string): PlatformInfo | undefined {
  return PLATFORMS[platform];
}

export function isSearchPlatform(platform: string): boolean {
  return PLATFORM_GROUPS.search.includes(platform as typeof PLATFORM_GROUPS.search[number]);
}

export function isAiAgent(platform: string): boolean {
  return PLATFORM_GROUPS.ai.includes(platform as typeof PLATFORM_GROUPS.ai[number]);
}
