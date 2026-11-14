"use client";
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import {
  CATALOG,
  money,
  priceCart,
  validateCart,
  type Cart,
  type Category,
  type Language,
  type Quote,
} from "@/lib/catalog";
import type { ShopOrder } from "@/lib/shop-store";
import { toWav } from "@/lib/audio";
import Icon from "./Icon";
import ProductArt from "./ProductArt";
import ThemeToggle from "./ThemeToggle";
type Message = {
  role: "you" | "vyra";
  text: string;
};
type Config = {
  speech: boolean;
  storage: string;
  orders: ShopOrder[];
};
const categories: Category[] = [
  "All essentials",
  "Dairy & bread",
  "Pantry",
  "Fresh produce",
];
const welcome: Message = {
  role: "vyra",
  text: "What would you like to buy?",
};
export default function Storefront() {
  const [tab, setTab] = useState("store");
  const [category, setCategory] = useState<Category>("All essentials");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Cart>({});
  const [hydrated, setHydrated] = useState(false);
  const [config, setConfig] = useState<Config | null>(null);
  const [language, setLanguage] = useState<Language>("hi-en");
  const [messages, setMessages] = useState<Message[]>([welcome]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [review, setReview] = useState<{ quote: Quote; token: string } | null>(
    null,
  );
  const [receipt, setReceipt] = useState<ShopOrder | null>(null);
  const [consent, setConsent] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [basketVisible, setBasketVisible] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const audioUrl = useRef<string | null>(null);
  const speechAbort = useRef<AbortController | null>(null);
  const playbackGeneration = useRef(0);
  const voiceEnabledRef = useRef(true);
  const cancelled = useRef(false);
  const lock = useRef(false);
  const transcript = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const basketRef = useRef<HTMLElement | null>(null);
  const total = priceCart(cart);
  const pending = busy || recording;
  async function request(body: object) {
    const res = await fetch("/api/shop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok)
      throw new Error(data.error || "Something went wrong. Please try again.");
    return data;
  }
  async function refresh() {
    const res = await fetch("/api/shop", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setConfig(data);
  }
  useEffect(() => {
    cancelled.current = false;
    if (new URLSearchParams(window.location.search).get("view") === "orders")
      setTab("orders");
    void refresh().catch((e) => setError(e.message));
    try {
      const saved = localStorage.getItem("vyra-basket");
      if (saved) setCart(validateCart(JSON.parse(saved)));
    } catch {
      /* invalid or unavailable browser storage */
    }
    setHydrated(true);
    return () => {
      cancelled.current = true;
      speechAbort.current?.abort();
      playbackGeneration.current++;
      recorder.current?.state === "recording" && recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
      if (timer.current) clearInterval(timer.current);
      audio.current?.pause();
      if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    };
  }, []);
  useEffect(() => {
    if (hydrated) {
      try {
        localStorage.setItem("vyra-basket", JSON.stringify(cart));
      } catch {
        /* private browser */
      }
    }
  }, [cart, hydrated]);
  useEffect(() => {
    transcript.current?.scrollTo({
      top: transcript.current.scrollHeight,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, [messages, busy]);
  useEffect(() => {
    if (review || receipt) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [review, receipt]);
  useEffect(() => {
    setBasketVisible(false);
    if (!basketRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setBasketVisible(entry.isIntersecting),
      { rootMargin: "0px 0px -88px 0px" },
    );
    observer.observe(basketRef.current);
    return () => observer.disconnect();
  }, [tab]);
  function change(id: string, delta: number) {
    if (pending) return;
    setReview(null);
    setCart((prev) => {
      const p = CATALOG.find((p) => p.id === id)!;
      const next = { ...prev };
      const n = Math.max(0, Math.min(p.stock, (next[id] || 0) + delta));
      if (n) next[id] = n;
      else delete next[id];
      return next;
    });
  }
  function stopAudio() {
    playbackGeneration.current++;
    speechAbort.current?.abort();
    speechAbort.current = null;
    if (audio.current) {
      audio.current.onended = null;
      audio.current.onerror = null;
      audio.current.pause();
      audio.current = null;
    }
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    audioUrl.current = null;
    setSpeaking(false);
  }
  async function speak(reply: string) {
    if (!config?.speech || !voiceEnabledRef.current || cancelled.current) return;
    const controller = new AbortController();
    speechAbort.current = controller;
    const generation = playbackGeneration.current;
    const stale = () => controller.signal.aborted || cancelled.current ||
      !voiceEnabledRef.current || generation !== playbackGeneration.current;
    let blob: Blob;
    try {
      const response = await fetch("/api/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: reply, language }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }
      blob = await response.blob();
    } catch (e) {
      if (stale()) return;
      throw e;
    } finally {
      if (speechAbort.current === controller) speechAbort.current = null;
    }
    if (stale()) return;
    const url = URL.createObjectURL(blob);
    audioUrl.current = url;
    const player = new Audio(url);
    audio.current = player;
    setSpeaking(true);
    player.onended = () => {
      if (audio.current !== player) return;
      setSpeaking(false);
      audio.current = null;
      URL.revokeObjectURL(url);
      if (audioUrl.current === url) audioUrl.current = null;
    };
    player.onerror = () => {
      if (audio.current !== player) return;
      stopAudio();
      setError(
        "Audio playback failed. Your reply is available in the transcript.",
      );
    };
    try {
      await player.play();
    } catch {
      if (stale()) return;
      stopAudio();
      throw new Error(
        "Audio playback was blocked. Use the transcript or try speaking again.",
      );
    }
  }
  async function send(value: string) {
    if (!value.trim() || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setText("");
    setReview(null);
    stopAudio();
    setMessages((prev) => [...prev, { role: "you", text: value }]);
    let cartUpdated = false;
    try {
      const data = await request({
        action: "chat",
        text: value,
        cart,
        language,
      });
      setCart(data.cart);
      cartUpdated = true;
      setMessages((prev) => [
        ...prev,
        {
          role: "vyra",
          text: data.reply,
        },
      ]);
      await speak(data.reply);
    } catch (e) {
      if (!cartUpdated && !cancelled.current) setText(value);
      setError(
        e instanceof Error ? e.message : "Could not send. Please try again.",
      );
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  async function startRecording() {
    if (recording) {
      if (recorder.current?.state === "recording") recorder.current.stop();
      return;
    }
    if (lock.current) return;
    if (!config?.speech) {
      setError(
        "Voice is unavailable. Type your shopping list below.",
      );
      return;
    }
    if (!consent) {
      setError(
        "Please allow sending your voice clip to Gnani using the checkbox below.",
      );
      return;
    }
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError(
        "This browser cannot record audio. Use Chrome or Edge over HTTPS, or type below.",
      );
      return;
    }
    stopAudio();
    setError("");
    lock.current = true;
    setBusy(true);
    cancelled.current = false;
    try {
      const mic = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
        },
      });
      if (cancelled.current) {
        mic.getTracks().forEach((t) => t.stop());
        lock.current = false;
        return;
      }
      stream.current = mic;
      const rec = new MediaRecorder(mic);
      recorder.current = rec;
      const chunks: Blob[] = [];
      rec.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      rec.onstop = async () => {
        mic.getTracks().forEach((t) => t.stop());
        if (timer.current) clearInterval(timer.current);
        setRecording(false);
        setBusy(true);
        if (cancelled.current) {
          setBusy(false);
          lock.current = false;
          return;
        }
        try {
          const wav = await toWav(new Blob(chunks, { type: rec.mimeType }));
          const form = new FormData();
          form.append("audio", wav, "utterance.wav");
          form.append("language", language);
          const res = await fetch("/api/speech", {
            method: "POST",
            body: form,
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          if (!data.transcript)
            throw new Error(
              "I didn’t catch any speech. Please try again or type your request.",
            );
          lock.current = false;
          await send(data.transcript);
        } catch (e) {
          setError(
            e instanceof Error
              ? e.message
              : "Recording failed. Try typing instead.",
          );
        } finally {
          setBusy(false);
          lock.current = false;
        }
      };
      rec.start();
      setRecording(true);
      setBusy(false);
      setSeconds(0);
      let elapsed = 0;
      timer.current = setInterval(() => {
        elapsed++;
        setSeconds(elapsed);
        if (elapsed >= 25 && rec.state === "recording") rec.stop();
      }, 1000);
    } catch (e) {
      stream.current?.getTracks().forEach((t) => t.stop());
      setBusy(false);
      lock.current = false;
      setError(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Microphone permission was denied. Allow access in your browser or use text."
          : "Could not open the microphone. Try typing instead.",
      );
    }
  }
  async function checkout() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    stopAudio();
    try {
      setReview(await request({ action: "quote", cart }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  async function confirm() {
    if (!review || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const data = await request({
        action: "checkout",
        token: review.token,
        confirmed: true,
      });
      setConfig((prev) => prev && { ...prev, orders: data.orders });
      setReceipt(data.order);
      setReview(null);
      setCart({});
      setMessages((prev) => [
        ...prev,
        {
          role: "vyra",
          text: `Demo order #${data.order.id.slice(0, 8).toUpperCase()} received. No payment collected.`,
        },
      ]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  async function advance(id: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const data = await request({ action: "advance", id });
      setConfig((prev) => prev && { ...prev, orders: data.orders });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  function download(order: ShopOrder) {
    const lines = [
      "VYRA — DEMO RECEIPT",
      `Order ${order.id}`,
      new Date(order.createdAt).toLocaleString("en-IN"),
      "",
      ...order.quote.lines.map(
        (l) => `${l.name} (${l.unit}) x ${l.quantity} — INR ${l.amount}`,
      ),
      "",
      `Subtotal: INR ${order.quote.subtotal}`,
      `Delivery: INR ${order.quote.delivery}`,
      `Total: INR ${order.quote.total}`,
      "",
      "Synthetic demo store. No payment collected. No real delivery.",
    ];
    const url = URL.createObjectURL(
      new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `vyra-${order.id.slice(0, 8)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }
  const filtered = CATALOG.filter(
    (p) =>
      (category === "All essentials" || p.category === category) &&
      `${p.name} ${p.hindi} ${p.aliases.join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <div className="app-frame">
      <a className="skip-link" href="#main">Skip to shopping</a>
      <header className="site-header">
        <div className="nav-shell">
          <a className="wordmark" href="/" aria-label="VYRA home">
            <span className="brand-glyph"><Icon name="spark" size={24} /></span>
            vyra<span className="brand-dot">.</span>
          </a>
        <nav aria-label="Main navigation">
          {[
            ["store", "grid", "Storefront"],
            ["orders", "receipt", "Shopkeeper"],
          ].map(([id, icon, label]) => (
            <button
              key={id}
              className={`nav-item ${tab === id ? "active" : ""}`}
              aria-label={label}
              aria-current={tab === id ? "page" : undefined}
              disabled={pending}
              onClick={() => {
                stopAudio();
                setTab(id);
              }}
            >
              <Icon name={icon} />
              {label}
              {id === "orders" && !!config?.orders.length && (
                <span className="nav-count">{config.orders.length}</span>
              )}
            </button>
          ))}
        </nav>
          <div className="header-actions">
            {tab === "store" && total.count > 0 && (
              <a
                className="basket-shortcut"
                href="#basket"
                aria-label={`View basket with ${total.count} items, ${money(total.total)}`}
              >
                <Icon name="bag" size={20} />
                <strong>{money(total.total)}</strong>
              </a>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>
      <div className="app-body">
        <main id="main">
          {error && (
            <div className="error-banner" role="alert">
              <Icon name="info" />
              <span>{error}</span>
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <Icon name="close" size={17} />
              </button>
            </div>
          )}
          {tab === "store" && (
            <>
              <div className="page-title">
                <div>
                  <div className="store-label"><span className="live-dot" /> Everyday Store <span className="demo-badge">Demo</span></div>
                  <h1>Shop your everyday <span>essentials.</span></h1>
                  <p>Speak, type or browse. Your basket follows along.</p>
                </div>
                <a className="browse-link" href="#groceries">Browse groceries <span aria-hidden="true">↘</span></a>
              </div>
              <div className="assistant-layout">
                  <section
                    className={`voice-card ${recording ? "is-recording" : ""}`}
                    aria-label="Voice shopping assistant"
                  >
                    <div className="voice-upper">
                      <div className="voice-copy">
                        <span className="assistant-label"><Icon name="spark" size={18} /> Your shopping assistant</span>
                        <h2>Tell VYRA what you need.</h2>
                        <p>Speak or type in Hindi, English or Hinglish.</p>
                        <div className="voice-controls">
                          <button
                            className={`talk-button ${recording ? "recording" : ""}`}
                            disabled={busy || !config}
                            onClick={() => void startRecording()}
                          >
                            <Icon name={recording ? "close" : "mic"} />
                            {recording
                              ? `Stop · ${seconds}s`
                              : busy
                                ? "Working…"
                                : "Talk to VYRA"}
                          </button>
                          <label className="language-select">
                            <span className="sr-only">
                              Conversation language
                            </span>
                            <select
                              value={language}
                              disabled={pending}
                              onChange={(e) =>
                                setLanguage(e.target.value as Language)
                              }
                            >
                              <option value="hi-en">Hinglish</option>
                              <option value="en-IN">English</option>
                              <option value="hi-IN">हिंदी</option>
                            </select>
                          </label>
                          {speaking && (
                            <button
                              className="stop-audio"
                              aria-label="Stop audio playback"
                              onClick={stopAudio}
                            >
                              <Icon name="sound" />
                              Stop
                            </button>
                          )}
                        </div>
                        {!config?.speech && config && (
                          <p className="voice-unavailable">Voice is unavailable. Type below to shop.</p>
                        )}
                      </div>
                      <div
                        className={`voice-orbit ${recording || speaking ? "animate" : ""}`}
                        aria-hidden="true"
                      >
                        <div className="orbit-ring ring-one" />
                        <div className="orbit-ring ring-two" />
                        <div className="orb">
                          <div className="orb-glow" />
                          <div className="wave-bars">
                            {[20, 38, 62, 44, 77, 51, 31, 45, 20].map(
                              (h, i) => (
                                <i
                                  key={i}
                                  style={{
                                    height: h,
                                    animationDelay: `${i * 0.12}s`,
                                  }}
                                />
                              ),
                            )}
                          </div>
                        </div>
                        <span className="orbit-spark">✳</span>
                      </div>
                    </div>
                    <label className="consent">
                      <input
                        type="checkbox"
                        checked={consent}
                        disabled={pending}
                        onChange={(e) => setConsent(e.target.checked)}
                      />
                      <span>Allow voice clips to be sent to Gnani. VYRA does not store audio.</span>
                    </label>
                  </section>
                  <section
                    className="conversation-card"
                    aria-label="Conversation"
                  >
                    <div className="conversation-head">
                      <h3>
                        <span className="live-dot" />
                        Conversation
                      </h3>
                      <div>
                        <label className="audio-toggle">
                          <input
                            type="checkbox"
                            checked={voiceEnabled}
                            onChange={(e) => {
                              voiceEnabledRef.current = e.target.checked;
                              setVoiceEnabled(e.target.checked);
                              if (!e.target.checked) stopAudio();
                            }}
                          />
                          Spoken replies
                        </label>
                        <button
                          className="text-button"
                          disabled={pending}
                          onClick={() => {
                            stopAudio();
                            setMessages([welcome]);
                          }}
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                    <div
                      className="messages"
                      ref={transcript}
                      role="log"
                      aria-live="polite"
                    >
                      {messages.map((m, i) => (
                        <div className={`message ${m.role}`} key={i}>
                          <span
                            className={`message-avatar ${m.role === "vyra" ? "ai-avatar" : ""}`}
                          >
                            {m.role === "vyra" ? "v" : "Y"}
                          </span>
                          <div>
                            <span className="message-name">
                              {m.role === "vyra" ? "VYRA" : "You"}
                            </span>
                            <p>{m.text}</p>
                          </div>
                        </div>
                      ))}
                      {busy && (
                        <div className="thinking" role="status">
                          VYRA is working<span>•••</span>
                        </div>
                      )}
                    </div>
                    <div className="suggestions">
                      {[
                        "2 milk and 1 bread",
                        "Do kilo chawal",
                        "What’s in stock?",
                      ].map((s) => (
                        <button
                          key={s}
                          disabled={pending || !config}
                          onClick={() => void send(s)}
                        >
                          {s}
                          <Icon name="arrow" size={12} />
                        </button>
                      ))}
                    </div>
                    <form
                      className="message-input"
                      onSubmit={(e: FormEvent) => {
                        e.preventDefault();
                        void send(text);
                      }}
                    >
                      <input
                        aria-label="Message VYRA"
                        placeholder="Or type what you need…"
                        value={text}
                        maxLength={600}
                        disabled={pending}
                        onChange={(e) => setText(e.target.value)}
                      />
                      <button
                        aria-label="Send message"
                        disabled={pending || !text.trim() || !config}
                      >
                        <span>Send</span>
                        <Icon name="arrow" size={20} />
                      </button>
                    </form>
                  </section>
              </div>
              <div className="commerce-layout">
                <div className="store-main">
                  <section className="catalog" id="groceries" aria-label="Product catalog">
                    <div className="section-heading">
                      <div>
                        <h2>Everyday groceries</h2>
                        <p className="product-count" role="status">{filtered.length} products</p>
                      </div>
                      <label className="search-box">
                        <Icon name="search" size={17} />
                        <input
                          aria-label="Search products"
                          placeholder="Search products"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </label>
                    </div>
                    <div
                      className="category-tabs"
                      role="group"
                      aria-label="Product categories"
                    >
                      {categories.map((c) => (
                        <button
                          key={c}
                          className={category === c ? "selected" : ""}
                          aria-pressed={category === c}
                          onClick={() => setCategory(c)}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                    <div className="product-grid">
                      {filtered.map((p) => (
                        <article className="product-card" key={p.id}>
                          <div
                            className="product-image"
                            style={{ "--product-tint": p.color } as CSSProperties}
                          >
                            <ProductArt product={p} />
                          </div>
                          <div className="product-info">
                            <h3>{p.name}</h3>
                            <p>
                              {p.unit}
                              <span>{p.hindi}</span>
                            </p>
                            <div className="product-bottom">
                              <strong>{money(p.price)}</strong>
                              {cart[p.id] ? (
                                <div className="stepper">
                                  <button
                                    aria-label={`Remove one ${p.name}`}
                                    disabled={pending}
                                    onClick={() => change(p.id, -1)}
                                  >
                                    <Icon name="minus" size={14} />
                                  </button>
                                  <span>{cart[p.id]}</span>
                                  <button
                                    aria-label={`Add one ${p.name}`}
                                    disabled={pending || cart[p.id] >= p.stock}
                                    onClick={() => change(p.id, 1)}
                                  >
                                    <Icon name="plus" size={14} />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  className="add-product"
                                  disabled={!p.stock || pending}
                                  onClick={() => change(p.id, 1)}
                                  aria-label={`Add ${p.name}`}
                                >
                                  {p.stock ? "Add" : "Sold out"}
                                  {!!p.stock && <Icon name="plus" size={15} />}
                                </button>
                              )}
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                    {!filtered.length && (
                      <div className="empty-search">
                        <Icon name="search" />
                        <h3>No essentials found</h3>
                        <p>Try “milk”, “चावल”, or another category.</p>
                        <button
                          className="small-button"
                          onClick={() => {
                            setSearch("");
                            setCategory("All essentials");
                          }}
                        >
                          Clear filters
                        </button>
                      </div>
                    )}
                  </section>
                </div>
                <aside
                  className="basket"
                  ref={basketRef}
                  id="basket"
                  aria-label="Shopping basket"
                >
                  <div className="basket-header">
                    <h2>
                      <Icon name="bag" />
                      Your basket
                    </h2>
                    <span>{total.count}</span>
                  </div>
                  <div className="delivery-note">
                    <Icon name="clock" size={17} />
                    <span>
                      Delivery ₹20 · Free from ₹299
                    </span>
                  </div>
                  {!total.lines.length ? (
                    <div className="empty-basket">
                      <span className="empty-basket-icon"><Icon name="bag" size={36} /></span>
                      <h3>Your basket is empty</h3>
                      <p>Add groceries or tell VYRA what you need.</p>
                    </div>
                  ) : (
                    <div className="basket-lines">
                      {total.lines.map((l) => (
                        <div className="basket-line" key={l.id}>
                          <div
                            className="basket-thumb"
                            style={{
                              "--product-tint": CATALOG.find((p) => p.id === l.id)!.color,
                            } as CSSProperties}
                          >
                            <ProductArt
                              product={CATALOG.find((p) => p.id === l.id)!}
                            />
                          </div>
                          <div className="basket-line-detail">
                            <strong>{l.name}</strong>
                            <small>{l.unit}</small>
                            <div className="stepper">
                              <button
                                aria-label={`Decrease basket ${l.name}`}
                                disabled={pending}
                                onClick={() => change(l.id, -1)}
                              >
                                <Icon name="minus" size={12} />
                              </button>
                              <span>{l.quantity}</span>
                              <button
                                aria-label={`Increase basket ${l.name}`}
                                disabled={
                                  pending ||
                                  l.quantity >=
                                    CATALOG.find((p) => p.id === l.id)!.stock
                                }
                                onClick={() => change(l.id, 1)}
                              >
                                <Icon name="plus" size={12} />
                              </button>
                            </div>
                          </div>
                          <strong>{money(l.amount)}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="basket-totals">
                    <div>
                      <span>Subtotal</span>
                      <span>{money(total.subtotal)}</span>
                    </div>
                    <div>
                      <span>Delivery</span>
                      <span>
                        {total.delivery
                          ? money(total.delivery)
                          : total.count
                            ? "Free"
                            : "—"}
                      </span>
                    </div>
                    <div className="total-row">
                      <strong>Total</strong>
                      <strong>{money(total.total)}</strong>
                    </div>
                  </div>
                  <button
                    className="checkout-button"
                    disabled={!total.count || pending || !config}
                    onClick={() => void checkout()}
                  >
                    Review order
                    <Icon name="arrow" size={18} />
                  </button>
                  <div className="demo-notice">
                    <p>Demo only. No payment or delivery.</p>
                  </div>
                </aside>
              </div>
            </>
          )}
          {tab === "orders" && (
            <section className="orders-page">
              <div className="page-title">
                <div>
                  <h1>Orders</h1>
                  <p>Manage demo orders placed in this browser.</p>
                </div>
                <button
                  className="small-button"
                  disabled={busy}
                  onClick={() =>
                    void refresh().catch((e) => setError(e.message))
                  }
                >
                  Refresh
                  <Icon name="arrow" size={16} />
                </button>
              </div>
              <div className="metrics">
                {[
                  ["Orders received", config?.orders.length || 0],
                  [
                    "Order value",
                    money(
                      config?.orders.reduce((s, o) => s + o.quote.total, 0) ||
                        0,
                    ),
                  ],
                  [
                    "Ready for collection",
                    config?.orders.filter((o) => o.status === "Ready").length ||
                      0,
                  ],
                ].map(([label, value]) => (
                  <div className="metric" key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
              <div className="board">
                {(["Received", "Packing", "Ready"] as const).map((status) => (
                  <section className="board-column" key={status}>
                    <h2>
                      <span className={`board-dot ${status.toLowerCase()}`} />
                      {status}
                      <span>
                        {config?.orders.filter((o) => o.status === status)
                          .length || 0}
                      </span>
                    </h2>
                    {config?.orders
                      .filter((o) => o.status === status)
                      .map((order) => (
                        <article className="order-card" key={order.id}>
                          <div>
                            <strong>
                              #{order.id.slice(0, 8).toUpperCase()}
                            </strong>
                            <span>
                              {new Date(order.createdAt).toLocaleTimeString(
                                "en-IN",
                                { hour: "2-digit", minute: "2-digit" },
                              )}
                            </span>
                          </div>
                          <ul>
                            {order.quote.lines.map((l) => (
                              <li key={l.id}>
                                <span>
                                  {l.quantity} × {l.name}
                                </span>
                                <span>{money(l.amount)}</span>
                              </li>
                            ))}
                          </ul>
                          <div className="order-total">
                            <span>Total incl. delivery</span>
                            <strong>{money(order.quote.total)}</strong>
                          </div>
                          {status !== "Ready" && (
                            <button
                              className="checkout-button"
                              disabled={busy}
                              onClick={() => void advance(order.id)}
                            >
                              {status === "Received"
                                ? "Start packing"
                                : "Mark ready"}
                              <Icon name="arrow" size={16} />
                            </button>
                          )}
                          <button
                            className="text-button receipt-link"
                            onClick={() => download(order)}
                          >
                            Download receipt
                            <Icon name="receipt" size={14} />
                          </button>
                        </article>
                      ))}
                    {!config?.orders.some((o) => o.status === status) && (
                      <div className="empty-column">
                        No {status.toLowerCase()} orders
                      </div>
                    )}
                  </section>
                ))}
              </div>
              <p className="storage-note">
                {config?.storage === "temporary memory"
                  ? "Orders reset when the server restarts."
                  : "Orders are shown for this browser only."}
              </p>
            </section>
          )}
        </main>
      </div>
      {tab === "store" && total.count > 0 && !basketVisible && !review && !receipt && (
        <a className="mobile-basket" href="#basket" aria-label={`View basket with ${total.count} items, ${money(total.total)}`}>
          <span><Icon name="bag" /> View basket · {total.count}</span>
          <strong>{money(total.total)} <span aria-hidden="true">↗</span></strong>
        </a>
      )}
      <dialog
        ref={dialogRef}
        className="review-dialog"
        onCancel={(e) => {
          if (busy) e.preventDefault();
          else {
            setReview(null);
            setReceipt(null);
          }
        }}
      >
        <div className="dialog-top">
          <button
            aria-label="Close order review"
            disabled={busy}
            onClick={() => {
              setReview(null);
              setReceipt(null);
            }}
          >
            <Icon name="close" />
          </button>
        </div>
        {receipt ? (
          <>
            <div className="success-mark">
              <Icon name="check" size={32} />
            </div>
            <h2>Order received</h2>
            <p>
              Demo order #{receipt.id.slice(0, 8).toUpperCase()}. No payment collected.
            </p>
            <div className="review-total">
              <span>Order total</span>
              <strong>{money(receipt.quote.total)}</strong>
            </div>
            <button
              className="checkout-button"
              onClick={() => {
                setReceipt(null);
                setTab("orders");
              }}
            >
              View in Shopkeeper
              <Icon name="arrow" />
            </button>
            <button
              className="text-button receipt-link"
              onClick={() => download(receipt)}
            >
              Download receipt
            </button>
          </>
        ) : (
          review && (
            <>
              <h2>Review your order</h2>
              <p>
                Check quantities and pack sizes. Demo only — no payment or delivery.
              </p>
              <div className="review-lines">
                {review.quote.lines.map((l) => (
                  <div key={l.id}>
                    <span>
                      <strong>{l.name}</strong>
                      <small>
                        {l.quantity} × {l.unit}
                      </small>
                    </span>
                    <strong>{money(l.amount)}</strong>
                  </div>
                ))}
              </div>
              <div className="review-delivery">
                <span>Delivery</span>
                <span>
                  {review.quote.delivery
                    ? money(review.quote.delivery)
                    : "Free"}
                </span>
              </div>
              <div className="review-total">
                <span>Total</span>
                <strong>{money(review.quote.total)}</strong>
              </div>
              {error && (
                <p className="dialog-error" role="alert">
                  {error}
                </p>
              )}
              <button
                className="checkout-button"
                disabled={busy}
                onClick={() => void confirm()}
              >
                {busy ? "Confirming…" : "Confirm demo order"}
                <Icon name="check" />
              </button>
              <button
                className="text-button receipt-link"
                disabled={busy}
                onClick={() => setReview(null)}
              >
                Back to basket
              </button>
            </>
          )
        )}
      </dialog>
    </div>
  );
}
