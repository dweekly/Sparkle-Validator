/**
 * Fetch XML content from a URL.
 * Uses Node.js built-in fetch (available since Node 18).
 */
export async function fetchUrl(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/xml, text/xml, application/rss+xml, */*",
      "User-Agent": "sparkle-validator/1.0",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.text();
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
