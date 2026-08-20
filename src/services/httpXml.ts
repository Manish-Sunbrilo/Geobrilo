const REQUEST_TIMEOUT_MS = 20000;

export async function postXml(url: string, body: string): Promise<string> {
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
    return await response.text();
  } finally {
    clearTimeout(timeoutId);
  }
}
