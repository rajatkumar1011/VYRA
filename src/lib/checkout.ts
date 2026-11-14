import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { priceCart, type Cart, type Quote } from "./catalog";
const g = globalThis as typeof globalThis & { vyraSecret?: string };
function secret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production")
    throw new Error("Set SESSION_SECRET before running in production.");
  return (g.vyraSecret ??= randomBytes(32).toString("hex"));
}
export function sign(data: object) {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${payload}.${createHmac("sha256", secret()).update(payload).digest("base64url")}`;
}
export function verify<T>(token: string): T {
  if (token.length > 10000) throw new Error("Invalid token.");
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) throw new Error("Invalid token.");
  const expected = Buffer.from(
    createHmac("sha256", secret()).update(payload).digest("base64url"),
  );
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new Error("Invalid token.");
  return JSON.parse(Buffer.from(payload, "base64url").toString()) as T;
}
export interface Checkout {
  id: string;
  session: string;
  cart: Cart;
  quote: Quote;
  expires: number;
}
export function createQuote(cart: Cart, session: string) {
  const quote = priceCart(cart);
  if (!quote.count) throw new Error("Add items before checking out.");
  const data: Checkout = {
    id: crypto.randomUUID(),
    session,
    cart,
    quote,
    expires: Date.now() + 10 * 60_000,
  };
  return { quote, token: sign(data) };
}
export function readQuote(token: string, session: string): Checkout {
  const data = verify<Checkout>(token);
  if (data.session !== session || data.expires < Date.now())
    throw new Error("Your review expired. Please review the basket again.");
  const current = priceCart(data.cart);
  if (JSON.stringify(current) !== JSON.stringify(data.quote))
    throw new Error("Prices changed. Please review the basket again.");
  return data;
}
