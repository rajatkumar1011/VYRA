import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const testRateLimits = process.env.TEST_RATE_LIMITS !== "0";
async function main() {
  const start = await fetch(`${base}/api/shop`);
  assert.equal(start.status, 200);
  const cookie = start.headers.get("set-cookie")!.split(";")[0];
  const post = async (body: unknown, session = cookie) => {
    const r = await fetch(`${base}/api/shop`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: session,
        Origin: base,
      },
      body: JSON.stringify(body),
    });
    return { status: r.status, data: await r.json() };
  };
  const chat = await post({
    action: "chat",
    cart: {},
    text: "दो लीटर दूध और एक किलो चावल",
    language: "hi-IN",
  });
  assert.equal(chat.status, 200);
  assert.deepEqual(chat.data.cart, { milk: 2, rice: 1 });
  assert.equal(chat.data.quote.total, 235);
  const quoted = await post({ action: "quote", cart: chat.data.cart });
  assert.equal(quoted.status, 200);
  assert.equal(
    (
      await post({
        action: "checkout",
        token: quoted.data.token,
        confirmed: false,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await post(
        { action: "checkout", token: quoted.data.token, confirmed: true },
        "",
      )
    ).status,
    400,
  );
  const orders = await Promise.all(
    [1, 2].map(() =>
      post({ action: "checkout", token: quoted.data.token, confirmed: true }),
    ),
  );
  assert.equal(orders[0].status, 200);
  assert.equal(orders[0].data.order.id, orders[1].data.order.id);
  const id = orders[0].data.order.id;
  assert.equal((await post({ action: "advance", id }, "")).status, 400);
  const packed = await post({ action: "advance", id });
  assert.equal(
    packed.data.orders.find((o: { id: string }) => o.id === id).status,
    "Packing",
  );
  const ready = await post({ action: "advance", id });
  assert.equal(
    ready.data.orders.find((o: { id: string }) => o.id === id).status,
    "Ready",
  );
  assert.equal(
    (await post({ action: "quote", cart: { milk: -5 } })).status,
    400,
  );
  assert.equal((await post(null)).status, 400);
  const badOrigin = await fetch(`${base}/api/shop`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://evil.example",
    },
    body: "{}",
  });
  assert.equal(badOrigin.status, 403);
  const invalidAudio = new FormData();
  invalidAudio.append("audio", new Blob([new Uint8Array(80)]), "bad.wav");
  assert.equal(
    (await fetch(`${base}/api/speech`, { method: "POST", body: invalidAudio }))
      .status,
    400,
  );
  assert.equal((await fetch(base)).status, 200);
  const malformedSpeech = await fetch(`${base}/api/speech`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{broken",
  });
  assert.equal(malformedSpeech.status, 400);
  const crossOriginSpeech = await fetch(`${base}/api/speech`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://evil.example",
    },
    body: JSON.stringify({ text: "hello" }),
  });
  assert.equal(crossOriginSpeech.status, 403);
  const malformedUpload = await fetch(`${base}/api/speech`, {
    method: "POST",
    headers: { "Content-Type": "multipart/form-data" },
    body: "invalid multipart",
  });
  assert.equal(malformedUpload.status, 400);

  const tampered = await post({ action: "checkout", token: quoted.data.token + "tampered", confirmed: true });
  assert.equal(tampered.status, 400);
  assert.equal((await post({ action: "quote", cart: {} })).status, 400);
  assert.equal((await post({ action: "quote", cart: { tea: 1 } })).status, 400);
  assert.equal((await post({ action: "quote", cart: { milk: 1.5 } })).status, 400);
  const otherSession = (await fetch(`${base}/api/shop`)).headers.get("set-cookie")!.split(";")[0];
  assert.equal((await post({ action: "advance", id }, otherSession)).status, 400);
  assert.equal((await post({ action: "checkout", token: quoted.data.token, confirmed: true }, otherSession)).status, 400);
  const otherOrders = await fetch(`${base}/api/shop`, { headers: { Cookie: otherSession } });
  assert.deepEqual((await otherOrders.json()).orders, []);

  const oversized = await fetch(`${base}/api/shop`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "chat", text: "x".repeat(21_000) }),
  });
  assert.equal(oversized.status, 413);
  // Local tests can isolate synthetic client IDs. Cloud proxies may overwrite
  // forwarded headers, so skip capacity tests there with TEST_RATE_LIMITS=0.
  for (const [route, limit] of testRateLimits ? [["shop", 60], ["speech", 30]] as const : []) {
    const testClient = `integration-${route}-${crypto.randomUUID()}`;
    for (let i = 0; i <= limit; i++) {
      const response = await fetch(`${base}/api/${route}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": testClient },
        body: "{}",
      });
      assert.equal(response.status, i === limit ? 429 : 400, `${route} request ${i + 1}`);
    }
  }
  console.log(
    `PASS: HTTP ordering, Hindi cart, pricing, confirmation/replay, session isolation, board transitions, tampered reviews, invalid/oversized requests, speech validation and storefront.${testRateLimits ? " Rate limits verified." : " Rate-limit capacity tests skipped."}`,
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
