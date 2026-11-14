import type { Product } from "@/lib/catalog";
export default function ProductArt({ product: p }: { product: Product }) {
  return (
    <svg viewBox="0 0 180 130" aria-hidden="true" className="product-art">
      <ellipse cx="90" cy="113" rx="40" ry="7" fill="#000" opacity=".07" />
      {p.art === "milk" && (
        <g transform="rotate(-8 90 70)">
          <path
            d="M65 36 76 17h32l10 19v72H65z"
            fill="#fafbf5"
            stroke="#78939b"
            strokeWidth="1.5"
          />
          <path d="M76 17v19h42l-10-19" fill="#b6d4de" />
          <path d="M65 36h53v19H65z" fill="#1b565d" />
          <path d="M65 91h53v17H65z" fill="#bfdce5" />
          <text
            x="91"
            y="75"
            textAnchor="middle"
            fontSize="15"
            fontWeight="800"
            fill="#234a50"
          >
            MILK
          </text>
          <text x="91" y="86" textAnchor="middle" fontSize="7" fill="#527279">
            FRESH · 1 L
          </text>
          <path d="M76 17h32" stroke="#fff" strokeWidth="5" />
        </g>
      )}
      {p.art === "bread" && (
        <g transform="rotate(6 90 70)">
          <path
            d="m62 31 8-14 14 6 17-7 13 15-4 15 10 53q-27 20-60 0l7-53z"
            fill="#f8edd8"
            stroke="#bba07b"
          />
          <path d="M67 44q22-25 43 0l7 54q-26 12-53 0z" fill="#b7763e" />
          <path
            d="M72 48q9-10 17-9M76 65q9-10 17-9"
            fill="none"
            stroke="#deb67d"
            strokeWidth="4"
          />
          <path d="M61 72h58v24H61z" fill="#344c37" />
          <text x="90" y="83" textAnchor="middle" fontSize="8" fill="#fff">
            WHOLE WHEAT
          </text>
          <text x="90" y="92" textAnchor="middle" fontSize="7" fill="#d4dda7">
            BAKED FRESH
          </text>
        </g>
      )}
      {p.art === "bag" && (
        <g transform="rotate(-6 90 70)">
          <path
            d="M61 22h59l-5 15 8 66q-32 15-65 0l8-66z"
            fill={
              p.id === "dal"
                ? "#d9a037"
                : p.id === "atta"
                  ? "#b57748"
                  : "#f9f7eb"
            }
            stroke="#9b875e"
          />
          <path d="M62 22h57M64 28h53" stroke="#917653" strokeWidth="2" />
          <rect
            x="60"
            y="47"
            width="61"
            height="39"
            rx="2"
            fill={p.id === "rice" ? "#366053" : "#f5edda"}
          />
          <text
            x="90"
            y="61"
            textAnchor="middle"
            fontSize="6"
            letterSpacing="2"
            fill="#999573"
          >
            THE DAILY
          </text>
          <text
            x="90"
            y="74"
            textAnchor="middle"
            fontSize="12"
            fontWeight="800"
            fill={p.id === "rice" ? "#fff" : "#664d2e"}
          >
            {p.id.toUpperCase()}
          </text>
          <text x="90" y="97" textAnchor="middle" fontSize="8" fill="#686346">
            1 KG
          </text>
        </g>
      )}
      {p.art === "oil" && (
        <g transform="rotate(7 90 70)">
          <rect x="79" y="14" width="24" height="16" rx="3" fill="#375b39" />
          <path
            d="M80 30h22v10q15 5 15 18v46q-26 13-50 0V58q0-13 13-18z"
            fill="#d3b339"
            stroke="#9f8b2e"
          />
          <path d="M74 56v38" stroke="#fff6b1" strokeWidth="5" opacity=".7" />
          <rect x="66" y="61" width="52" height="29" fill="#f8f4de" />
          <text x="92" y="73" textAnchor="middle" fontSize="7" fill="#65723d">
            SUNFLOWER
          </text>
          <text
            x="92"
            y="84"
            textAnchor="middle"
            fontSize="12"
            fontWeight="700"
            fill="#426143"
          >
            OIL
          </text>
        </g>
      )}
      {p.art === "tomato" && (
        <g>
          <circle cx="70" cy="85" r="29" fill="#bd4b35" />
          <circle cx="112" cy="75" r="32" fill="#dd6549" />
          <path
            d="m108 45-12 9 15-2 8 8-3-13 8-6-14 3-5-7zM64 57l-8 8 12-2 9 9-3-13 8-4-13 4z"
            fill="#42634a"
          />
          <path
            d="M91 61q-8 8-8 18"
            stroke="#f6ad84"
            strokeWidth="5"
            fill="none"
            strokeLinecap="round"
          />
        </g>
      )}
      {p.art === "onion" && (
        <g>
          <path
            d="M72 37q-3 15-22 29c-30 35 32 61 49 28 13-26-22-39-20-57"
            fill="#a56484"
          />
          <path
            d="M113 30q-2 17-22 34c-28 33 31 62 50 28 16-28-25-42-22-62"
            fill="#be83a3"
          />
          <path
            d="M114 40q-16 53-3 67M119 45q20 39 12 53M73 44q-15 40-5 61"
            stroke="#e6b8c9"
            strokeWidth="2"
            fill="none"
          />
          <path d="m113 30 4-14 2 14M72 37l5-12 2 12" fill="#947348" />
        </g>
      )}
      {p.art === "tea" && (
        <g transform="rotate(-5 90 70)">
          <path d="M61 25h59v82H61z" fill="#365a41" />
          <path d="M61 25 72 16h47v9" fill="#7c8d55" />
          <rect x="68" y="40" width="45" height="44" fill="#e9dfb1" />
          <text x="90" y="57" textAnchor="middle" fontSize="8" fill="#5c663d">
            ASSAM
          </text>
          <text
            x="90"
            y="73"
            textAnchor="middle"
            fontSize="16"
            fontWeight="700"
            fill="#37553e"
          >
            CHAI
          </text>
        </g>
      )}
      {p.art === "eggs" && (
        <g>
          <path d="m40 77 16 30h78l13-30z" fill="#ab9c7f" />
          <path d="m40 77 26-20h61l20 20-24 18H60z" fill="#c6bda5" />
          {[65, 91, 117].map((x, i) => (
            <ellipse
              key={x}
              cx={x}
              cy={70 - i * 3}
              rx="14"
              ry="22"
              fill={i === 1 ? "#d7b994" : "#f3e9d5"}
              stroke="#bbaa8d"
            />
          ))}
        </g>
      )}
      {p.art === "potato" && (
        <g>
          {[
            [67, 82, -20],
            [111, 68, 30],
            [116, 94, -10],
          ].map(([x, y, r], i) => (
            <g key={i} transform={`rotate(${r} ${x} ${y})`}>
              <ellipse
                cx={x}
                cy={y}
                rx="29"
                ry="21"
                fill={i === 1 ? "#c39b5c" : "#b58d51"}
              />
              <circle cx={x - 8} cy={y - 4} r="2" fill="#8c713f" />
              <circle cx={x + 12} cy={y + 5} r="1.5" fill="#8c713f" />
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}
