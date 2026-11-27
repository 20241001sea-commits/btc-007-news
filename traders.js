/* BTC-007 News — Hype top-10 traders by PnL (trader-leaderboard channel).
   Source: Hyperliquid's public no-login API. A poller on our box ranks the 30-day PnL leaderboard,
   keeps only traders with a perpetual fill in the last 7 days, follows their fills over Hyperliquid's
   websocket and writes one snapshot per trader into this site's Site Data collection `trader_feed`.
   The page reads it same-origin every 2s while visible. Reuses the kol-* row styles. */
(() => {
  "use strict";

  const FEED_URL = "./.herenow/data/trader_feed?limit=30";
  const POLL_MS = 2000;
  const STALE_MS = 120000;
  const MAX_BACKOFF_MS = 30000;
  const NEW_MS = 15000;
  const HL_APP = "https://app.hyperliquid.xyz";

  const STR = {
    zh: {
      title: "Hype 交易员盈利TOP10",
      note: "数据来自 Hyperliquid 公开接口（无需登录）。榜单按近 30 天盈利排序，只收录最近 7 天内有永续合约成交的地址，约每 10 分钟刷新一次；成交通过 Hyperliquid 的 WebSocket 实时接收，网页每 2 秒刷新，通常比链上成交晚几秒。最大回撤按 30 天盈亏曲线估算，无法计算时显示 —。仅供参考，不构成投资建议。",
      rank_basis: "排名依据：近 30 天盈利（USDC）", ws_note: "成交实时推送，通常延迟几秒",
      stale: "数据源延迟，上次更新在 {s} 秒前", not_ready: "数据源尚未就绪", live: "实时", connecting: "连接中", paused: "已暂停",
      backoff: "被限流，{s} 秒后重试", error: "暂时取不到数据，正在重试", updated: "{s} 秒前更新", updated_min: "{m} 分钟前更新", never: "尚未更新",
      times_in: "时间为 {z}", is_new: "新", pinned_pnl: "30天盈利",
      pnl30: "30天盈利", roi30: "30天收益率", mdd30: "最大回撤（30天，估算）", acct: "账户总值", vlm30: "30天成交额", pnl_all: "历史总盈利",
      address: "地址", hl_link: "在 Hyperliquid 查看", scan_link: "在 Hypurrscan 查看",
      positions: "当前持仓", positions_summary: "当前持仓：{s}", positions_empty: "当前无永续持仓", loading: "加载中…",
      orders: "最近成交", orders_empty: "最近没有永续成交", history_show: "查看历史记录 ({n})", history_hide: "收起",
      long: "多", short: "空", size: "仓位", entry: "开仓价", upnl: "未实现盈亏", lev: "杠杆", liq: "强平价", value: "价值",
      open_long: "开多", close_long: "平多", open_short: "开空", close_short: "平空",
      flip_ls: "多转空", flip_sl: "空转多", liquidation: "被强平", adl: "自动减仓", other: "成交",
      perp: "永续", side_long: "做多", side_short: "做空",
      sentence_open: "以 {price} 的价格开启 {symbol} {perp} 的{side}仓位，数量为 {qty}{base}，总价值为 {value}USDC。",
      sentence_close: "以 {price} 的价格平仓 {symbol} {perp} 的{side}仓位，数量为 {qty}{base}，总价值为 {value}USDC。",
      sentence_other: "{label}：以 {price} 的价格成交 {symbol} {perp}，数量为 {qty}{base}，总价值为 {value}USDC。",
      sentence_pnl: "已实现盈亏为 {pnl}USDC。"
    },
    en: {
      title: "Hype Top 10 Traders by PnL",
      note: "Data comes from Hyperliquid’s public no-login API. Ranked by 30-day PnL, keeping only addresses with a perpetual fill in the last 7 days; the ranking refreshes about every 10 minutes. Fills arrive over Hyperliquid’s websocket and this page refreshes every 2 seconds, so it usually lags by a few seconds. Max drawdown is estimated from the 30-day PnL curve and shows — when it can’t be computed. For information only, not investment advice.",
      rank_basis: "Ranked by 30-day PnL (USDC)", ws_note: "Fills stream live, usually a few seconds behind",
      stale: "Source delayed, last update {s}s ago", not_ready: "Data source not ready yet", live: "Live", connecting: "Connecting", paused: "Paused",
      backoff: "Rate limited, retrying in {s}s", error: "Can’t reach the data right now, retrying", updated: "Updated {s}s ago", updated_min: "Updated {m} min ago", never: "Not updated yet",
      times_in: "Times in {z}", is_new: "New", pinned_pnl: "30D PnL",
      pnl30: "30D PnL", roi30: "30D ROI", mdd30: "Max drawdown (30D, est.)", acct: "Account value", vlm30: "30D volume", pnl_all: "All-time PnL",
      address: "Address", hl_link: "View on Hyperliquid", scan_link: "View on Hypurrscan",
      positions: "Open positions", positions_summary: "Open positions: {s}", positions_empty: "No open perpetual positions", loading: "Loading…",
      orders: "Recent fills", orders_empty: "No recent perpetual fills", history_show: "View history ({n})", history_hide: "Hide",
      long: "Long", short: "Short", size: "Size", entry: "Entry", upnl: "Unrealized PnL", lev: "Leverage", liq: "Liq. price", value: "Value",
      open_long: "Open long", close_long: "Close long", open_short: "Open short", close_short: "Close short",
      flip_ls: "Long→Short", flip_sl: "Short→Long", liquidation: "Liquidated", adl: "Auto-deleverage", other: "Fill",
      perp: "Perpetual", side_long: "long", side_short: "short",
      sentence_open: "Opened a {side} position on {symbol} {perp} at {price}, quantity {qty} {base}, total value {value}USDC.",
      sentence_close: "Closed a {side} position on {symbol} {perp} at {price}, quantity {qty} {base}, total value {value}USDC.",
      sentence_other: "{label}: filled {symbol} {perp} at {price}, quantity {qty} {base}, total value {value}USDC.",
      sentence_pnl: "Realized PnL {pnl}USDC."
    },
    ko: {
      title: "Hype 수익 TOP10 트레이더",
      note: "데이터는 Hyperliquid의 공개 API(로그인 불필요)에서 가져옵니다. 최근 30일 수익 순위이며, 최근 7일 안에 무기한 선물 체결이 있는 주소만 포함하고 약 10분마다 갱신합니다. 체결은 Hyperliquid 웹소켓으로 받고 페이지는 2초마다 새로고침되어 보통 몇 초 늦습니다. 최대 낙폭은 30일 손익 곡선으로 추정하며 계산할 수 없으면 —로 표시합니다. 참고용이며 투자 조언이 아닙니다.",
      rank_basis: "순위 기준: 최근 30일 수익(USDC)", ws_note: "체결 실시간 수신, 보통 몇 초 지연",
      stale: "데이터 소스 지연, 마지막 갱신 {s}초 전", not_ready: "데이터 소스 준비 중", live: "실시간", connecting: "연결 중", paused: "일시 중지",
      backoff: "요청 제한, {s}초 후 재시도", error: "지금은 데이터를 가져올 수 없어 재시도 중", updated: "{s}초 전 갱신", updated_min: "{m}분 전 갱신", never: "아직 갱신 없음",
      times_in: "시간대 {z}", is_new: "신규", pinned_pnl: "30일 수익",
      pnl30: "30일 수익", roi30: "30일 수익률", mdd30: "최대 낙폭 (30일, 추정)", acct: "계정 가치", vlm30: "30일 거래량", pnl_all: "전체 기간 수익",
      address: "주소", hl_link: "Hyperliquid에서 보기", scan_link: "Hypurrscan에서 보기",
      positions: "현재 포지션", positions_summary: "현재 포지션: {s}", positions_empty: "무기한 포지션 없음", loading: "불러오는 중…",
      orders: "최근 체결", orders_empty: "최근 무기한 체결 없음", history_show: "거래 기록 보기 ({n})", history_hide: "접기",
      long: "롱", short: "숏", size: "수량", entry: "진입가", upnl: "미실현 손익", lev: "레버리지", liq: "청산가", value: "가치",
      open_long: "롱 진입", close_long: "롱 청산", open_short: "숏 진입", close_short: "숏 청산",
      flip_ls: "롱→숏", flip_sl: "숏→롱", liquidation: "강제 청산", adl: "자동 감축", other: "체결",
      perp: "무기한", side_long: "롱", side_short: "숏",
      sentence_open: "{price}의 가격으로 {symbol} {perp} {side} 포지션을 열었습니다. 수량은 {qty}{base}, 총 가치는 {value}USDC입니다.",
      sentence_close: "{price}의 가격으로 {symbol} {perp} {side} 포지션을 청산했습니다. 수량은 {qty}{base}, 총 가치는 {value}USDC입니다.",
      sentence_other: "{label}: {price}의 가격으로 {symbol} {perp} 체결, 수량은 {qty}{base}, 총 가치는 {value}USDC입니다.",
      sentence_pnl: "실현 손익은 {pnl}USDC입니다."
    },
    tr: {
      title: "Hype PnL’ye Göre İlk 10 Trader",
      note: "Veriler Hyperliquid’in herkese açık, girişsiz API’sinden gelir. Son 30 günlük PnL’ye göre sıralanır; yalnızca son 7 günde perpetual işlemi olan adresler listelenir ve sıralama yaklaşık 10 dakikada bir yenilenir. İşlemler Hyperliquid websocket’i ile alınır, sayfa 2 saniyede bir yenilenir; genelde birkaç saniye gecikir. Maks. düşüş 30 günlük PnL eğrisinden tahmin edilir, hesaplanamazsa — görünür. Yalnızca bilgi amaçlıdır, yatırım tavsiyesi değildir.",
      rank_basis: "Sıralama: son 30 gün PnL (USDC)", ws_note: "İşlemler canlı akar, genelde birkaç sn gecikme",
      stale: "Kaynak gecikti, son güncelleme {s} sn önce", not_ready: "Veri kaynağı henüz hazır değil", live: "Canlı", connecting: "Bağlanıyor", paused: "Duraklatıldı",
      backoff: "Sınır aşıldı, {s} sn sonra tekrar", error: "Veriye şu an ulaşılamıyor, yeniden deneniyor", updated: "{s} sn önce güncellendi", updated_min: "{m} dk önce güncellendi", never: "Henüz güncellenmedi",
      times_in: "Saatler {z}", is_new: "Yeni", pinned_pnl: "30g PnL",
      pnl30: "30 günlük PnL", roi30: "30 günlük ROI", mdd30: "Maks. düşüş (30g, tahmini)", acct: "Hesap değeri", vlm30: "30 günlük hacim", pnl_all: "Toplam PnL",
      address: "Adres", hl_link: "Hyperliquid’de gör", scan_link: "Hypurrscan’de gör",
      positions: "Açık pozisyonlar", positions_summary: "Açık pozisyonlar: {s}", positions_empty: "Açık perpetual pozisyon yok", loading: "Yükleniyor…",
      orders: "Son işlemler", orders_empty: "Son perpetual işlem yok", history_show: "Geçmişi gör ({n})", history_hide: "Gizle",
      long: "Long", short: "Short", size: "Miktar", entry: "Giriş", upnl: "Gerçekleşmemiş K/Z", lev: "Kaldıraç", liq: "Likidasyon fiyatı", value: "Değer",
      open_long: "Long aç", close_long: "Long kapat", open_short: "Short aç", close_short: "Short kapat",
      flip_ls: "Long→Short", flip_sl: "Short→Long", liquidation: "Likide edildi", adl: "Otomatik azaltma", other: "İşlem",
      perp: "Perpetual", side_long: "long", side_short: "short",
      sentence_open: "{symbol} {perp} {side} pozisyonu {price} fiyatından açıldı, miktar {qty} {base}, toplam değer {value}USDC.",
      sentence_close: "{symbol} {perp} {side} pozisyonu {price} fiyatından kapatıldı, miktar {qty} {base}, toplam değer {value}USDC.",
      sentence_other: "{label}: {symbol} {perp} {price} fiyatından gerçekleşti, miktar {qty} {base}, toplam değer {value}USDC.",
      sentence_pnl: "Gerçekleşen K/Z {pnl}USDC."
    },
    ru: {
      title: "Hype: топ-10 трейдеров по прибыли",
      note: "Данные берутся из открытого API Hyperliquid без входа в аккаунт. Рейтинг по прибыли за 30 дней, только адреса со сделкой по бессрочным контрактам за последние 7 дней; рейтинг обновляется примерно раз в 10 минут. Сделки приходят по websocket Hyperliquid, страница обновляется каждые 2 секунды, обычно с задержкой в несколько секунд. Макс. просадка оценивается по кривой PnL за 30 дней, если посчитать нельзя — показывается —. Только для информации, не инвестиционный совет.",
      rank_basis: "Рейтинг: PnL за 30 дней (USDC)", ws_note: "Сделки приходят вживую, обычно с задержкой в пару секунд",
      stale: "Источник задерживается, обновлено {s} с назад", not_ready: "Источник данных ещё не готов", live: "В эфире", connecting: "Подключение", paused: "Пауза",
      backoff: "Лимит запросов, повтор через {s} с", error: "Сейчас нет данных, повторяем", updated: "Обновлено {s} с назад", updated_min: "Обновлено {m} мин назад", never: "Ещё не обновлялось",
      times_in: "Время: {z}", is_new: "Новое", pinned_pnl: "PnL 30д",
      pnl30: "PnL за 30 дней", roi30: "ROI за 30 дней", mdd30: "Макс. просадка (30д, оценка)", acct: "Стоимость счёта", vlm30: "Объём за 30 дней", pnl_all: "PnL за всё время",
      address: "Адрес", hl_link: "Открыть в Hyperliquid", scan_link: "Открыть в Hypurrscan",
      positions: "Открытые позиции", positions_summary: "Открытые позиции: {s}", positions_empty: "Нет открытых бессрочных позиций", loading: "Загрузка…",
      orders: "Последние сделки", orders_empty: "Недавних бессрочных сделок нет", history_show: "История ({n})", history_hide: "Скрыть",
      long: "Лонг", short: "Шорт", size: "Размер", entry: "Вход", upnl: "Нереализ. PnL", lev: "Плечо", liq: "Цена ликвидации", value: "Стоимость",
      open_long: "Открыть лонг", close_long: "Закрыть лонг", open_short: "Открыть шорт", close_short: "Закрыть шорт",
      flip_ls: "Лонг→Шорт", flip_sl: "Шорт→Лонг", liquidation: "Ликвидация", adl: "Автоделеверидж", other: "Сделка",
      perp: "бессрочный", side_long: "лонг", side_short: "шорт",
      sentence_open: "Открыта {side} позиция по {symbol} {perp} по цене {price}, количество {qty} {base}, общая стоимость {value}USDC.",
      sentence_close: "Закрыта {side} позиция по {symbol} {perp} по цене {price}, количество {qty} {base}, общая стоимость {value}USDC.",
      sentence_other: "{label}: сделка по {symbol} {perp} по цене {price}, количество {qty} {base}, общая стоимость {value}USDC.",
      sentence_pnl: "Реализованный PnL {pnl}USDC."
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
  function fmtNum(v, max = 2) {
    const n = num(v);
    return n == null ? "—" : n.toLocaleString(loc(), { maximumFractionDigits: max });
  }
  function fmtPrice(v) {
    const n = num(v);
    if (n == null) return "—";
    return app() ? app().formatPrice(n) : String(n);
  }
  function usdc(v, compact) {
    const n = num(v);
    if (n == null) return "—";
    return `${n.toLocaleString(loc(), compact ? { notation: "compact", maximumFractionDigits: 2 } : { maximumFractionDigits: Math.abs(n) >= 100 ? 0 : 2 })} USDC`;
  }
  function signed(v, compact) {
    const n = num(v);
    if (n == null) return "—";
    const s = Math.abs(n).toLocaleString(loc(), compact ? { notation: "compact", maximumFractionDigits: 2 } : { maximumFractionDigits: Math.abs(n) >= 100 ? 0 : 2 });
    return `${n > 0 ? "+" : n < 0 ? "−" : ""}${s} USDC`;
  }
  function pct(v, signedOut) {
    const n = num(v);
    if (n == null) return "—";
    const s = n.toLocaleString(loc(), { maximumFractionDigits: 2, minimumFractionDigits: 2 });
    return `${signedOut && n > 0 ? "+" : ""}${s}%`;
  }
  const pnlClass = (v) => {
    const n = num(v);
    return !n ? "" : n > 0 ? "pct-up" : "pct-down";
  };
  const tz = () => (app() ? app().viewerTimeZone() : undefined);
  function zoneText() {
    try { return (app() && app().zoneLabel(new Date(), "shortOffset")) || tz() || ""; } catch { return ""; }
  }
  function fmtStamp(ts) {
    const n = num(ts);
    if (!n) return "—";
    try {
      const parts = {};
      for (const p of new Intl.DateTimeFormat("en-US", {
        timeZone: tz(), year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
      }).formatToParts(new Date(n))) {
        if (p.type !== "literal") parts[p.type] = p.value;
      }
      return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
    } catch {
      return new Date(n).toISOString();
    }
  }
  function withSep(s) {
    const m = String(s).match(/^([+-]?)(\d+)(?:\.(\d+))?$/);
    if (!m) return String(s);
    return m[1] + m[2].replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (m[3] != null ? "." + m[3] : "");
  }
  const exact = (v) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : String(v).trim());
  const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");

  /* Hyperliquid dir -> action key + side */
  function actionOf(o) {
    const d = String(o.dir || "");
    if (/^Open Long/i.test(d)) return { a: "open_long", long: true, closing: false };
    if (/^Open Short/i.test(d)) return { a: "open_short", long: false, closing: false };
    if (/^Close Long/i.test(d)) return { a: "close_long", long: true, closing: true };
    if (/^Close Short/i.test(d)) return { a: "close_short", long: false, closing: true };
    if (/^Long\s*>\s*Short/i.test(d)) return { a: "flip_ls", long: false, closing: true, other: true };
    if (/^Short\s*>\s*Long/i.test(d)) return { a: "flip_sl", long: true, closing: true, other: true };
    if (/^Liquidated/i.test(d)) return { a: "liquidation", long: /Long/i.test(d), closing: true, other: true };
    if (/Auto-?Deleverag/i.test(d)) return { a: "adl", long: o.side === "A", closing: true, other: true };
    return { a: "other", long: o.side === "B", closing: false, other: true };
  }
  function sideClass(x) {
    if (x.a === "open_long") return "is-open-long";
    if (x.a === "close_long") return "is-close-long";
    if (x.a === "open_short") return "is-open-short";
    if (x.a === "close_short") return "is-close-short";
    return x.long ? "is-open-long" : "is-open-short";
  }
  function flashTone(x) { return x && x.long ? "up" : "down"; }
  function syncRowFlash(el, s, first, now) {
    const main = el && el.querySelector(".kol-row-main");
    if (!main) return;
    const k = first ? orderKey(first) : "";
    const isNew = !!(first && (s.newUntil.get(k) || 0) > now);
    if (isNew && s.flashedKey !== k) {
      s.flashedKey = k;
      main.classList.remove("is-new", "is-new-up", "is-new-down");
      void main.offsetWidth;
      const tone = flashTone(actionOf(first));
      main.classList.add("is-new");
      if (tone) main.classList.add(`is-new-${tone}`);
    } else if (!isNew) {
      main.classList.remove("is-new", "is-new-up", "is-new-down");
    }
  }
  const orderKey = (o) => [o.t, o.coin, o.dir, o.sz, o.px].join("|");
  const symHref = (c) => `${HL_APP}/trade/${encodeURIComponent(c)}`;
  function sentenceHtml(o) {
    const x = actionOf(o);
    const base = String(o.coin || "").replace(/^.*:/, "");
    const vars = {
      price: exact(o.px) != null ? withSep(o.px) : "—", symbol: "\u0001", perp: t("perp"), side: t(x.long ? "side_long" : "side_short"),
      qty: exact(o.sz) != null ? withSep(o.sz) : "—", base, value: exact(o.value) != null ? withSep(o.value) : "—", label: t(x.a)
    };
    let text = t(x.other ? "sentence_other" : x.closing ? "sentence_close" : "sentence_open", vars);
    if (x.closing && exact(o.pnl) != null) text += (/[。！？]$/.test(text) ? "" : " ") + t("sentence_pnl", { pnl: withSep(o.pnl) });
    return esc(text).replace("\u0001", `<a class="kol-sym" href="${esc(symHref(o.coin))}" target="_blank" rel="noopener noreferrer">${esc(o.coin)}</a>`);
  }

  const feed = { status: "connecting", fails: 0, lastTry: 0, lastOk: 0, backoffUntil: 0, inflight: false };
  const traders = new Map(); // addr -> {snap, checked, changed, seen:Set, newUntil:Map, sig}
  const expanded = new Set();
  const root = () => document.getElementById("trader-view");
  let built = false, active = false, timer = null, order = [];

  function ordered() {
    return [...traders.values()].filter((s) => s.snap && s.snap.rank).sort((a, b) => a.snap.rank - b.snap.rank);
  }
  function applyRecord(d, rec) {
    const addr = d.trader;
    let s = traders.get(addr);
    if (!s) { s = { addr, snap: null, seen: new Set(), newUntil: new Map(), sig: "", first: true }; traders.set(addr, s); }
    s.checked = d.checked_ms || 0;
    s.changed = d.changed_ms || 0;
    const snap = d.snap;
    if (!snap || !snap.rank) return;
    const now = Date.now();
    const orders = Array.isArray(snap.orders) ? snap.orders : [];
    for (const o of orders) {
      const k = orderKey(o);
      if (!s.seen.has(k)) {
        s.seen.add(k);
        if (!s.first && (o.t || 0) > now - 120000) {
          s.newUntil.set(k, now + NEW_MS);
          if (window.BTC007_VIZ) {
            const lat = root() && root().querySelector("[data-lattice=traders]");
            const dir = actionOf(o).long ? "up" : "down";
            if (lat) window.BTC007_VIZ.hitLattice(lat, s.addr, dir);
          }
        }
      }
    }
    s.first = false;
    s.snap = snap;
    const sg = JSON.stringify([snap.rank, snap.name, snap.lb, snap.mdd, snap.positions, orders]);
    s.dirty = sg !== s.sig;
    s.sig = sg;
  }

  async function poll() {
    feed.lastTry = Date.now();
    let res;
    try { res = await fetch(FEED_URL, { cache: "no-store" }); } catch { res = null; }
    if (res && res.status === 429) {
      feed.fails += 1; feed.status = "backoff"; feed.backoffUntil = Date.now() + 10000; renderStatus(); return;
    }
    let j = null;
    if (res && res.ok) { try { j = await res.json(); } catch { j = null; } }
    if (!j || !Array.isArray(j.records)) {
      feed.fails += 1; feed.status = "error";
      feed.backoffUntil = Date.now() + Math.min(MAX_BACKOFF_MS, POLL_MS * Math.pow(2, feed.fails - 1));
      renderStatus(); return;
    }
    feed.fails = 0; feed.status = "ok"; feed.lastOk = Date.now();
    const seen = new Set();
    for (const r of j.records) {
      const d = r && r.data;
      if (!d || typeof d.trader !== "string" || seen.has(d.trader)) continue;
      seen.add(d.trader);
      applyRecord(d, r);
    }
    for (const k of [...traders.keys()]) if (!seen.has(k)) traders.delete(k);
    renderList();
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

  function srcTimes() {
    let newest = 0, oldest = 0;
    for (const s of ordered()) {
      const c = s.checked || 0;
      if (c > newest) newest = c;
      if (!oldest || c < oldest) oldest = c;
    }
    return { newest, oldest };
  }
  function statusInfo() {
    if (!active || document.hidden) return { cls: "paused", text: t("paused") };
    if (feed.status === "backoff") return { cls: "backoff", text: t("backoff", { s: Math.max(1, Math.ceil((feed.backoffUntil - Date.now()) / 1000)) }) };
    if (feed.status === "error") return { cls: "error", text: t("error") };
    if (feed.status === "connecting") return { cls: "connecting", text: t("connecting") };
    const src = srcTimes();
    if (!src.newest) return { cls: "error", text: t("not_ready") };
    const age = Date.now() - src.oldest;
    if (age > STALE_MS) return { cls: "backoff", text: t("stale", { s: Math.round(age / 1000) }) };
    return { cls: "live", text: t("live") };
  }
  function renderStatus() {
    const box = root();
    if (!box || !built) return;
    const el = box.querySelector("[data-tr-status]");
    if (!el) return;
    const info = statusInfo();
    el.dataset.state = info.cls;
    el.querySelector(".kol-status-text").textContent = info.text;
    const { newest } = srcTimes();
    const sec = Math.max(0, Math.round((Date.now() - newest) / 1000));
    el.querySelector(".kol-status-ago").textContent = !newest ? t("never") : sec < 120 ? t("updated", { s: sec }) : t("updated_min", { m: Math.round(sec / 60) });
    const zone = box.querySelector("[data-tr-zone]");
    if (zone) zone.textContent = t("times_in", { z: zoneText() });
  }
  function renderAges() {
    const box = root();
    if (!box) return;
    const now = Date.now();
    box.querySelectorAll(".kol-row-main.is-new").forEach((main) => {
      const card = main.closest("[data-tr-card]");
      const addr = card && card.getAttribute("data-tr-card");
      const stt = addr && traders.get(addr);
      const first = stt && stt.snap && Array.isArray(stt.snap.orders) ? stt.snap.orders[0] : null;
      const until = first && stt.newUntil.get(orderKey(first));
      if (!until || until < now) main.classList.remove("is-new", "is-new-up", "is-new-down");
    });
  }

  function orderBlock(s, o, now) {
    const k = orderKey(o);
    const x = actionOf(o);
    const isNew = (s.newUntil.get(k) || 0) > now;
    return `<div class="kol-order-line" data-tr="${esc(s.addr)}" data-key="${esc(k)}">
      <div class="kol-latest-meta">
        <span class="kol-time">${esc(fmtStamp(o.t))}</span>
        <span class="kol-side ${sideClass(x)}">${esc(t(x.a))}</span>
        ${isNew ? `<span class="kol-new">${esc(t("is_new"))}</span>` : ""}
      </div>
      <p class="kol-sentence">${sentenceHtml(o)}</p>
    </div>`;
  }
  function headHtml(s) {
    const sn = s.snap;
    const nm = sn.name ? `${esc(sn.name)}` : `<span class="tr-addr">${esc(short(sn.addr))}</span>`;
    const pnl = sn.lb && sn.lb.pnl;
    return `<span class="kol-avatar" data-initial="${esc(sn.rank)}"><span class="kol-avatar-fallback" aria-hidden="true">${esc(sn.rank)}</span></span>
      <span class="kol-name"><span class="kol-name-text">${nm}${sn.name ? ` <span class="tr-addr">${esc(short(sn.addr))}</span>` : ""}</span><span class="kol-tag ${pnlClass(pnl)}">${esc(t("pinned_pnl"))} <span data-hero-pnl="${esc(s.addr)}">${esc(signed(pnl, true))}</span></span></span>`;
  }
  function posHtml(sn) {
    const rows = (sn.positions || []).filter((p) => num(p.szi));
    if (sn.positions == null) return { line: t("loading"), box: "" };
    if (!rows.length) return { line: t("positions_empty"), box: "" };
    const sum = rows.slice(0, 3).map((p) => `${p.coin} ${num(p.szi) > 0 ? t("long") : t("short")} ${fmtNum(Math.abs(num(p.szi)), 4)}`).join(" · ") + (rows.length > 3 ? ` +${rows.length - 3}` : "");
    const box = `<h3 class="kol-sub">${esc(t("positions"))}</h3><div class="kol-positions">${rows.map((p) => {
      const long = num(p.szi) > 0;
      return `<div class="kol-pos">
        <div class="kol-pos-sym"><b>${esc(p.coin)}</b> <span class="kol-side ${long ? "is-open-long" : "is-open-short"}">${esc(t(long ? "long" : "short"))}${num(p.lev) ? ` ${esc(fmtNum(p.lev, 0))}x` : ""}</span></div>
        <div><span class="k">${esc(t("size"))}</span><span class="v">${esc(fmtNum(Math.abs(num(p.szi)), 4))}</span></div>
        <div><span class="k">${esc(t("entry"))}</span><span class="v">${esc(fmtPrice(p.entryPx))}</span></div>
        <div><span class="k">${esc(t("value"))}</span><span class="v">${esc(usdc(p.value, true))}</span></div>
        <div><span class="k">${esc(t("upnl"))}</span><span class="v ${pnlClass(p.upnl)}">${esc(signed(p.upnl))}</span></div>
        <div><span class="k">${esc(t("liq"))}</span><span class="v">${esc(num(p.liqPx) ? fmtPrice(p.liqPx) : "—")}</span></div>
      </div>`;
    }).join("")}</div>`;
    return { line: sum, box };
  }
  function detailHtml(s) {
    const sn = s.snap, lb = sn.lb || {};
    const stat = (label, value) => `<div class="kol-stat"><span class="k">${esc(label)}</span><span class="v">${value}</span></div>`;
    const roi = num(lb.roi) != null ? num(lb.roi) * 100 : null;
    const addr = esc(sn.addr);
    const p = posHtml(sn);
    const orders = Array.isArray(sn.orders) ? sn.orders : [];
    const rest = orders.slice(1);
    const now = Date.now();
    return `<div class="kol-links">
        <a href="${HL_APP}/explorer/address/${addr}" target="_blank" rel="noopener noreferrer">${esc(t("hl_link"))} ↗</a>
        <a href="https://hypurrscan.io/address/${addr}" target="_blank" rel="noopener noreferrer">${esc(t("scan_link"))} ↗</a>
      </div>
      <p class="kol-bio" title="${addr}">${esc(t("address"))}: ${addr}</p>
      <div class="kol-stats">
        ${stat(t("pnl30"), `<span class="${pnlClass(lb.pnl)}">${esc(signed(lb.pnl))}</span>`)}
        ${stat(t("roi30"), `<span class="${pnlClass(roi)}">${esc(pct(roi, true))}</span>`)}
        ${stat(t("mdd30"), sn.mdd != null ? esc(pct(sn.mdd)) : "—")}
        ${stat(t("acct"), esc(usdc(lb.accountValue, true)))}
        ${stat(t("vlm30"), esc(usdc(lb.vlm, true)))}
        ${stat(t("pnl_all"), `<span class="${pnlClass(lb.allTimePnl)}">${esc(signed(lb.allTimePnl, true))}</span>`)}
      </div>
      <p class="kol-pos-line">${esc(t("positions_summary", { s: p.line }))}</p>
      ${p.box ? `<div>${p.box}</div>` : ""}
      ${rest.length ? `<details class="kol-history"><summary>${esc(t("history_show", { n: rest.length }))}</summary><div class="kol-history-list">${rest.map((o) => orderBlock(s, o, now)).join("")}</div></details>` : ""}`;
  }
  function latestHtml(s) {
    const orders = (s.snap && s.snap.orders) || [];
    if (!orders.length) return `<p class="kol-muted">${esc(t("orders_empty"))}</p>`;
    return orderBlock(s, orders[0], Date.now());
  }

  function renderList() {
    const box = root();
    if (!box || !built) return;
    const list = box.querySelector("[data-tr-list]");
    if (!list) return;
    const rows = ordered();
    const keys = rows.map((s) => s.addr).join(",");
    if (keys !== order.join(",")) {
      order = rows.map((s) => s.addr);
      list.innerHTML = rows.map((s) => `<article class="kol-row" data-tr-card="${esc(s.addr)}">
          <div class="kol-row-main" data-tr-expand="${esc(s.addr)}" role="button" tabindex="0" aria-expanded="false">
            <div class="kol-id-line" data-tr-head></div>
            <div data-kol-latest data-tr-latest></div>
          </div>
          <div class="kol-detail" data-tr-detail hidden></div>
        </article>`).join("");
      rows.forEach((s) => (s.dirty = true));
    }
    if (!rows.length) {
      list.innerHTML = `<p class="kol-muted">${esc(feed.status === "error" ? t("error") : t("loading"))}</p>`;
      return;
    }
    for (const s of rows) {
      const el = list.querySelector(`[data-tr-card="${CSS.escape(s.addr)}"]`);
      if (!el) continue;
      if (s.dirty || s.lang !== lang() || s.tz !== tz()) {
        el.querySelector("[data-tr-head]").innerHTML = headHtml(s);
        if (window.BTC007_VIZ) {
          const num = s.snap && s.snap.lb ? s.snap.lb.pnl : null;
          const hero = el.querySelector("[data-hero-pnl]");
          if (hero && num != null) window.BTC007_VIZ.playHero(hero, num, { key: "pnl:" + s.addr, format: (v) => signed(v, true), dirClass: true });
        }
        el.querySelector("[data-tr-latest]").innerHTML = latestHtml(s);
        const det = el.querySelector("[data-tr-detail]");
        const wasOpen = det.querySelector("details.kol-history[open]") != null;
        det.innerHTML = detailHtml(s);
        if (wasOpen) { const d = det.querySelector("details.kol-history"); if (d) d.open = true; }
        const orders = (s.snap && s.snap.orders) || [];
        syncRowFlash(el, s, orders[0], Date.now());
        s.dirty = false; s.lang = lang(); s.tz = tz();
      }
      syncExpand(s.addr);
    }
    const lat = box.querySelector("[data-lattice=traders]");
    if (lat && window.BTC007_VIZ) window.BTC007_VIZ.ensureLattice(lat, rows.map((s) => s.addr), true);
  }
  function syncExpand(addr) {
    const box = root();
    const el = box && box.querySelector(`[data-tr-card="${CSS.escape(addr)}"]`);
    if (!el) return;
    const open = expanded.has(addr);
    el.classList.toggle("is-expanded", open);
    const det = el.querySelector("[data-tr-detail]");
    if (det) det.hidden = !open;
    const btn = el.querySelector("[data-tr-expand]");
    if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function build() {
    const box = root();
    if (!box) return;
    built = true;
    order = [];
    box.innerHTML = `
      <div class="kol-head">
        <h2 class="kol-title">${esc(t("title"))}</h2>
        <span class="kol-status" data-tr-status data-state="connecting">
          <span class="kol-dot" aria-hidden="true"></span>
          <span class="kol-status-text"></span>
          <span class="kol-status-ago"></span>
        </span>
      </div>
      <p class="kol-zone" data-tr-zone></p>
      <p class="kol-cadence-note">${esc(t("rank_basis"))} · ${esc(t("ws_note"))}</p>
      <p class="fx-note">${esc((window.BTC007_APP && window.BTC007_APP.t && window.BTC007_APP.t("lattice_orders")) || "")}</p>
      <div class="fx-lattice is-compact" data-lattice="traders"></div>
      <div class="kol-list" data-tr-list></div>
      <p class="kol-note">${esc(t("note"))}</p>`;
    for (const s of traders.values()) s.dirty = true;
    renderList();
    renderStatus();
    const lat = box.querySelector("[data-lattice=traders]");
    if (lat && window.BTC007_VIZ) {
      window.BTC007_VIZ.ensureLattice(lat, ordered().map((s) => s.addr), true);
      window.BTC007_VIZ.primeLattice(lat);
    }
  }
  function onClick(e) {
    if (e.target.closest("a") || e.target.closest("details")) return;
    const b = e.target.closest("[data-tr-expand]");
    if (!b) return;
    const k = b.getAttribute("data-tr-expand");
    if (expanded.has(k)) expanded.delete(k); else expanded.add(k);
    syncExpand(k);
  }
  function onKey(e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    const b = e.target.closest("[data-tr-expand]");
    if (!b) return;
    e.preventDefault();
    onClick(e);
  }
  function setActive(on) {
    on = !!on;
    if (on && !built) {
      build();
      const box = root();
      if (box) { box.addEventListener("click", onClick); box.addEventListener("keydown", onKey); }
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
    if (!document.hidden && active) tick(); else renderStatus();
  });
  window.BTC007_TRADERS = { setActive, rerender() { if (built) build(); } };
})();
