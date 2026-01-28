interface Env {}

// Maximum allowed response size (1MB - appcast files are typically <100KB)
const MAX_RESPONSE_SIZE = 1024 * 1024;

// Valid XML content types
const XML_CONTENT_TYPES = [
  "application/xml",
  "application/rss+xml",
  "application/atom+xml",
  "text/xml",
  "text/plain", // Some servers misconfigure this
];

function jsonResponse(
  data: Record<string, unknown>,
  status = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function looksLikeXml(content: string): boolean {
  const trimmed = content.trimStart();
  return (
    trimmed.startsWith("<?xml") ||
    trimmed.startsWith("<rss") ||
    trimmed.startsWith("<feed") ||
    trimmed.startsWith("<!DOCTYPE")
  );
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url).searchParams.get("url");

  if (!url) {
    return jsonResponse({ error: "Missing url parameter" }, 400);
  }

  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return jsonResponse({ error: "Invalid URL" }, 400);
  }

  // Only allow http/https
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return jsonResponse({ error: "Only HTTP/HTTPS URLs are allowed" }, 400);
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "SparkleValidator/1.0 (https://sparklevalidator.com)",
        Accept: "application/xml, application/rss+xml, text/xml, */*",
      },
      cf: {
        cacheTtl: 60,
        cacheEverything: true,
      },
    });

    if (!response.ok) {
      return jsonResponse(
        { error: `Failed to fetch: ${response.status} ${response.statusText}` },
        502
      );
    }

    // Check Content-Length if available
    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_SIZE) {
      return jsonResponse(
        { error: "Response too large (max 1MB). This doesn't look like an appcast file." },
        413
      );
    }

    // Check Content-Type (allow if missing, since some servers misconfigure)
    const contentType = response.headers.get("content-type")?.toLowerCase() || "";
    const hasValidType =
      !contentType || XML_CONTENT_TYPES.some((t) => contentType.includes(t));
    if (!hasValidType) {
      return jsonResponse(
        { error: `Invalid content type: ${contentType}. Expected XML.` },
        415
      );
    }

    // Read response with size limit
    const reader = response.body?.getReader();
    if (!reader) {
      return jsonResponse({ error: "Failed to read response" }, 502);
    }

    const chunks: Uint8Array[] = [];
    let totalSize = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalSize += value.length;
      if (totalSize > MAX_RESPONSE_SIZE) {
        reader.cancel();
        return jsonResponse(
          { error: "Response too large (max 1MB). This doesn't look like an appcast file." },
          413
        );
      }
      chunks.push(value);
    }

    const xml = new TextDecoder().decode(
      new Uint8Array(chunks.reduce((acc, chunk) => [...acc, ...chunk], [] as number[]))
    );

    // Verify it looks like XML
    if (!looksLikeXml(xml)) {
      return jsonResponse(
        { error: "Response doesn't appear to be XML. Expected an appcast file." },
        415
      );
    }

    return new Response(JSON.stringify({ xml }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ error: `Fetch failed: ${message}` }, 502);
  }
};
