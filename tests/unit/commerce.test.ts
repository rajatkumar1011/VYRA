import assert from "node:assert/strict";
import { test } from "node:test";
import { priceCart, validateCart } from "../../src/lib/catalog";
import { parseLocal, applyIntent } from "../../src/lib/commerce";
import { createQuote, readQuote, sign, verify } from "../../src/lib/checkout";
import { saveOrder, listOrders, advanceOrder } from "../../src/lib/shop-store";
import { isSameOrigin } from "../../src/lib/request";

test("same-origin checks use the browser host and still reject cross-origin requests", () => {
  const make = (origin: string, host = "127.0.0.1:3000") => new Request("http://localhost:3000/api/shop", { headers: { Host: host, Origin: origin } });
  assert.equal(isSameOrigin(make("http://127.0.0.1:3000")), true);
  assert.equal(isSameOrigin(make("http://localhost:3000", "localhost:3000")), true);
  assert.equal(isSameOrigin(make("https://evil.example")), false);
  assert.equal(isSameOrigin(make("null")), false);
  assert.equal(isSameOrigin(make("https://127.0.0.1:3000")), false);
  assert.equal(isSameOrigin(new Request("http://localhost:3000/api/shop")), true);
});

test("stock questions never add groceries", () => {
  assert.deepEqual(
    applyIntent({}, parseLocal("Do you have milk?"), "en-IN").cart,
    {},
  );
});
test("unit suffixes and negative quantities are handled without guessing one pack", () => {
  assert.deepEqual(applyIntent({}, parseLocal("2kg rice"), "en-IN").cart, {
    rice: 2,
  });
  assert.deepEqual(applyIntent({}, parseLocal("500g rice"), "en-IN").cart, {});
  assert.deepEqual(applyIntent({}, parseLocal("1000ml milk"), "en-IN").cart, {
    milk: 1,
  });
  assert.deepEqual(applyIntent({}, parseLocal("-1 milk"), "en-IN").cart, {});
  assert.deepEqual(applyIntent({}, parseLocal("milk 2"), "en-IN").cart, {
    milk: 2,
  });
});
test("coordinated removal applies to every named item", () => {
  assert.deepEqual(
    applyIntent(
      { milk: 2, bread: 1 },
      parseLocal("remove milk and bread"),
      "en-IN",
    ).cart,
    {},
  );
  assert.deepEqual(
    applyIntent({}, parseLocal("add milk, no bread"), "en-IN").cart,
    {},
  );
});

test("prices come from catalog; delivery is free at the threshold", () => {
  assert.equal(priceCart({ milk: 2, bread: 1 }).total, 185);
  assert.equal(priceCart({ rice: 3 }).delivery, 20);
  assert.equal(priceCart({ rice: 3, sugar: 1 }).delivery, 0);
  assert.equal(priceCart({}).total, 0);
});
test("invalid products, fractional, negative, string and excess quantities fail", () => {
  for (const cart of [
    { unknown: 1 },
    { milk: 0.5 },
    { milk: -1 },
    { milk: "1" },
    { milk: 13 },
    { tea: 1 },
    [],
    null,
  ])
    assert.throws(() => validateCart(cart));
});
test("English and Hinglish multi-item ordering", () => {
  assert.deepEqual(
    applyIntent({}, parseLocal("2 milk and 1 bread"), "en-IN").cart,
    { milk: 2, bread: 1 },
  );
  assert.deepEqual(
    applyIntent({}, parseLocal("Do litre doodh aur ek kilo chawal"), "hi-en")
      .cart,
    { milk: 2, rice: 1 },
  );
});
test("native Hindi numerals and product names", () => {
  assert.deepEqual(
    applyIntent({}, parseLocal("दो लीटर दूध और एक किलो चावल"), "hi-IN").cart,
    { milk: 2, rice: 1 },
  );
  assert.deepEqual(
    applyIntent({}, parseLocal("२ दूध और १ चावल"), "hi-IN").cart,
    { milk: 2, rice: 1 },
  );
});
test("basket corrections, negation and unknown words", () => {
  assert.deepEqual(
    applyIntent({ milk: 2 }, parseLocal("remove milk"), "en-IN").cart,
    {},
  );
  assert.deepEqual(
    applyIntent({ milk: 2 }, parseLocal("make it 1 milk instead"), "en-IN")
      .cart,
    { milk: 1 },
  );
  assert.deepEqual(
    applyIntent({}, parseLocal("don't add milk"), "en-IN").cart,
    {},
  );
  assert.deepEqual(applyIntent({}, parseLocal("milkshake"), "en-IN").cart, {});
});
test("stock refusal never silently substitutes or caps a request", () => {
  const result = applyIntent(
    { milk: 1 },
    parseLocal("20 milk and 1 tea"),
    "en-IN",
  );
  assert.deepEqual(result.cart, { milk: 1 });
  assert.match(result.reply, /only 12/);
  assert.match(result.reply, /only 0/);
});
test("fractional packs are rejected; questions do not mutate baskets", () => {
  assert.deepEqual(
    applyIntent({}, parseLocal("half kilo rice"), "en-IN").cart,
    {},
  );
  assert.equal(parseLocal("What is the price of milk?").kind, "catalog");
  assert.equal(parseLocal("confirm order").kind, "checkout");
});
test("egg units convert to packs, ambiguous fractions never round", () => {
  assert.deepEqual(applyIntent({}, parseLocal("6 eggs"), "en-IN").cart, {
    eggs: 1,
  });
  assert.deepEqual(
    applyIntent({}, parseLocal("one dozen eggs"), "en-IN").cart,
    { eggs: 2 },
  );
  assert.deepEqual(applyIntent({}, parseLocal("2 packs eggs"), "en-IN").cart, {
    eggs: 2,
  });
  assert.deepEqual(applyIntent({}, parseLocal("2 eggs"), "en-IN").cart, {});
});
test("Hinglish suffix corrections stay within their clause", () => {
  assert.deepEqual(
    applyIntent(
      { milk: 2 },
      parseLocal("milk hata do aur 1 bread add karo"),
      "hi-en",
    ).cart,
    { bread: 1 },
  );
  assert.deepEqual(
    applyIntent({ milk: 2 }, parseLocal("don't remove milk"), "en-IN").cart,
    { milk: 2 },
  );
});
test("empty checkouts, tampered quotes, expired quotes and cross-session use fail", () => {
  assert.throws(() => createQuote({}, "a"));
  const { token } = createQuote({ milk: 1 }, "a");
  assert.equal(readQuote(token, "a").quote.total, 80);
  assert.throws(() => readQuote(token, "b"));
  assert.throws(() => readQuote(`${token.slice(0, -8)}aaaaaaaa`, "a"));
  const data = readQuote(token, "a");
  assert.throws(() => readQuote(sign({ ...data, expires: 1 }), "a"));
  assert.throws(() => verify(token + ".extra"));
});
test("checkout retry is idempotent and order boards are session scoped", async () => {
  const session = crypto.randomUUID();
  const { token } = createQuote({ milk: 2 }, session);
  const checkout = readQuote(token, session);
  const results = await Promise.all([
    saveOrder(checkout),
    saveOrder(checkout),
    saveOrder(checkout),
  ]);
  assert.equal(new Set(results.map((o) => o.id)).size, 1);
  assert.equal((await listOrders(session)).length, 1);
  assert.equal((await listOrders("other")).length, 0);
  await assert.rejects(advanceOrder(checkout.id, "other"));
  await advanceOrder(checkout.id, session);
  assert.equal((await listOrders(session))[0].status, "Packing");
  await advanceOrder(checkout.id, session);
  assert.equal((await listOrders(session))[0].status, "Ready");
});
