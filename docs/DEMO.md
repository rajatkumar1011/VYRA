# VYRA demo walkthrough

Open [VYRA](https://vyra-gnani.vercel.app) to try voice shopping, basket corrections and order fulfilment. For a local voice demo, configure `GNANI_API_KEY` and verify microphone access before starting.

| Time   | Show / say                                                                                                                 |
| ------ | -------------------------------------------------------------------------------------------------------------------------- |
| 0–8s   | Storefront: “Customers should order in the language they already speak. This is VYRA.”                                     |
| 8–22s  | Opt in, record “Do litre doodh aur ek kilo chawal.” Stop recording. Show returned transcript, spoken reply and ₹235 total. |
| 22–32s | Say “Remove milk.” Show correction. Add bread from the catalog to demonstrate both input paths.                            |
| 32–40s | Say “Ek chai add karo.” Show unavailable tea being refused without substitution.                                           |
| 40–50s | Review pack sizes and delivery. Explicitly confirm the demo order.                                                         |
| 50–57s | Shopkeeper: Received → Packing → Ready. Download receipt.                                                                  |
| 57–60s | “Gnani hears and speaks. VYRA turns the conversation into a verified action.”                                              |

## Demo scope

Products, stock limits and orders are demonstration data. VYRA does not collect payments or arrange real deliveries. Voice processing requires consent and a working speech-provider connection; text and catalog controls remain available when voice is unavailable.
