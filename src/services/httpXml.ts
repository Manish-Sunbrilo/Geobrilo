const REQUEST_TIMEOUT_MS = 20000;

export async function postXml(url: string, body: string): Promise<string> {
  const { text } = await postXmlWithStatus(url, body);
  return text;
}

/**
 * Like postXml, but also surfaces the HTTP status -- fetch() only rejects on
 * network-level failures, not HTTP error statuses, so a wrong/missing
 * endpoint (e.g. a 404 error page) otherwise looks exactly like a real
 * response and gets silently treated as a successful delivery.
 */
export async function postXmlWithStatus(url: string, body: string): Promise<{ status: number; text: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml; charset=UTF-8',
        Accept: 'application/xml',
      },
      body,
      signal: controller.signal,
    });
    return { status: response.status, text: await response.text() };
  } finally {
    clearTimeout(timeoutId);
  }
}
