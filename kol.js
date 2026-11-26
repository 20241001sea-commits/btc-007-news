/* BTC-007 News — KOL copy-trading monitor (kol-trading channel).
   Binance blocks proxy requests from here.now, so a poller on our own box reads the public
   Binance copy-trading endpoints (~every 2s) and writes one snapshot per KOL into this site's
   here.now Site Data collection `kol_feed`. The page reads it same-origin every 3s while visible.
   To add a trader: add it here and to KOLS in the poller (kol-trading-poller/poller.py). */
(() => {
  "use strict";

  const KOL_LIST = [
    {
      key: "aoying",
      source: "binance",
      portfolioId: "5075281354358777856",
      name: "熬鹰资本",
      x: "thankUcrypto",
      url: "https://www.binance.com/en/copy-trading/lead-details/5075281354358777856"
    }
  ];

  const FEED_URL = "./.herenow/data/kol_feed?limit=20";
  const POLL_MS = 3000;
  const STALE_MS = 30000;
  const RATE_BACKOFF_MS = 10000;
  const MAX_BACKOFF_MS = 30000;
  const MAX_ROWS = 60;
  const NEW_MS = 15000;

  const STR = {
    zh: {
      stale: "数据源延迟，上次成功读取币安在 {s} 秒前", not_ready: "数据源尚未就绪",
      title: "KOL 带单监控",
      note: "数据来自币安合约公开带单（Binance Copy Trading）的公开接口，由本站服务器约每 2 秒读取一次，网页每 3 秒刷新，通常比交易员实际下单晚几秒。仅供参考，不构成投资建议。",
      live: "实时", connecting: "连接中", paused: "已暂停", backoff: "被限流，{s} 秒后重试", error: "暂时取不到数据，正在重试",
      updated: "{s} 秒前更新", updated_min: "{m} 分钟前更新", never: "尚未更新",
      aum: "管理规模", balance: "带单余额", copiers: "跟单人数", share: "分润比例", full: "已满员",
      binance_page: "币安带单页", positions: "当前持仓", positions_hidden: "交易员未公开当前持仓", positions_empty: "当前无持仓",
      orders: "最新订单", orders_empty: "暂无订单记录", loading: "加载中…", load_failed: "暂时无法加载，稍后自动重试",
      time: "时间", symbol: "合约", action: "方向", price: "成交均价", qty: "数量", notional: "名义价值", pnl: "已实现盈亏",
      open_long: "开多", close_long: "平多", open_short: "开空", close_short: "平空", buy: "买入", sell: "卖出",
      long: "多", short: "空", size: "仓位", entry: "开仓价", mark: "标记价", upnl: "未实现盈亏", lev: "杠杆",
      is_new: "新", times_in: "时间为 {z}", copy_status_paused: "已暂停带单"
    },
    en: {
      stale: "Source delayed, last read from Binance {s}s ago", not_ready: "Data source not ready yet",
      title: "KOL trade monitor",
      note: "Data comes from Binance Futures public copy trading pages. Our server reads them about every 2 seconds and this page refreshes every 3 seconds, so it usually lags the trader by a few seconds. For information only, not investment advice.",
      live: "Live", connecting: "Connecting", paused: "Paused", backoff: "Rate limited, retrying in {s}s", error: "Can’t reach the data right now, retrying",
      updated: "Updated {s}s ago", updated_min: "Updated {m} min ago", never: "Not updated yet",
      aum: "AUM", balance: "Lead balance", copiers: "Copiers", share: "Profit share", full: "Full",
      binance_page: "Binance lead page", positions: "Open positions", positions_hidden: "The trader keeps open positions private", positions_empty: "No open positions",
      orders: "Latest orders", orders_empty: "No orders yet", loading: "Loading…", load_failed: "Couldn’t load right now, retrying automatically",
      time: "Time", symbol: "Contract", action: "Side", price: "Avg price", qty: "Qty", notional: "Notional", pnl: "Realized PnL",
      open_long: "Open long", close_long: "Close long", open_short: "Open short", close_short: "Close short", buy: "Buy", sell: "Sell",
      long: "Long", short: "Short", size: "Size", entry: "Entry", mark: "Mark", upnl: "Unrealized PnL", lev: "Leverage",
      is_new: "New", times_in: "Times in {z}", copy_status_paused: "Lead paused"
    },
    ko: {
      stale: "데이터 소스 지연, 마지막 바이낸스 조회 {s}초 전", not_ready: "데이터 소스 준비 중",
      title: "KOL 거래 모니터",
      note: "데이터는 바이낸스 선물 공개 카피트레이딩 페이지에서 가져옵니다. 서버가 약 2초마다 읽고 페이지는 3초마다 새로고침하므로 보통 실제 주문보다 몇 초 늦습니다. 참고용이며 투자 조언이 아닙니다.",
      live: "실시간", connecting: "연결 중", paused: "일시 중지", backoff: "요청 제한, {s}초 후 재시도", error: "데이터를 가져올 수 없어 재시도 중",
      updated: "{s}초 전 업데이트", updated_min: "{m}분 전 업데이트", never: "아직 업데이트 없음",
      aum: "운용 규모", balance: "리드 잔고", copiers: "카피 인원", share: "수익 배분", full: "정원 마감",
      binance_page: "바이낸스 리드 페이지", positions: "현재 포지션", positions_hidden: "트레이더가 현재 포지션을 비공개로 설정했습니다", positions_empty: "현재 포지션 없음",
      orders: "최신 주문", orders_empty: "주문 기록 없음", loading: "불러오는 중…", load_failed: "지금은 불러올 수 없어 자동으로 재시도합니다",
      time: "시간", symbol: "계약", action: "방향", price: "평균가", qty: "수량", notional: "명목 가치", pnl: "실현 손익",
      open_long: "롱 진입", close_long: "롱 청산", open_short: "숏 진입", close_short: "숏 청산", buy: "매수", sell: "매도",
      long: "롱", short: "숏", size: "규모", entry: "진입가", mark: "마크가", upnl: "미실현 손익", lev: "레버리지",
      is_new: "신규", times_in: "시간대 {z}", copy_status_paused: "리드 일시 중지"
    },
    tr: {
      stale: "Kaynak gecikmeli, Binance'ten son okuma {s} sn önce", not_ready: "Veri kaynağı henüz hazır değil",
      title: "KOL işlem takibi",
      note: "Veriler Binance Vadeli herkese açık kopya işlem sayfalarından gelir. Sunucumuz verileri yaklaşık 2 saniyede bir okur, sayfa 3 saniyede bir yenilenir; bu yüzden genellikle işlemciden birkaç saniye geride kalır. Yalnızca bilgi amaçlıdır, yatırım tavsiyesi değildir.",
      live: "Canlı", connecting: "Bağlanıyor", paused: "Duraklatıldı", backoff: "Hız sınırı, {s} sn sonra yeniden denenecek", error: "Veriye şu an ulaşılamıyor, yeniden deneniyor",
      updated: "{s} sn önce güncellendi", updated_min: "{m} dk önce güncellendi", never: "Henüz güncellenmedi",
      aum: "Yönetilen varlık", balance: "Lider bakiyesi", copiers: "Kopyalayanlar", share: "Kâr payı", full: "Dolu",
      binance_page: "Binance lider sayfası", positions: "Açık pozisyonlar", positions_hidden: "İşlemci açık pozisyonlarını gizli tutuyor", positions_empty: "Açık pozisyon yok",
      orders: "Son emirler", orders_empty: "Henüz emir yok", loading: "Yükleniyor…", load_failed: "Şu an yüklenemedi, otomatik yeniden denenecek",
      time: "Zaman", symbol: "Kontrat", action: "Yön", price: "Ort. fiyat", qty: "Miktar", notional: "Nominal", pnl: "Gerçekleşen K/Z",
      open_long: "Long aç", close_long: "Long kapat", open_short: "Short aç", close_short: "Short kapat", buy: "Al", sell: "Sat",
      long: "Long", short: "Short", size: "Büyüklük", entry: "Giriş", mark: "İşaret", upnl: "Gerçekleşmemiş K/Z", lev: "Kaldıraç",
      is_new: "Yeni", times_in: "Saatler {z}", copy_status_paused: "Liderlik duraklatıldı"
    },
    ru: {
      stale: "Источник задерживается, последнее чтение Binance {s} с назад", not_ready: "Источник данных ещё не готов",
      title: "Мониторинг сделок KOL",
      note: "Данные взяты с публичных страниц копи-трейдинга Binance Futures. Наш сервер читает их примерно каждые 2 секунды, страница обновляется каждые 3 секунды, поэтому обычно отстаёт от трейдера на несколько секунд. Только для информации, не инвестиционный совет.",
      live: "В эфире", connecting: "Подключение", paused: "Пауза", backoff: "Лимит запросов, повтор через {s} с", error: "Данные сейчас недоступны, повторяем",
      updated: "Обновлено {s} с назад", updated_min: "Обновлено {m} мин назад", never: "Ещё не обновлялось",
      aum: "Под управлением", balance: "Баланс лидера", copiers: "Копировщики", share: "Доля прибыли", full: "Мест нет",
      binance_page: "Страница на Binance", positions: "Открытые позиции", positions_hidden: "Трейдер скрывает открытые позиции", positions_empty: "Открытых позиций нет",
      orders: "Последние ордера", orders_empty: "Ордеров пока нет", loading: "Загрузка…", load_failed: "Сейчас не загрузилось, повторим автоматически",
      time: "Время", symbol: "Контракт", action: "Сторона", price: "Ср. цена", qty: "Кол-во", notional: "Номинал", pnl: "Реализ. PnL",
      open_long: "Открыть лонг", close_long: "Закрыть лонг", open_short: "Открыть шорт", close_short: "Закрыть шорт", buy: "Покупка", sell: "Продажа",
      long: "Лонг", short: "Шорт", size: "Размер", entry: "Вход", mark: "Маркировка", upnl: "Нереализ. PnL", lev: "Плечо",
      is_new: "Новое", times_in: "Время: {z}", copy_status_paused: "Ведение приостановлено"
    }
  };

  const app = () => window.BTC007_APP || null;
  const lang = () => (app() ? app().lang() : "zh");
  const loc = () => (app() ? app().locale() : "zh-Hans");
  function t(key, vars) {
    const d = STR[lang()] || STR.en;
    let s = d[key] != null ? d[key] : (STR.en[key] != null ? STR.en[key] : key);
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  const num = (v) => {
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  function fmtNum(v, max = 4) {
    const n = num(v);
    if (n == null) return "—";
    return n.toLocaleString(loc(), { maximumFractionDigits: max });
  }
  function fmtPrice(v) {
    const n = num(v);
    if (n == null) return "—";
    return app() ? app().formatPrice(n) : String(n);
  }
  function fmtUsdt(v, compact) {
    const n = num(v);
    if (n == null) return "—";
    const s = n.toLocaleString(loc(), compact
      ? { notation: "compact", maximumFractionDigits: 2 }
      : { maximumFractionDigits: Math.abs(n) >= 100 ? 0 : 2 });
    return `${s} USDT`;
  }
  function fmtPnl(v) {
    const n = num(v);
    if (n == null) return "—";
    const s = Math.abs(n).toLocaleString(loc(), { maximumFractionDigits: 2, minimumFractionDigits: 2 });
    return `${n > 0 ? "+" : n < 0 ? "−" : ""}${s}`;
  }
  const pnlClass = (v) => {
    const n = num(v);
    if (!n) return "";
    return n > 0 ? "pct-up" : "pct-down";
  };
  function tz() {
    return app() ? app().viewerTimeZone() : undefined;
  }
  function fmtTime(ts) {
    const n = num(ts);
    if (!n) return "—";
    try {
      return new Intl.DateTimeFormat(loc(), {
        timeZone: tz(), month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
      }).format(new Date(n));
    } catch {
      return new Date(n).toISOString();
    }
  }
  function zoneText() {
    try { return (app() && app().zoneLabel(new Date(), "shortOffset")) || tz() || ""; } catch { return ""; }
  }

  function actionOf(o) {
    const side = String(o.side || "").toUpperCase();
    const ps = String(o.positionSide || "").toUpperCase();
    if (ps === "LONG") return side === "BUY" ? "open_long" : "close_long";
    if (ps === "SHORT") return side === "SELL" ? "open_short" : "close_short";
    return side === "BUY" ? "buy" : "sell";
  }
  const isClose = (a) => a === "close_long" || a === "close_short";
  const orderKey = (o) => [o.orderTime, o.symbol, o.side, o.positionSide, o.executedQty, o.avgPrice].join("|");

  const kols = new Map(KOL_LIST.map((k) => [k.key, {
    cfg: k,
    orders: [],
    seen: new Set(),
    newUntil: new Map(),
    loaded: false,
    detail: null,
    positions: null,
    srcOk: 0,
    srcErr: null,
    hasRecord: false
  }]));
  const feed = { status: "connecting", lastTry: 0, backoffUntil: 0, fails: 0, inflight: false, lastOk: 0 };

  let active = false;
  let current = KOL_LIST[0].key;
  let timer = null;
  let built = false;

  const root = () => document.getElementById("kol-view");
  const st = () => kols.get(current);

  function applySnap(s, snap) {
    const now = Date.now();
    s.hasRecord = true;
    s.srcOk = num(snap.src_ok_ms) || 0;
    s.srcErr = snap.src_err || null;
    let ordersChanged = false;
    if (Array.isArray(snap.orders)) {
      for (const o of snap.orders) {
        const k = orderKey(o);
        if (s.seen.has(k)) continue;
        s.seen.add(k);
        s.orders.push(o);
        if (s.loaded) s.newUntil.set(k, now + NEW_MS);
        ordersChanged = true;
      }
      s.orders.sort((a, b) => (num(b.orderTime) || 0) - (num(a.orderTime) || 0));
      if (s.orders.length > MAX_ROWS) s.orders.length = MAX_ROWS;
      if (!s.loaded) ordersChanged = true;
      s.loaded = true;
    }
    const detailSig = JSON.stringify(snap.detail || null);
    const posSig = JSON.stringify(snap.positions == null ? null : snap.positions);
    const detailChanged = detailSig !== s._detailSig;
    const posChanged = posSig !== s._posSig || detailChanged;
    s._detailSig = detailSig;
    s._posSig = posSig;
    s.detail = snap.detail || null;
    s.positions = Array.isArray(snap.positions) ? snap.positions : null;
    if (s === st()) {
      if (ordersChanged) renderOrders();
      if (detailChanged) renderCard();
      if (posChanged) renderPositions();
    }
  }

  async function poll() {
    feed.lastTry = Date.now();
    let res;
    try {
      res = await fetch(FEED_URL, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    } catch {
      res = null;
    }
    if (res && (res.status === 429 || res.status === 503)) {
      const ra = num(res.headers.get("Retry-After"));
      feed.status = "backoff";
      feed.backoffUntil = Date.now() + Math.min(60000, Math.max(RATE_BACKOFF_MS, ra ? ra * 1000 : 0));
      renderStatus();
      return;
    }
    let j = null;
    if (res && res.ok) { try { j = await res.json(); } catch { j = null; } }
    if (!j || !Array.isArray(j.records)) {
      feed.fails += 1;
      feed.status = "error";
      feed.backoffUntil = Date.now() + Math.min(MAX_BACKOFF_MS, POLL_MS * Math.pow(2, feed.fails - 1));
      const s = st();
      if (!s.loaded) renderOrders();
      renderStatus();
      return;
    }
    feed.fails = 0;
    feed.status = "ok";
    feed.lastOk = Date.now();
    const seen = new Set();
    for (const r of j.records) {
      const d = r && r.data;
      if (!d || typeof d.kol !== "string" || seen.has(d.kol) || !kols.has(d.kol) || !d.snap || typeof d.snap !== "object") continue;
      seen.add(d.kol);
      applySnap(kols.get(d.kol), d.snap);
    }
    renderStatus();
  }

  async function tick() {
    renderStatus();
    renderAges();
    if (!active || document.hidden || feed.inflight) return;
    const now = Date.now();
    if (now < feed.backoffUntil || now - feed.lastTry < POLL_MS - 250) return;
    feed.inflight = true;
    try { await poll(); } finally { feed.inflight = false; }
  }

  function statusInfo(s) {
    if (!active || document.hidden) return { cls: "paused", text: t("paused") };
    if (feed.status === "backoff") return { cls: "backoff", text: t("backoff", { s: Math.max(1, Math.ceil((feed.backoffUntil - Date.now()) / 1000)) }) };
    if (feed.status === "error") return { cls: "error", text: t("error") };
    if (feed.status === "connecting") return { cls: "connecting", text: t("connecting") };
    if (!s.hasRecord || !s.srcOk) return { cls: "error", text: t("not_ready") };
    const age = Date.now() - s.srcOk;
    if (age > STALE_MS) return { cls: "backoff", text: t("stale", { s: Math.round(age / 1000) }) };
    return { cls: "live", text: t("live") };
  }

  function agoText(s) {
    if (!s.srcOk) return t("never");
    const sec = Math.max(0, Math.round((Date.now() - s.srcOk) / 1000));
    return sec < 120 ? t("updated", { s: sec }) : t("updated_min", { m: Math.round(sec / 60) });
  }

  function renderStatus() {
    const box = root();
    if (!box || !built) return;
    const s = st();
    const el = box.querySelector("[data-kol-status]");
    if (!el) return;
    const info = statusInfo(s);
    el.dataset.state = info.cls;
    el.querySelector(".kol-status-text").textContent = info.text;
    el.querySelector(".kol-status-ago").textContent = agoText(s);
  }

  function renderAges() {
    const box = root();
    if (!box) return;
    const now = Date.now();
    box.querySelectorAll(".kol-order.is-new").forEach((row) => {
      const until = st().newUntil.get(row.getAttribute("data-key"));
      if (!until || until < now) row.classList.remove("is-new");
    });
  }

  function picker() {
    if (KOL_LIST.length < 2) return "";
    return `<div class="kol-picker" role="tablist">${KOL_LIST.map((k) => `<button type="button" role="tab" class="channel-pill${k.key === current ? " is-active" : ""}" aria-selected="${k.key === current}" data-kol="${esc(k.key)}">${esc(k.name)}</button>`).join("")}</div>`;
  }

  function build() {
    const box = root();
    if (!box) return;
    built = true;
    box.innerHTML = `
      ${picker()}
      <div class="kol-head">
        <h2 class="kol-title">${esc(t("title"))}</h2>
        <span class="kol-status" data-kol-status data-state="connecting">
          <span class="kol-dot" aria-hidden="true"></span>
          <span class="kol-status-text"></span>
          <span class="kol-status-ago"></span>
        </span>
      </div>
      <section class="kol-card" data-kol-card></section>
      <section class="kol-block">
        <h3 class="kol-sub">${esc(t("positions"))}</h3>
        <div data-kol-positions></div>
      </section>
      <section class="kol-block">
        <div class="kol-sub-row">
          <h3 class="kol-sub">${esc(t("orders"))}</h3>
          <span class="kol-zone" data-kol-zone></span>
        </div>
        <div data-kol-orders></div>
      </section>
      <p class="kol-note">${esc(t("note"))}</p>`;
    renderCard();
    renderPositions();
    renderOrders();
    renderStatus();
  }

  function renderCard() {
    const box = root();
    const el = box && box.querySelector("[data-kol-card]");
    if (!el) return;
    const s = st();
    const c = s.cfg;
    const d = s.detail || {};
    const avatar = typeof d.avatarUrl === "string" && /^https:\/\//.test(d.avatarUrl) ? d.avatarUrl : "";
    const initial = esc(c.name.slice(0, 1));
    const cur = num(d.currentCopyCount);
    const max = num(d.maxCopyCount);
    const full = cur != null && max != null && max > 0 && cur >= max;
    const stat = (label, value, extra = "") => `<div class="kol-stat"><span class="k">${esc(label)}</span><span class="v">${value}${extra}</span></div>`;
    const bio = typeof d.description === "string" ? d.description.trim() : "";
    el.innerHTML = `
      <div class="kol-id">
        <span class="kol-avatar">${avatar ? `<img src="${esc(avatar)}" alt="" width="44" height="44" loading="lazy" referrerpolicy="no-referrer">` : initial}</span>
        <div class="kol-id-text">
          <div class="kol-name">${esc(d.nickname || c.name)}${d.isPaused ? ` <span class="kol-tag">${esc(t("copy_status_paused"))}</span>` : ""}</div>
          <div class="kol-links">
            <a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">${esc(t("binance_page"))} ↗</a>
            ${c.x ? `<a href="https://x.com/${encodeURIComponent(c.x)}" target="_blank" rel="noopener noreferrer">@${esc(c.x)}</a>` : ""}
          </div>
        </div>
      </div>
      ${bio ? `<p class="kol-bio">${esc(bio)}</p>` : ""}
      ${s.detail ? `<div class="kol-stats">
        ${stat(t("aum"), esc(fmtUsdt(d.aumAmount, true)))}
        ${stat(t("balance"), esc(fmtUsdt(d.marginBalance, true)))}
        ${stat(t("copiers"), cur != null ? `${esc(fmtNum(cur, 0))}${max != null ? ` / ${esc(fmtNum(max, 0))}` : ""}` : "—", full ? ` <span class="kol-tag">${esc(t("full"))}</span>` : "")}
        ${stat(t("share"), num(d.profitSharingRate) != null ? `${esc(fmtNum(d.profitSharingRate, 2))}%` : "—")}
      </div>` : `<p class="kol-muted">${esc(feed.status === "error" ? t("load_failed") : t("loading"))}</p>`}`;
  }

  function posRows(list) {
    return list.filter((p) => {
      const amt = num(p.positionAmount != null ? p.positionAmount : p.positionAmt);
      return amt != null && amt !== 0;
    });
  }

  function renderPositions() {
    const box = root();
    const el = box && box.querySelector("[data-kol-positions]");
    if (!el) return;
    const s = st();
    if (s.positions == null) {
      el.innerHTML = `<p class="kol-muted">${esc(feed.status === "error" ? t("load_failed") : t("loading"))}</p>`;
      return;
    }
    const rows = posRows(s.positions);
    if (!rows.length) {
      const hidden = s.detail && s.detail.positionShow === false;
      el.innerHTML = `<p class="kol-muted">${esc(hidden ? t("positions_hidden") : t("positions_empty"))}</p>`;
      return;
    }
    el.innerHTML = `<div class="kol-positions">${rows.map((p) => {
      const amt = num(p.positionAmount != null ? p.positionAmount : p.positionAmt);
      const ps = String(p.positionSide || "").toUpperCase();
      const long = ps === "LONG" || (ps !== "SHORT" && amt > 0);
      const upnl = p.unrealizedProfit != null ? p.unrealizedProfit : p.unRealizedProfit;
      const lev = num(p.leverage);
      return `<div class="kol-pos">
        <div class="kol-pos-sym"><b>${esc(p.symbol || "—")}</b> <span class="kol-side ${long ? "is-buy" : "is-sell"}">${esc(t(long ? "long" : "short"))}${lev ? ` ${esc(fmtNum(lev, 0))}x` : ""}</span></div>
        <div><span class="k">${esc(t("size"))}</span><span class="v">${esc(fmtNum(Math.abs(amt)))}</span></div>
        <div><span class="k">${esc(t("entry"))}</span><span class="v">${esc(fmtPrice(p.entryPrice))}</span></div>
        <div><span class="k">${esc(t("mark"))}</span><span class="v">${esc(fmtPrice(p.markPrice))}</span></div>
        <div><span class="k">${esc(t("upnl"))}</span><span class="v ${pnlClass(upnl)}">${esc(fmtPnl(upnl))}</span></div>
      </div>`;
    }).join("")}</div>`;
  }

  function renderOrders() {
    const box = root();
    const el = box && box.querySelector("[data-kol-orders]");
    if (!el) return;
    const zone = box.querySelector("[data-kol-zone]");
    if (zone) zone.textContent = t("times_in", { z: zoneText() });
    const s = st();
    if (!s.loaded) {
      el.innerHTML = `<p class="kol-muted">${esc(feed.status === "error" ? t("load_failed") : (feed.status === "ok" ? t("not_ready") : t("loading")))}</p>`;
      return;
    }
    if (!s.orders.length) {
      el.innerHTML = `<p class="kol-muted">${esc(t("orders_empty"))}</p>`;
      return;
    }
    const now = Date.now();
    const head = `<div class="kol-order kol-order-head" aria-hidden="true">
      <span class="c-time">${esc(t("time"))}</span><span class="c-sym">${esc(t("symbol"))}</span><span class="c-act">${esc(t("action"))}</span>
      <span class="c-num c-price">${esc(t("price"))}</span><span class="c-num c-qty">${esc(t("qty"))}</span><span class="c-num c-notional">${esc(t("notional"))}</span><span class="c-num c-pnl">${esc(t("pnl"))}</span>
    </div>`;
    el.innerHTML = `<div class="kol-orders" role="list">${head}${s.orders.map((o) => {
      const k = orderKey(o);
      const a = actionOf(o);
      const isNew = (s.newUntil.get(k) || 0) > now;
      const price = num(o.avgPrice);
      const qty = num(o.executedQty);
      const notional = price != null && qty != null ? price * qty : null;
      const buy = String(o.side || "").toUpperCase() === "BUY";
      const pnl = isClose(a) ? o.totalPnl : null;
      return `<div class="kol-order${isNew ? " is-new" : ""}" role="listitem" data-key="${esc(k)}">
        <span class="c-time">${esc(fmtTime(o.orderTime))}${isNew ? ` <span class="kol-new">${esc(t("is_new"))}</span>` : ""}</span>
        <span class="c-sym">${esc(o.symbol || "—")}</span>
        <span class="c-act"><span class="kol-side ${buy ? "is-buy" : "is-sell"}">${esc(t(a))}</span></span>
        <span class="c-num c-price" data-label="${esc(t("price"))}">${esc(fmtPrice(price))}</span>
        <span class="c-num c-qty" data-label="${esc(t("qty"))}">${esc(fmtNum(qty))}</span>
        <span class="c-num c-notional" data-label="${esc(t("notional"))}">${esc(fmtUsdt(notional))}</span>
        <span class="c-num c-pnl ${pnl != null ? pnlClass(pnl) : ""}" data-label="${esc(t("pnl"))}">${pnl != null ? esc(fmtPnl(pnl)) : "—"}</span>
      </div>`;
    }).join("")}</div>`;
  }

  function onClick(e) {
    const b = e.target.closest("[data-kol]");
    if (!b) return;
    const k = b.getAttribute("data-kol");
    if (!kols.has(k) || k === current) return;
    current = k;
    build();
    tick();
  }

  function setActive(on) {
    on = !!on;
    if (on && !built) {
      build();
      const box = root();
      if (box) box.addEventListener("click", onClick);
    }
    if (on === active) return;
    active = on;
    if (on) {
      if (!timer) timer = setInterval(tick, 1000);
      tick();
    } else if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && active) tick();
    else renderStatus();
  });

  window.BTC007_KOL = {
    list: KOL_LIST,
    setActive,
    rerender() { if (built) build(); }
  };
})();
