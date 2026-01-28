interface Env {}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url).searchParams.get("url");

  if (!url) {
    return new Response(JSON.stringify({ error: "Missing url parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid URL" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Only allow http/https
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return new Response(
      JSON.stringify({ error: "Only HTTP/HTTPS URLs are allowed" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
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
      return new Response(
        JSON.stringify({
          error: `Failed to fetch: ${response.status} ${response.statusText}`,
        }),
        {
          status: 502,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const xml = await response.text();

    return new Response(JSON.stringify({ xml }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: `Fetch failed: ${message}` }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
};
