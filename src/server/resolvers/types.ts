import type { ResolvedPost } from "../../types";

export interface MediaResolverProvider {
  name: string;
  canHandle(url: URL): boolean;
  resolve(url: URL, normalized: string): Promise<ResolvedPost>;
}

export class ResolverError extends Error {
  code:
    | "NOT_FOUND"
    | "PRIVATE_CONTENT"
    | "MEDIA_NOT_FOUND"
    | "RESOLVER_UNAVAILABLE"
    | "TEMPORARY_ERROR";
  constructor(code: ResolverError["code"], message?: string) {
    super(message ?? code);
    this.code = code;
  }
}
