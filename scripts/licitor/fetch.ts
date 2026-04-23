/**
 * Polite HTTP fetching with jitter, retry, backoff.
 * All licitor.com requests go through this.
 */
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export type FetchOptions = {
  /** Minimum delay before the request, in ms. Jitter is added. */
  minDelayMs?: number;
  /** Max delay before the request, in ms. */
  maxDelayMs?: number;
  /** Retries on transient errors (5xx, network). */
  retries?: number;
  /** Abort after this many ms per attempt. */
  timeoutMs?: number;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Fetch a licitor URL politely. Returns { status, body } or throws after retries. */
export async function politeFetch(
  url: string,
  opts: FetchOptions = {}
): Promise<{ status: number; body: string }> {
  const minDelay = opts.minDelayMs ?? 1800;
  const maxDelay = opts.maxDelayMs ?? 3200;
  const retries = opts.retries ?? 3;
  const timeout = opts.timeoutMs ?? 15_000;

  const delay = minDelay + Math.random() * (maxDelay - minDelay);
  await sleep(delay);

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": UA,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
        },
        signal: AbortSignal.timeout(timeout),
      });
      // 404 is legitimate — listing removed. Don't retry, return status to caller.
      if (res.status === 404) return { status: 404, body: "" };
      if (res.status >= 500 || res.status === 429) {
        throw new Error(`HTTP ${res.status}`);
      }
      if (!res.ok) return { status: res.status, body: await res.text() };
      return { status: res.status, body: await res.text() };
    } catch (err) {
      lastErr = err;
      // exponential backoff with jitter on transient failures
      const backoff = 2000 * Math.pow(2, attempt) + Math.random() * 1000;
      console.warn(
        `[fetch] ${url} attempt ${attempt + 1} failed: ${String(err)}. Backing off ${Math.round(backoff)}ms`
      );
      await sleep(backoff);
    }
  }
  throw lastErr ?? new Error(`Unknown fetch failure for ${url}`);
}
