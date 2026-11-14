import { CATALOG, priceCart, validateCart, type Language } from "./catalog";
export interface Action {
  product: string;
  quantity: number;
  operation: "add" | "set" | "remove";
}
export interface Intent {
  actions: Action[];
  kind: "basket" | "catalog" | "checkout" | "help";
  message?: string;
}
const numbers: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  half: 0.5,
  ek: 1,
  do: 2,
  teen: 3,
  char: 4,
  chaar: 4,
  paanch: 5,
  aadha: 0.5,
  एक: 1,
  दो: 2,
  तीन: 3,
  चार: 4,
  पाँच: 5,
  पांच: 5,
  आधा: 0.5,
};
const numeric = (s: string) =>
  s.replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x0966));
// Deliberately bounded fallback. An LLM can extend language understanding, never pricing or order creation.
export function parseLocal(text: string): Intent {
  const s = numeric(text.toLowerCase()).replace(
    /(\d)(kg|g|ml|litres?|liters?)\b/g,
    "$1 $2",
  );
  if (
    /\b(checkout|confirm|place order|order now)\b|ऑर्डर कर|पक्का|कन्फर्म/.test(
      s,
    )
  )
    return { actions: [], kind: "checkout" };
  if (
    /\b(price|cost|available|stock|how much|do you have|have you got|how many)\b|कीमत|कितने का|मिलता है|मिलेगा/.test(
      s,
    )
  )
    return { actions: [], kind: "catalog" };
  const matches: { product: string; start: number; end: number }[] = [];
  for (const p of CATALOG) {
    for (const alias of [...p.aliases].sort((a, b) => b.length - a.length)) {
      const re = new RegExp(
        `(?<![\\p{L}\\p{N}])${alias}(?![\\p{L}\\p{N}])`,
        "u",
      );
      const m = re.exec(s);
      if (m) {
        matches.push({
          product: p.id,
          start: m.index,
          end: m.index + m[0].length,
        });
        break;
      }
    }
  }
  matches.sort((a, b) => a.start - b.start);
  let inheritedOperation: Action["operation"] = "add";
  const actions: Action[] = matches.map((m, i) => {
    const separator = /\s+(?:and|aur|और)\s+|,/;
    const before =
      s
        .slice(i ? matches[i - 1].end : 0, m.start)
        .split(separator)
        .pop() || "";
    const after = s
      .slice(m.end, i + 1 < matches.length ? matches[i + 1].start : s.length)
      .split(separator)[0];
    const rawAfter = s.slice(
      m.end,
      i + 1 < matches.length ? matches[i + 1].start : s.length,
    );
    const quantityText =
      before +
      ((i === matches.length - 1 || separator.test(rawAfter)) &&
      /^\s*-?\d/.test(after)
        ? " " + after
        : "");
    const tokens = quantityText.trim().split(/[\s,]+/);
    let quantity = 1;
    for (let j = tokens.length - 1; j >= 0; j--) {
      if (/^-?\d+(\.\d+)?$/.test(tokens[j])) {
        quantity = Number(tokens[j]);
        break;
      }
      if (numbers[tokens[j]] !== undefined) {
        quantity = numbers[tokens[j]];
        break;
      }
    }
    if (/\b(g|grams?)\b/.test(quantityText)) {
      quantity /=
        m.product === "bread" ? 400 : m.product === "tea" ? 250 : 1000;
    } else if (/\b(ml|millilitres?|milliliters?)\b/.test(quantityText)) {
      quantity /= 1000;
    }
    // Convert explicit individual eggs/dozens into six-egg packs; never round.
    if (m.product === "eggs" && !/pack|packet|पैक/.test(before)) {
      quantity = /dozen|दर्जन/.test(before) ? quantity * 2 : quantity / 6;
    }
    const remove = /remove|delete|hata|हटा|निकाल/.test(before + after);
    const set = /instead|make|change|sirf|only|कर दो|सिर्फ/.test(
      before + after,
    );
    const explicitAdd = /\b(add|include)\b|डाल|जोड़/.test(before + after);
    const operation = remove
      ? "remove"
      : set
        ? "set"
        : explicitAdd
          ? "add"
          : inheritedOperation;
    inheritedOperation = operation;
    return {
      product: m.product,
      quantity,
      operation,
    };
  });
  // Negative / ambiguous requests must not silently add an item.
  if (/\b(don't|dont|not|no|nahi|nahin)\b|नहीं|मत /.test(s))
    return {
      actions: [],
      kind: "help",
      message:
        "Please use the basket controls to make that change, or say ‘remove milk’.",
    };
  return { actions, kind: actions.length ? "basket" : "help" };
}
export function applyIntent(
  cartInput: unknown,
  intent: Intent,
  language: Language,
) {
  const cart = validateCart(cartInput);
  const events: string[] = [];
  for (const action of intent.actions.slice(0, 12)) {
    const p = CATALOG.find((p) => p.id === action.product);
    if (!p || !["add", "set", "remove"].includes(action.operation)) {
      events.push("Unknown product or action ignored.");
      continue;
    }
    if (action.operation === "remove") {
      delete cart[p.id];
      events.push(`Removed ${p.name}.`);
      continue;
    }
    if (
      !Number.isInteger(action.quantity) ||
      action.quantity < 1 ||
      action.quantity > 20
    ) {
      events.push(
        `${p.name} is sold as ${p.unit}. Please choose 1–20 whole packs.`,
      );
      continue;
    }
    const next =
      action.operation === "set"
        ? action.quantity
        : (cart[p.id] || 0) + action.quantity;
    if (next > p.stock) {
      events.push(
        `${p.name}: only ${p.stock} packs available. Basket unchanged for this item.`,
      );
      continue;
    }
    cart[p.id] = next;
    events.push(`${p.name} × ${next} in your basket.`);
  }
  const quote = priceCart(cart);
  const localized = language !== "en-IN";
  let reply = events.join(" ");
  if (intent.kind === "checkout")
    reply = quote.count
      ? localized
        ? `आपका कुल ${quote.total} रुपये है। नीचे Review order दबाकर सामान और कीमत जाँचें, फिर Confirm demo order दबाएँ।`
        : `Your total is ${quote.total} rupees. Select Review order to check your items and confirm the demo order.`
      : "Your basket is empty. Add a few essentials first.";
  else if (intent.kind === "catalog")
    reply = CATALOG.map(
      (p) =>
        `${p.name}: ${p.price} rupees per ${p.unit}${!p.stock ? " (out of stock)" : ""}`,
    ).join(". ");
  else if (!reply)
    reply =
      intent.message ||
      (localized
        ? "नमस्ते! कहिए ‘दो लीटर दूध और एक किलो चावल’। आप नीचे से सामान भी चुन सकते हैं।"
        : "Hi! Try ‘two litres milk and one kilo rice’, ask for prices, or choose items below. I’ll build your basket for you.");
  else
    reply += localized
      ? ` कुल ${quote.total} रुपये, delivery सहित। नीचे basket जाँच लें।`
      : ` Total ${quote.total} rupees, including delivery. Please check the basket below.`;
  return { cart, quote, reply, events };
}
