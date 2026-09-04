import { createCmsAdapter, type CmsAdapter } from "./index";
import { decryptSecret } from "@/lib/security/secrets";

interface StoredCmsIntegration {
  type: string;
  baseUrl: string;
  apiKeyEncrypted: string | null;
  apiKeyIv: string | null;
  apiKeyTag: string | null;
}

export function adapterForIntegration(integration: StoredCmsIntegration): CmsAdapter {
  if (integration.type === "mock") {
    return createCmsAdapter({ type: "mock", baseUrl: integration.baseUrl, apiKey: "" });
  }
  if (!integration.apiKeyEncrypted || !integration.apiKeyIv || !integration.apiKeyTag) {
    throw new Error("CMS 凭据不可用，请重新保存此集成的 API Key");
  }
  const apiKey = decryptSecret({
    encrypted: integration.apiKeyEncrypted,
    iv: integration.apiKeyIv,
    tag: integration.apiKeyTag,
  });
  return createCmsAdapter({
    type: integration.type,
    baseUrl: integration.baseUrl,
    apiKey,
  });
}

export function publicCmsIntegration<T extends StoredCmsIntegration & { apiKeyHash: string }>(
  integration: T,
) {
  const {
    apiKeyHash: _apiKeyHash,
    apiKeyEncrypted: _apiKeyEncrypted,
    apiKeyIv: _apiKeyIv,
    apiKeyTag: _apiKeyTag,
    ...safe
  } = integration;
  return {
    ...safe,
    credentialConfigured: integration.type === "mock" || Boolean(
      integration.apiKeyEncrypted && integration.apiKeyIv && integration.apiKeyTag,
    ),
  };
}
