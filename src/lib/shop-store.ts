import { neon } from "@neondatabase/serverless";
import type { Checkout } from "./checkout";
import type { Quote } from "./catalog";
export interface ShopOrder {
  id: string;
  session: string;
  createdAt: string;
  status: "Received" | "Packing" | "Ready";
  quote: Quote;
}
const g = globalThis as typeof globalThis & {
  vyraOrders?: Map<string, ShopOrder>;
};
const memory = () => (g.vyraOrders ??= new Map<string, ShopOrder>());
const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
let ready: Promise<unknown> | undefined;
async function init() {
  if (!sql) return;
  await (ready ??=
    sql`CREATE TABLE IF NOT EXISTS vyra_orders (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), status TEXT NOT NULL, quote JSONB NOT NULL)`.catch(
      (e) => {
        ready = undefined;
        throw e;
      },
    ));
}
export const storageKind = () => (sql ? "postgres" : "temporary memory");
export async function listOrders(session: string): Promise<ShopOrder[]> {
  await init();
  if (!sql)
    return [...memory().values()]
      .filter((o) => o.session === session)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const rows =
    await sql`SELECT * FROM vyra_orders WHERE session_id = ${session} ORDER BY created_at DESC LIMIT 100`;
  return rows.map((r) => ({
    id: String(r.id),
    session: String(r.session_id),
    createdAt: new Date(r.created_at).toISOString(),
    status: r.status,
    quote: r.quote,
  }));
}
export async function saveOrder(checkout: Checkout): Promise<ShopOrder> {
  await init();
  const order: ShopOrder = {
    id: checkout.id,
    session: checkout.session,
    createdAt: new Date().toISOString(),
    status: "Received",
    quote: checkout.quote,
  };
  if (!sql) {
    if (!memory().has(order.id)) memory().set(order.id, order);
    return memory().get(order.id)!;
  }
  await sql`INSERT INTO vyra_orders (id, session_id, status, quote) VALUES (${order.id}, ${order.session}, ${order.status}, ${JSON.stringify(order.quote)}::jsonb) ON CONFLICT (id) DO NOTHING`;
  return (await listOrders(order.session)).find((o) => o.id === order.id)!;
}
export async function advanceOrder(id: string, session: string): Promise<void> {
  await init();
  if (!sql) {
    const o = memory().get(id);
    if (!o || o.session !== session) throw new Error("Order not found.");
    o.status = o.status === "Received" ? "Packing" : "Ready";
  } else {
    const rows =
      await sql`UPDATE vyra_orders SET status = CASE WHEN status = 'Received' THEN 'Packing' ELSE 'Ready' END WHERE id = ${id} AND session_id = ${session} RETURNING id`;
    if (!rows.length) throw new Error("Order not found.");
  }
}
