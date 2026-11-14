export type Language = "en-IN" | "hi-IN" | "hi-en";
export type Category =
  | "All essentials"
  | "Dairy & bread"
  | "Pantry"
  | "Fresh produce";
export interface Product {
  id: string;
  name: string;
  hindi: string;
  unit: string;
  price: number;
  stock: number;
  category: Category;
  color: string;
  art: string;
  aliases: string[];
}
export const CATALOG: Product[] = [
  {
    id: "milk",
    name: "Fresh milk",
    hindi: "दूध",
    unit: "1 litre",
    price: 60,
    stock: 12,
    category: "Dairy & bread",
    color: "#dce9ed",
    art: "milk",
    aliases: ["milk", "doodh", "dudh", "दूध"],
  },
  {
    id: "bread",
    name: "Whole wheat bread",
    hindi: "ब्रेड",
    unit: "400 g loaf",
    price: 45,
    stock: 8,
    category: "Dairy & bread",
    color: "#eedcc5",
    art: "bread",
    aliases: ["bread", "ब्रेड"],
  },
  {
    id: "rice",
    name: "Everyday basmati",
    hindi: "चावल",
    unit: "1 kg",
    price: 95,
    stock: 20,
    category: "Pantry",
    color: "#e9e5d3",
    art: "bag",
    aliases: ["rice", "chawal", "chaval", "चावल", "basmati", "बासमती"],
  },
  {
    id: "atta",
    name: "Whole wheat atta",
    hindi: "आटा",
    unit: "1 kg",
    price: 48,
    stock: 15,
    category: "Pantry",
    color: "#ead4bd",
    art: "bag",
    aliases: ["atta", "aata", "flour", "आटा", "आटे"],
  },
  {
    id: "dal",
    name: "Toor dal",
    hindi: "दाल",
    unit: "1 kg",
    price: 140,
    stock: 9,
    category: "Pantry",
    color: "#f0df9d",
    art: "bag",
    aliases: ["dal", "daal", "lentils", "दाल"],
  },
  {
    id: "oil",
    name: "Sunflower oil",
    hindi: "तेल",
    unit: "1 litre",
    price: 135,
    stock: 6,
    category: "Pantry",
    color: "#e9e6ba",
    art: "oil",
    aliases: ["oil", "tel", "तेल"],
  },
  {
    id: "tomato",
    name: "Farm tomatoes",
    hindi: "टमाटर",
    unit: "1 kg",
    price: 40,
    stock: 10,
    category: "Fresh produce",
    color: "#eed8cf",
    art: "tomato",
    aliases: ["tomato", "tomatoes", "tamatar", "टमाटर"],
  },
  {
    id: "onion",
    name: "Red onions",
    hindi: "प्याज़",
    unit: "1 kg",
    price: 35,
    stock: 10,
    category: "Fresh produce",
    color: "#e8dce9",
    art: "onion",
    aliases: ["onion", "onions", "pyaz", "pyaaz", "प्याज", "प्याज़"],
  },
  {
    id: "sugar",
    name: "Classic sugar",
    hindi: "चीनी",
    unit: "1 kg",
    price: 44,
    stock: 15,
    category: "Pantry",
    color: "#dfe7df",
    art: "bag",
    aliases: ["sugar", "cheeni", "chini", "चीनी"],
  },
  {
    id: "tea",
    name: "Assam chai",
    hindi: "चाय",
    unit: "250 g",
    price: 110,
    stock: 0,
    category: "Pantry",
    color: "#d5e2ce",
    art: "tea",
    aliases: ["tea", "chai", "चाय"],
  },
  {
    id: "eggs",
    name: "Farm eggs",
    hindi: "अंडे",
    unit: "6 pack",
    price: 48,
    stock: 7,
    category: "Dairy & bread",
    color: "#e9e0d3",
    art: "eggs",
    aliases: ["eggs", "egg", "ande", "अंडे", "अंडा"],
  },
  {
    id: "potato",
    name: "Golden potatoes",
    hindi: "आलू",
    unit: "1 kg",
    price: 30,
    stock: 18,
    category: "Fresh produce",
    color: "#e9ddc6",
    art: "potato",
    aliases: ["potato", "potatoes", "aloo", "aalu", "आलू"],
  },
];
export type Cart = Record<string, number>;
export interface CartLine {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  price: number;
  amount: number;
}
export interface Quote {
  lines: CartLine[];
  subtotal: number;
  delivery: number;
  total: number;
  count: number;
}
export function validateCart(input: unknown): Cart {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Invalid basket.");
  const cart: Cart = {};
  for (const [id, qty] of Object.entries(input)) {
    const p = CATALOG.find((p) => p.id === id);
    if (
      !p ||
      typeof qty !== "number" ||
      !Number.isInteger(qty) ||
      qty < 0 ||
      qty > Math.min(p.stock, 20)
    )
      throw new Error(
        `Check quantity for ${p?.name ?? "unknown product"}. Maximum available: ${p?.stock ?? 0}.`,
      );
    if (qty) cart[id] = qty;
  }
  return cart;
}
export function priceCart(input: unknown): Quote {
  const cart = validateCart(input);
  const lines = Object.entries(cart).map(([id, quantity]) => {
    const p = CATALOG.find((p) => p.id === id)!;
    return {
      id,
      name: p.name,
      unit: p.unit,
      quantity,
      price: p.price,
      amount: quantity * p.price,
    };
  });
  const subtotal = lines.reduce((sum, l) => sum + l.amount, 0);
  const delivery = subtotal === 0 || subtotal >= 299 ? 0 : 20;
  return {
    lines,
    subtotal,
    delivery,
    total: subtotal + delivery,
    count: lines.reduce((sum, l) => sum + l.quantity, 0),
  };
}
export const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
