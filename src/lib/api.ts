import type { ResolveResponse } from "../types";

export async function resolveUrl(url: string, signal?: AbortSignal): Promise<ResolveResponse> {
  const res = await fetch("/api/resolve", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url }),
    signal,
  });
  const data = (await res.json()) as ResolveResponse;
  return data;
}
