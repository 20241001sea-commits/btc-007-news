/* BTC-007 News — KOL copy-trading monitor (kol-trading channel).
   Binance blocks proxy requests from here.now, so a poller on our own box reads the public
   Binance copy-trading endpoints (~every 2s) and writes one snapshot per KOL into this site's
   here.now Site Data collection `kol_feed`. The page reads it same-origin every 2s while visible.
   To add a trader: add it here and to KOLS in the poller (kol-trading-poller/poller.py).
   Traders with `pinned: true` (熬鹰资本) always render first, ahead of any later profit or
   drawdown sort, so new additions cannot displace them. */
(() => {
  "use strict";

  const KOL_LIST = [
    {
      key: "aoying",
      source: "binance",
      portfolioId: "5075281354358777856",
      name: "熬鹰资本",
      x: "thankUcrypto",
      url: "https://www.binance.com/en/copy-trading/lead-details/5075281354358777856",
      pinned: true
    },
    // After the pin, traders are listed by descending 90D lead PnL (research snapshot).
    { key: "yunzhi", source: "binance", portfolioId: "5323669014384329216", name: "云沚",
      url: "https://www.binance.com/en/copy-trading/lead-details/5323669014384329216" },
    { key: "bran-brandon", source: "binance", portfolioId: "5126298543040831233", name: "Bran Brandon",
      url: "https://www.binance.com/en/copy-trading/lead-details/5126298543040831233" },
    { key: "jason007", source: "binance", portfolioId: "5133452281665177088", name: "踢倒丹炉Jason007",
      url: "https://www.binance.com/en/copy-trading/lead-details/5133452281665177088" },
    { key: "xiaoxiao-tangying", source: "binance", portfolioId: "4286775714676474369", name: "小小的躺赢",
      url: "https://www.binance.com/en/copy-trading/lead-details/4286775714676474369" },
    { key: "shayu", source: "binance", portfolioId: "5191019069362573825", name: "鲨鱼先生",
      url: "https://www.binance.com/en/copy-trading/lead-details/5191019069362573825" },
    { key: "guitu-sairun", source: "binance", portfolioId: "4635972047552772865", name: "龟兔赛跑985-稳健型",
      url: "https://www.binance.com/en/copy-trading/lead-details/4635972047552772865" },
    { key: "nengzoudao", source: "binance", portfolioId: "5236689487243483392", name: "能走到对岸吗_",
      url: "https://www.binance.com/en/copy-trading/lead-details/5236689487243483392" },
    { key: "longgomi", source: "binance", portfolioId: "4954034225308534017", name: "龙够米",
      url: "https://www.binance.com/en/copy-trading/lead-details/4954034225308534017" },
    { key: "zhao-xiansen", source: "binance", portfolioId: "5327204477216755200", name: "zhao先森",
      url: "https://www.binance.com/en/copy-trading/lead-details/5327204477216755200" },
    { key: "ziyou-zhongzai", source: "binance", portfolioId: "5304286558448176640", name: "自由终在眼前",
      url: "https://www.binance.com/en/copy-trading/lead-details/5304286558448176640" }
  ];

  const FEED_URL = "./.herenow/data/kol_feed?limit=30";
  const POLL_MS = 2000;
  const STALE_MS = 120000;
  const RATE_BACKOFF_MS = 10000;
  const MAX_BACKOFF_MS = 30000;
  const MAX_ROWS = 60;
  const NEW_MS = 15000;

  const STR = {
    zh: {
      stale: "数据源延迟，上次成功读取币安在 {s} 秒前", not_ready: "数据源尚未就绪",
      title: "KOL 带单监控",
      note: "数据来自币安合约公开带单（Binance Copy Trading）的公开接口，由本站服务器读取。置顶交易员的订单大约每 4 秒更新一次，其他交易员大约每分钟一次，网页每 2 秒刷新。通常比实际下单晚若干秒。仅供参考，不构成投资建议。",
      live: "实时", connecting: "连接中", paused: "已暂停", backoff: "被限流，{s} 秒后重试", error: "暂时取不到数据，正在重试",
      updated: "{s} 秒前更新", updated_min: "{m} 分钟前更新", never: "尚未更新",
      aum: "管理规模", balance: "带单余额", copiers: "跟单人数", share: "分润比例", full: "已满员",
      binance_page: "币安带单页", positions: "当前持仓", positions_hidden: "交易员未公开当前持仓", positions_empty: "当前无持仓",
      orders: "最新订单", orders_empty: "暂无订单记录", loading: "加载中…", load_failed: "暂时无法加载，稍后自动重试",
      time: "时间", symbol: "合约", action: "方向", price: "成交均价", qty: "数量", notional: "名义价值", pnl: "已实现盈亏",
      open_long: "开多", close_long: "平多", open_short: "开空", close_short: "平空", buy: "买入", sell: "卖出",
      long: "多", short: "空", size: "仓位", entry: "开仓价", mark: "标记价", upnl: "未实现盈亏", lev: "杠杆",
      is_new: "新", times_in: "时间为 {z}", copy_status_paused: "已暂停带单",
      history_show: "查看历史记录 ({n})", history_hide: "收起",
      positions_summary: "当前持仓：{s}", positions_n: "{n} 笔", pinned: "置顶",
      pinned_cadence: "置顶交易员·约每 4 秒更新",
      others_cadence: "其他交易员大约每分钟更新一次",
      perp: "永续", side_long: "做多", side_short: "做空",
      sentence_open: "以 {price} 的价格开启 {symbol} {perp} 的{side}仓位，数量为 {qty}{base}，总价值为 {value}USDT。",
      sentence_close: "以 {price} 的价格平仓 {symbol} {perp} 的{side}仓位，数量为 {qty}{base}，总价值为 {value}USDT。",
      sentence_pnl: "已实现盈亏为 {pnl}USDT。",
      mdd: "最大回撤", roi: "收益率", lead_pnl: "盈亏", win_rate: "胜率",
      range_days: "{n}天", stat_ranged: "{label}（{range}）"
    },
    en: {
      stale: "Source delayed, last read from Binance {s}s ago", not_ready: "Data source not ready yet",
      title: "KOL trade monitor",
      note: "Data comes from Binance Futures public copy trading pages. Our server polls the pinned trader’s orders about every 4 seconds and the others about every minute; this page refreshes every 2 seconds, so it usually lags by several seconds. For information only, not investment advice.",
      live: "Live", connecting: "Connecting", paused: "Paused", backoff: "Rate limited, retrying in {s}s", error: "Can’t reach the data right now, retrying",
      updated: "Updated {s}s ago", updated_min: "Updated {m} min ago", never: "Not updated yet",
      aum: "AUM", balance: "Lead balance", copiers: "Copiers", share: "Profit share", full: "Full",
      binance_page: "Binance lead page", positions: "Open positions", positions_hidden: "The trader keeps open positions private", positions_empty: "No open positions",
      orders: "Latest orders", orders_empty: "No orders yet", loading: "Loading…", load_failed: "Couldn’t load right now, retrying automatically",
      time: "Time", symbol: "Contract", action: "Side", price: "Avg price", qty: "Qty", notional: "Notional", pnl: "Realized PnL",
      open_long: "Open long", close_long: "Close long", open_short: "Open short", close_short: "Close short", buy: "Buy", sell: "Sell",
      long: "Long", short: "Short", size: "Size", entry: "Entry", mark: "Mark", upnl: "Unrealized PnL", lev: "Leverage",
      is_new: "New", times_in: "Times in {z}", copy_status_paused: "Lead paused",
      history_show: "View history ({n})", history_hide: "Hide",
      positions_summary: "Open positions: {s}", positions_n: "{n}", pinned: "Pinned",
      pinned_cadence: "Pinned · updates every ~4s",
      others_cadence: "Other traders update about every minute",
      perp: "Perpetual", side_long: "long", side_short: "short",
      sentence_open: "Opened a {side} position on {symbol} {perp} at {price}, quantity {qty} {base}, total value {value}USDT.",
      sentence_close: "Closed a {side} position on {symbol} {perp} at {price}, quantity {qty} {base}, total value {value}USDT.",
      sentence_pnl: "Realized PnL {pnl}USDT.",
      mdd: "Max drawdown", roi: "ROI", lead_pnl: "PnL", win_rate: "Win rate",
      range_days: "{n}D", stat_ranged: "{label} ({range})"
    },
    ko: {
      stale: "데이터 소스 지연, 마지막 바이낸스 조회 {s}초 전", not_ready: "데이터 소스 준비 중",
      title: "KOL 거래 모니터",
      note: "데이터는 바이낸스 선물 공개 카피트레이딩 페이지에서 가져옵니다. 서버는 고정 트레이더의 주문을 약 4초마다, 다른 트레이더는 약 1분마다 읽고, 페이지는 2초마다 새로고침하므로 보통 실제 주문보다 수 초 늦습니다. 참고용이며 투자 조언이 아닙니다.",
      live: "실시간", connecting: "연결 중", paused: "일시 중지", backoff: "요청 제한, {s}초 후 재시도", error: "데이터를 가져올 수 없어 재시도 중",
      updated: "{s}초 전 업데이트", updated_min: "{m}분 전 업데이트", never: "아직 업데이트 없음",
      aum: "운용 규모", balance: "리드 잔고", copiers: "카피 인원", share: "수익 배분", full: "정원 마감",
      binance_page: "바이낸스 리드 페이지", positions: "현재 포지션", positions_hidden: "트레이더가 현재 포지션을 비공개로 설정했습니다", positions_empty: "현재 포지션 없음",
      orders: "최신 주문", orders_empty: "주문 기록 없음", loading: "불러오는 중…", load_failed: "지금은 불러올 수 없어 자동으로 재시도합니다",
      time: "시간", symbol: "계약", action: "방향", price: "평균가", qty: "수량", notional: "명목 가치", pnl: "실현 손익",
      open_long: "롱 진입", close_long: "롱 청산", open_short: "숏 진입", close_short: "숏 청산", buy: "매수", sell: "매도",
      long: "롱", short: "숏", size: "규모", entry: "진입가", mark: "마크가", upnl: "미실현 손익", lev: "레버리지",
      is_new: "신규", times_in: "시간대 {z}", copy_status_paused: "리드 일시 중지",
      history_show: "거래 기록 보기 ({n})", history_hide: "접기",
      positions_summary: "현재 포지션: {s}", positions_n: "{n}건", pinned: "고정",
      pinned_cadence: "고정 트레이더 · 약 4초마다 업데이트",
      others_cadence: "다른 트레이더는 약 1분마다 업데이트됩니다",
      perp: "무기한", side_long: "롱", side_short: "숏",
      sentence_open: "{price}의 가격으로 {symbol} {perp} {side} 포지션을 열었습니다. 수량은 {qty}{base}, 총 가치는 {value}USDT입니다.",
      sentence_close: "{price}의 가격으로 {symbol} {perp} {side} 포지션을 청산했습니다. 수량은 {qty}{base}, 총 가치는 {value}USDT입니다.",
      sentence_pnl: "실현 손익은 {pnl}USDT입니다.",
      mdd: "최대 낙폭", roi: "수익률", lead_pnl: "손익", win_rate: "승률",
      range_days: "{n}일", stat_ranged: "{label} ({range})"
    },
    tr: {
      stale: "Kaynak gecikmeli, Binance'ten son okuma {s} sn önce", not_ready: "Veri kaynağı henüz hazır değil",
      title: "KOL işlem takibi",
      note: "Veriler Binance Vadeli herkese açık kopya işlem sayfalarından gelir. Sunucumuz sabitlenen işlemcinin emirlerini yaklaşık 4 saniyede bir, diğerlerini yaklaşık her dakika okur; sayfa 2 saniyede bir yenilenir, bu yüzden genellikle birkaç saniye geride kalır. Yalnızca bilgi amaçlıdır, yatırım tavsiyesi değildir.",
      live: "Canlı", connecting: "Bağlanıyor", paused: "Duraklatıldı", backoff: "Hız sınırı, {s} sn sonra yeniden denenecek", error: "Veriye şu an ulaşılamıyor, yeniden deneniyor",
      updated: "{s} sn önce güncellendi", updated_min: "{m} dk önce güncellendi", never: "Henüz güncellenmedi",
      aum: "Yönetilen varlık", balance: "Lider bakiyesi", copiers: "Kopyalayanlar", share: "Kâr payı", full: "Dolu",
      binance_page: "Binance lider sayfası", positions: "Açık pozisyonlar", positions_hidden: "İşlemci açık pozisyonlarını gizli tutuyor", positions_empty: "Açık pozisyon yok",
      orders: "Son emirler", orders_empty: "Henüz emir yok", loading: "Yükleniyor…", load_failed: "Şu an yüklenemedi, otomatik yeniden denenecek",
      time: "Zaman", symbol: "Kontrat", action: "Yön", price: "Ort. fiyat", qty: "Miktar", notional: "Nominal", pnl: "Gerçekleşen K/Z",
      open_long: "Long aç", close_long: "Long kapat", open_short: "Short aç", close_short: "Short kapat", buy: "Al", sell: "Sat",
      long: "Long", short: "Short", size: "Büyüklük", entry: "Giriş", mark: "İşaret", upnl: "Gerçekleşmemiş K/Z", lev: "Kaldıraç",
      is_new: "Yeni", times_in: "Saatler {z}", copy_status_paused: "Liderlik duraklatıldı",
      history_show: "Geçmişi gör ({n})", history_hide: "Gizle",
      positions_summary: "Açık pozisyonlar: {s}", positions_n: "{n}", pinned: "Sabit",
      pinned_cadence: "Sabit · yaklaşık her 4 sn güncellenir",
      others_cadence: "Diğer işlemciler yaklaşık her dakika güncellenir",
      perp: "Perpetual", side_long: "long", side_short: "short",
      sentence_open: "{symbol} {perp} {side} pozisyonu {price} fiyatından açıldı, miktar {qty} {base}, toplam değer {value}USDT.",
      sentence_close: "{symbol} {perp} {side} pozisyonu {price} fiyatından kapatıldı, miktar {qty} {base}, toplam değer {value}USDT.",
      sentence_pnl: "Gerçekleşen K/Z {pnl}USDT.",
      mdd: "Maks. düşüş", roi: "ROI", lead_pnl: "K/Z", win_rate: "Kazanma oranı",
      range_days: "{n}g", stat_ranged: "{label} ({range})"
    },
    ru: {
      stale: "Источник задерживается, последнее чтение Binance {s} с назад", not_ready: "Источник данных ещё не готов",
      title: "Мониторинг сделок KOL",
      note: "Данные взяты с публичных страниц копи-трейдинга Binance Futures. Наш сервер обновляет ордера закреплённого трейдера примерно каждые 4 секунды, остальных — примерно раз в минуту; страница обновляется каждые 2 секунды, поэтому обычно отстаёт на несколько секунд. Только для информации, не инвестиционный совет.",
      live: "В эфире", connecting: "Подключение", paused: "Пауза", backoff: "Лимит запросов, повтор через {s} с", error: "Данные сейчас недоступны, повторяем",
      updated: "Обновлено {s} с назад", updated_min: "Обновлено {m} мин назад", never: "Ещё не обновлялось",
      aum: "Под управлением", balance: "Баланс лидера", copiers: "Копировщики", share: "Доля прибыли", full: "Мест нет",
      binance_page: "Страница на Binance", positions: "Открытые позиции", positions_hidden: "Трейдер скрывает открытые позиции", positions_empty: "Открытых позиций нет",
      orders: "Последние ордера", orders_empty: "Ордеров пока нет", loading: "Загрузка…", load_failed: "Сейчас не загрузилось, повторим автоматически",
      time: "Время", symbol: "Контракт", action: "Сторона", price: "Ср. цена", qty: "Кол-во", notional: "Номинал", pnl: "Реализ. PnL",
      open_long: "Открыть лонг", close_long: "Закрыть лонг", open_short: "Открыть шорт", close_short: "Закрыть шорт", buy: "Покупка", sell: "Продажа",
      long: "Лонг", short: "Шорт", size: "Размер", entry: "Вход", mark: "Маркировка", upnl: "Нереализ. PnL", lev: "Плечо",
      is_new: "Новое", times_in: "Время: {z}", copy_status_paused: "Ведение приостановлено",
      history_show: "История ({n})", history_hide: "Скрыть",
      positions_summary: "Открытые позиции: {s}", positions_n: "{n}", pinned: "Закреплён",
      pinned_cadence: "Закреплён · обновление ~каждые 4 с",
      others_cadence: "Остальные трейдеры обновляются примерно раз в минуту",
      perp: "бессрочный", side_long: "лонг", side_short: "шорт",
      sentence_open: "Открыта {side} позиция по {symbol} {perp} по цене {price}, количество {qty} {base}, общая стоимость {value}USDT.",
      sentence_close: "Закрыта {side} позиция по {symbol} {perp} по цене {price}, количество {qty} {base}, общая стоимость {value}USDT.",
      sentence_pnl: "Реализованный PnL {pnl}USDT.",
      mdd: "Макс. просадка", roi: "Доходность", lead_pnl: "PnL", win_rate: "Винрейт",
      range_days: "{n} дн.", stat_ranged: "{label} ({range})"
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
  const isLongAction = (a) => a === "open_long" || a === "close_long";
  const orderKey = (o) => [o.orderTime, o.symbol, o.side, o.positionSide, o.executedQty, o.avgPrice].join("|");

  /* Show API digits as given, only adding thousands separators. Do not round or pad. */
  function exactStr(v) {
    if (v == null || v === "") return null;
    if (typeof v === "string") {
      const s = v.trim();
      if (!s || !Number.isFinite(Number(s))) return null;
      return s;
    }
    if (typeof v === "number" && Number.isFinite(v)) {
      let s = String(v);
      if (/[eE]/.test(s)) s = v.toFixed(15).replace(/\.?0+$/, "");
      return s;
    }
    return null;
  }
  function withSep(s) {
    const m = String(s).match(/^([+-]?)(\d+)(?:\.(\d+))?$/);
    if (!m) return String(s);
    return m[1] + m[2].replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (m[3] != null ? "." + m[3] : "");
  }
  function mulExact(a, b) {
    const sa = exactStr(a), sb = exactStr(b);
    if (sa == null || sb == null) return null;
    const sign = (sa[0] === "-" ? -1 : 1) * (sb[0] === "-" ? -1 : 1);
    const na = sa.replace("-", ""), nb = sb.replace("-", "");
    const pa = (na.split(".")[1] || "").length, pb = (nb.split(".")[1] || "").length;
    const ia = BigInt(na.replace(".", "")), ib = BigInt(nb.replace(".", ""));
    let prod = (ia * ib).toString();
    const scale = pa + pb;
    if (scale > 0) {
      prod = prod.padStart(scale + 1, "0");
      prod = prod.slice(0, prod.length - scale) + "." + prod.slice(prod.length - scale);
      prod = prod.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
    }
    prod = prod.replace(/^0+(?=\d)/, "");
    return (sign < 0 ? "-" : "") + prod;
  }
  function baseOf(o) {
    if (typeof o.baseAsset === "string" && o.baseAsset.trim()) return o.baseAsset.trim();
    const sym = String(o.symbol || "");
    const m = sym.match(/^(.*)(USDT|USDC|BUSD|FDUSD|TUSD|USD)$/i);
    return m ? m[1] : "";
  }
  function fmtStamp(ts) {
    const n = num(ts);
    if (!n) return "—";
    try {
      const parts = {};
      for (const p of new Intl.DateTimeFormat("en-US", {
        timeZone: tz(), year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hourCycle: "h23"
      }).formatToParts(new Date(n))) {
        if (p.type !== "literal") parts[p.type] = p.value;
      }
      return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
    } catch {
      const d = new Date(n);
      const p = (x) => String(x).padStart(2, "0");
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
    }
  }
  function sideClass(a) {
    if (a === "open_long") return "is-open-long";
    if (a === "close_long") return "is-close-long";
    if (a === "open_short") return "is-open-short";
    if (a === "close_short") return "is-close-short";
    return String(a).startsWith("close") || a === "sell" ? "is-close-short" : "is-open-long";
  }
  function flashTone(a) {
    if (a === "open_short" || a === "close_short" || a === "sell") return "down";
    if (a === "open_long" || a === "close_long" || a === "buy") return "up";
    return "";
  }
  function newLineClass(isNew, a) {
    if (!isNew) return "";
    const tone = flashTone(a);
    return " is-new" + (tone ? ` is-new-${tone}` : "");
  }
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
  function symbolHref(sym) {
    return `https://www.binance.com/${lang() === "zh" ? "zh-CN" : "en"}/futures/${encodeURIComponent(sym)}`;
  }
  function symbolHtml(sym) {
    const s = String(sym || "").trim() || "—";
    return `<a class="kol-sym" href="${esc(symbolHref(s))}" target="_blank" rel="noopener noreferrer">${esc(s)}</a>`;
  }
  function sentenceHtml(o) {
    const a = actionOf(o);
    const price = exactStr(o.avgPrice);
    const qty = exactStr(o.executedQty);
    const value = price != null && qty != null ? mulExact(price, qty) : null;
    const base = baseOf(o);
    const long = isLongAction(a) || (a !== "open_short" && a !== "close_short" && a !== "sell" && String(o.positionSide || "").toUpperCase() !== "SHORT");
    const closing = isClose(a);
    const vars = {
      price: price != null ? withSep(price) : "—",
      symbol: "\u0001",
      perp: t("perp"),
      side: t(long ? "side_long" : "side_short"),
      qty: qty != null ? withSep(qty) : "—",
      base: base || "",
      value: value != null ? withSep(value) : "—"
    };
    let text = t(closing ? "sentence_close" : "sentence_open", vars);
    const pnl = exactStr(o.totalPnl);
    if (closing && pnl != null) text = text + (/[。！？]$/.test(text) ? "" : " ") + t("sentence_pnl", { pnl: withSep(pnl) });
    return esc(text).replace("\u0001", symbolHtml(o.symbol));
  }
  function orderBlock(s, o, now) {
    const k = orderKey(o);
    const a = actionOf(o);
    const isNew = (s.newUntil.get(k) || 0) > now;
    return `<div class="kol-order-line${newLineClass(isNew, a)}" data-kol="${esc(s.cfg.key)}" data-key="${esc(k)}">
      <div class="kol-latest-meta">
        <span class="kol-time">${esc(fmtStamp(o.orderTime))}</span>
        <span class="kol-side ${sideClass(a)}">${esc(t(a))}</span>
        ${isNew ? `<span class="kol-new">${esc(t("is_new"))}</span>` : ""}
      </div>
      <p class="kol-sentence">${sentenceHtml(o)}</p>
    </div>`;
  }

  /* Pinned traders always precede everyone else. Optional tieBreak (e.g. profit or
     max drawdown) only runs among unpinned traders, or among pinned ones. */
  function compareKols(a, b, tieBreak) {
    const pa = a && a.pinned ? 0 : 1;
    const pb = b && b.pinned ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return tieBreak ? tieBreak(a, b) : 0;
  }
  function visibleKols() {
    return KOL_LIST.slice().sort((a, b) => compareKols(a, b));
  }

  const kols = new Map(KOL_LIST.map((k) => [k.key, {
    cfg: k,
    orders: [],
    seen: new Set(),
    newUntil: new Map(),
    loaded: false,
    detail: null,
    positions: null,
    stats: null,
    srcOk: 0,
    srcErr: null,
    hasRecord: false
  }]));
  const feed = { status: "connecting", lastTry: 0, backoffUntil: 0, fails: 0, inflight: false, lastOk: 0 };
  const expanded = new Set();

  let active = false;
  let timer = null;
  let built = false;

  const root = () => document.getElementById("kol-view");
  const st = (key) => kols.get(key);

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
    const statsSig = JSON.stringify(snap.stats || null);
    const detailChanged = detailSig !== s._detailSig;
    const posChanged = posSig !== s._posSig || detailChanged;
    const statsChanged = statsSig !== s._statsSig;
    s._detailSig = detailSig;
    s._posSig = posSig;
    s._statsSig = statsSig;
    s.detail = snap.detail || null;
    s.positions = Array.isArray(snap.positions) ? snap.positions : null;
    s.stats = snap.stats && typeof snap.stats === "object" ? snap.stats : null;
    const key = s.cfg.key;
    if (detailChanged || statsChanged) { renderHead(key); renderDetail(key); }
    if (posChanged) renderPositions(key);
    if (ordersChanged) renderOrders(key);
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
      for (const k of kols.keys()) {
        if (!st(k).loaded) renderOrders(k);
      }
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

  function feedSrc() {
    let newest = 0;
    let oldest = 0;
    let anyRecord = false;
    let anyOk = false;
    for (const s of kols.values()) {
      if (s.hasRecord) anyRecord = true;
      if (s.srcOk) {
        anyOk = true;
        if (!newest || s.srcOk > newest) newest = s.srcOk;
        if (!oldest || s.srcOk < oldest) oldest = s.srcOk;
      }
    }
    return { newest, oldest, anyRecord, anyOk };
  }

  function statusInfo() {
    if (!active || document.hidden) return { cls: "paused", text: t("paused") };
    if (feed.status === "backoff") return { cls: "backoff", text: t("backoff", { s: Math.max(1, Math.ceil((feed.backoffUntil - Date.now()) / 1000)) }) };
    if (feed.status === "error") return { cls: "error", text: t("error") };
    if (feed.status === "connecting") return { cls: "connecting", text: t("connecting") };
    const src = feedSrc();
    if (!src.anyRecord || !src.anyOk) return { cls: "error", text: t("not_ready") };
    const age = Date.now() - src.oldest;
    if (age > STALE_MS) return { cls: "backoff", text: t("stale", { s: Math.round(age / 1000) }) };
    return { cls: "live", text: t("live") };
  }

  function agoText() {
    const src = feedSrc();
    if (!src.newest) return t("never");
    const sec = Math.max(0, Math.round((Date.now() - src.newest) / 1000));
    return sec < 120 ? t("updated", { s: sec }) : t("updated_min", { m: Math.round(sec / 60) });
  }

  function renderStatus() {
    const box = root();
    if (!box || !built) return;
    const el = box.querySelector("[data-kol-status]");
    if (!el) return;
    const info = statusInfo();
    el.dataset.state = info.cls;
    el.querySelector(".kol-status-text").textContent = info.text;
    el.querySelector(".kol-status-ago").textContent = agoText();
    const zone = box.querySelector("[data-kol-zone]");
    if (zone) zone.textContent = t("times_in", { z: zoneText() });
  }

  function renderAges() {
    const box = root();
    if (!box) return;
    const now = Date.now();
    box.querySelectorAll(".kol-order-line.is-new").forEach((row) => {
      const key = row.getAttribute("data-kol");
      const s = key && st(key);
      const until = s && s.newUntil.get(row.getAttribute("data-key"));
      if (!until || until < now) row.classList.remove("is-new", "is-new-up", "is-new-down");
    });
    box.querySelectorAll(".kol-row-main.is-new").forEach((main) => {
      const latest = main.querySelector("[data-kol-latest] .kol-order-line");
      if (!latest || !latest.classList.contains("is-new")) {
        main.classList.remove("is-new", "is-new-up", "is-new-down");
      }
    });
  }

  function bindAvatars(scope) {
    (scope || root() || document).querySelectorAll("img[data-kol-avatar]").forEach((img) => {
      if (img.dataset.bound === "1") return;
      img.dataset.bound = "1";
      const wrap = img.closest(".kol-avatar");
      if (!wrap) return;
      const ok = () => { wrap.classList.add("has-img"); };
      const fail = () => { wrap.classList.remove("has-img"); img.remove(); };
      if (img.complete) {
        if (img.naturalWidth) ok();
        else fail();
        return;
      }
      img.addEventListener("load", ok, { once: true });
      img.addEventListener("error", fail, { once: true });
    });
  }

  function cardEl(key) {
    const box = root();
    return box && box.querySelector(`[data-kol-card="${CSS.escape(key)}"]`);
  }

  function posRows(list) {
    return (list || []).filter((p) => {
      const amt = num(p.positionAmount != null ? p.positionAmount : p.positionAmt);
      return amt != null && amt !== 0;
    });
  }

  function posSummary(s) {
    if (s.positions == null && !s.detail) return t("loading");
    if (s.positions == null) return feed.status === "error" ? t("load_failed") : t("loading");
    const rows = posRows(s.positions);
    if (!rows.length) {
      const hidden = s.detail && s.detail.positionShow === false;
      return hidden ? t("positions_hidden") : t("positions_empty");
    }
    const bits = rows.slice(0, 3).map((p) => {
      const amt = num(p.positionAmount != null ? p.positionAmount : p.positionAmt);
      const ps = String(p.positionSide || "").toUpperCase();
      const long = ps === "LONG" || (ps !== "SHORT" && amt > 0);
      const lev = num(p.leverage);
      return `${p.symbol || "—"} ${t(long ? "long" : "short")}${lev ? ` ${fmtNum(lev, 0)}x` : ""}`;
    });
    const more = rows.length > 3 ? ` · ${t("positions_n", { n: rows.length })}` : (rows.length > 1 ? ` · ${t("positions_n", { n: rows.length })}` : "");
    return bits.join(" · ") + (rows.length > 3 ? more : "");
  }

  function orderRow() { /* replaced by orderBlock */ return ""; }

  function renderHead(key) {
    const el = cardEl(key);
    const head = el && el.querySelector("[data-kol-head]");
    if (!head) return;
    const s = st(key);
    const c = s.cfg;
    const d = s.detail || {};
    const avatar = typeof d.avatarUrl === "string" && /^https:\/\//.test(d.avatarUrl) ? d.avatarUrl : "";
    const initial = (d.nickname || c.name).trim().slice(0, 1) || "?";
    head.innerHTML = `
      <span class="kol-avatar" data-initial="${esc(initial)}">
        <span class="kol-avatar-fallback" aria-hidden="true">${esc(initial)}</span>
        ${avatar ? `<img src="${esc(avatar)}" alt="" width="28" height="28" loading="lazy" referrerpolicy="no-referrer" data-kol-avatar>` : ""}
      </span>
      <span class="kol-name"><span class="kol-name-text">${esc(d.nickname || c.name)}</span>${c.pinned ? `<span class="kol-tag kol-pin-tag">${esc(t("pinned_cadence"))}</span>` : ""}${d.isPaused ? `<span class="kol-tag">${esc(t("copy_status_paused"))}</span>` : ""}</span>`;
    bindAvatars(head);
  }

  function rangeSuffix(stats) {
    const r = stats && typeof stats.timeRange === "string" ? stats.timeRange.trim() : "";
    const m = r.match(/^(\d+)D$/i);
    return m ? t("range_days", { n: m[1] }) : "";
  }
  function rangedLabel(key, stats) {
    const suf = rangeSuffix(stats);
    return suf ? t("stat_ranged", { label: t(key), range: suf }) : t(key);
  }
  function exactPlain(v, suffix) {
    const x = exactStr(v);
    return x == null ? "—" : `${esc(withSep(x))}${suffix}`;
  }
  function exactSigned(v, suffix) {
    const x = exactStr(v);
    if (x == null) return "—";
    const cls = pnlClass(v);
    const body = `${esc(withSep(x))}${suffix}`;
    return cls ? `<span class="${cls}">${body}</span>` : body;
  }

  function renderDetail(key) {
    const el = cardEl(key);
    const box = el && el.querySelector("[data-kol-profile]");
    if (!box) return;
    const s = st(key);
    const c = s.cfg;
    const d = s.detail || {};
    const stt = s.stats || null;
    const cur = num(d.currentCopyCount);
    const max = num(d.maxCopyCount);
    const full = cur != null && max != null && max > 0 && cur >= max;
    const stat = (label, value, extra = "") => `<div class="kol-stat"><span class="k">${esc(label)}</span><span class="v">${value}${extra}</span></div>`;
    const bio = typeof d.description === "string" ? d.description.trim() : "";
    const perf = `
        ${stat(rangedLabel("mdd", stt), exactPlain(stt && stt.mdd, "%"))}
        ${stat(rangedLabel("roi", stt), exactSigned(stt && stt.roi, "%"))}
        ${stat(rangedLabel("lead_pnl", stt), exactSigned(stt && stt.pnl, " USDT"))}
        ${stat(rangedLabel("win_rate", stt), exactPlain(stt && stt.winRate, "%"))}`;
    box.innerHTML = `
      <div class="kol-links">
        <a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">${esc(t("binance_page"))} ↗</a>
        ${c.x ? `<a href="https://x.com/${encodeURIComponent(c.x)}" target="_blank" rel="noopener noreferrer">@${esc(c.x)}</a>` : ""}
      </div>
      ${bio ? `<p class="kol-bio" title="${esc(bio)}">${esc(bio)}</p>` : ""}
      ${s.detail ? `<div class="kol-stats">
        ${stat(t("aum"), esc(fmtUsdt(d.aumAmount, true)))}
        ${stat(t("balance"), esc(fmtUsdt(d.marginBalance, true)))}
        ${stat(t("copiers"), cur != null ? `${esc(fmtNum(cur, 0))}${max != null ? ` / ${esc(fmtNum(max, 0))}` : ""}` : "—", full ? ` <span class="kol-tag">${esc(t("full"))}</span>` : "")}
        ${stat(t("share"), num(d.profitSharingRate) != null ? `${esc(fmtNum(d.profitSharingRate, 2))}%` : "—")}
        ${perf}
      </div>` : `<p class="kol-muted">${esc(feed.status === "error" ? t("load_failed") : t("loading"))}</p>`}`;
  }

  function renderPositions(key) {
    const el = cardEl(key);
    if (!el) return;
    const s = st(key);
    const line = el.querySelector("[data-kol-pos-line]");
    if (line) line.innerHTML = `<p class="kol-pos-line">${esc(t("positions_summary", { s: posSummary(s) }))}</p>`;
    const box = el.querySelector("[data-kol-positions]");
    if (!box) return;
    const rows = s.positions == null ? [] : posRows(s.positions);
    if (!rows.length) {
      box.innerHTML = "";
      box.hidden = true;
      return;
    }
    box.hidden = false;
    box.innerHTML = `<h3 class="kol-sub">${esc(t("positions"))}</h3><div class="kol-positions">${rows.map((p) => {
      const amt = num(p.positionAmount != null ? p.positionAmount : p.positionAmt);
      const ps = String(p.positionSide || "").toUpperCase();
      const long = ps === "LONG" || (ps !== "SHORT" && amt > 0);
      const upnl = p.unrealizedProfit != null ? p.unrealizedProfit : p.unRealizedProfit;
      const lev = num(p.leverage);
      return `<div class="kol-pos">
        <div class="kol-pos-sym"><b>${esc(p.symbol || "—")}</b> <span class="kol-side ${long ? "is-open-long" : "is-open-short"}">${esc(t(long ? "long" : "short"))}${lev ? ` ${esc(fmtNum(lev, 0))}x` : ""}</span></div>
        <div><span class="k">${esc(t("size"))}</span><span class="v">${esc(fmtNum(Math.abs(amt)))}</span></div>
        <div><span class="k">${esc(t("entry"))}</span><span class="v">${esc(fmtPrice(p.entryPrice))}</span></div>
        <div><span class="k">${esc(t("mark"))}</span><span class="v">${esc(fmtPrice(p.markPrice))}</span></div>
        <div><span class="k">${esc(t("upnl"))}</span><span class="v ${pnlClass(upnl)}">${esc(fmtPnl(upnl))}</span></div>
      </div>`;
    }).join("")}</div>`;
  }

  function syncExpand(key) {
    const el = cardEl(key);
    if (!el) return;
    const open = expanded.has(key);
    el.classList.toggle("is-expanded", open);
    const detail = el.querySelector("[data-kol-detail]");
    if (detail) detail.hidden = !open;
    const btn = el.querySelector("[data-kol-expand]");
    if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function renderOrders(key) {
    const el = cardEl(key);
    if (!el) return;
    const s = st(key);
    const latest = el.querySelector("[data-kol-latest]");
    const histOrders = el.querySelector("[data-kol-hist-orders]");
    if (!latest || !histOrders) return;
    if (!s.loaded) {
      latest.innerHTML = `<p class="kol-muted">${esc(feed.status === "error" ? t("load_failed") : (feed.status === "ok" ? t("not_ready") : t("loading")))}</p>`;
      histOrders.innerHTML = "";
      syncExpand(key);
      return;
    }
    if (!s.orders.length) {
      latest.innerHTML = `<p class="kol-muted">${esc(t("orders_empty"))}</p>`;
      histOrders.innerHTML = "";
      syncExpand(key);
      return;
    }
    const now = Date.now();
    const first = s.orders[0];
    const rest = s.orders.slice(1);
    latest.innerHTML = orderBlock(s, first, now);
    histOrders.innerHTML = rest.length
      ? `<h3 class="kol-sub">${esc(t("orders"))}</h3><div class="kol-history-list">${rest.map((o) => orderBlock(s, o, now)).join("")}</div>`
      : "";
    syncRowFlash(el, s, first, now);
    syncExpand(key);
  }

  function renderKol(key) {
    renderHead(key);
    renderDetail(key);
    renderPositions(key);
    renderOrders(key);
  }

  function build() {
    const box = root();
    if (!box) return;
    built = true;
    box.innerHTML = `
      <div class="kol-head">
        <h2 class="kol-title">${esc(t("title"))}</h2>
        <span class="kol-status" data-kol-status data-state="connecting">
          <span class="kol-dot" aria-hidden="true"></span>
          <span class="kol-status-text"></span>
          <span class="kol-status-ago"></span>
        </span>
      </div>
      <p class="kol-zone" data-kol-zone></p>
      <p class="kol-cadence-note">${esc(t("others_cadence"))}</p>
      <div class="kol-list" data-kol-grid>
        ${visibleKols().map((c) => `<article class="kol-row${c.pinned ? " is-pinned" : ""}" data-kol-card="${esc(c.key)}">
          <div class="kol-row-main" data-kol-expand="${esc(c.key)}" role="button" tabindex="0" aria-expanded="false" aria-controls="kol-detail-${esc(c.key)}">
            <div class="kol-id-line" data-kol-head></div>
            <div data-kol-latest></div>
          </div>
          <div class="kol-detail" id="kol-detail-${esc(c.key)}" data-kol-detail hidden>
            <div data-kol-profile></div>
            <div data-kol-pos-line></div>
            <div data-kol-positions hidden></div>
            <div data-kol-hist-orders></div>
          </div>
        </article>`).join("")}
      </div>
      <p class="kol-note">${esc(t("note"))}</p>`;
    for (const c of visibleKols()) renderKol(c.key);
    renderStatus();
  }

  function onClick(e) {
    if (e.target.closest("a")) return;
    const b = e.target.closest("[data-kol-expand]");
    if (!b) return;
    const k = b.getAttribute("data-kol-expand");
    if (!kols.has(k)) return;
    if (expanded.has(k)) expanded.delete(k);
    else expanded.add(k);
    syncExpand(k);
  }

  function onKey(e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    const b = e.target.closest("[data-kol-expand]");
    if (!b) return;
    e.preventDefault();
    onClick(e);
  }

  function setActive(on) {
    on = !!on;
    if (on && !built) {
      build();
      const box = root();
      if (box) {
        box.addEventListener("click", onClick);
        box.addEventListener("keydown", onKey);
      }
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
    compareKols,
    visibleKols,
    setActive,
    rerender() { if (built) build(); }
  };
})();
