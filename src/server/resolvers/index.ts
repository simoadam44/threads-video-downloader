import type { MediaResolverProvider } from "./types";
import { MockResolver } from "./mock";
import { ExternalResolver } from "./external";
import { OpenSourceResolver } from "./threads/opensource";

export interface ResolverEnv {
  MEDIA_RESOLVER_PROVIDER?: string;
  MEDIA_RESOLVER_API_URL?: string;
  MEDIA_RESOLVER_API_KEY?: string;
}

export function getResolver(env: ResolverEnv): MediaResolverProvider {
  const provider = (env.MEDIA_RESOLVER_PROVIDER || "opensource").toLowerCase();
  if (provider === "external") {
    return new ExternalResolver(env);
  }
  if (provider === "mock") {
    return new MockResolver();
  }
  return new OpenSourceResolver();
}
