// Next's production URL can use an internal hostname. The browser's Host header
// identifies the public request origin, including 127.0.0.1 versus localhost.
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    const target = new URL(req.url);
    const host = req.headers.get("host");
    if (host) target.host = host;
    return origin === target.origin;
  } catch {
    return false;
  }
}
