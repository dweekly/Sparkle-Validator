export interface FetchUrlResult {
  text: string;
  finalUrl: string;
}

export interface FetchUrlOptions {
  timeoutMs?: number;
  maxBytes?: number;
  userAgent?: string;
}

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024; // 10MB limit

/**
 * Fetch XML content from a URL with bounded size and timeouts.
 */
export async function fetchUrl(
  url: string,
  options: FetchUrlOptions = {}
): Promise<FetchUrlResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/xml, text/xml, application/rss+xml, */*",
        "User-Agent": options.userAgent ?? "sparkle-validator/1.2",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      const text = await response.text();
      return { text, finalUrl: response.url || url };
    }

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new Error(`Feed size exceeded limit of ${maxBytes} bytes`);
      }
      chunks.push(value);
    }

    const decoder = new TextDecoder();
    let text = "";
    for (const chunk of chunks) {
      text += decoder.decode(chunk, { stream: true });
    }
    text += decoder.decode();

    return { text, finalUrl: response.url || url };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Read all data from stdin as a string.
 */
export async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8");
}
