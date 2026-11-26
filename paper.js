/* BTC-007 News — Papertrade top-10 traders by 24h PnL (paper-leaderboard channel).
   Papertrade (exchange.papertrade.xyz) is a real-money, on-chain perpetual exchange on HyperEVM mainnet
   (USDC collateral, every trade has a HyperEVM txHash) — NOT a simulated paper-trading game. A poller on
   our box follows its public no-login "Accounts" leaderboard, trades and live-position streams and
   writes one snapshot per trader into this site's Site Data collection `paper_feed`.
   The page reads it same-origin every 2s while visible. Reuses the kol-* row styles. */
(() => {
  "use strict";

  const FEED_URL = "./.herenow/data/paper_feed?limit=30";
  const POLL_MS = 2000;
  const STALE_MS = 120000;
  const MAX_BACKOFF_MS = 30000;
  const NEW_MS = 15000;
  const PT = "https://exchange.papertrade.xyz";
  const SCAN = "https://hyperevmscan.io";

  const STR = {
    zh: {
      title: "Paper 交易员盈利TOP10",
      note: "数据来自 Papertrade（exchange.papertrade.xyz）的公开接口，无需登录。Papertrade 是部署在 HyperEVM 主网上的真实资金永续合约交易所，以 USDC 为保证金，每笔成交都有链上交易哈希，并不是模拟盘，名字里的 Paper 只是品牌名。榜单沿用其「Accounts」排行榜，按近 24 小时盈利排序，只收录最近 7 天内活跃且有公开成交的地址，约每分钟刷新；成交通过其实时数据流接收，网页每 2 秒刷新，通常比链上成交晚几秒。仅供参考，不构成投资建议。",
      rank_basis: "排名依据：近 24 小时盈利（USDC）", ws_note: "真实资金 · HyperEVM 主网 · 非模拟盘",
      stale: "数据源延迟，上次更新在 {s} 秒前", not_ready: "数据源尚未就绪", live: "实时", connecting: "连接中", paused: "已暂停",
      backoff: "被限流，{s} 秒后重试", error: "暂时取不到数据，正在重试", updated: "{s} 秒前更新", updated_min: "{m} 分钟前更新", never: "尚未更新",
      times_in: "时间为 {z}", is_new: "新", pinned_pnl: "24小时盈利",
      pnl_win: "24小时盈利", realized: "已实现盈亏", upnl: "未实现盈亏", rewards: "奖励", balance: "余额", exposure: "持仓敞口", volume: "成交额", last_active: "最后活跃",
      deposited: "累计入金", withdrawn: "累计出金", fees: "累计手续费",
      address: "地址", pt_link: "在 Papertrade 查看", scan_link: "在 HyperEVMscan 查看", tx_link: "在链上查看这笔交易",
      positions: "当前持仓", positions_summary: "当前持仓：{s}", positions_empty: "当前无持仓", loading: "加载中…",
      orders_empty: "最近没有成交", history_show: "查看历史记录 ({n})", history_hide: "收起",
      long: "多", short: "空", size: "数量", entry: "开仓价", lev: "杠杆", liq: "强平价", value: "价值", margin: "保证金", opened: "开仓时间",
      open_long: "开多", close_long: "平多", open_short: "开空", close_short: "平空", liq_long: "多单被强平", liq_short: "空单被强平",
      perp: "永续", side_long: "做多", side_short: "做空",
      sentence_open: "以 {price} 的价格开启 {symbol} {perp} 的{side}仓位，数量为 {qty}{base}，总价值为 {value}USDC。",
      sentence_close: "以 {price} 的价格平仓 {symbol} {perp} 的{side}仓位，数量为 {qty}{base}，总价值为 {value}USDC。",
      sentence_liq: "{symbol} {perp} 的{side}仓位在 {price} 的价格被强制平仓，数量为 {qty}{base}，总价值为 {value}USDC。",
      sentence_pnl: "已实现盈亏为 {pnl}USDC（{roi}%）。"
    },
    en: {
      title: "Paper Top 10 Traders by PnL",
      note: "Data comes from Papertrade’s (exchange.papertrade.xyz) public no-login endpoints. Papertrade is a real-money perpetual exchange on HyperEVM mainnet with USDC margin, and every fill has an on-chain transaction hash. It is not a simulated or paper-trading game; “Paper” is just the brand name. The ranking mirrors its “Accounts” leaderboard by 24-hour PnL, keeping only addresses active in the last 7 days with public fills; it refreshes about every minute. Fills arrive over its live feed and this page refreshes every 2 seconds, so it usually lags by a few seconds. For information only, not investment advice.",
      rank_basis: "Ranked by 24-hour PnL (USDC)", ws_note: "Real money · HyperEVM mainnet · not simulated",
      stale: "Source delayed, last update {s}s ago", not_ready: "Data source not ready yet", live: "Live", connecting: "Connecting", paused: "Paused",
      backoff: "Rate limited, retrying in {s}s", error: "Can’t reach the data right now, retrying", updated: "Updated {s}s ago", updated_min: "Updated {m} min ago", never: "Not updated yet",
      times_in: "Times in {z}", is_new: "New", pinned_pnl: "24H PnL",
      pnl_win: "24H PnL", realized: "Realized PnL", upnl: "Unrealized PnL", rewards: "Rewards", balance: "Balance", exposure: "Open exposure", volume: "Volume", last_active: "Last active",
      deposited: "Total deposited", withdrawn: "Total withdrawn", fees: "Total fees",
      address: "Address", pt_link: "View on Papertrade", scan_link: "View on HyperEVMscan", tx_link: "View this trade on-chain",
      positions: "Open positions", positions_summary: "Open positions: {s}", positions_empty: "No open positions", loading: "Loading…",
      orders_empty: "No recent fills", history_show: "View history ({n})", history_hide: "Hide",
      long: "Long", short: "Short", size: "Size", entry: "Entry", lev: "Leverage", liq: "Liq. price", value: "Value", margin: "Margin", opened: "Opened",
      open_long: "Open long", close_long: "Close long", open_short: "Open short", close_short: "Close short", liq_long: "Long liquidated", liq_short: "Short liquidated",
      perp: "Perpetual", side_long: "long", side_short: "short",
      sentence_open: "Opened a {side} position on {symbol} {perp} at {price}, quantity {qty} {base}, total value {value}USDC.",
      sentence_close: "Closed a {side} position on {symbol} {perp} at {price}, quantity {qty} {base}, total value {value}USDC.",
      sentence_liq: "A {side} position on {symbol} {perp} was liquidated at {price}, quantity {qty} {base}, total value {value}USDC.",
      sentence_pnl: "Realized PnL {pnl}USDC ({roi}%)."
    },
    ko: {
      title: "Paper 수익 TOP10 트레이더",
      note: "데이터는 Papertrade(exchange.papertrade.xyz)의 공개 엔드포인트(로그인 불필요)에서 가져옵니다. Papertrade는 HyperEVM 메인넷의 실제 자금 무기한 선물 거래소로, USDC 증거금을 쓰며 모든 체결에 온체인 트랜잭션 해시가 있습니다. 모의투자가 아니며 Paper는 브랜드 이름일 뿐입니다. 순위는 “Accounts” 리더보드의 최근 24시간 수익 기준이고, 최근 7일 내 활동하고 공개 체결이 있는 주소만 포함하며 약 1분마다 갱신됩니다. 체결은 실시간 피드로 받고 페이지는 2초마다 새로고침되어 보통 몇 초 늦습니다. 참고용이며 투자 조언이 아닙니다.",
      rank_basis: "순위 기준: 최근 24시간 수익(USDC)", ws_note: "실제 자금 · HyperEVM 메인넷 · 모의 아님",
      stale: "데이터 소스 지연, 마지막 갱신 {s}초 전", not_ready: "데이터 소스 준비 중", live: "실시간", connecting: "연결 중", paused: "일시 중지",
      backoff: "요청 제한, {s}초 후 재시도", error: "지금은 데이터를 가져올 수 없어 재시도 중", updated: "{s}초 전 갱신", updated_min: "{m}분 전 갱신", never: "아직 갱신 없음",
      times_in: "시간대 {z}", is_new: "신규", pinned_pnl: "24시간 수익",
      pnl_win: "24시간 수익", realized: "실현 손익", upnl: "미실현 손익", rewards: "보상", balance: "잔고", exposure: "미결제 익스포저", volume: "거래량", last_active: "마지막 활동",
      deposited: "누적 입금", withdrawn: "누적 출금", fees: "누적 수수료",
      address: "주소", pt_link: "Papertrade에서 보기", scan_link: "HyperEVMscan에서 보기", tx_link: "온체인에서 이 거래 보기",
      positions: "현재 포지션", positions_summary: "현재 포지션: {s}", positions_empty: "포지션 없음", loading: "불러오는 중…",
      orders_empty: "최근 체결 없음", history_show: "거래 기록 보기 ({n})", history_hide: "접기",
      long: "롱", short: "숏", size: "수량", entry: "진입가", lev: "레버리지", liq: "청산가", value: "가치", margin: "증거금", opened: "진입 시각",
      open_long: "롱 진입", close_long: "롱 청산", open_short: "숏 진입", close_short: "숏 청산", liq_long: "롱 강제청산", liq_short: "숏 강제청산",
      perp: "무기한", side_long: "롱", side_short: "숏",
      sentence_open: "{price}의 가격으로 {symbol} {perp} {side} 포지션을 열었습니다. 수량은 {qty}{base}, 총 가치는 {value}USDC입니다.",
      sentence_close: "{price}의 가격으로 {symbol} {perp} {side} 포지션을 청산했습니다. 수량은 {qty}{base}, 총 가치는 {value}USDC입니다.",
      sentence_liq: "{symbol} {perp} {side} 포지션이 {price}에서 강제 청산되었습니다. 수량은 {qty}{base}, 총 가치는 {value}USDC입니다.",
      sentence_pnl: "실현 손익은 {pnl}USDC({roi}%)입니다."
    },
    tr: {
      title: "Paper PnL’ye Göre İlk 10 Trader",
      note: "Veriler Papertrade’in (exchange.papertrade.xyz) herkese açık, girişsiz uç noktalarından gelir. Papertrade, HyperEVM ana ağında USDC teminatlı gerçek para ile çalışan bir perpetual borsadır ve her işlemin zincir üzerinde işlem karması vardır. Simülasyon veya kağıt üstü işlem oyunu değildir; “Paper” yalnızca marka adıdır. Sıralama “Accounts” liderlik tablosunu izler: son 24 saat PnL’ye göre, son 7 günde aktif ve herkese açık işlemi olan adresler, yaklaşık dakikada bir yenilenir. İşlemler canlı akıştan alınır, sayfa 2 saniyede bir yenilenir; genelde birkaç saniye gecikir. Yalnızca bilgi amaçlıdır, yatırım tavsiyesi değildir.",
      rank_basis: "Sıralama: son 24 saat PnL (USDC)", ws_note: "Gerçek para · HyperEVM ana ağı · simülasyon değil",
      stale: "Kaynak gecikti, son güncelleme {s} sn önce", not_ready: "Veri kaynağı henüz hazır değil", live: "Canlı", connecting: "Bağlanıyor", paused: "Duraklatıldı",
      backoff: "Sınır aşıldı, {s} sn sonra tekrar", error: "Veriye şu an ulaşılamıyor, yeniden deneniyor", updated: "{s} sn önce güncellendi", updated_min: "{m} dk önce güncellendi", never: "Henüz güncellenmedi",
      times_in: "Saatler {z}", is_new: "Yeni", pinned_pnl: "24s PnL",
      pnl_win: "24 saatlik PnL", realized: "Gerçekleşen K/Z", upnl: "Gerçekleşmemiş K/Z", rewards: "Ödüller", balance: "Bakiye", exposure: "Açık pozisyon büyüklüğü", volume: "Hacim", last_active: "Son aktivite",
      deposited: "Toplam yatırılan", withdrawn: "Toplam çekilen", fees: "Toplam komisyon",
      address: "Adres", pt_link: "Papertrade’de gör", scan_link: "HyperEVMscan’de gör", tx_link: "Bu işlemi zincirde gör",
      positions: "Açık pozisyonlar", positions_summary: "Açık pozisyonlar: {s}", positions_empty: "Açık pozisyon yok", loading: "Yükleniyor…",
      orders_empty: "Son işlem yok", history_show: "Geçmişi gör ({n})", history_hide: "Gizle",
      long: "Long", short: "Short", size: "Miktar", entry: "Giriş", lev: "Kaldıraç", liq: "Likidasyon fiyatı", value: "Değer", margin: "Teminat", opened: "Açılış",
      open_long: "Long aç", close_long: "Long kapat", open_short: "Short aç", close_short: "Short kapat", liq_long: "Long likide edildi", liq_short: "Short likide edildi",
      perp: "Perpetual", side_long: "long", side_short: "short",
      sentence_open: "{symbol} {perp} {side} pozisyonu {price} fiyatından açıldı, miktar {qty} {base}, toplam değer {value}USDC.",
      sentence_close: "{symbol} {perp} {side} pozisyonu {price} fiyatından kapatıldı, miktar {qty} {base}, toplam değer {value}USDC.",
      sentence_liq: "{symbol} {perp} {side} pozisyonu {price} fiyatından likide edildi, miktar {qty} {base}, toplam değer {value}USDC.",
      sentence_pnl: "Gerçekleşen K/Z {pnl}USDC (%{roi})."
    },
    ru: {
      title: "Paper: топ-10 трейдеров по прибыли",
      note: "Данные берутся из открытых эндпоинтов Papertrade (exchange.papertrade.xyz) без входа в аккаунт. Papertrade — биржа бессрочных контрактов на реальные деньги в основной сети HyperEVM с маржой в USDC; у каждой сделки есть хеш транзакции в блокчейне. Это не симулятор и не игра на виртуальные деньги, «Paper» — просто название бренда. Рейтинг повторяет таблицу «Accounts» по прибыли за 24 часа, только адреса, активные последние 7 дней и с открытыми сделками; обновляется примерно раз в минуту. Сделки приходят по живому потоку, страница обновляется каждые 2 секунды, обычно с задержкой в несколько секунд. Только для информации, не инвестиционный совет.",
      rank_basis: "Рейтинг: PnL за 24 часа (USDC)", ws_note: "Реальные деньги · HyperEVM mainnet · не симуляция",
      stale: "Источник задерживается, обновлено {s} с назад", not_ready: "Источник данных ещё не готов", live: "В эфире", connecting: "Подключение", paused: "Пауза",
      backoff: "Лимит запросов, повтор через {s} с", error: "Сейчас нет данных, повторяем", updated: "Обновлено {s} с назад", updated_min: "Обновлено {m} мин назад", never: "Ещё не обновлялось",
      times_in: "Время: {z}", is_new: "Новое", pinned_pnl: "PnL 24ч",
      pnl_win: "PnL за 24 часа", realized: "Реализованный PnL", upnl: "Нереализ. PnL", rewards: "Награды", balance: "Баланс", exposure: "Открытая экспозиция", volume: "Объём", last_active: "Последняя активность",
      deposited: "Всего внесено", withdrawn: "Всего выведено", fees: "Всего комиссий",
      address: "Адрес", pt_link: "Открыть в Papertrade", scan_link: "Открыть в HyperEVMscan", tx_link: "Посмотреть сделку в блокчейне",
      positions: "Открытые позиции", positions_summary: "Открытые позиции: {s}", positions_empty: "Нет открытых позиций", loading: "Загрузка…",
      orders_empty: "Недавних сделок нет", history_show: "История ({n})", history_hide: "Скрыть",
      long: "Лонг", short: "Шорт", size: "Размер", entry: "Вход", lev: "Плечо", liq: "Цена ликвидации", value: "Стоимость", margin: "Маржа", opened: "Открыта",
      open_long: "Открыть лонг", close_long: "Закрыть лонг", open_short: "Открыть шорт", close_short: "Закрыть шорт", liq_long: "Лонг ликвидирован", liq_short: "Шорт ликвидирован",
      perp: "бессрочный", side_long: "лонг", side_short: "шорт",
      sentence_open: "Открыта {side} позиция по {symbol} {perp} по цене {price}, количество {qty} {base}, общая стоимость {value}USDC.",
      sentence_close: "Закрыта {side} позиция по {symbol} {perp} по цене {price}, количество {qty} {base}, общая стоимость {value}USDC.",
      sentence_liq: "{side} позиция по {symbol} {perp} ликвидирована по цене {price}, количество {qty} {base}, общая стоимость {value}USDC.",
      sentence_pnl: "Реализованный PnL {pnl}USDC ({roi}%)."
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

  /* Papertrade events: kind open | close | liq, side from `long`. */
  function actionOf(o) {
    const long = !!o.long;
    if (o.kind === "liq") return { a: long ? "liq_long" : "liq_short", long, closing: true, liq: true };
    if (o.kind === "close") return { a: long ? "close_long" : "close_short", long, closing: true };
    return { a: long ? "open_long" : "open_short", long, closing: false };
  }
  function sideClass(x) {
    if (x.a === "open_long") return "is-open-long";
    if (x.a === "close_long") return "is-close-long";
    if (x.a === "open_short") return "is-open-short";
    if (x.a === "close_short") return "is-close-short";
    return x.long ? "is-close-long" : "is-close-short";
  }
  const orderKey = (o) => [o.pid, o.kind, o.t].join("|");
  const txHref = (h) => `${SCAN}/tx/${encodeURIComponent(h)}`;
  function sentenceHtml(o) {
    const x = actionOf(o);
    const vars = {
      price: exact(o.px) != null ? withSep(o.px) : "—", symbol: "\u0001", perp: t("perp"), side: t(x.long ? "side_long" : "side_short"),
      qty: exact(o.sz) != null ? withSep(o.sz) : "—", base: o.symbol || "", value: exact(o.value) != null ? withSep(o.value) : "—"
    };
    let text = t(x.liq ? "sentence_liq" : x.closing ? "sentence_close" : "sentence_open", vars);
    if (x.closing && exact(o.pnl) != null) text += (/[。！？]$/.test(text) ? "" : " ") + t("sentence_pnl", { pnl: withSep(o.pnl), roi: o.roi != null ? withSep(o.roi) : "—" });
    const sym = esc(o.symbol || "—");
    const link = o.tx ? `<a class="kol-sym" href="${esc(txHref(o.tx))}" target="_blank" rel="noopener noreferrer" title="${esc(t("tx_link"))}">${sym}</a>` : sym;
    return esc(text).replace("\u0001", link);
  }

  const feed = { status: "connecting", fails: 0, lastTry: 0, lastOk: 0, backoffUntil: 0, inflight: false };
  const traders = new Map(); // addr -> {snap, checked, changed, seen:Set, newUntil:Map, sig}
  const expanded = new Set();
  const root = () => document.getElementById("paper-view");
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
        if (!s.first && (o.t || 0) > now - 120000) s.newUntil.set(k, now + NEW_MS);
      }
    }
    s.first = false;
    s.snap = snap;
    const sg = JSON.stringify([snap.rank, snap.name, snap.acct, snap.life, snap.positions, orders]);
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
    box.querySelectorAll(".kol-order-line.is-new").forEach((row) => {
      const s = traders.get(row.getAttribute("data-tr"));
      const until = s && s.newUntil.get(row.getAttribute("data-key"));
      if (!until || until < now) row.classList.remove("is-new");
    });
  }


  function orderBlock(s, o, now) {
    const k = orderKey(o);
    const x = actionOf(o);
    const isNew = (s.newUntil.get(k) || 0) > now;
    return `<div class="kol-order-line${isNew ? " is-new" : ""}" data-tr="${esc(s.addr)}" data-key="${esc(k)}">
      <div class="kol-latest-meta">
        <span class="kol-time">${esc(fmtStamp(o.t))}</span>
        <span class="kol-side ${sideClass(x)}">${esc(t(x.a))}</span>
        <span class="kol-tag">${esc(o.lev)}×</span>
        ${isNew ? `<span class="kol-new">${esc(t("is_new"))}</span>` : ""}
      </div>
      <p class="kol-sentence">${sentenceHtml(o)}</p>
    </div>`;
  }
  function headHtml(s) {
    const sn = s.snap;
    const label = sn.name || (sn.x ? `@${sn.x}` : null);
    const nm = label ? `${esc(label)}` : `<span class="tr-addr">${esc(short(sn.addr))}</span>`;
    const pnl = sn.acct && sn.acct.pnlWindow;
    return `<span class="kol-avatar" data-initial="${esc(sn.rank)}"><span class="kol-avatar-fallback" aria-hidden="true">${esc(sn.rank)}</span></span>
      <span class="kol-name"><span class="kol-name-text">${nm}${label ? ` <span class="tr-addr">${esc(short(sn.addr))}</span>` : ""}</span><span class="kol-tag ${pnlClass(pnl)}">${esc(t("pinned_pnl"))} ${esc(signed(pnl, true))}</span></span>`;
  }
  function posHtml(sn) {
    const rows = sn.positions;
    if (rows == null) return { line: t("loading"), box: "" };
    if (!rows.length) return { line: t("positions_empty"), box: "" };
    const sum = rows.slice(0, 3).map((p) => `${p.symbol} ${p.long ? t("long") : t("short")} ${p.lev}×`).join(" · ") + (rows.length > 3 ? ` +${rows.length - 3}` : "");
    const box = `<h3 class="kol-sub">${esc(t("positions"))}</h3><div class="kol-positions">${rows.slice(0, 12).map((p) => `<div class="kol-pos">
        <div class="kol-pos-sym"><b>${esc(p.symbol)}</b> <span class="kol-side ${p.long ? "is-open-long" : "is-open-short"}">${esc(t(p.long ? "long" : "short"))} ${esc(p.lev)}×</span></div>
        <div><span class="k">${esc(t("size"))}</span><span class="v">${esc(fmtNum(p.sz, 4))}</span></div>
        <div><span class="k">${esc(t("entry"))}</span><span class="v">${esc(fmtPrice(p.entry))}</span></div>
        <div><span class="k">${esc(t("value"))}</span><span class="v">${esc(usdc(p.notional, true))}</span></div>
        <div><span class="k">${esc(t("margin"))}</span><span class="v">${esc(usdc(p.margin, true))}</span></div>
        <div><span class="k">${esc(t("liq"))}</span><span class="v">${esc(fmtPrice(p.liq))}</span></div>
      </div>`).join("")}</div>`;
    return { line: sum, box };
  }
  function lastActive(ts) {
    const n = num(ts);
    return n ? fmtStamp(n * 1000) : "—";
  }
  function detailHtml(s) {
    const sn = s.snap, a = sn.acct || {}, life = sn.life || {};
    const stat = (label, value) => `<div class="kol-stat"><span class="k">${esc(label)}</span><span class="v">${value}</span></div>`;
    const addr = esc(sn.addr);
    const p = posHtml(sn);
    const orders = Array.isArray(sn.orders) ? sn.orders : [];
    const rest = orders.slice(1);
    const now = Date.now();
    return `<div class="kol-links">
        <a href="${PT}/portfolio?view=${addr}" target="_blank" rel="noopener noreferrer">${esc(t("pt_link"))} ↗</a>
        <a href="${SCAN}/address/${addr}" target="_blank" rel="noopener noreferrer">${esc(t("scan_link"))} ↗</a>
        ${sn.x ? `<a href="https://x.com/${encodeURIComponent(sn.x)}" target="_blank" rel="noopener noreferrer">@${esc(sn.x)}</a>` : ""}
      </div>
      <p class="kol-bio" title="${addr}">${esc(t("address"))}: ${addr}</p>
      <div class="kol-stats">
        ${stat(t("pnl_win"), `<span class="${pnlClass(a.pnlWindow)}">${esc(signed(a.pnlWindow))}</span>`)}
        ${stat(t("realized"), `<span class="${pnlClass(a.realized)}">${esc(signed(a.realized))}</span>`)}
        ${stat(t("upnl"), `<span class="${pnlClass(a.upnl)}">${esc(signed(a.upnl))}</span>`)}
        ${stat(t("rewards"), esc(usdc(a.rewards)))}
        ${stat(t("balance"), esc(usdc(a.balance)))}
        ${stat(t("exposure"), esc(usdc(a.exposure)))}
        ${stat(t("volume"), esc(usdc(a.volume, true)))}
        ${stat(t("last_active"), esc(lastActive(a.lastActive)))}
        ${life.depositedRaw != null ? stat(t("deposited"), esc(usdc(life.depositedRaw, true))) : ""}
        ${life.withdrawnRaw != null ? stat(t("withdrawn"), esc(usdc(life.withdrawnRaw, true))) : ""}
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
        el.querySelector("[data-tr-latest]").innerHTML = latestHtml(s);
        const det = el.querySelector("[data-tr-detail]");
        const wasOpen = det.querySelector("details.kol-history[open]") != null;
        det.innerHTML = detailHtml(s);
        if (wasOpen) { const d = det.querySelector("details.kol-history"); if (d) d.open = true; }
        s.dirty = false; s.lang = lang(); s.tz = tz();
      }
      syncExpand(s.addr);
    }
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
      <div class="kol-list" data-tr-list></div>
      <p class="kol-note">${esc(t("note"))}</p>`;
    for (const s of traders.values()) s.dirty = true;
    renderList();
    renderStatus();
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
  window.BTC007_PAPER = { setActive, rerender() { if (built) build(); } };
})();
