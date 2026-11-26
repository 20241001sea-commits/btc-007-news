(() => {
  "use strict";

  const MARKET_API = "https://eqn.news/api/v1";
  const NEWS_PROXY = "/api/eqn";
  const NEWS_PUBLIC = "https://api.eqn.news/public/v1";
  const WS_URL = "wss://eqn.news/api/v1/market/ws";
  const ICON = (ic) => `${MARKET_API}/icons/${encodeURIComponent(ic)}`;
  let newsBase = NEWS_PROXY;
  const LS_LANG = "bitxsea-news-lang";
  const LS_THEME = "bitxsea-news-theme";
  const LS_PINS = "bitxsea-news-pins";
  const SITE_TITLE = "BTC-007 News";
  const HOME_DESC = "BTC-007 News — live crypto and market briefings. 实时快讯与行情。Automatically collected, independently designed.";
  const HOME_OG_DESC = "Live market briefings / 实时快讯与行情";
  const HOME_CANONICAL = "https://polite-lotus-yhf8.here.now/";
  const NEWS_LIMIT = 40;
  const POLL_MS = 1000;
  const STATS_MS = 20000;
  const FAIL_LIMIT = 3;
  const BACKFILL_PAGES = 4;
  const TAPE_SYMBOLS = ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "AVAX", "LINK", "TRX", "TON", "SUI", "DOT", "NEAR", "APT", "LTC", "BCH", "UNI", "ATOM", "FIL"];
  const STABLES = new Set(["USDT", "USDC", "FDUSD", "DAI", "TUSD", "USDE", "USDP", "PYUSD", "BUSD", "USD1", "USD"]);
  const LANGS = ["zh", "en", "ko", "tr", "ru"];
  const LANG_LOCALE = { zh: "zh-Hans", en: "en", ko: "ko", tr: "tr", ru: "ru" };
  const HK_TZ = "Asia/Hong_Kong";
  const KOL_CHANNEL = "kol-trading";
  const TRADER_CHANNEL = "trader-leaderboard";
  const PAPER_CHANNEL = "paper-leaderboard";
  const I18N = window.BITXSEA_I18N || {};
  const CHANNELS = window.BITXSEA_CHANNELS || [];
  const CHANNEL_MAP = Object.fromEntries(CHANNELS.map((c) => [c.key, c]));
  const FNG_I18N = window.BITXSEA_FNG || {};
  const LANG_NAMES = { zh: "中文", en: "English", ko: "한국어", tr: "Türkçe", ru: "Русский" };

  const state = {
    lang: "zh",
    theme: "dark",
    timeZone: null,
    timeZoneSource: "browser",
    view: "feed",
    channel: "all",
    coin: "",
    query: "",
    articleId: null,
    items: new Map(),
    order: [],
    nextCursor: null,
    newsEtag: null,
    queued: [],
    atTop: true,
    loadingMore: false,
    hasMore: true,
    newsFail: 0,
    liveNews: false,
    liveMarket: false,
    stats: null,
    market: { byId: new Map(), bySym: new Map(), extras: new Map(), g: null, fng: null, liq: null, t: 0, v: 0 },
    marketsQuery: "",
    matrix: { w: "24h", area: "cap", top: 100, nativeOnly: true },
    coinDrawer: null,
    coinDrawerPinned: false,
    matrixTip: null,
    historyLoaded: false,
    pollTimer: null,
    statsTimer: null,
    clockTimer: null,
    relTimer: null,
    ws: null,
    wsRetry: 0,
    marketPollTimer: null,
    newsPauseUntil: 0,
    bootstrapped: false,
    suppressUrl: false,
    articleCache: null,
    pins: { channels: [], coins: [] }
  };

  const $ = (id) => document.getElementById(id);

  function t(key, vars) {
    const pack = I18N[state.lang] || I18N.en || {};
    let s = pack[key] ?? (I18N.en && I18N.en[key]) ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    }
    return s;
  }

  function locale() {
    return LANG_LOCALE[state.lang] || "en";
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeLang(s) {
    s = String(s || "").toLowerCase();
    if (s.startsWith("zh")) return "zh";
    if (LANGS.includes(s)) return s;
    return null;
  }

  function pickText(i18n, lang = state.lang) {
    if (!i18n || typeof i18n !== "object") return "";
    for (const k of [lang, "en", "zh", "ko", "tr", "ru"]) {
      const v = i18n[k];
      if (v != null && String(v).trim()) return String(v);
    }
    return "";
  }

  function channelLabel(key) {
    const c = CHANNEL_MAP[key];
    if (!c) return key;
    return c[state.lang] || c.en || key;
  }

  function sourceLabel(src) {
    if (!src) return "";
    if (state.lang === "zh") return src.display_zh || src.display || src.slug || "";
    return src.display || src.display_zh || src.slug || "";
  }

  function isBlockedSourceUrl(u) {
    if (!u) return true;
    try {
      const url = new URL(u, "https://eqn.news");
      const h = url.hostname.replace(/^www\./, "").toLowerCase();
      if (h === "t.me" || h === "telegram.me" || h === "telegram.org" || h.endsWith(".t.me")) return true;
      return false;
    } catch {
      return true;
    }
  }

  function safeHttpUrl(u) {
    if (!u || typeof u !== "string") return null;
    try {
      const url = new URL(u, "https://eqn.news");
      if (url.protocol !== "http:" && url.protocol !== "https:") return null;
      if (isBlockedSourceUrl(url.href)) return null;
      return url.href;
    } catch {
      return null;
    }
  }

  function itemId(it) {
    return String(it.id ?? it.no);
  }

  function sortKey(it) {
    return [Number(it.published_ts) || 0, Number(it.no) || 0];
  }

  function cmpKey(a, b) {
    if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;
    if (a[1] !== b[1]) return a[1] < b[1] ? -1 : 1;
    return 0;
  }

  function itemSig(it) {
    const i18n = it.i18n || {};
    return [
      it.published_ts,
      i18n.en || "",
      i18n.zh || "",
      i18n.ko || "",
      i18n.tr || "",
      i18n.ru || "",
      (it.channels || []).join(","),
      (it.coins || []).map((c) => c.symbol).join(","),
      it.url || "",
      it.digest ? JSON.stringify(it.digest) : "",
      it.body || ""
    ].join("|");
  }

  function formatPrice(p) {
    if (p == null || Number.isNaN(Number(p))) return "—";
    const n = Number(p);
    const abs = Math.abs(n);
    let max = 2;
    if (abs < 0.0001) max = 8;
    else if (abs < 0.01) max = 6;
    else if (abs < 1) max = 5;
    else if (abs < 100) max = 4;
    return n.toLocaleString(locale(), { minimumFractionDigits: Math.min(2, max), maximumFractionDigits: max });
  }

  function compactUsd(n) {
    if (n == null || Number.isNaN(Number(n))) return "—";
    return new Intl.NumberFormat(locale(), {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 2
    }).format(Number(n));
  }

  function formatPct(n) {
    if (n == null || Number.isNaN(Number(n))) return "—";
    const v = Number(n);
    const s = v.toLocaleString(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${v > 0 ? "+" : ""}${s}%`;
  }

  function pctClass(n) {
    if (n == null || Number.isNaN(Number(n)) || Number(n) === 0) return "";
    return Number(n) > 0 ? "pct-up" : "pct-down";
  }

  function browserTimeZone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  }

  function validTimeZone(tz) {
    if (!tz || typeof tz !== "string") return "";
    try {
      new Intl.DateTimeFormat("en", { timeZone: tz }).format(new Date());
      return tz;
    } catch {
      return "";
    }
  }

  function viewerTimeZone() {
    return validTimeZone(state.timeZone) || browserTimeZone();
  }

  function zoneLabel(date = new Date(), style = "short") {
    try {
      const parts = new Intl.DateTimeFormat(locale(), {
        timeZone: viewerTimeZone(),
        timeZoneName: style
      }).formatToParts(date);
      return (parts.find((p) => p.type === "timeZoneName") || {}).value || "";
    } catch {
      return "";
    }
  }

  function formatClock(ts, timeZone = viewerTimeZone()) {
    return new Intl.DateTimeFormat(locale(), {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    }).format(new Date(ts));
  }

  function formatCardTime(ts) {
    const d = new Date(ts);
    const tz = viewerTimeZone();
    const time = new Intl.DateTimeFormat(locale(), {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).format(d);
    return { time, zone: zoneLabel(d, "shortOffset"), date: d };
  }

  function zonedDayKey(ts) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: viewerTimeZone(),
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date(ts));
    const get = (type) => (parts.find((p) => p.type === type) || {}).value || "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  }

  function applyViewerTimeZone(tz, source) {
    const next = validTimeZone(tz) || browserTimeZone();
    const changed = next !== state.timeZone;
    state.timeZone = next;
    state.timeZoneSource = source || state.timeZoneSource || "browser";
    updateClock();
    if (!changed) return;
    if (window.BTC007_KOL) window.BTC007_KOL.rerender();
    if (window.BTC007_TRADERS) window.BTC007_TRADERS.rerender();
    if (window.BTC007_PAPER) window.BTC007_PAPER.rerender();
    if (state.order.length) renderFeed();
    if (state.view === "article" && state.articleCache) renderArticle(state.articleCache);
    if (state.coinDrawer) {
      const rec = state.market.bySym.get(state.coinDrawer);
      if (rec) renderCoinDetail(rec, relatedNewsFor(rec.s));
    }
  }

  async function detectViewerTimeZone() {
    const pick = async (url, read) => {
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) throw new Error("tz");
      const tz = read(await res.json());
      const ok = validTimeZone(tz);
      if (!ok) throw new Error("tz");
      return ok;
    };
    try {
      const tz = await Promise.any([
        pick("https://ipwho.is/?fields=success,timezone", (j) => (
          j && j.success !== false && j.timezone && (j.timezone.id || j.timezone)
        )),
        pick("https://ipapi.co/json/", (j) => j && j.timezone)
      ]);
      applyViewerTimeZone(tz, "ip");
    } catch {
      applyViewerTimeZone(browserTimeZone(), "browser");
    }
  }

  function relativeTime(ts) {
    const diff = Date.now() - ts;
    if (diff < 45_000) return t("just_now");
    if (diff < 3_600_000) return t("min_ago", { n: Math.max(1, Math.round(diff / 60_000)) });
    if (diff < 24 * 3_600_000) return t("hours_ago", { n: Math.max(1, Math.round(diff / 3_600_000)) });
    return "";
  }

  function localDayKey(ts) {
    return zonedDayKey(ts);
  }

  function dayLabel(ts, count) {
    const todayKey = zonedDayKey(Date.now());
    const thatKey = zonedDayKey(ts);
    const [y1, m1, d1] = todayKey.split("-").map(Number);
    const [y2, m2, d2] = thatKey.split("-").map(Number);
    const diffDays = Math.round((Date.UTC(y1, m1 - 1, d1) - Date.UTC(y2, m2 - 1, d2)) / 86400000);
    let label;
    if (diffDays === 0) label = t("today");
    else if (diffDays === 1) label = t("yesterday");
    else {
      label = new Intl.DateTimeFormat(locale(), {
        timeZone: viewerTimeZone(),
        weekday: "long",
        month: "short",
        day: "numeric"
      }).format(new Date(ts));
    }
    return `${label} · ${count}`;
  }

  function reducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }


  function applyTheme(theme, persist = true) {
    state.theme = theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", state.theme);
    const color = state.theme === "light" ? "#F3EFE6" : "#071018";
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", color));
    if (persist) localStorage.setItem(LS_THEME, state.theme);
  }

  function applyLang(lang, persist = true) {
    state.lang = normalizeLang(lang) || "en";
    document.documentElement.lang = LANG_LOCALE[state.lang];
    if (persist) localStorage.setItem(LS_LANG, state.lang);
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
    });
    document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria")));
    });
    document.querySelectorAll("[data-i18n-html]").forEach((el) => {
      el.innerHTML = t(el.getAttribute("data-i18n-html"));
    });
    document.querySelectorAll(".lang-btn").forEach((btn) => {
      btn.setAttribute("aria-pressed", btn.getAttribute("data-lang") === state.lang ? "true" : "false");
    });
    renderChannels();
    renderTrending();
    updateFeedHeading();
    renderFeed();
    renderMarketBits({ force: true });
    if (state.view === "markets") renderMarketsView();
    if (state.coinDrawer) {
      const rec = state.market.bySym.get(state.coinDrawer);
      if (rec) renderCoinDetail(rec, relatedNewsFor(rec.s));
    }
    if (state.view === "article" && state.articleCache) renderArticle(state.articleCache);
    if (window.BTC007_KOL) window.BTC007_KOL.rerender();
    if (window.BTC007_TRADERS) window.BTC007_TRADERS.rerender();
    if (window.BTC007_PAPER) window.BTC007_PAPER.rerender();
    updateNewChip();
    updateLivePill();
    updateClock();
  }

  function measureChrome() {
    const root = document.documentElement;
    const h = $("site-header");
    const c = $("channel-bar");
    const tk = $("ticker");
    const ft = document.querySelector(".site-footer");
    if (h) root.style.setProperty("--header-h", `${h.offsetHeight}px`);
    const ch = c && !c.hidden ? c.offsetHeight : 0;
    root.style.setProperty("--channels-h", `${ch}px`);
    const th = tk && !tk.hidden ? tk.offsetHeight : 0;
    root.style.setProperty("--ticker-h", `${th}px`);
    if (ft) root.style.setProperty("--footer-h", `${ft.offsetHeight}px`);
    syncMatrixTip();
  }

  function viewScroller() {
    if (state.view === "article") return $("view-article");
    if (state.view === "markets") return $("view-markets");
    return $("view-feed");
  }

  function scrollView(top, smooth) {
    const sc = viewScroller();
    if (!sc) return;
    sc.scrollTo({ top: top || 0, behavior: smooth && !reducedMotion() ? "smooth" : "auto" });
  }

  function updateClock() {
    const now = new Date();
    const tz = viewerTimeZone();
    const el = $("hk-time");
    if (el) el.textContent = formatClock(now, tz);
    const wrap = $("hk-clock");
    if (wrap) {
      wrap.setAttribute("datetime", now.toISOString());
      wrap.setAttribute("title", tz);
    }
    const lab = wrap && wrap.querySelector(".hk-label");
    if (lab) lab.textContent = zoneLabel(now, "short") || tz.split("/").pop().replaceAll("_", " ");
  }

  function liveStateName() {
    if (document.hidden) return "paused";
    if (state.newsFail >= FAIL_LIMIT && !state.liveNews) return "reconnecting";
    if (state.liveNews || state.liveMarket) return "live";
    if (state.newsFail === 0 && !state.bootstrapped) return "connecting";
    if (!state.liveNews && !state.liveMarket && state.newsFail > 0) return "offline";
    return "connecting";
  }

  function updateLivePill(force) {
    const pill = $("live-pill");
    if (!pill) return;
    const st = force || liveStateName();
    pill.dataset.state = st;
    const key = st === "live" ? "live" : st;
    pill.querySelector(".live-label").textContent = t(key);
  }


  function uniqueList(arr) {
    const out = [];
    const seen = new Set();
    for (const v of arr) {
      if (v == null || v === "") continue;
      const k = String(v);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(k);
    }
    return out;
  }

  function loadPins() {
    try {
      const raw = JSON.parse(localStorage.getItem(LS_PINS) || "null");
      const channels = Array.isArray(raw && raw.channels) ? raw.channels : [];
      const coins = Array.isArray(raw && raw.coins) ? raw.coins : [];
      state.pins = {
        channels: uniqueList(channels.filter((k) => k && k !== "all" && CHANNEL_MAP[k])),
        coins: uniqueList(coins.map((s) => String(s || "").toUpperCase()).filter(Boolean))
      };
    } catch {
      state.pins = { channels: [], coins: [] };
    }
  }

  function persistPins() {
    try { localStorage.setItem(LS_PINS, JSON.stringify(state.pins)); } catch { /* ignore */ }
  }

  function isPinned(kind, key) {
    const list = state.pins && state.pins[kind];
    return Array.isArray(list) && list.includes(key);
  }

  function togglePin(kind, key) {
    if (!key) return;
    if (kind === "channels") {
      if (key === "all" || !CHANNEL_MAP[key]) return;
    } else {
      key = String(key).toUpperCase();
    }
    const list = state.pins[kind] ? state.pins[kind].slice() : [];
    const i = list.indexOf(key);
    if (i >= 0) list.splice(i, 1);
    else list.push(key);
    state.pins[kind] = list;
    persistPins();
    renderChannels();
    renderTrending();
    if (state.view === "markets") renderMarketsView();
    if (state.coinDrawer && kind === "coins") {
      const rec = state.market.bySym.get(state.coinDrawer);
      if (rec) renderCoinDetail(rec, relatedNewsFor(rec.s));
    }
  }

  function pinIcon() {
    return `<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" fill="currentColor"><path d="M10.35 1.4a1 1 0 0 0-1.4 0L7.6 2.75 4.7 2.2a.75.75 0 0 0-.85 1.15L5.5 5.3 3.2 9.15a.65.65 0 0 0 .95.85l3.7-2.35 2.2 1.95a.75.75 0 0 0 1.25-.75l-.55-2.85 1.45-1.45a1 1 0 0 0 0-1.4L10.35 1.4zM6.4 11.1 5.15 12.7a.5.5 0 1 1-.8-.6l1.15-1.5.9.5z"/></svg>`;
  }

  function setMeta(selector, attr, value) {
    const el = document.querySelector(selector);
    if (el) el.setAttribute(attr, value);
  }

  function ensureOgUrl() {
    let el = document.querySelector('meta[property="og:url"]');
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute("property", "og:url");
      document.head.appendChild(el);
    }
    return el;
  }

  function applyHomeShareMeta() {
    document.title = SITE_TITLE;
    setMeta('meta[property="og:title"]', "content", SITE_TITLE);
    setMeta('meta[name="twitter:title"]', "content", SITE_TITLE);
    setMeta('meta[name="description"]', "content", HOME_DESC);
    setMeta('meta[property="og:description"]', "content", HOME_OG_DESC);
    setMeta('meta[name="twitter:description"]', "content", HOME_OG_DESC);
    setMeta('link[rel="canonical"]', "href", HOME_CANONICAL);
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute("content", HOME_CANONICAL);
  }

  function storyShareText(it) {
    if (!it) return "";
    const note = it.data && it.data.note ? String(it.data.note) : "";
    const points = digestPoints(it);
    const body = it.body ? String(it.body).replace(/\s+/g, " ").trim() : "";
    const raw = note || points[0] || body || pickText(it.i18n) || "";
    return raw.length > 180 ? raw.slice(0, 177) + "…" : raw;
  }

  function applyStoryShareMeta(title, url, desc) {
    const full = title ? `${title} · ${SITE_TITLE}` : SITE_TITLE;
    document.title = full;
    setMeta('meta[property="og:title"]', "content", title || SITE_TITLE);
    setMeta('meta[name="twitter:title"]', "content", title || SITE_TITLE);
    if (desc) {
      setMeta('meta[name="description"]', "content", desc);
      setMeta('meta[property="og:description"]', "content", desc);
      setMeta('meta[name="twitter:description"]', "content", desc);
    }
    if (url) {
      setMeta('link[rel="canonical"]', "href", url);
      ensureOgUrl().setAttribute("content", url);
    }
  }

    function showView() {
    const isFeed = state.view === "feed";
    const isMarkets = state.view === "markets";
    const isArticle = state.view === "article";
    document.body.dataset.view = state.view;
    $("view-feed").hidden = !isFeed;
    $("view-markets").hidden = !isMarkets;
    $("view-article").hidden = !isArticle;
    $("channel-bar").hidden = !isFeed;
    document.querySelectorAll(".mobile-nav-btn").forEach((btn) => {
      const nav = btn.getAttribute("data-nav");
      btn.classList.toggle("is-active", (nav === "feed" && (isFeed || isArticle)) || (nav === "markets" && isMarkets));
    });
    if (isMarkets) renderMarketsView();
    syncKol();
    measureChrome();
    if (!isArticle) applyHomeShareMeta();
  }

  function readUrl() {
    const u = new URL(location.href);
    const lang = normalizeLang(u.searchParams.get("lang"));
    const id = u.searchParams.get("id");
    const view = u.searchParams.get("view");
    const ch = u.searchParams.get("ch");
    const coin = u.searchParams.get("coin");
    const q = u.searchParams.get("q");
    const hm = location.hash.match(/#\/n\/(\d+)/);
    return {
      lang,
      id: id || (hm ? hm[1] : null),
      view: view === "markets" ? "markets" : "feed",
      ch: ch && CHANNEL_MAP[ch] ? ch : "all",
      coin: coin || "",
      q: q || ""
    };
  }

  function syncUrl(replace = false) {
    if (state.suppressUrl) return;
    const u = new URL(location.href);
    const sp = u.searchParams;
    sp.set("lang", state.lang);
    if (state.view === "markets") sp.set("view", "markets");
    else sp.delete("view");
    if (state.view === "article" && state.articleId) sp.set("id", String(state.articleId));
    else sp.delete("id");
    if (state.channel && state.channel !== "all") sp.set("ch", state.channel);
    else sp.delete("ch");
    if (state.coin) sp.set("coin", state.coin);
    else sp.delete("coin");
    if (state.query) sp.set("q", state.query);
    else sp.delete("q");
    const hash = state.view === "article" && state.articleId ? `#/n/${state.articleId}` : "";
    const qs = sp.toString();
    const next = `${u.pathname}${qs ? `?${qs}` : ""}${hash}`;
    history[replace ? "replaceState" : "pushState"]({ view: state.view, id: state.articleId, lang: state.lang }, "", next);
  }

  function newsParams(extra = {}) {
    const p = new URLSearchParams({ limit: String(NEWS_LIMIT) });
    for (const [k, v] of Object.entries(extra)) if (v != null) p.set(k, v);
    if (state.channel && state.channel !== "all") {
      p.set(newsBase === NEWS_PUBLIC ? "channel" : "ch", state.channel);
    }
    if (state.coin) p.set("coin", state.coin);
    if (state.query) p.set("q", state.query);
    return p;
  }

  async function fetchNewsPath(path) {
    const opts = { cache: "no-cache", headers: { Accept: "application/json" } };
    let res = await fetch(`${newsBase}${path}`, opts);
    if (!res.ok && res.status !== 304 && newsBase === NEWS_PROXY && [404, 405, 501, 502, 503].includes(res.status)) {
      newsBase = NEWS_PUBLIC;
      if (path.startsWith("/news/stats")) return res;
      const u = new URL(path, "https://api.eqn.news");
      if (u.searchParams.has("ch")) {
        u.searchParams.set("channel", u.searchParams.get("ch"));
        u.searchParams.delete("ch");
      }
      res = await fetch(`${NEWS_PUBLIC}${u.pathname}${u.search}`, opts);
    }
    return res;
  }

  function pauseForRetry(res) {
    const ra = res.headers.get("Retry-After");
    let ms = 2000;
    if (ra) {
      const n = Number(ra);
      if (!Number.isNaN(n)) ms = Math.max(1000, n * 1000);
      else {
        const d = Date.parse(ra);
        if (!Number.isNaN(d)) ms = Math.max(1000, d - Date.now());
      }
    }
    state.newsPauseUntil = Date.now() + ms;
  }

  function isKolChannel() {
    return state.channel === KOL_CHANNEL;
  }

  function isTraderChannel() {
    return state.channel === TRADER_CHANNEL;
  }

  function isPaperChannel() {
    return state.channel === PAPER_CHANNEL;
  }

  function syncKol() {
    const on = state.view === "feed" && isKolChannel();
    document.body.dataset.kol = on ? "1" : "";
    const box = $("kol-view");
    if (box) box.hidden = !on;
    if (window.BTC007_KOL) window.BTC007_KOL.setActive(on);
    const tOn = state.view === "feed" && isTraderChannel();
    document.body.dataset.trader = tOn ? "1" : "";
    const tBox = $("trader-view");
    if (tBox) tBox.hidden = !tOn;
    if (window.BTC007_TRADERS) window.BTC007_TRADERS.setActive(tOn);
    const pOn = state.view === "feed" && isPaperChannel();
    document.body.dataset.paper = pOn ? "1" : "";
    const pBox = $("paper-view");
    if (pBox) pBox.hidden = !pOn;
    if (window.BTC007_PAPER) window.BTC007_PAPER.setActive(pOn);
  }

  async function pollNews() {
    if (document.hidden) return;
    if (isKolChannel() || isTraderChannel() || isPaperChannel()) return;
    if (Date.now() < state.newsPauseUntil) return;
    try {
      const res = await fetchNewsPath(`/news?${newsParams()}`);
      if (res.status === 304) {
        state.newsFail = 0;
        state.liveNews = true;
        state.bootstrapped = true;
        hideFeedStatus();
        updateLivePill();
        return;
      }
      if (res.status === 429 || res.status === 503) {
        pauseForRetry(res);
        throw new Error("rate " + res.status);
      }
      if (!res.ok) throw new Error("http " + res.status);
      const etag = res.headers.get("ETag");
      if (etag) state.newsEtag = etag;
      const data = await res.json();
      await applyHeadPage(data);
      state.newsFail = 0;
      state.liveNews = true;
      state.bootstrapped = true;
      hideFeedStatus();
    } catch (err) {
      state.newsFail += 1;
      state.liveNews = false;
      if (state.newsFail >= FAIL_LIMIT) showFeedStatus(t("reconnect_body"), "is-reconnect");
      else if (!state.order.length) showFeedStatus(t("error_title"), "is-error", true);
    }
    updateLivePill();
  }

  async function applyHeadPage(data) {
    const items = (Array.isArray(data.items) ? data.items : []).map(normalizeItem);
    state.nextCursor = data.next_cursor || null;
    state.hasMore = !!state.nextCursor;
    $("feed-sentinel").hidden = !state.hasMore && !items.length ? true : !state.hasMore;
    $("load-more").textContent = state.hasMore ? t("load_more") : t("end_of_feed");

    if (!items.length) {
      if (!state.order.length) renderFeed();
      return;
    }

    const incomingSet = new Set(items.map(itemId));
    const allUnknown = items.every((it) => !state.items.has(itemId(it)));

    if (allUnknown && state.order.length) {
      for (const it of items) upsertItem(it);
      await backfillFrom(data.next_cursor);
      sortOrder();
      renderFeed();
      return;
    }

    const oldestKey = sortKey(items[items.length - 1]);
    let removed = false;
    for (const id of [...state.order]) {
      const it = state.items.get(id);
      if (!it) continue;
      if (cmpKey(sortKey(it), oldestKey) >= 0 && !incomingSet.has(id) && !state.queued.includes(id)) {
        state.items.delete(id);
        state.order = state.order.filter((x) => x !== id);
        removed = true;
      }
    }

    const brandNew = [];
    let changed = false;
    for (const it of items) {
      const id = itemId(it);
      const prev = state.items.get(id);
      if (!prev) brandNew.push(it);
      else if (itemSig(prev) !== itemSig(it)) {
        upsertItem(it);
        changed = true;
      }
    }

    if (brandNew.length) {
      if (state.atTop || !state.order.length) {
        for (const it of brandNew) upsertItem(it, { isNew: true });
        changed = true;
      } else {
        for (const it of brandNew) {
          const id = itemId(it);
          state.items.set(id, normalizeItem(it));
          if (!state.queued.includes(id) && !state.order.includes(id)) state.queued.push(id);
        }
        updateNewChip();
      }
    }

    if (changed || removed || !state.bootstrapped) {
      sortOrder();
      renderFeed();
    } else if (!state.order.length && items.length) {
      for (const it of items) upsertItem(it);
      sortOrder();
      renderFeed();
    }
  }

  function sanitizeItem(it) {
    const copy = { ...it };
    delete copy.deliveries;
    delete copy.telegram;
    return copy;
  }

  function normalizeItem(it) {
    if (!it || typeof it !== "object") return it;
    // Rich site-API items already have i18n + published_ts.
    if (it.i18n && it.published_ts) return sanitizeItem(it);
    const ts = it.published_ts || (it.time ? Date.parse(it.time) : 0);
    const source = it.source;
    const src = source && typeof source === "object"
      ? source
      : { display: source || "", display_zh: source || "" };
    const coins = (it.coins || []).map((c) => (typeof c === "string" ? { symbol: c } : c));
    const digest = it.digest || (it.ai && it.ai.summary) || null;
    const original = safeHttpUrl(it.source_url) || safeHttpUrl(it.url);
    return sanitizeItem({
      ...it,
      id: String(it.id ?? it.no),
      no: it.no,
      published_ts: ts,
      channels: it.channels || [],
      source: src,
      i18n: it.i18n || { en: it.en, zh: it.zh, ko: it.ko, tr: it.tr, ru: it.ru },
      coins,
      url: original,
      images: it.images || [],
      body: it.body || null,
      digest,
      data: it.data || null
    });
  }

  function upsertItem(it, { isNew = false } = {}) {
    const id = itemId(it);
    const clean = normalizeItem(it);
    if (isNew) clean._isNew = true;
    state.items.set(id, clean);
    if (!state.order.includes(id)) state.order.push(id);
  }

  function sortOrder() {
    state.order.sort((a, b) => {
      const ia = state.items.get(a);
      const ib = state.items.get(b);
      if (!ia || !ib) return 0;
      return -cmpKey(sortKey(ia), sortKey(ib));
    });
  }

  async function backfillFrom(cursor) {
    let c = cursor;
    for (let i = 0; i < BACKFILL_PAGES && c; i++) {
      try {
        const res = await fetchNewsPath(`/news?${newsParams({ before: c })}`);
        if (res.status === 429 || res.status === 503) {
          pauseForRetry(res);
          break;
        }
        if (!res.ok) break;
        const data = await res.json();
        const items = data.items || [];
        let known = 0;
        for (const it of items) {
          if (state.order.includes(itemId(it))) known += 1;
          upsertItem(it);
        }
        c = data.next_cursor;
        if (items.length && known === items.length) break;
      } catch {
        break;
      }
    }
  }

  async function loadMore() {
    if (state.loadingMore || !state.nextCursor) return;
    state.loadingMore = true;
    const btn = $("load-more");
    btn.disabled = true;
    btn.textContent = t("loading");
    try {
      const res = await fetchNewsPath(`/news?${newsParams({ before: state.nextCursor })}`);
      if (!res.ok) throw new Error("http");
      const data = await res.json();
      for (const it of data.items || []) upsertItem(it);
      state.nextCursor = data.next_cursor || null;
      state.hasMore = !!state.nextCursor;
      sortOrder();
      renderFeed();
    } catch {
      /* keep button */
    } finally {
      state.loadingMore = false;
      btn.disabled = false;
      btn.textContent = state.hasMore ? t("load_more") : t("end_of_feed");
      $("feed-sentinel").hidden = !state.hasMore && !state.order.length;
    }
  }

  function resetFeed({ refetch = true } = {}) {
    syncKol();
    state.items.clear();
    state.order = [];
    state.queued = [];
    state.nextCursor = null;
    state.newsEtag = null;
    state.hasMore = true;
    updateNewChip();
    $("feed").innerHTML = `<div class="empty"><p>${esc(t("loading"))}</p></div>`;
    if (isKolChannel() || isTraderChannel() || isPaperChannel()) return;
    if (refetch) pollNews();
  }

  function flushQueue() {
    if (!state.queued.length) return;
    for (const id of state.queued) {
      const it = state.items.get(id);
      if (it && !state.order.includes(id)) {
        it._isNew = true;
        state.order.push(id);
      }
    }
    state.queued = [];
    updateNewChip();
    sortOrder();
    renderFeed();
    scrollView(0, true);
  }

  function updateNewChip() {
    const chip = $("new-chip");
    const n = state.queued.length;
    if (!n || state.view !== "feed") {
      chip.hidden = true;
      return;
    }
    chip.hidden = false;
    $("new-chip-label").textContent = t("new_stories", { n });
  }

  function showFeedStatus(msg, cls, retry) {
    const el = $("feed-status");
    el.hidden = false;
    el.className = "feed-status " + (cls || "");
    el.innerHTML = retry
      ? `${esc(msg)} <button type="button" class="text-btn" id="retry-news">${esc(t("error_retry"))}</button>`
      : esc(msg);
    const btn = $("retry-news");
    if (btn) btn.addEventListener("click", () => { state.newsFail = 0; pollNews(); });
  }

  function hideFeedStatus() {
    const el = $("feed-status");
    if (!el) return;
    if (state.newsFail < FAIL_LIMIT) {
      el.hidden = true;
      el.textContent = "";
    }
  }


  function renderChannels() {
    const scroller = $("channel-scroller");
    const counts = (state.stats && state.stats.channels) || {};
    const allCount = state.stats ? state.stats.total_today : null;
    const pinnedKeys = (state.pins.channels || []).filter((k) => CHANNEL_MAP[k]);
    const pinnedSet = new Set(pinnedKeys);
    const restKeys = CHANNELS.map((c) => c.key).filter((k) => !pinnedSet.has(k));
    const keys = ["all"].concat(pinnedKeys, restKeys);
    const pills = keys.map((key) => key === "all"
      ? { key: "all", label: t("all_channels"), count: allCount }
      : { key, label: channelLabel(key), count: counts[key] ? counts[key].today : null });
    scroller.innerHTML = pills.map((p) => {
      const active = state.channel === p.key;
      const pinned = p.key !== "all" && pinnedSet.has(p.key);
      const count = p.count == null ? "" : `<span class="channel-count">${esc(p.count)}</span>`;
      const showPin = p.key !== "all" && (active || pinned);
      const pin = showPin
        ? `<span class="pin-btn${pinned ? " is-pinned" : ""}" data-pin-ch="${esc(p.key)}" role="button" tabindex="0" aria-pressed="${pinned}" aria-label="${esc(t(pinned ? "unpin_item" : "pin_item", { s: p.label }))}">${pinIcon()}</span>`
        : "";
      return `<button type="button" class="channel-pill${active ? " is-active" : ""}${pinned ? " is-pinned" : ""}" role="tab" aria-selected="${active}" data-ch="${esc(p.key)}">${esc(p.label)}${count}${pin}</button>`;
    }).join("");
  }

  function updateFeedHeading() {
    const el = $("feed-heading");
    if (!el) return;
    if (state.query) el.textContent = t("search") + " · " + state.query;
    else if (state.coin) el.textContent = t("filter_stories", { s: state.coin });
    else if (state.channel && state.channel !== "all") el.textContent = channelLabel(state.channel);
    else el.textContent = t("feed_title");
  }

  function digestPoints(item) {
    const d = item && item.digest;
    if (!d || !Array.isArray(d.points)) return [];
    return d.points.map((p) => pickText(p) || "").filter(Boolean);
  }

  function storyCard(it) {
    const id = itemId(it);
    const ts = Number(it.published_ts) || 0;
    const { time, zone } = formatCardTime(ts);
    const rel = relativeTime(ts);
    const ch = (it.channels && it.channels[0]) || "";
    const title = pickText(it.i18n) || "";
    const coins = (it.coins || []).filter((c) => c && c.symbol);
    const points = digestPoints(it).slice(0, 2);
    const note = it.data && it.data.note ? String(it.data.note) : "";
    const pct = it.data && typeof it.data.pct === "number" ? it.data.pct : null;
    const images = (it.images || []).map(safeHttpUrl).filter(Boolean).slice(0, 1);
    const cls = it._isNew && !reducedMotion() ? " is-new" : "";
    return `<button type="button" class="story${cls}" data-id="${esc(id)}">
      <div class="story-time"><span>${esc(time)} <span class="rel">${esc(zone)}</span></span><span class="rel">${esc(rel)}</span></div>
      <div class="story-meta">
        ${ch ? `<span class="ch-chip" data-ch="${esc(ch)}">${esc(channelLabel(ch))}</span>` : ""}
        ${it.source ? `<span class="source-chip">${esc(sourceLabel(it.source))}</span>` : ""}
        ${pct != null ? `<span class="${pctClass(pct)}">${esc(formatPct(pct))}</span>` : ""}
      </div>
      <h3 class="story-title">${esc(title)}</h3>
      <div>
        ${note ? `<p class="story-note">${esc(note)}</p>` : ""}
        ${points.length ? `<ul class="story-digest">${points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : ""}
        ${coins.length ? `<div class="coin-row">${coins.map((c) => `<span class="coin-tag" data-coin="${esc(c.symbol)}">${esc(c.symbol)}</span>`).join("")}</div>` : ""}
        ${images.length ? `<div class="story-image"><img src="${esc(images[0])}" alt="" loading="lazy"></div>` : ""}
      </div>
    </button>`;
  }

  function renderFeed() {
    const root = $("feed");
    const ids = state.order;
    if (!ids.length) {
      if (state.newsFail >= FAIL_LIMIT) {
        root.innerHTML = `<div class="error-block"><h2>${esc(t("error_title"))}</h2><p>${esc(t("reconnect_body"))}</p><button type="button" class="btn btn-primary" id="retry-feed">${esc(t("error_retry"))}</button></div>`;
        const b = $("retry-feed");
        if (b) b.addEventListener("click", () => { state.newsFail = 0; pollNews(); });
      } else if (state.bootstrapped && state.liveNews) {
        root.innerHTML = `<div class="empty"><h2>${esc(t("empty_title"))}</h2><p>${esc(t("empty_body"))}</p></div>`;
      } else if (!state.bootstrapped) {
        root.innerHTML = `<div class="empty"><p>${esc(t("loading"))}</p></div>`;
      }
      return;
    }

    const groups = [];
    let current = null;
    for (const id of ids) {
      const it = state.items.get(id);
      if (!it) continue;
      const key = localDayKey(it.published_ts);
      if (!current || current.key !== key) {
        current = { key, ts: it.published_ts, items: [] };
        groups.push(current);
      }
      current.items.push(it);
    }

    root.innerHTML = groups.map((g) => `<section class="day-group">
      <h2 class="day-label">${esc(dayLabel(g.ts, g.items.length))}</h2>
      ${g.items.map(storyCard).join("")}
    </section>`).join("");

    for (const id of ids) {
      const it = state.items.get(id);
      if (it) delete it._isNew;
    }
    $("feed-sentinel").hidden = !state.hasMore;
    if (state.hasMore) $("load-more").textContent = t("load_more");
  }

  async function pollStats() {
    if (document.hidden) return;
    try {
      const res = await fetch(`${NEWS_PROXY}/news/stats?tz=${encodeURIComponent(HK_TZ)}`, { cache: "no-cache" });
      if (!res.ok) return;
      state.stats = await res.json();
      renderChannels();
      renderTrending();
    } catch { /* ignore */ }
  }

  function renderTrending() {
    const el = $("trending");
    if (!el) return;
    const coins = state.stats && state.stats.coins ? Object.entries(state.stats.coins) : [];
    coins.sort((a, b) => (b[1].count || 0) - (a[1].count || 0) || (b[1].last_ts || 0) - (a[1].last_ts || 0));
    const pinned = state.pins.coins || [];
    const seen = new Set();
    const top = [];
    for (const sym of pinned) {
      if (seen.has(sym)) continue;
      seen.add(sym);
      const info = (state.stats && state.stats.coins && state.stats.coins[sym]) || {};
      top.push([sym, info, true]);
    }
    for (const [sym, info] of coins) {
      if (seen.has(sym)) continue;
      if (top.length >= 12) break;
      seen.add(sym);
      top.push([sym, info, false]);
    }
    el.innerHTML = top.map(([sym, info, pinnedTag]) => {
      const active = state.coin === sym;
      const count = info && info.count != null && info.count !== "" ? ` · ${esc(info.count)}` : "";
      return `<button type="button" class="coin-tag${active ? " is-active" : ""}${pinnedTag ? " is-pinned" : ""}" data-coin="${esc(sym)}">${esc(sym)}${count}</button>`;
    }).join("");
  }

  function decodeRows(data) {
    const k = data.k || [];
    const byId = new Map();
    const bySym = new Map();
    for (const r of data.rows || []) {
      const o = {};
      for (let i = 0; i < k.length; i++) o[k[i]] = r[i];
      if (!o.id) continue;
      byId.set(o.id, o);
      if (o.s) bySym.set(o.s, o);
    }
    const extras = new Map();
    const x = data.x || {};
    const xi = data.xi || {};
    for (const [sym, arr] of Object.entries(x)) {
      extras.set(sym, { s: sym, p: arr[0], c24: arr[1], ic: xi[sym] });
    }
    state.market.byId = byId;
    state.market.bySym = bySym;
    state.market.extras = extras;
    state.market.g = data.g || state.market.g;
    state.market.fng = data.fng || state.market.fng;
    state.market.liq = data.liq || state.market.liq;
    state.market.t = data.t || state.market.t;
    state.market.v = data.v || state.market.v;
  }

  async function fetchMarketSnapshot() {
    try {
      const res = await fetch(`${MARKET_API}/market`, { cache: "no-cache" });
      if (!res.ok) throw new Error("http");
      decodeRows(await res.json());
      state.liveMarket = true;
      renderMarketBits({ force: true });
      if (state.view === "markets") renderMarketsView();
    } catch {
      state.liveMarket = false;
    }
    updateLivePill();
  }

  function applyQuotes(q) {
    if (!Array.isArray(q)) return;
    for (const row of q) {
      const [id, p, c1, c24, c7] = row;
      const rec = state.market.byId.get(id);
      if (rec) {
        rec._prev = rec.p;
        rec.p = p;
        rec.c1 = c1;
        rec.c24 = c24;
        rec.c7 = c7;
      }
    }
  }

  function applyExtras(x) {
    if (!Array.isArray(x)) return;
    for (const row of x) {
      const [sym, p, c24] = row;
      const ex = state.market.extras.get(sym) || { s: sym };
      ex.p = p;
      if (c24 != null) ex.c24 = c24;
      state.market.extras.set(sym, ex);
    }
  }

  function handleMarketMsg(msg) {
    if (!msg || typeof msg !== "object") return;
    const type = msg.type;
    if (type === "hello" || type === "tick") {
      applyQuotes(msg.q);
      applyExtras(msg.x);
      if (msg.t) state.market.t = msg.t;
      if (msg.v != null) state.market.v = msg.v;
      state.liveMarket = true;
      renderMarketBits({ quotesOnly: type === "tick" });
      if (state.view === "markets") {
        updateMarketsPrices();
        refreshMatrix($("markets-matrix"));
      }
      updateCoinDetailQuotes();
    } else if (type === "part") {
      if (msg.g) state.market.g = msg.g;
      if (msg.liq) state.market.liq = msg.liq;
      if (msg.fng) state.market.fng = msg.fng;
      renderGlobals();
      renderFng();
    } else if (type === "universe") {
      fetchMarketSnapshot();
    }
  }

  function stopMarketWS() {
    if (state.ws) {
      try { state.ws.onclose = null; state.ws.close(); } catch { /* ignore */ }
      state.ws = null;
    }
    if (state.marketPollTimer) {
      clearInterval(state.marketPollTimer);
      state.marketPollTimer = null;
    }
  }

  function startMarketPoll() {
    if (state.marketPollTimer) return;
    fetchMarketSnapshot();
    state.marketPollTimer = setInterval(() => {
      if (!document.hidden) fetchMarketSnapshot();
    }, POLL_MS);
  }

  function connectWS() {
    if (document.hidden) return;
    if (state.ws && (state.ws.readyState === WebSocket.OPEN || state.ws.readyState === WebSocket.CONNECTING)) return;
    try {
      const ws = new WebSocket(WS_URL);
      state.ws = ws;
      ws.onopen = () => {
        state.wsRetry = 0;
        if (state.marketPollTimer) {
          clearInterval(state.marketPollTimer);
          state.marketPollTimer = null;
        }
      };
      ws.onmessage = (ev) => {
        try { handleMarketMsg(JSON.parse(ev.data)); } catch { /* ignore */ }
      };
      ws.onerror = () => { try { ws.close(); } catch { /* ignore */ } };
      ws.onclose = () => {
        state.ws = null;
        if (document.hidden) return;
        state.wsRetry += 1;
        if (state.wsRetry >= 3) startMarketPoll();
        else setTimeout(connectWS, Math.min(8000, 400 * 2 ** state.wsRetry));
      };
    } catch {
      startMarketPoll();
    }
  }

  function startMarket() {
    fetchMarketSnapshot().then(() => connectWS());
  }

  function coinIcon(rec) {
    if (rec && rec.ic) return `<img class="coin-ic" src="${esc(ICON(rec.ic))}" alt="" width="22" height="22" loading="lazy">`;
    return `<span class="coin-ic" aria-hidden="true"></span>`;
  }

  function topQuotes(n) {
    const seen = new Set();
    const rows = [];
    for (const s of TAPE_SYMBOLS) {
      const r = state.market.bySym.get(s);
      if (r && r.s && !seen.has(r.s)) {
        rows.push(r);
        seen.add(r.s);
      }
      if (rows.length >= n) return rows;
    }
    const rest = [...state.market.byId.values()]
      .filter((r) => r && r.s && !seen.has(r.s) && !STABLES.has(r.s) && r.grp !== 1)
      .sort((a, b) => (a.r || 9999) - (b.r || 9999));
    for (const r of rest) {
      rows.push(r);
      seen.add(r.s);
      if (rows.length >= n) break;
    }
    return rows;
  }

  function renderQuoteList(el, rows, cls, emptyHtml) {
    if (!el) return;
    if (!rows.length) {
      if (!el.childElementCount) el.innerHTML = emptyHtml || "";
      return;
    }
    const existing = el.querySelectorAll("." + cls);
    if (existing.length === rows.length) {
      rows.forEach((r, i) => updateQuoteRow(existing[i], r));
      return;
    }
    el.innerHTML = rows.map((r) => quoteRowHtml(r, cls)).join("");
  }

  function renderTape() {
    const el = $("tape");
    if (!el) return;
    const rows = topQuotes(20);
    renderQuoteList(el, rows, "tape-row", `<p class="story-note">${esc(t("no_market"))}</p>`);
  }

  function renderTicker() {
    renderQuoteList($("ticker-track"), topQuotes(24), "ticker-item", "");
  }

  function quoteRowHtml(r, cls) {
    return `<button type="button" class="${cls}" data-sym="${esc(r.s)}" data-coin="${esc(r.s)}">
      ${coinIcon(r)}
      <span class="coin-sym">${esc(r.s)}</span>
      <span class="coin-price">${esc(formatPrice(r.p))}</span>
      <span class="coin-chg ${pctClass(r.c24)}">${esc(formatPct(r.c24))}</span>
    </button>`;
  }

  function updateQuoteRow(node, r) {
    const price = node.querySelector(".coin-price");
    const chg = node.querySelector(".coin-chg");
    const prev = price.textContent;
    const next = formatPrice(r.p);
    if (prev !== next) {
      price.textContent = next;
      if (!reducedMotion() && r._prev != null && r._prev !== r.p) {
        const flash = r.p > r._prev ? "flash-up" : "flash-down";
        price.classList.remove("flash-up", "flash-down");
        void price.offsetWidth;
        price.classList.add(flash);
      }
    }
    chg.textContent = formatPct(r.c24);
    chg.className = "coin-chg " + pctClass(r.c24);
  }

  function topMovers() {
    const list = [...state.market.byId.values()].filter((r) => {
      if (!r || r.c24 == null) return false;
      if (STABLES.has(r.s) || r.grp === 1) return false;
      if (r.r && r.r > 250) return false;
      return true;
    });
    return {
      gainers: [...list].sort((a, b) => b.c24 - a.c24).slice(0, 5),
      losers: [...list].sort((a, b) => a.c24 - b.c24).slice(0, 5)
    };
  }

  function renderMovers() {
    const el = $("movers");
    if (!el) return;
    const { gainers, losers } = topMovers();
    if (!gainers.length && !losers.length) { el.innerHTML = ""; return; }
    const block = (title, rows) => `<div><div class="rail-title" style="margin-top:4px">${esc(title)}</div>${rows.map((r) => quoteRowHtml(r, "mover-row")).join("")}</div>`;
    el.innerHTML = block(t("gainers"), gainers) + block(t("losers"), losers);
  }

  function latestFng() {
    const arr = state.market.fng;
    if (!Array.isArray(arr) || !arr.length) return null;
    const last = arr[arr.length - 1];
    if (Array.isArray(last)) return { score: last[0], label: last[1], ts: last[2] };
    return last;
  }

  function fngLabel(raw) {
    const pack = FNG_I18N[raw];
    if (!pack) return raw || "";
    return pack[state.lang] || pack.en || raw;
  }

  function renderFng() {
    const el = $("fng");
    if (!el) return;
    const f = latestFng();
    if (!f) { el.innerHTML = ""; return; }
    const score = Number(f.score);
    const label = fngLabel(f.label);
    const ang = Math.max(0, Math.min(100, score)) / 100 * 180;
    const color = score < 25 ? "var(--down)" : score < 45 ? "var(--sand)" : score < 55 ? "var(--text-dim)" : score < 75 ? "var(--accent)" : "var(--up)";
    el.innerHTML = `
      <svg class="fng-dial" viewBox="0 0 84 52" aria-hidden="true">
        <path d="M8 48 A34 34 0 0 1 76 48" fill="none" stroke="var(--line-strong)" stroke-width="8" stroke-linecap="round"/>
        <path d="M8 48 A34 34 0 0 1 76 48" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${(ang / 180) * 106.8} 200"/>
      </svg>
      <div>
        <div class="fng-score" style="color:${color}">${esc(score)}</div>
        <div class="fng-label">${esc(label)}</div>
      </div>`;
  }

  function sparkPath(values, w, h, pad = 2) {
    if (!values || values.length < 2) return "";
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    return values.map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (w - pad * 2);
      const y = h - pad - ((v - min) / span) * (h - pad * 2);
      return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  }

  function renderGlobals() {
    const el = $("globals");
    if (!el) return;
    const g = state.market.g;
    if (!g) { el.innerHTML = ""; return; }
    const spark = Array.isArray(g.mc7) ? sparkPath(g.mc7, 140, 36) : "";
    el.innerHTML = `
      <div class="global-item"><span class="k">${esc(t("total_mcap"))}</span><span class="v ${pctClass(g.mcChg)}">${esc(compactUsd(g.mc || 0))}</span></div>
      <div class="global-item"><span class="k">${esc(t("total_vol"))}</span><span class="v">${esc(compactUsd(g.vol))}</span></div>
      <div class="global-item"><span class="k">${esc(t("dominance"))}</span><span class="v">${esc(g.btcD != null ? g.btcD + "%" : "—")}</span></div>
      <div class="global-item"><span class="k">${esc(t("eth_dominance"))}</span><span class="v">${esc(g.ethD != null ? g.ethD + "%" : "—")}</span></div>
      ${spark ? `<svg viewBox="0 0 140 36" width="100%" height="36" style="grid-column:1/-1" aria-hidden="true"><path d="${spark}" fill="none" stroke="var(--accent)" stroke-width="1.6"/></svg>` : ""}
    `;
  }

  function renderMarketBits({ quotesOnly = false, force = false, parts = false } = {}) {
    renderTape();
    renderTicker();
    if (!quotesOnly || force) {
      renderMovers();
      renderFng();
      renderGlobals();
      renderTrending();
      renderRailMatrix({ force });
    } else {
      refreshMatrix($("rail-matrix"));
    }
    if (parts) {
      renderFng();
      renderGlobals();
    }
  }

  function marketRowsFiltered() {
    const q = state.marketsQuery.trim().toLowerCase();
    let rows = [...state.market.byId.values()].filter((r) => r && r.s);
    rows.sort((a, b) => (a.r || 9999) - (b.r || 9999));
    if (q) rows = rows.filter((r) => String(r.s).toLowerCase().includes(q) || String(r.n || "").toLowerCase().includes(q));
    else rows = rows.slice(0, 150);
    const pinned = state.pins.coins || [];
    if (!pinned.length) return rows;
    const head = [];
    const seen = new Set();
    if (!q) {
      for (const s of pinned) {
        const rec = state.market.bySym.get(s);
        if (rec && rec.s && !seen.has(rec.s)) { seen.add(rec.s); head.push(rec); }
      }
    } else {
      const order = new Map(pinned.map((s, i) => [s, i]));
      for (const rec of rows) {
        if (order.has(rec.s) && !seen.has(rec.s)) { seen.add(rec.s); head.push(rec); }
      }
      head.sort((a, b) => order.get(a.s) - order.get(b.s));
    }
    return head.concat(rows.filter((r) => !seen.has(r.s)));
  }


  const MX_LEVELS = { "1h": [0.05, 0.5, 1.5, 3], "24h": [0.1, 2, 5, 10], "7d": [0.2, 5, 10, 20] };

  function loadMatrixPrefs() {
    try {
      const raw = JSON.parse(localStorage.getItem("bitxsea-news-matrix") || "{}");
      if (["1h", "24h", "7d"].includes(raw.w)) state.matrix.w = raw.w;
      if (raw.area === "even" || raw.area === "cap") state.matrix.area = raw.area;
      if ([50, 100, 200].includes(Number(raw.top))) state.matrix.top = Number(raw.top);
      if (typeof raw.nativeOnly === "boolean") state.matrix.nativeOnly = raw.nativeOnly;
    } catch { /* ignore */ }
  }

  function persistMatrix() {
    try { localStorage.setItem("bitxsea-news-matrix", JSON.stringify(state.matrix)); } catch { /* ignore */ }
  }

  function marketCapOf(r) {
    if (r && r.mc > 0) return Number(r.mc);
    const cs = r && (r.cs || r.ms);
    if (r && r.p && cs) return Number(r.p) * Number(cs);
    return 0;
  }

  function matrixChange(rec, w) {
    if (w === "1h") return rec.c1;
    if (w === "7d") return rec.c7;
    return rec.c24;
  }

  function matrixLevel(chg, w) {
    if (chg == null || Number.isNaN(Number(chg))) return 0;
    const th = MX_LEVELS[w] || MX_LEVELS["24h"];
    const a = Math.abs(Number(chg));
    if (a < th[0]) return 0;
    if (a < th[1]) return 1;
    if (a < th[2]) return 2;
    if (a < th[3]) return 3;
    return 4;
  }

  function matrixUniverse(top) {
    let rows = [...state.market.byId.values()].filter((r) => r && r.s && marketCapOf(r) > 0);
    if (state.matrix.nativeOnly) {
      rows = rows.filter((r) => r.grp === 0 || (r.grp == null && !STABLES.has(r.s)));
    }
    rows.sort((a, b) => marketCapOf(b) - marketCapOf(a) || (a.r || 9999) - (b.r || 9999));
    return rows.slice(0, top);
  }

  function squarify(items, width, height) {
    const total = items.reduce((sum, it) => sum + it.v, 0) || 1;
    const scale = (width * height) / total;
    const nodes = items.map((it) => ({ rec: it.rec, area: Math.max(it.v, 0) * scale }));
    const out = [];
    let x = 0, y = 0, w = width, h = height;
    let row = [];
    const worst = (cur, side) => {
      if (!side) return Infinity;
      const s = cur.reduce((a, n) => a + n.area, 0);
      if (!s) return Infinity;
      let mx = 0, mn = Infinity;
      for (const n of cur) {
        if (n.area > mx) mx = n.area;
        if (n.area < mn) mn = n.area;
      }
      return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn));
    };
    const layoutRow = (cur) => {
      const s = cur.reduce((a, n) => a + n.area, 0);
      if (w >= h) {
        const colW = s / h;
        let cy = y;
        for (const n of cur) {
          const nh = n.area / colW;
          out.push({ rec: n.rec, x, y: cy, w: colW, h: nh });
          cy += nh;
        }
        x += colW;
        w -= colW;
      } else {
        const rowH = s / w;
        let cx = x;
        for (const n of cur) {
          const nw = n.area / rowH;
          out.push({ rec: n.rec, x: cx, y, w: nw, h: rowH });
          cx += nw;
        }
        y += rowH;
        h -= rowH;
      }
    };
    let i = 0;
    while (i < nodes.length && w > 0.5 && h > 0.5) {
      const side = Math.min(w, h);
      const node = nodes[i];
      if (!row.length || worst(row.concat(node), side) <= worst(row, side)) {
        row.push(node);
        i++;
      } else {
        layoutRow(row);
        row = [];
      }
    }
    if (row.length) layoutRow(row);
    return out;
  }

  function matrixTileInner(rec, w, boxW, boxH) {
    const chg = matrixChange(rec, w);
    const minSide = Math.min(boxW, boxH);
    const showSym = minSide >= 20 && boxW >= 26;
    const showChg = showSym && boxH >= 34 && boxW >= 42;
    const showPx = showChg && boxH >= 52 && boxW >= 70;
    if (!showSym) return "";
    return `<span class="mx-sym">${esc(rec.s)}</span>` +
      (showChg ? `<span class="mx-chg">${esc(formatPct(chg))}</span>` : "") +
      (showPx ? `<span class="mx-px">$${esc(formatPrice(rec.p))}</span>` : "");
  }

  function layoutMatrix(box, { top, compact }) {
    if (!box) return;
    const W = box.clientWidth, H = box.clientHeight;
    if (!W || !H) { box.innerHTML = ""; box._mx = null; return; }
    const w = state.matrix.w;
    const list = matrixUniverse(top);
    const weight = (r) => {
      const mc = marketCapOf(r);
      return state.matrix.area === "even" ? Math.sqrt(Math.max(mc, 0)) : Math.max(mc, 0);
    };
    const items = list.map((rec) => ({ rec, v: weight(rec) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
    if (!items.length) {
      box.innerHTML = `<p class="mx-empty">${esc(t("no_market"))}</p>`;
      box._mx = null;
      return;
    }
    const nodes = squarify(items, W, H);
    const gap = compact ? 1.5 : 2;
    box.innerHTML = nodes.map((n) => {
      const chg = matrixChange(n.rec, w);
      const lvl = matrixLevel(chg, w);
      const dir = lvl === 0 || chg == null ? "flat" : Number(chg) > 0 ? "up" : "down";
      const left = Math.max(0, n.x + gap / 2);
      const topPx = Math.max(0, n.y + gap / 2);
      const tw = Math.max(0, n.w - gap);
      const th = Math.max(0, n.h - gap);
      const label = `${n.rec.s} ${n.rec.n || ""} · $${formatPrice(n.rec.p)} · ${w} ${formatPct(chg)} · ${compactUsd(marketCapOf(n.rec))}`;
      return `<button type="button" class="mx-tile" data-coin="${esc(n.rec.s)}" data-dir="${dir}" data-lvl="${lvl}" style="left:${left.toFixed(1)}px;top:${topPx.toFixed(1)}px;width:${tw.toFixed(1)}px;height:${th.toFixed(1)}px" aria-label="${esc(label)}">${matrixTileInner(n.rec, w, tw, th)}</button>`;
    }).join("");
    box._mx = { nodes, top, compact, w, area: state.matrix.area, nativeOnly: state.matrix.nativeOnly };
    syncMatrixTip();
  }

  function refreshMatrix(box) {
    if (!box || !box._mx) return;
    const { nodes, compact } = box._mx;
    const w = state.matrix.w;
    const gap = compact ? 1.5 : 2;
    const bySym = new Map(nodes.map((n) => [n.rec.s, n]));
    box.querySelectorAll(".mx-tile").forEach((el) => {
      const n = bySym.get(el.getAttribute("data-coin"));
      if (!n) return;
      const rec = state.market.bySym.get(n.rec.s) || n.rec;
      n.rec = rec;
      const chg = matrixChange(rec, w);
      const lvl = matrixLevel(chg, w);
      const dir = lvl === 0 || chg == null ? "flat" : Number(chg) > 0 ? "up" : "down";
      if (el.dataset.dir !== dir) el.dataset.dir = dir;
      if (el.dataset.lvl !== String(lvl)) el.dataset.lvl = String(lvl);
      el.innerHTML = matrixTileInner(rec, w, n.w - gap, n.h - gap);
      el.setAttribute("aria-label", `${rec.s} ${rec.n || ""} · $${formatPrice(rec.p)} · ${w} ${formatPct(chg)} · ${compactUsd(marketCapOf(rec))}`);
    });
  }

  function syncRailWindow() {
    const root = $("rail-matrix-win");
    if (!root) return;
    root.querySelectorAll("[data-v]").forEach((btn) => {
      btn.setAttribute("aria-pressed", btn.getAttribute("data-v") === state.matrix.w ? "true" : "false");
    });
  }

  function paintMatrixToolbar() {
    const el = $("markets-matrix-tools");
    if (!el) return;
    const { w, area, top, nativeOnly } = state.matrix;
    const seg = (key, cur, opts, label) =>
      `<div class="matrix-seg" role="group" aria-label="${esc(label)}" data-mx="${key}">${
        opts.map(([v, lab]) => `<button type="button" data-v="${v}" aria-pressed="${String(v) === String(cur)}">${lab}</button>`).join("")
      }</div>`;
    el.innerHTML =
      seg("w", w, [["1h", "1h"], ["24h", "24h"], ["7d", "7d"]], t("chg_24h")) +
      seg("area", area, [["cap", t("matrix_cap")], ["even", t("matrix_even")]], t("matrix_area")) +
      seg("top", top, [[50, t("matrix_top", { n: 50 })], [100, t("matrix_top", { n: 100 })], [200, t("matrix_top", { n: 200 })]], t("matrix")) +
      `<button type="button" class="matrix-chk" data-mx-chk="nativeOnly" aria-pressed="${nativeOnly}">${esc(t("matrix_native"))}</button>`;
    const legend = $("markets-matrix-legend");
    if (legend) {
      const swatches = [4, 3, 2, 1].map((l) => `<i class="mx-swatch" data-dir="down" data-lvl="${l}"></i>`).join("") +
        `<i class="mx-swatch" data-dir="flat" data-lvl="0"></i>` +
        [1, 2, 3, 4].map((l) => `<i class="mx-swatch" data-dir="up" data-lvl="${l}"></i>`).join("");
      legend.innerHTML = `<span class="mx-meta">${esc(t(area === "even" ? "matrix_meta_even" : "matrix_meta_cap", { w }))}</span><span class="mx-scale" aria-hidden="true">${swatches}</span>`;
    }
    syncRailWindow();
  }

  function renderRailMatrix({ force = false } = {}) {
    const box = $("rail-matrix");
    if (!box || box.clientWidth < 8) return;
    const st = box._mx;
    const same = st && st.top === 30 && st.w === state.matrix.w && st.area === state.matrix.area && st.nativeOnly === state.matrix.nativeOnly;
    if (!force && same) refreshMatrix(box);
    else layoutMatrix(box, { top: 30, compact: true });
    syncRailWindow();
  }

  function renderMarketsMatrix({ force = false } = {}) {
    const box = $("markets-matrix");
    if (!box) return;
    paintMatrixToolbar();
    if (state.view !== "markets") return;
    const run = () => {
      const st = box._mx;
      const same = st && st.top === state.matrix.top && st.w === state.matrix.w && st.area === state.matrix.area && st.nativeOnly === state.matrix.nativeOnly;
      if (!force && same && box.clientWidth) refreshMatrix(box);
      else layoutMatrix(box, { top: state.matrix.top, compact: false });
    };
    if (box.clientWidth) run();
    else requestAnimationFrame(run);
  }

  function relayoutMatrices() {
    paintMatrixToolbar();
    layoutMatrix($("rail-matrix"), { top: 30, compact: true });
    if (state.view === "markets") layoutMatrix($("markets-matrix"), { top: state.matrix.top, compact: false });
  }

  function refreshAllMatrices() {
    paintMatrixToolbar();
    refreshMatrix($("rail-matrix"));
    if (state.view === "markets") refreshMatrix($("markets-matrix"));
    const rail = $("rail-matrix");
    if (rail && !rail._mx && rail.clientWidth >= 8) layoutMatrix(rail, { top: 30, compact: true });
    const page = $("markets-matrix");
    if (state.view === "markets" && page && !page._mx && page.clientWidth) layoutMatrix(page, { top: state.matrix.top, compact: false });
  }

  function observeMatrix(box, relayout) {
    if (!box || box._mxRo) return;
    box._mxRo = new ResizeObserver(() => {
      if (box.clientWidth < 8 || box.clientHeight < 8) return;
      const sig = `${box.clientWidth}x${box.clientHeight}`;
      if (sig === box._mxSize) return;
      box._mxSize = sig;
      relayout();
    });
    box._mxRo.observe(box);
  }

  function bindMatrixControls(root) {
    if (!root || root._mxBound) return;
    root._mxBound = true;
    root.addEventListener("click", (e) => {
      const chk = e.target.closest("[data-mx-chk]");
      if (chk) {
        state.matrix.nativeOnly = !state.matrix.nativeOnly;
        persistMatrix();
        relayoutMatrices();
        return;
      }
      const btn = e.target.closest("[data-mx] [data-v]");
      if (!btn) return;
      const key = btn.closest("[data-mx]").getAttribute("data-mx");
      let val = btn.getAttribute("data-v");
      if (key === "top") val = Number(val);
      state.matrix[key] = val;
      persistMatrix();
      if (key === "w") refreshAllMatrices();
      else relayoutMatrices();
    });
  }


  const SPARK_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";

  function compactQty(n) {
    if (n == null || Number.isNaN(Number(n))) return "—";
    return new Intl.NumberFormat(locale(), { notation: "compact", maximumFractionDigits: 2 }).format(Number(n));
  }

  function sparklinePath(sp, w, h, pad = 3) {
    if (!sp || typeof sp !== "string" || sp.length < 2) return "";
    const n = sp.length;
    return Array.from(sp).map((ch, i) => {
      const v = SPARK_ALPHABET.indexOf(ch);
      const yv = v < 0 ? 0 : v / 63;
      const x = pad + (i / (n - 1)) * (w - pad * 2);
      const y = h - pad - yv * (h - pad * 2);
      return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(" ");
  }

  function coinTags(rec) {
    const tags = [];
    if (rec.bn & 1) tags.push(t("bn_spot"));
    if (rec.bn & 2) tags.push(t("bn_perp"));
    if (!rec.bn) tags.push(t("bn_none"));
    if (rec.grp === 1) tags.push(t("grp_1"));
    else if (rec.grp === 2) tags.push(t("grp_2"));
    else if (rec.grp >= 3) tags.push(t("grp_3"));
    return tags;
  }

  function relatedNewsFor(sym, n = 8) {
    const key = String(sym || "").toUpperCase();
    const rows = [];
    const seen = new Set();
    const consider = (it) => {
      if (!it) return;
      const id = itemId(it);
      if (!id || seen.has(id)) return;
      const coins = it.coins || [];
      if (coins.some((c) => String(c.symbol || c).toUpperCase() === key)) {
        seen.add(id);
        rows.push(it);
      }
    };
    for (const id of state.order) consider(state.items.get(id));
    for (const it of state.items.values()) {
      if (rows.length >= n) break;
      consider(it);
    }
    rows.sort((a, b) => (Number(b.published_ts) || 0) - (Number(a.published_ts) || 0));
    return rows.slice(0, n);
  }

  function coinNewsListHtml(sym, items) {
    if (!items.length) return `<p class="cdetail-none">${esc(t("no_related", { s: sym }))}</p>`;
    return `<ol>${items.map((it) => {
      const id = itemId(it);
      const title = pickText(it.i18n) || "";
      const when = formatCardTime(Number(it.published_ts) || 0);
      return `<li><button type="button" class="cdetail-story" data-open-id="${esc(id)}"><time>${esc(when.time)} ${esc(when.zone)}</time><span class="hl">${esc(title)}</span></button></li>`;
    }).join("")}</ol>`;
  }

  function renderCoinDetail(rec, news) {
    const panel = $("coin-panel");
    if (!panel || !rec) return;
    const share = state.market.g && state.market.g.mc ? (marketCapOf(rec) / state.market.g.mc) * 100 : 0;
    const tags = coinTags(rec).map((x) => `<span>${esc(x)}</span>`).join("");
    const ch = (w, val) => `<div><span class="k">${esc(w)}</span><span class="v ${pctClass(val)}" data-chg="${w}">${esc(formatPct(val))}</span></div>`;
    const path = sparklinePath(rec.sp, 380, 88);
    const updated = state.market.t ? formatClock(state.market.t, undefined) : "";
    panel.innerHTML = `
      <div class="cdetail-hd">
        ${coinIcon(rec)}
        <h2 id="coin-drawer-title"><span class="cdetail-sym">${esc(rec.s)}</span><span class="cdetail-name">${esc(rec.n || "")}</span></h2>
        <span class="cdetail-rank">#${esc(rec.r ?? "—")}</span>
        <button type="button" class="cdetail-pin${isPinned("coins", rec.s) ? " is-pinned" : ""}" data-pin-coin="${esc(rec.s)}" aria-pressed="${isPinned("coins", rec.s)}" aria-label="${esc(t(isPinned("coins", rec.s) ? "unpin_item" : "pin_item", { s: rec.s }))}">
          ${pinIcon()}
        </button>
        <button type="button" class="cdetail-close" data-close-coin aria-label="${esc(t("close_detail"))}">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/></svg>
        </button>
      </div>
      ${tags ? `<div class="cdetail-tags">${tags}</div>` : ""}
      <div class="cdetail-px">
        <span class="price" data-detail-price>$${esc(formatPrice(rec.p))}</span>
        <span class="chg ${pctClass(rec.c24)}" data-detail-chg24>${esc(formatPct(rec.c24))}</span>
        <span class="win">24h</span>
      </div>
      <div class="cdetail-chgs">${ch("1h", rec.c1)}${ch("24h", rec.c24)}${ch("7d", rec.c7)}</div>
      ${path ? `<div class="cdetail-spark"><svg viewBox="0 0 380 88" preserveAspectRatio="none" aria-hidden="true"><path d="${path}" fill="none" stroke="${Number(rec.c7) < 0 ? "var(--down)" : "var(--up)"}" stroke-width="2"/></svg>
        <div class="cdetail-lh"><span>${esc(t("range_7d_lo"))} <b>$${esc(formatPrice(rec.lo))}</b></span><span>${esc(t("range_7d_hi"))} <b>$${esc(formatPrice(rec.hi))}</b></span></div>
      </div>` : ""}
      <dl class="cdetail-kv">
        <div><dt>${esc(t("market_cap"))}</dt><dd data-detail-mc>${esc(compactUsd(marketCapOf(rec)))}${share >= 0.01 ? `<small>${share >= 10 ? share.toFixed(1) : share.toFixed(2)}% ${esc(t("mcap_share"))}</small>` : ""}</dd></div>
        <div><dt>${esc(t("volume"))}</dt><dd>${esc(compactUsd(rec.v))}</dd></div>
        <div><dt>${esc(t("circ_supply"))}</dt><dd>${esc(compactQty(rec.cs))}<small>${esc(rec.s)}</small></dd></div>
        <div><dt>${esc(t("rank_full"))}</dt><dd>#${esc(rec.r ?? "—")}</dd></div>
      </dl>
      <section class="cdetail-news" id="coin-detail-news">
        <h3>${esc(t("related_news"))}${news.length ? `<small>${news.length}</small>` : ""}</h3>
        ${coinNewsListHtml(rec.s, news)}
      </section>
      <button type="button" class="cdetail-act" data-filter-coin="${esc(rec.s)}">${esc(t("filter_stories", { s: rec.s }))}</button>
      <p class="cdetail-note">${esc(t("disclaimer"))}${updated ? " · " + esc(t("detail_updated", { t: updated })) : ""}</p>`;
  }

  function updateCoinDetailQuotes() {
    updateMatrixTipQuotes();
    if (!state.coinDrawer) return;
    const rec = state.market.bySym.get(state.coinDrawer);
    if (!rec) return;
    const root = $("coin-panel");
    if (!root) return;
    const price = root.querySelector("[data-detail-price]");
    if (price) price.textContent = "$" + formatPrice(rec.p);
    const c24 = root.querySelector("[data-detail-chg24]");
    if (c24) { c24.textContent = formatPct(rec.c24); c24.className = "chg " + pctClass(rec.c24); }
    root.querySelectorAll("[data-chg]").forEach((el) => {
      const w = el.getAttribute("data-chg");
      const val = w === "1h" ? rec.c1 : w === "7d" ? rec.c7 : rec.c24;
      el.textContent = formatPct(val);
      el.className = "v " + pctClass(val);
    });
  }

  function markOpenTile(sym) {
    document.querySelectorAll(".mx-tile.is-open").forEach((el) => el.classList.remove("is-open"));
    if (!sym) return;
    document.querySelectorAll(`.mx-tile[data-coin="${CSS.escape(sym)}"]`).forEach((el) => el.classList.add("is-open"));
  }

  async function loadCoinDetailNews(sym) {
    try {
      const res = await fetchNewsPath(`/news?${new URLSearchParams({ limit: "8", coin: sym })}`);
      if (!res.ok || state.coinDrawer !== sym) return;
      const data = await res.json();
      const items = (Array.isArray(data.items) ? data.items : []).map(normalizeItem);
      for (const it of items) {
        const id = itemId(it);
        if (id && !state.items.has(id)) state.items.set(id, it);
      }
      if (state.coinDrawer !== sym) return;
      const box = $("coin-detail-news");
      if (!box) return;
      const list = items.length ? items.slice(0, 8) : relatedNewsFor(sym);
      box.innerHTML = `<h3>${esc(t("related_news"))}${list.length ? `<small>${list.length}</small>` : ""}</h3>${coinNewsListHtml(sym, list)}`;
    } catch { /* ignore */ }
  }

  const FINE_HOVER_MQ = window.matchMedia("(any-hover: hover) and (any-pointer: fine)");
  const MATRIX_HOVER_CLOSE_MS = 220;
  let matrixHoverCloseTimer = null;
  let matrixTipTile = null;

  function canHoverMatrix() {
    return FINE_HOVER_MQ.matches;
  }

  function cancelMatrixHoverClose() {
    if (matrixHoverCloseTimer) {
      clearTimeout(matrixHoverCloseTimer);
      matrixHoverCloseTimer = null;
    }
  }

  function hideMatrixTip() {
    cancelMatrixHoverClose();
    const was = state.matrixTip;
    state.matrixTip = null;
    matrixTipTile = null;
    const tip = $("matrix-tip");
    if (tip) {
      tip.hidden = true;
      tip.removeAttribute("data-coin");
      tip.style.left = "";
      tip.style.top = "";
    }
    if (was && !state.coinDrawer) markOpenTile(null);
  }

  function clampTip(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function positionMatrixTip(tile) {
    const tip = $("matrix-tip");
    if (!tip || tip.hidden || !tile || !tile.isConnected) return;
    const gap = 8;
    const margin = 8;
    const tr = tile.getBoundingClientRect();
    const tipW = tip.offsetWidth;
    const tipH = tip.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const maxLeft = Math.max(margin, vw - tipW - margin);
    const left = clampTip(tr.left + (tr.width - tipW) / 2, margin, maxLeft);
    const aboveTop = tr.top - tipH - gap;
    const belowTop = tr.bottom + gap;
    const roomAbove = tr.top - margin;
    const roomBelow = vh - margin - tr.bottom;
    let top;
    let place;
    // Keep the card on the hovered tile: above when it can sit there (clamping
    // a pixel or two to the viewport), and just below that same tile otherwise.
    if (aboveTop >= margin) {
      top = aboveTop;
      place = "above";
    } else if (roomAbove >= tipH - gap) {
      top = margin;
      place = "above";
    } else if (belowTop + tipH <= vh - margin || roomBelow >= 72) {
      top = clampTip(belowTop, margin, Math.max(margin, vh - tipH - margin));
      place = "below";
    } else if (roomAbove >= 48) {
      top = margin;
      place = "above";
    } else {
      top = clampTip(belowTop, margin, Math.max(margin, vh - tipH - margin));
      place = "below";
    }
    tip.dataset.place = place;
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(top)}px`;
    const caretX = tr.left + tr.width / 2 - left;
    tip.style.setProperty("--tip-caret-x", `${Math.round(clampTip(caretX, 12, tipW - 12))}px`);
  }

  function currentMatrixTipTile() {
    if (matrixTipTile && matrixTipTile.isConnected) return matrixTipTile;
    if (!state.matrixTip) return null;
    return document.querySelector(`.mx-tile[data-coin="${CSS.escape(state.matrixTip)}"]`);
  }

  function syncMatrixTip() {
    if (!state.matrixTip) return;
    const tile = currentMatrixTipTile();
    if (!tile) {
      hideMatrixTip();
      return;
    }
    matrixTipTile = tile;
    positionMatrixTip(tile);
  }

  function renderMatrixTip(rec) {
    const tip = $("matrix-tip");
    if (!tip || !rec) return;
    const path = sparklinePath(rec.sp, 220, 32);
    const spark = path
      ? `<div class="matrix-tip-spark" aria-hidden="true"><svg viewBox="0 0 220 32" preserveAspectRatio="none"><path data-tip-spark d="${path}" fill="none" stroke="${Number(rec.c7) < 0 ? "var(--down)" : "var(--up)"}" stroke-width="1.7"/></svg></div>`
      : "";
    const ch = (key, val, attr) => `<div><span class="k">${esc(t(key))}</span><span class="v ${pctClass(val)}" ${attr}>${esc(formatPct(val))}</span></div>`;
    tip.innerHTML = `
      <div class="matrix-tip-hd">
        ${coinIcon(rec)}
        <div class="matrix-tip-id">
          <span class="matrix-tip-sym">${esc(rec.s)}</span>
          ${rec.n ? `<span class="matrix-tip-name">${esc(rec.n)}</span>` : ""}
        </div>
        <span class="matrix-tip-rank">#${esc(rec.r ?? "—")}</span>
      </div>
      <div class="matrix-tip-px">
        <span data-tip-price>$${esc(formatPrice(rec.p))}</span>
        <span data-tip-chg24 class="${pctClass(rec.c24)}">${esc(formatPct(rec.c24))}</span>
      </div>
      <div class="matrix-tip-chgs">
        ${ch("chg_1h", rec.c1, 'data-tip-chg1')}
        ${ch("chg_24h", rec.c24, 'data-tip-chg24b')}
        ${ch("chg_7d", rec.c7, 'data-tip-chg7')}
      </div>
      ${spark}
      <div class="matrix-tip-kv">
        <div><span class="k">${esc(t("market_cap"))}</span><span class="v" data-tip-mc>${esc(compactUsd(marketCapOf(rec)))}</span></div>
        <div><span class="k">${esc(t("volume"))}</span><span class="v" data-tip-vol>${esc(compactUsd(rec.v))}</span></div>
        <div><span class="k">${esc(t("range_7d_lo"))}</span><span class="v" data-tip-lo>$${esc(formatPrice(rec.lo))}</span></div>
        <div><span class="k">${esc(t("range_7d_hi"))}</span><span class="v" data-tip-hi>$${esc(formatPrice(rec.hi))}</span></div>
      </div>`;
  }

  function updateMatrixTipQuotes() {
    if (!state.matrixTip) return;
    const rec = state.market.bySym.get(state.matrixTip);
    if (!rec) return;
    const tip = $("matrix-tip");
    if (!tip || tip.hidden) return;
    const setText = (sel, text, cls) => {
      const el = tip.querySelector(sel);
      if (!el) return;
      el.textContent = text;
      if (cls != null) el.className = cls;
    };
    setText("[data-tip-price]", "$" + formatPrice(rec.p));
    setText("[data-tip-chg24]", formatPct(rec.c24), pctClass(rec.c24));
    setText("[data-tip-chg1]", formatPct(rec.c1), "v " + pctClass(rec.c1));
    setText("[data-tip-chg24b]", formatPct(rec.c24), "v " + pctClass(rec.c24));
    setText("[data-tip-chg7]", formatPct(rec.c7), "v " + pctClass(rec.c7));
    setText("[data-tip-mc]", compactUsd(marketCapOf(rec)));
    setText("[data-tip-vol]", compactUsd(rec.v));
    setText("[data-tip-lo]", "$" + formatPrice(rec.lo));
    setText("[data-tip-hi]", "$" + formatPrice(rec.hi));
    const spark = tip.querySelector("[data-tip-spark]");
    if (spark) {
      const path = sparklinePath(rec.sp, 220, 32);
      if (path) spark.setAttribute("d", path);
      spark.setAttribute("stroke", Number(rec.c7) < 0 ? "var(--down)" : "var(--up)");
    }
  }

  function showMatrixTip(sym, tile) {
    const rec = state.market.bySym.get(sym) || state.market.byId.get(sym);
    if (!rec || !rec.s || !tile) return;
    if (state.coinDrawer) return;
    cancelMatrixHoverClose();
    state.matrixTip = rec.s;
    matrixTipTile = tile;
    const tip = $("matrix-tip");
    if (!tip) return;
    renderMatrixTip(rec);
    tip.setAttribute("data-coin", rec.s);
    tip.hidden = false;
    positionMatrixTip(tile);
    markOpenTile(rec.s);
  }

  function scheduleMatrixHoverClose() {
    if (!state.matrixTip) return;
    cancelMatrixHoverClose();
    matrixHoverCloseTimer = setTimeout(() => {
      matrixHoverCloseTimer = null;
      hideMatrixTip();
    }, MATRIX_HOVER_CLOSE_MS);
  }

  function isMatrixHoverPointer(e) {
    const typ = e && e.pointerType;
    if (typ === "touch") return false;
    if (typ === "mouse" || typ === "pen") return true;
    return canHoverMatrix();
  }

  function openCoinDetail(sym, opts = {}) {
    const rec = state.market.bySym.get(sym) || state.market.byId.get(sym);
    if (!rec || !rec.s) return;
    const drawer = $("coin-drawer");
    const panel = $("coin-panel");
    if (!drawer || !panel) return;
    hideMatrixTip();
    state.coinDrawer = rec.s;
    state.coinDrawerPinned = true;
    renderCoinDetail(rec, relatedNewsFor(rec.s));
    drawer.hidden = false;
    drawer.classList.remove("is-hover-preview");
    panel.setAttribute("aria-modal", "true");
    document.body.style.overflow = "hidden";
    markOpenTile(rec.s);
    const closeBtn = panel.querySelector("[data-close-coin]");
    if (closeBtn) closeBtn.focus();
    loadCoinDetailNews(rec.s);
  }

  function closeCoinDetail() {
    if (!state.coinDrawer) return;
    state.coinDrawer = null;
    state.coinDrawerPinned = false;
    const drawer = $("coin-drawer");
    const panel = $("coin-panel");
    if (drawer) {
      drawer.hidden = true;
      drawer.classList.remove("is-hover-preview");
    }
    if (panel) panel.setAttribute("aria-modal", "true");
    document.body.style.overflow = "";
    if (!state.matrixTip) markOpenTile(null);
  }

  function onMatrixTileClick(sym, e) {
    if (!sym) return;
    if (isMatrixHoverPointer(e) || canHoverMatrix()) {
      openCoinDetail(sym, { pinned: true });
      return;
    }
    if (state.coinDrawer === sym) closeCoinDetail();
    else openCoinDetail(sym, { pinned: true });
  }

  function bindMatrixHover() {
    const evEl = (n) => (n && n.nodeType === 1 ? n : n && n.parentElement) || null;
    const inStayZone = (n) => {
      const el = evEl(n);
      return !!(el && (el.closest(".mx-tile[data-coin]") || el.closest("#matrix-tip")));
    };
    document.addEventListener("pointerover", (e) => {
      if (!isMatrixHoverPointer(e)) return;
      const start = evEl(e.target);
      const tile = start && start.closest(".mx-tile[data-coin]");
      if (tile) {
        const from = evEl(e.relatedTarget);
        if (from && tile.contains(from)) return;
        if (state.coinDrawer) return;
        cancelMatrixHoverClose();
        showMatrixTip(tile.getAttribute("data-coin"), tile);
        return;
      }
      if (start && start.closest("#matrix-tip")) {
        cancelMatrixHoverClose();
        return;
      }
      if (state.matrixTip) scheduleMatrixHoverClose();
    }, true);
    document.addEventListener("pointerout", (e) => {
      if (!isMatrixHoverPointer(e)) return;
      if (!state.matrixTip) return;
      const from = evEl(e.target);
      if (!inStayZone(from)) return;
      const to = evEl(e.relatedTarget);
      if (inStayZone(to)) {
        cancelMatrixHoverClose();
        return;
      }
      scheduleMatrixHoverClose();
    }, true);
    document.addEventListener("scroll", syncMatrixTip, true);
  }

  function renderMarketsView() {
    const stats = $("markets-stats");
    const g = state.market.g;
    const f = latestFng();
    const tiles = [];
    if (g) {
      tiles.push(`<div class="stat-tile"><div class="k">${esc(t("total_mcap"))}</div><div class="v ${pctClass(g.mcChg)}">${esc(compactUsd(g.mc))} ${g.mcChg != null ? esc(formatPct(g.mcChg)) : ""}</div></div>`);
      tiles.push(`<div class="stat-tile"><div class="k">${esc(t("total_vol"))}</div><div class="v">${esc(compactUsd(g.vol))}</div></div>`);
      tiles.push(`<div class="stat-tile"><div class="k">${esc(t("dominance"))}</div><div class="v">${esc(g.btcD != null ? g.btcD + "%" : "—")}</div></div>`);
    }
    if (f) tiles.push(`<div class="stat-tile"><div class="k">${esc(t("fear_greed"))}</div><div class="v">${esc(f.score)} · ${esc(fngLabel(f.label))}</div></div>`);
    stats.innerHTML = tiles.join("");

    const rows = marketRowsFiltered();
    const wrap = $("markets-table-wrap");
    renderMarketsMatrix({ force: true });
    if (!rows.length) {
      wrap.innerHTML = `<div class="empty"><p>${esc(t("no_market"))}</p></div>`;
      return;
    }
    wrap.innerHTML = `<table class="markets-table">
      <thead><tr>
        <th>${esc(t("rank"))}</th><th>${esc(t("coin"))}</th>
        <th class="num">${esc(t("price"))}</th><th class="num">${esc(t("chg_1h"))}</th>
        <th class="num">${esc(t("chg_24h"))}</th><th class="num">${esc(t("chg_7d"))}</th>
        <th class="num">${esc(t("market_cap"))}</th><th class="num">${esc(t("volume"))}</th>
      </tr></thead>
      <tbody>${rows.map((r) => `<tr data-sym="${esc(r.s)}" data-coin="${esc(r.s)}">
        <td>${esc(r.r ?? "")}</td>
        <td><div class="pair">${coinIcon(r)}<div><div>${esc(r.s)}</div><div class="name">${esc(r.n || "")}</div></div></div></td>
        <td class="num coin-price">${esc(formatPrice(r.p))}</td>
        <td class="num ${pctClass(r.c1)}">${esc(formatPct(r.c1))}</td>
        <td class="num ${pctClass(r.c24)}">${esc(formatPct(r.c24))}</td>
        <td class="num ${pctClass(r.c7)}">${esc(formatPct(r.c7))}</td>
        <td class="num">${esc(compactUsd(r.mc))}</td>
        <td class="num">${esc(compactUsd(r.v))}</td>
      </tr>`).join("")}</tbody>
    </table>`;
  }

  function updateMarketsPrices() {
    const wrap = $("markets-table-wrap");
    if (!wrap || state.view !== "markets") return;
    wrap.querySelectorAll("tr[data-sym]").forEach((tr) => {
      const rec = state.market.bySym.get(tr.getAttribute("data-sym"));
      if (!rec) return;
      const tds = tr.querySelectorAll("td");
      if (tds.length < 8) return;
      tds[2].textContent = formatPrice(rec.p);
      tds[3].textContent = formatPct(rec.c1); tds[3].className = "num " + pctClass(rec.c1);
      tds[4].textContent = formatPct(rec.c24); tds[4].className = "num " + pctClass(rec.c24);
      tds[5].textContent = formatPct(rec.c7); tds[5].className = "num " + pctClass(rec.c7);
    });
  }

  async function maybeLoadHistory() {
    if (state.historyLoaded) return;
    state.historyLoaded = true;
    try { await fetch(`${MARKET_API}/market/history`, { cache: "no-cache" }); }
    catch { state.historyLoaded = false; }
  }


  function sourceLinkLabel(url) {
    try {
      const h = new URL(url).hostname.replace(/^www\./, "");
      if (h === "x.com" || h === "twitter.com") return t("view_on_x");
      if (h.includes("eqn.news") && url.includes("/archive/")) return t("view_archive");
    } catch { /* ignore */ }
    return t("original_source");
  }

  function availableLangs(i18n) {
    if (!i18n) return [];
    return LANGS.filter((k) => i18n[k] && String(i18n[k]).trim());
  }

  function storyLink(r, cls = "related-item") {
    return `<button type="button" class="${cls}" data-open-id="${esc(itemId(r))}">${esc(pickText(r.i18n) || "")}</button>`;
  }

  function articleShareUrl(id) {
    const u = new URL(location.origin + location.pathname);
    u.searchParams.set("lang", state.lang);
    u.searchParams.set("id", String(id));
    u.hash = `#/n/${id}`;
    return u.toString();
  }

  async function copyText(text, btn) {
    try {
      await navigator.clipboard.writeText(text);
      if (btn) {
        const prev = btn.textContent;
        btn.textContent = t("copied");
        setTimeout(() => { btn.textContent = prev; }, 1600);
      }
    } catch { /* ignore */ }
  }

  function renderArticle(data) {
    const it = { ...(data.item || {}) };
    delete it.deliveries;
    const title = pickText(it.i18n);
    const ts = Number(it.published_ts) || 0;
    const { date } = formatCardTime(ts);
    const full = new Intl.DateTimeFormat(locale(), {
      timeZone: viewerTimeZone(),
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
      timeZoneName: "shortOffset"
    }).format(date);
    const url = safeHttpUrl(it.url);
    const images = (it.images || []).map(safeHttpUrl).filter(Boolean);
    const points = digestPoints(it);
    const langs = availableLangs(it.i18n);
    const coins = (it.coins || []).filter((c) => c && c.symbol);
    const note = it.data && it.data.note ? String(it.data.note) : "";
    const body = it.body ? String(it.body) : "";
    const ch = (it.channels || [])[0] || "";
    applyStoryShareMeta(title, articleShareUrl(itemId(it)), storyShareText(it));
    const related = (data.related && Array.isArray(data.related.items)) ? data.related.items : [];
    const latest = Array.isArray(data.channel_latest) ? data.channel_latest : [];
    const prevId = data.prev_id;
    const nextId = data.next_id;
    const langBtns = langs.length > 1
      ? `<div class="article-langs" role="group" aria-label="${esc(t("translations"))}">
          <span class="source-chip">${esc(t("also_in"))}</span>
          ${langs.map((k) => `<button type="button" class="text-btn story-lang" data-story-lang="${k}" aria-pressed="${k === state.lang}">${esc(LANG_NAMES[k])}</button>`).join("")}
        </div>`
      : "";

    $("article").innerHTML = `
      <div class="article-kicker">
        <time datetime="${esc(new Date(ts).toISOString())}">${esc(full)}</time>
        ${ch ? `<span class="ch-chip" data-ch="${esc(ch)}">${esc(channelLabel(ch))}</span>` : ""}
        ${it.source ? `<span class="source-chip">${esc(sourceLabel(it.source))}</span>` : ""}
      </div>
      <h1>${esc(title)}</h1>
      ${coins.length ? `<div class="coin-row">${coins.map((c) => `<button type="button" class="coin-tag" data-coin="${esc(c.symbol)}">${esc(c.symbol)}</button>`).join("")}</div>` : ""}
      ${langBtns}
      ${note ? `<p class="article-note">${esc(note)}</p>` : ""}
      ${body ? `<div class="article-body">${esc(body)}</div>` : ""}
      ${points.length ? `<section class="article-digest"><h2>${esc(t("digest"))}</h2><ol>${points.map((p) => `<li>${esc(p)}</li>`).join("")}</ol></section>` : ""}
      ${images.map((src) => `<div class="story-image" style="max-width:100%"><img src="${esc(src)}" alt=""></div>`).join("")}
      <div class="article-actions">
        ${url ? `<a class="btn btn-primary" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(sourceLinkLabel(url))}</a>` : ""}
        <button type="button" class="btn" id="share-btn">${esc(t("share"))}</button>
        <button type="button" class="btn" id="copy-btn">${esc(t("copy_link"))}</button>
      </div>
      ${related.length ? `<section class="related"><h2>${esc(t("related"))}</h2>${related.map((r) => storyLink(r)).join("")}</section>` : ""}
      ${latest.length ? `<section class="latest"><h2>${esc(t("latest_in_channel"))}</h2>${latest.map((r) => storyLink(r, "latest-item")).join("")}</section>` : ""}
      <div class="pager">
        ${prevId ? `<button type="button" class="text-btn" data-open-id="${esc(prevId)}">← ${esc(t("newer"))}</button>` : "<span></span>"}
        ${nextId ? `<button type="button" class="text-btn" data-open-id="${esc(nextId)}">${esc(t("older"))} →</button>` : "<span></span>"}
      </div>
    `;

    const shareUrl = articleShareUrl(itemId(it));
    const shareBtn = $("share-btn");
    const copyBtn = $("copy-btn");
    if (shareBtn) {
      shareBtn.addEventListener("click", async () => {
        if (navigator.share) {
          try { await navigator.share({ title: title || SITE_TITLE, text: title || "", url: shareUrl }); return; } catch { /* fall through */ }
        }
        await copyText(shareUrl, copyBtn);
      });
    }
    if (copyBtn) copyBtn.addEventListener("click", () => copyText(shareUrl, copyBtn));
    $("article").querySelectorAll(".story-lang").forEach((btn) => {
      btn.addEventListener("click", () => {
        const lang = btn.getAttribute("data-story-lang");
        const localTitle = pickText(it.i18n, lang) || title;
        const h = $("article").querySelector("h1");
        if (h) h.textContent = localTitle;
        applyStoryShareMeta(localTitle, articleShareUrl(itemId(it)), storyShareText(it));
        $("article").querySelectorAll(".story-lang").forEach((b) => b.setAttribute("aria-pressed", b === btn ? "true" : "false"));
      });
    });
  }

  async function openArticle(id, push = true) {
    state.view = "article";
    state.articleId = String(id);
    if (push) syncUrl();
    showView();
    updateNewChip();
    const box = $("article");
    box.innerHTML = `<p class="feed-status">${esc(t("loading"))}</p>`;
    const cached = state.items.get(String(id));
    if (cached) {
      applyStoryShareMeta(pickText(cached.i18n), articleShareUrl(id), storyShareText(cached));
    }
    scrollView(0, false);
    try {
      const res = await fetchNewsPath(`/news/${encodeURIComponent(id)}`);
      if (res.status === 404) {
        box.innerHTML = `<div class="empty"><h2>${esc(t("not_found"))}</h2></div>`;
        document.title = `${t("not_found")} · ${SITE_TITLE}`;
        return;
      }
      if (!res.ok) throw new Error("http");
      const data = await res.json();
      if (data.item) data.item = normalizeItem(data.item);
      else data.item = normalizeItem(data);
      if (data.related && Array.isArray(data.related.items)) {
        data.related.items = data.related.items.map(normalizeItem);
      }
      if (Array.isArray(data.channel_latest)) data.channel_latest = data.channel_latest.map(normalizeItem);
      state.articleCache = data;
      renderArticle(data);
    } catch {
      box.innerHTML = `<div class="error-block"><h2>${esc(t("error_title"))}</h2><button type="button" class="btn btn-primary" id="retry-article">${esc(t("error_retry"))}</button></div>`;
      const b = $("retry-article");
      if (b) b.addEventListener("click", () => openArticle(id, false));
    }
  }

  function closeArticle(push = true) {
    state.view = "feed";
    state.articleId = null;
    state.articleCache = null;
    if (push) syncUrl();
    showView();
    updateNewChip();
  }

  function goMarkets(push = true) {
    state.view = "markets";
    state.articleId = null;
    if (push) syncUrl();
    showView();
    updateNewChip();
    maybeLoadHistory();
  }

  function goFeed(push = true) {
    state.view = "feed";
    state.articleId = null;
    if (push) syncUrl();
    showView();
    updateNewChip();
  }

  function setChannel(ch, push = true) {
    state.channel = ch || "all";
    state.coin = "";
    state.query = "";
    $("search-input").value = "";
    $("search-clear").hidden = true;
    if (state.view !== "feed") goFeed(false);
    if (push) syncUrl();
    renderChannels();
    renderTrending();
    updateFeedHeading();
    resetFeed();
  }

  function setCoin(sym, push = true) {
    state.coin = sym || "";
    if (state.coin) {
      state.channel = "all";
      state.query = "";
      $("search-input").value = "";
      $("search-clear").hidden = true;
    }
    if (state.view !== "feed") goFeed(false);
    if (push) syncUrl();
    renderChannels();
    renderTrending();
    updateFeedHeading();
    resetFeed();
  }

  function setQuery(q, push = true) {
    state.query = (q || "").trim();
    $("search-input").value = state.query;
    $("search-clear").hidden = !state.query;
    if (state.query) {
      state.channel = "all";
      state.coin = "";
    }
    if (state.view !== "feed") goFeed(false);
    if (push) syncUrl();
    renderChannels();
    renderTrending();
    updateFeedHeading();
    resetFeed();
  }

  function bindEvents() {
    $("theme-toggle").addEventListener("click", () => applyTheme(state.theme === "dark" ? "light" : "dark"));
    $("lang-switch").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-lang]");
      if (!btn) return;
      applyLang(btn.getAttribute("data-lang"));
      syncUrl(true);
    });
    $("channel-scroller").addEventListener("click", (e) => {
      const pin = e.target.closest("[data-pin-ch]");
      if (pin) {
        e.preventDefault();
        e.stopPropagation();
        togglePin("channels", pin.getAttribute("data-pin-ch"));
        return;
      }
      const btn = e.target.closest("[data-ch]");
      if (btn) setChannel(btn.getAttribute("data-ch"));
    });
    $("channel-scroller").addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const pin = e.target.closest("[data-pin-ch]");
      if (!pin) return;
      e.preventDefault();
      e.stopPropagation();
      togglePin("channels", pin.getAttribute("data-pin-ch"));
    });
    $("search-form").addEventListener("submit", (e) => {
      e.preventDefault();
      if (state.view !== "feed") goFeed(false);
      setQuery($("search-input").value);
    });
    let qTimer = null;
    $("search-input").addEventListener("input", () => {
      $("search-clear").hidden = !$("search-input").value;
      clearTimeout(qTimer);
      qTimer = setTimeout(() => {
        if (state.view !== "feed") goFeed(false);
        setQuery($("search-input").value);
      }, 400);
    });
    $("search-clear").addEventListener("click", () => setQuery(""));
    $("feed").addEventListener("click", (e) => {
      const coin = e.target.closest("[data-coin]");
      if (coin) { e.preventDefault(); e.stopPropagation(); setCoin(coin.getAttribute("data-coin")); return; }
      const ch = e.target.closest("[data-ch]");
      if (ch) { e.preventDefault(); e.stopPropagation(); setChannel(ch.getAttribute("data-ch")); return; }
      const story = e.target.closest(".story[data-id]");
      if (story) openArticle(story.getAttribute("data-id"));
    });
    $("rail").addEventListener("click", (e) => {
      const tile = e.target.closest(".mx-tile[data-coin]");
      if (tile) { e.preventDefault(); onMatrixTileClick(tile.getAttribute("data-coin"), e); return; }
      const coin = e.target.closest("[data-coin]");
      if (coin) setCoin(coin.getAttribute("data-coin"));
    });
    $("ticker").addEventListener("click", (e) => {
      const coin = e.target.closest("[data-coin]");
      if (coin) setCoin(coin.getAttribute("data-coin"));
    });
    $("load-more").addEventListener("click", loadMore);
    $("new-chip").addEventListener("click", flushQueue);
    $("article-back").addEventListener("click", () => closeArticle(true));
    $("view-article").addEventListener("click", (e) => {
      const open = e.target.closest("[data-open-id]");
      if (open) { openArticle(open.getAttribute("data-open-id")); return; }
      const coin = e.target.closest("[data-coin]");
      if (coin) setCoin(coin.getAttribute("data-coin"));
    });
    $("mobile-nav").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-nav]");
      if (!btn) return;
      const nav = btn.getAttribute("data-nav");
      if (nav === "feed") goFeed();
      else if (nav === "markets") goMarkets();
      else if (nav === "search") {
        goFeed();
        $("search-input").focus();
        $("search-input").scrollIntoView({ block: "center" });
      }
    });
    $("markets-search").addEventListener("input", () => {
      state.marketsQuery = $("markets-search").value;
      renderMarketsView();
    });
    $("view-markets").addEventListener("click", (e) => {
      if (e.target.closest("[data-mx], [data-mx-chk]")) return;
      const tableRow = e.target.closest(".markets-table tr[data-coin]");
      if (tableRow) { e.preventDefault(); openCoinDetail(tableRow.getAttribute("data-coin"), { pinned: true }); return; }
      const tile = e.target.closest(".mx-tile[data-coin]");
      if (tile) { e.preventDefault(); onMatrixTileClick(tile.getAttribute("data-coin"), e); return; }
    });
    bindMatrixControls($("markets-matrix-tools"));
    bindMatrixControls($("rail-matrix-win"));
    bindMatrixHover();
    document.querySelector('.brand[data-nav="home"]').addEventListener("click", (e) => {
      e.preventDefault();
      state.channel = "all";
      state.coin = "";
      state.query = "";
      $("search-input").value = "";
      $("search-clear").hidden = true;
      goFeed(true);
      renderChannels();
      updateFeedHeading();
      resetFeed();
    });
    const onFeedScroll = () => {
      const sc = $("view-feed");
      state.atTop = !sc || sc.scrollTop < 140;
      if (state.atTop && state.queued.length && state.view === "feed") flushQueue();
      if (state.view === "feed" && state.hasMore && !state.loadingMore) {
        const sent = $("feed-sentinel");
        if (sent && !sent.hidden && sent.getBoundingClientRect().top < window.innerHeight + 400) loadMore();
      }
    };
    $("view-feed").addEventListener("scroll", onFeedScroll, { passive: true });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        updateLivePill("paused");
        stopMarketWS();
      } else {
        startNewsPoll();
        startMarket();
        pollStats();
      }
    });
    window.addEventListener("popstate", () => applyFromUrl({ replace: true, fromPop: true }));
    const drawer = $("coin-drawer");
    if (drawer) {
      drawer.addEventListener("click", (e) => {
        if (e.target.closest("[data-close-coin]")) { closeCoinDetail(); return; }
        const pinCoin = e.target.closest("[data-pin-coin]");
        if (pinCoin) {
          e.preventDefault();
          togglePin("coins", pinCoin.getAttribute("data-pin-coin"));
          return;
        }
        const filter = e.target.closest("[data-filter-coin]");
        if (filter) {
          const sym = filter.getAttribute("data-filter-coin");
          closeCoinDetail();
          setCoin(sym);
          return;
        }
        const story = e.target.closest("[data-open-id]");
        if (story) {
          const id = story.getAttribute("data-open-id");
          closeCoinDetail();
          openArticle(id);
          return;
        }
      });
    }
    const tip = $("matrix-tip");
    if (tip) {
      tip.addEventListener("click", () => {
        const sym = tip.getAttribute("data-coin") || state.matrixTip;
        if (sym) openCoinDetail(sym, { pinned: true });
      });
    }
    window.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (state.coinDrawer) { closeCoinDetail(); return; }
      if (state.matrixTip) { hideMatrixTip(); return; }
      if (state.view === "article") closeArticle(true);
    });
    window.addEventListener("resize", measureChrome);
    const ro = new ResizeObserver(measureChrome);
    ["site-header", "channel-bar", "ticker"].forEach((id) => {
      const el = $(id);
      if (el) ro.observe(el);
    });
    const footer = document.querySelector(".site-footer");
    if (footer) ro.observe(footer);
  }

  function startNewsPoll() {
    if (state.pollTimer) clearInterval(state.pollTimer);
    pollNews();
    state.pollTimer = setInterval(() => { if (!document.hidden) pollNews(); }, POLL_MS);
  }

  function startClocks() {
    updateClock();
    if (state.clockTimer) clearInterval(state.clockTimer);
    state.clockTimer = setInterval(updateClock, 1000);
    if (state.relTimer) clearInterval(state.relTimer);
    state.relTimer = setInterval(() => {
      if (state.view !== "feed" || !state.order.length) return;
      document.querySelectorAll(".story").forEach((node) => {
        const it = state.items.get(node.getAttribute("data-id"));
        if (!it) return;
        const rel = node.querySelector(".rel");
        if (rel) rel.textContent = relativeTime(it.published_ts) || formatCardTime(it.published_ts).zone;
      });
    }, 30000);
  }

  function applyFromUrl({ replace = true, fromPop = false } = {}) {
    const u = readUrl();
    if (u.lang && u.lang !== state.lang) applyLang(u.lang, true);
    state.channel = u.ch;
    state.coin = u.coin;
    state.query = u.q;
    $("search-input").value = state.query;
    $("search-clear").hidden = !state.query;
    renderChannels();
    updateFeedHeading();
    if (u.id) openArticle(u.id, false);
    else if (u.view === "markets") goMarkets(false);
    else goFeed(false);
    if (!fromPop) syncUrl(replace);
    resetFeed();
  }

  function detectTheme() {
    const saved = localStorage.getItem(LS_THEME);
    if (saved === "light" || saved === "dark") return saved;
    return "dark";
  }

  function detectLang() {
    const fromUrl = normalizeLang(new URL(location.href).searchParams.get("lang"));
    if (fromUrl) return fromUrl;
    const saved = normalizeLang(localStorage.getItem(LS_LANG));
    if (saved) return saved;
    return normalizeLang(navigator.language || "en") || "en";
  }


  window.BTC007_APP = {
    t,
    esc,
    locale,
    formatPrice,
    viewerTimeZone,
    zoneLabel,
    safeHttpUrl,
    lang: () => state.lang
  };

  function init() {
    applyTheme(detectTheme(), false);
    loadMatrixPrefs();
    loadPins();
    state.lang = detectLang();
    state.timeZone = browserTimeZone();
    state.timeZoneSource = "browser";
    applyLang(state.lang, true);
    detectViewerTimeZone();
    bindEvents();
    observeMatrix($("rail-matrix"), () => layoutMatrix($("rail-matrix"), { top: 30, compact: true }));
    observeMatrix($("markets-matrix"), () => {
      if (state.view === "markets") layoutMatrix($("markets-matrix"), { top: state.matrix.top, compact: false });
    });
    measureChrome();
    startClocks();
    const u = readUrl();
    state.channel = u.ch;
    state.coin = u.coin;
    state.query = u.q;
    $("search-input").value = state.query;
    $("search-clear").hidden = !state.query;
    renderChannels();
    updateFeedHeading();
    if (u.id) openArticle(u.id, false);
    else if (u.view === "markets") goMarkets(false);
    else goFeed(false);
    syncUrl(true);
    startNewsPoll();
    pollStats();
    state.statsTimer = setInterval(pollStats, STATS_MS);
    startMarket();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
