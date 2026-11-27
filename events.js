/* BTC-007 News — Event Intelligence channel.
   Own channel, not a third-party product. Night-earth map uses a self-hosted
   NASA Black Marble 2016 raster (attribution on the map). Event points come
   from a Site Data collection written by the box poller — never invented. */
(() => {
  "use strict";

  const CHANNEL = "event-intelligence";
  const FEED_URL = "./.herenow/data/event_feed?limit=8";
  const MARKET_API = "https://eqn.news/api/v1/market";
  const BASEMAP_URL = "./assets/earth-night/black-marble-2016.jpg";
  const POLL_MS = 30000;
  const MARKET_MS = 15000;
  const LS_FILTER = "bitxsea-ei-filter";
  const TAPE = ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "AVAX", "LINK", "SUI"];
  const LEAFLET_JS = "./assets/vendor/leaflet.js";
  const LEAFLET_CSS = "./assets/vendor/leaflet.css";

  const CAT_COLOR = {
    seismic: [122, 208, 255],
    conflict: [255, 107, 107],
    sanction: [240, 193, 75],
    economy: [70, 240, 176],
    threat: [255, 155, 110],
    other: [122, 240, 224]
  };

  const STR = {
    zh: {
      title: "事件情报",
      lead: "有坐标的公开事件，不是本站快讯的地图化。默认只看与市场更相关的事件，可切换为全部合格记录。",
      filter_market: "市场相关事件",
      filter_all: "全部合格事件",
      filter_hint_market: "默认：经济、制裁、冲突与风险类新闻事件，以及显著或 6 级以上地震。",
      filter_hint_all: "全部通过质量筛选、且已有坐标的公开记录（含 4.5 级以上地震）。坐标来自数据源，本站不补点。",
      live_events: "实时事件",
      brief: "局势摘要",
      brief_empty: "当前筛选下暂无足够来源的条目可作摘要。",
      markets: "市场",
      markets_empty: "行情暂时无法加载。",
      loading: "加载中…",
      not_ready: "数据源尚未就绪，稍后自动重试。",
      error: "暂时取不到事件数据，正在重试。",
      stale: "数据源延迟，上次更新在 {s} 之前。",
      updated: "{s}更新",
      empty_list: "当前筛选下没有可显示的事件。",
      cluster: "附近有 {n} 起事件",
      legend: "图例",
      source: "来源",
      place: "地点",
      time: "时间",
      category: "类别",
      open_source: "打开来源",
      no_url: "无来源链接",
      attr: "地图底图：NASA Earth Observatory — Black Marble 2016。地震：美国地质调查局（USGS）。新闻事件：GDELT Project（如有）。坐标均来自上述来源，未人工补全。",
      cat_seismic: "地震",
      cat_conflict: "冲突",
      cat_sanction: "制裁",
      cat_economy: "经济",
      cat_threat: "威胁",
      cat_other: "其他",
      connecting: "连接中",
      live: "已连接",
      detail: "事件详情",
      briefly: "基于当前列表的来源条目，非编辑部撰写。",
      close: "关闭",
      mag: "震级 {n}"
    },
    en: {
      title: "Event Intelligence",
      lead: "Public, already-geocoded events — not a map of this site’s headlines. The default view is market-relevant; you can switch to all qualifying records.",
      filter_market: "Market-relevant events",
      filter_all: "All qualifying events",
      filter_hint_market: "Default: economic, sanctions, conflict and risk-related news events, plus significant or magnitude-6+ earthquakes.",
      filter_hint_all: "Every quality-filtered public record that already has coordinates, including M4.5+ earthquakes. Coordinates come from the sources; we do not invent points.",
      live_events: "Live events",
      brief: "Situation brief",
      brief_empty: "No sourced items under the current filter to summarise.",
      markets: "Markets",
      markets_empty: "Market data is temporarily unavailable.",
      loading: "Loading…",
      not_ready: "The data source is not ready yet. Retrying automatically.",
      error: "Could not load events. Retrying.",
      stale: "Source delayed. Last update {s} ago.",
      updated: "Updated {s} ago",
      empty_list: "No events in the current filter.",
      cluster: "{n} events near this location",
      legend: "Legend",
      source: "Source",
      place: "Place",
      time: "Time",
      category: "Category",
      open_source: "Open source",
      no_url: "No source link",
      attr: "Basemap: NASA Earth Observatory — Black Marble 2016. Earthquakes: U.S. Geological Survey. News events: the GDELT Project (when present). Coordinates come from those sources and are not filled in by hand.",
      cat_seismic: "Earthquake",
      cat_conflict: "Conflict",
      cat_sanction: "Sanctions",
      cat_economy: "Economy",
      cat_threat: "Threat",
      cat_other: "Other",
      connecting: "Connecting",
      live: "Live",
      detail: "Event detail",
      briefly: "Sourced from the current list, not an editorial brief.",
      close: "Close",
      mag: "Magnitude {n}"
    },
    ko: {
      title: "이벤트 인텔리전스",
      lead: "좌표가 있는 공개 사건입니다. 이 사이트의 헤드라인을 지도에 올린 것이 아닙니다. 기본값은 시장 관련 사건이며, 자격을 갖춘 전체 기록으로 전환할 수 있습니다.",
      filter_market: "시장 관련 사건",
      filter_all: "적격 사건 전체",
      filter_hint_market: "기본값: 경제·제재·분쟁 및 위험 관련 뉴스 사건과 주요 또는 규모 6 이상 지진.",
      filter_hint_all: "좌표가 있는 품질 필터를 통과한 공개 기록 전체(규모 4.5 이상 지진 포함). 좌표는 출처에서 오며 임의로 채우지 않습니다.",
      live_events: "실시간 사건",
      brief: "상황 요약",
      brief_empty: "현재 필터에서 요약할 출처 항목이 없습니다.",
      markets: "시장",
      markets_empty: "시세를 잠시 불러올 수 없습니다.",
      loading: "불러오는 중…",
      not_ready: "데이터 소스가 아직 준비되지 않았습니다. 자동으로 다시 시도합니다.",
      error: "사건 데이터를 불러오지 못했습니다. 다시 시도합니다.",
      stale: "소스가 지연되었습니다. 마지막 업데이트는 {s} 전입니다.",
      updated: "{s} 전 업데이트",
      empty_list: "현재 필터에 표시할 사건이 없습니다.",
      cluster: "이 위치 근처에 사건 {n}건",
      legend: "범례",
      source: "출처",
      place: "위치",
      time: "시간",
      category: "분류",
      open_source: "출처 열기",
      no_url: "출처 링크 없음",
      attr: "배경 지도: NASA Earth Observatory — Black Marble 2016. 지진: U.S. Geological Survey. 뉴스 사건: GDELT Project(있는 경우). 좌표는 해당 출처에서 오며 수동으로 보완하지 않습니다.",
      cat_seismic: "지진",
      cat_conflict: "분쟁",
      cat_sanction: "제재",
      cat_economy: "경제",
      cat_threat: "위협",
      cat_other: "기타",
      connecting: "연결 중",
      live: "연결됨",
      detail: "사건 상세",
      briefly: "현재 목록의 출처 항목이며 편집부 작성이 아닙니다.",
      close: "닫기",
      mag: "규모 {n}"
    },
    tr: {
      title: "Olay İstihbaratı",
      lead: "Koordinatı olan kamuya açık olaylar; sitedeki manşetlerin haritası değil. Varsayılan görünüm piyasayla ilgili olaylardır; tüm uygun kayıtlara geçebilirsiniz.",
      filter_market: "Piyasayla ilgili olaylar",
      filter_all: "Tüm uygun olaylar",
      filter_hint_market: "Varsayılan: ekonomi, yaptırım, çatışma ve risk haberleri ile önemli veya 6 ve üzeri depremler.",
      filter_hint_all: "Koordinatı olan, kalite süzgecinden geçen tüm kamuya açık kayıtlar (M4.5+ depremler dahil). Koordinatlar kaynaklardan gelir; biz uydurmayız.",
      live_events: "Canlı olaylar",
      brief: "Durum özeti",
      brief_empty: "Geçerli süzgeçte özetlenecek kaynaklı madde yok.",
      markets: "Piyasalar",
      markets_empty: "Piyasa verisi geçici olarak alınamıyor.",
      loading: "Yükleniyor…",
      not_ready: "Veri kaynağı henüz hazır değil. Yeniden denenecek.",
      error: "Olaylar yüklenemedi. Yeniden deneniyor.",
      stale: "Kaynak gecikti. Son güncelleme {s} önce.",
      updated: "{s} önce güncellendi",
      empty_list: "Bu süzgeçte olay yok.",
      cluster: "Bu konum yakınında {n} olay",
      legend: "Gösterge",
      source: "Kaynak",
      place: "Yer",
      time: "Zaman",
      category: "Kategori",
      open_source: "Kaynağı aç",
      no_url: "Kaynak bağlantısı yok",
      attr: "Altlık: NASA Earth Observatory — Black Marble 2016. Depremler: U.S. Geological Survey. Haber olayları: GDELT Project (varsa). Koordinatlar bu kaynaklardandır, elle tamamlanmaz.",
      cat_seismic: "Deprem",
      cat_conflict: "Çatışma",
      cat_sanction: "Yaptırım",
      cat_economy: "Ekonomi",
      cat_threat: "Tehdit",
      cat_other: "Diğer",
      connecting: "Bağlanılıyor",
      live: "Canlı",
      detail: "Olay ayrıntısı",
      briefly: "Güncel listedeki kaynak maddeleridir; editoryal metin değildir.",
      close: "Kapat",
      mag: "Büyüklük {n}"
    },
    ru: {
      title: "Аналитика событий",
      lead: "Открытые события с уже известными координатами, а не карта заголовков этого сайта. По умолчанию показаны события, более значимые для рынков; можно переключить на все подходящие записи.",
      filter_market: "События, значимые для рынка",
      filter_all: "Все подходящие события",
      filter_hint_market: "По умолчанию: экономика, санкции, конфликты и риски, а также значительные землетрясения или магнитудой 6+.",
      filter_hint_all: "Все прошедшие фильтр качества открытые записи с координатами, включая землетрясения M4.5+. Координаты берутся из источников, мы их не придумываем.",
      live_events: "События",
      brief: "Обстановка",
      brief_empty: "В текущем фильтре нет sourced-пунктов для сводки.",
      markets: "Рынки",
      markets_empty: "Рыночные данные временно недоступны.",
      loading: "Загрузка…",
      not_ready: "Источник данных ещё не готов. Повторяем запрос.",
      error: "Не удалось загрузить события. Повторяем попытку.",
      stale: "Источник задерживается. Последнее обновление {s} назад.",
      updated: "Обновлено {s} назад",
      empty_list: "В текущем фильтре нет событий.",
      cluster: "Рядом с этой точкой: {n}",
      legend: "Легенда",
      source: "Источник",
      place: "Место",
      time: "Время",
      category: "Категория",
      open_source: "Открыть источник",
      no_url: "Нет ссылки на источник",
      attr: "Подложка: NASA Earth Observatory — Black Marble 2016. Землетрясения: U.S. Geological Survey. Новостные события: GDELT Project (если есть). Координаты взяты из этих источников и не дополняются вручную.",
      cat_seismic: "Землетрясение",
      cat_conflict: "Конфликт",
      cat_sanction: "Санкции",
      cat_economy: "Экономика",
      cat_threat: "Угроза",
      cat_other: "Другое",
      connecting: "Подключение",
      live: "Подключено",
      detail: "Сведения о событии",
      briefly: "Пункты из текущего списка с указанием источника, это не редакционная сводка.",
      close: "Закрыть",
      mag: "Магнитуда {n}"
    }
  };

  const state = {
    active: false,
    built: false,
    filter: "market",
    events: [],
    checked_ms: 0,
    selected: null,
    status: "connecting",
    markets: [],
    map: null,
    overlay: null,
    pollTimer: 0,
    marketTimer: 0,
    libs: false,
    briefOpen: false,
    didFit: false,
    arcLayer: null,
    dotLayer: null
  };

  try {
    const saved = localStorage.getItem(LS_FILTER);
    if (saved === "all" || saved === "market") state.filter = saved;
  } catch { /* ignore */ }

  function lang() {
    const l = document.documentElement.lang || "";
    if (l.startsWith("zh")) return "zh";
    if (l.startsWith("ko")) return "ko";
    if (l.startsWith("tr")) return "tr";
    if (l.startsWith("ru")) return "ru";
    if (l.startsWith("en")) return "en";
    return "en";
  }

  function t(key, vars) {
    const pack = STR[lang()] || STR.en;
    let s = pack[key] ?? STR.en[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    }
    return s;
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function reducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function viewerTz() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  }

  function formatWhen(ms) {
    const d = new Date(Number(ms) || 0);
    if (!ms || Number.isNaN(d.getTime())) return { rel: "", abs: "", zone: "" };
    const tz = viewerTz();
    const loc = lang() === "zh" ? "zh-Hans" : (lang() === "en" ? "en" : lang());
    const abs = new Intl.DateTimeFormat(loc, {
      timeZone: tz,
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).format(d);
    const zone = new Intl.DateTimeFormat(loc, { timeZone: tz, timeZoneName: "shortOffset", hour: "numeric" })
      .formatToParts(d)
      .filter((p) => p.type === "timeZoneName")
      .map((p) => p.value)[0] || tz;
    const diff = Date.now() - d.getTime();
    let rel = "";
    if (diff < 45_000) rel = lang() === "zh" ? "刚刚" : "just now";
    else if (diff < 3_600_000) {
      const n = Math.max(1, Math.round(diff / 60_000));
      rel = lang() === "zh" ? `${n} 分钟前` : `${n}m`;
    } else if (diff < 36 * 3_600_000) {
      const n = Math.max(1, Math.round(diff / 3_600_000));
      rel = lang() === "zh" ? `${n} 小时前` : `${n}h`;
    } else {
      const n = Math.max(1, Math.round(diff / 86_400_000));
      rel = lang() === "zh" ? `${n} 天前` : `${n}d`;
    }
    return { rel, abs, zone };
  }

  function catLabel(cat) {
    return t("cat_" + (cat || "other"));
  }

  function rgb(cat) {
    return CAT_COLOR[cat] || CAT_COLOR.other;
  }

  function cssRgb(cat, a) {
    const [r, g, b] = rgb(cat);
    return a == null ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
  }

  function visibleEvents() {
    const list = state.events.filter((e) => {
      if (!Number.isFinite(e.lat) || !Number.isFinite(e.lon)) return false;
      if (state.filter === "market") return !!e.market_relevant;
      return true;
    });
    list.sort((a, b) => (Number(b.time_ms) || 0) - (Number(a.time_ms) || 0));
    return list;
  }

  function $root() {
    return document.getElementById("ei-view");
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if ([...document.scripts].some((s) => s.src === src || s.getAttribute("src") === src)) {
        resolve();
        return;
      }
      const el = document.createElement("script");
      el.src = src;
      el.async = true;
      el.onload = () => resolve();
      el.onerror = () => reject(new Error("script " + src));
      document.head.appendChild(el);
    });
  }

  function loadCss(href) {
    if ([...document.querySelectorAll("link[rel=stylesheet]")].some((l) => (l.getAttribute("href") || l.href).includes(href.replace("./", "")))) return;
    const el = document.createElement("link");
    el.rel = "stylesheet";
    el.href = href;
    document.head.appendChild(el);
  }

  async function ensureLibs() {
    if (state.libs) return;
    loadCss(LEAFLET_CSS);
    await loadScript(LEAFLET_JS);
    if (!window.L) throw new Error("leaflet missing");
    state.libs = true;
  }

  function buildShell() {
    const root = $root();
    if (!root) return;
    root.innerHTML = `
      <header class="ei-head">
        <div class="ei-head-text">
          <h2 class="ei-title" data-ei="title"></h2>
          <p class="ei-lead" data-ei="lead"></p>
        </div>
        <div class="ei-head-tools">
          <span class="ei-status" data-ei="status" data-state="connecting"><i class="ei-dot" aria-hidden="true"></i><span data-ei="status-label"></span></span>
          <div class="ei-toggle" role="group" data-ei="toggle"></div>
        </div>
      </header>
      <p class="ei-hint" data-ei="hint"></p>
      <div class="ei-grid">
        <section class="ei-panel ei-list-panel" aria-labelledby="ei-list-h">
          <h3 id="ei-list-h" class="ei-panel-title" data-ei="list-title"></h3>
          <div class="ei-list" id="ei-list" role="listbox"></div>
        </section>
        <section class="ei-map-panel">
          <div id="ei-map" class="ei-map" role="img"></div>
          <ul class="ei-legend" id="ei-legend" aria-label=""></ul>
          <div class="ei-map-attr" data-ei="attr"></div>
          <aside class="ei-detail" id="ei-detail" hidden></aside>
        </section>
        <section class="ei-panel ei-brief-panel">
          <button type="button" class="ei-brief-toggle" id="ei-brief-toggle" aria-expanded="false"></button>
          <div class="ei-brief-body" id="ei-brief-body">
            <h3 class="ei-panel-title" data-ei="brief-title"></h3>
            <p class="ei-brief-note" data-ei="brief-note"></p>
            <ul class="ei-brief-list" id="ei-brief-list"></ul>
          </div>
        </section>
        <section class="ei-markets" aria-labelledby="ei-mkt-h">
          <h3 id="ei-mkt-h" class="ei-panel-title" data-ei="markets-title"></h3>
          <div class="ei-mkt-row" id="ei-mkt-row"></div>
        </section>
      </div>
    `;
    state.built = true;
    root.querySelector("[data-ei=toggle]").addEventListener("click", onToggle);
    root.querySelector("#ei-list").addEventListener("click", onListClick);
    root.querySelector("#ei-brief-toggle").addEventListener("click", () => {
      state.briefOpen = !state.briefOpen;
      $root().classList.toggle("is-brief-open", state.briefOpen);
      paintChrome();
    });
  }

  function paintChrome() {
    const root = $root();
    if (!root || !state.built) return;
    const set = (sel, text) => {
      const el = root.querySelector(sel);
      if (el) el.textContent = text;
    };
    set("[data-ei=title]", t("title"));
    set("[data-ei=lead]", t("lead"));
    set("[data-ei=hint]", state.filter === "all" ? t("filter_hint_all") : t("filter_hint_market"));
    set("[data-ei=list-title]", t("live_events"));
    set("[data-ei=brief-title]", t("brief"));
    set("[data-ei=brief-note]", t("briefly"));
    set("[data-ei=markets-title]", t("markets"));
    set("[data-ei=attr]", t("attr"));
    const st = root.querySelector("[data-ei=status]");
    if (st) {
      st.dataset.state = state.status;
      const when = state.checked_ms ? formatWhen(state.checked_ms).rel : "";
      const label = state.status === "live"
        ? (when ? t("updated", { s: when }) : t("live"))
        : state.status === "error"
          ? t("error")
          : state.status === "empty"
            ? t("not_ready")
            : t("connecting");
      set("[data-ei=status-label]", label);
    }
    const tog = root.querySelector("[data-ei=toggle]");
    if (tog) {
      tog.innerHTML = `
        <button type="button" class="ei-tog${state.filter === "market" ? " is-on" : ""}" data-filter="market" aria-pressed="${state.filter === "market"}">${esc(t("filter_market"))}</button>
        <button type="button" class="ei-tog${state.filter === "all" ? " is-on" : ""}" data-filter="all" aria-pressed="${state.filter === "all"}">${esc(t("filter_all"))}</button>
      `;
    }
    const bt = root.querySelector("#ei-brief-toggle");
    if (bt) {
      bt.textContent = t("brief");
      bt.setAttribute("aria-expanded", state.briefOpen ? "true" : "false");
    }
    const legend = root.querySelector("#ei-legend");
    if (legend) legend.setAttribute("aria-label", t("legend"));
    paintLegend();
  }

  function onToggle(ev) {
    const btn = ev.target.closest("[data-filter]");
    if (!btn) return;
    const next = btn.getAttribute("data-filter");
    if (next !== "market" && next !== "all") return;
    state.filter = next;
    state.didFit = false;
    try { localStorage.setItem(LS_FILTER, next); } catch { /* ignore */ }
    const still = visibleEvents().some((e) => e.id === state.selected);
    if (!still) state.selected = null;
    paintAll();
  }

  function onListClick(ev) {
    const row = ev.target.closest("[data-eid]");
    if (!row) return;
    select(row.getAttribute("data-eid"), { fly: true });
  }

  function select(id, { fly = false } = {}) {
    const ev = visibleEvents().find((e) => e.id === id) || null;
    state.selected = ev ? ev.id : null;
    paintList();
    paintDetail();
    paintBrief();
    updateMapLayers();
    if (fly && ev && state.map) {
      const z = Math.min(Math.max(state.map.getZoom(), 3), 5.2);
      const opts = { duration: reducedMotion() ? 0 : 0.6 };
      if (state.map.flyTo) state.map.flyTo([ev.lat, ev.lon], z, opts);
      const group = clusterEvents(visibleEvents()).find((g) => g.items.some((x) => x.id === ev.id));
      if (group && group.items.length > 1) openClusterPopup(group);
      else openEventPopup(ev);
    }
  }

  function paintList() {
    const box = document.getElementById("ei-list");
    if (!box) return;
    const items = visibleEvents();
    if (!items.length) {
      box.innerHTML = `<p class="ei-empty">${esc(state.events.length ? t("empty_list") : (state.status === "error" ? t("error") : t("loading")))}</p>`;
      return;
    }
    box.innerHTML = items.map((e) => {
      const when = formatWhen(e.time_ms);
      const on = e.id === state.selected;
      return `<button type="button" class="ei-row${on ? " is-on" : ""}" role="option" aria-selected="${on}" data-eid="${esc(e.id)}">
        <span class="ei-pin" style="--ei-cat:${cssRgb(e.category)}"></span>
        <span class="ei-row-body">
          <span class="ei-row-title">${esc(e.title || e.place || e.id)}</span>
          <span class="ei-row-meta"><span class="ei-cat">${esc(catLabel(e.category))}</span> · ${esc(when.rel || when.abs)} · ${esc(e.source_name || e.source || "")}</span>
        </span>
      </button>`;
    }).join("");
    const on = box.querySelector(".ei-row.is-on");
    if (on) on.scrollIntoView({ block: "nearest" });
  }

  function paintDetail() {
    const box = document.getElementById("ei-detail");
    if (!box) return;
    const ev = visibleEvents().find((e) => e.id === state.selected);
    if (!ev) {
      box.hidden = true;
      box.innerHTML = "";
      return;
    }
    const when = formatWhen(ev.time_ms);
    const link = ev.url && /^https?:/i.test(ev.url)
      ? `<a class="ei-src" href="${esc(ev.url)}" target="_blank" rel="noopener noreferrer">${esc(t("open_source"))}</a>`
      : `<span class="ei-src is-off">${esc(t("no_url"))}</span>`;
    const mag = ev.magnitude != null ? `<div><dt>${esc(t("category"))}</dt><dd>${esc(catLabel(ev.category))} · ${esc(t("mag", { n: ev.magnitude }))}</dd></div>` : `<div><dt>${esc(t("category"))}</dt><dd>${esc(catLabel(ev.category))}</dd></div>`;
    box.hidden = false;
    box.innerHTML = `
      <div class="ei-detail-head">
        <h3>${esc(t("detail"))}</h3>
        <button type="button" class="ei-detail-close" id="ei-detail-close" aria-label="${esc(t("close"))}">×</button>
      </div>
      <p class="ei-detail-title">${esc(ev.title || ev.place || "")}</p>
      <dl class="ei-dl">
        <div><dt>${esc(t("place"))}</dt><dd>${esc(ev.place || "—")}</dd></div>
        <div><dt>${esc(t("time"))}</dt><dd>${esc(when.abs)}${when.zone ? ` · ${esc(when.zone)}` : ""}</dd></div>
        ${mag}
        <div><dt>${esc(t("source"))}</dt><dd>${esc(ev.source_name || ev.source || "—")}</dd></div>
      </dl>
      ${link}
    `;
    box.querySelector("#ei-detail-close").addEventListener("click", () => {
      state.selected = null;
      paintAll();
    });
  }

  function paintBrief() {
    const ul = document.getElementById("ei-brief-list");
    if (!ul) return;
    const items = visibleEvents().slice(0, 8);
    if (!items.length) {
      ul.innerHTML = `<li class="ei-empty">${esc(state.events.length ? t("brief_empty") : (state.status === "error" ? t("error") : t("loading")))}</li>`;
      return;
    }
    ul.innerHTML = items.map((e) => {
      const when = formatWhen(e.time_ms);
      const inner = `${esc(e.title || e.place || "")} <span class="ei-brief-src">· ${esc(e.source_name || e.source || "")} · ${esc(when.rel || when.abs)}</span>`;
      if (e.url && /^https?:/i.test(e.url)) {
        return `<li><a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">${inner}</a></li>`;
      }
      return `<li>${inner}</li>`;
    }).join("");
  }

  function formatPrice(p) {
    const n = Number(p);
    if (!Number.isFinite(n)) return "—";
    if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
    if (n >= 1) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  }

  function formatPct(p) {
    const n = Number(p);
    if (!Number.isFinite(n)) return "—";
    const sign = n > 0 ? "+" : "";
    return sign + n.toFixed(2) + "%";
  }

  function paintMarkets() {
    const row = document.getElementById("ei-mkt-row");
    if (!row) return;
    if (!state.markets.length) {
      row.innerHTML = `<p class="ei-empty">${esc(t("markets_empty"))}</p>`;
      return;
    }
    row.innerHTML = state.markets.map((r) => {
      const chg = Number(r.c24);
      const dir = !Number.isFinite(chg) || chg === 0 ? "flat" : chg > 0 ? "up" : "down";
      return `<div class="ei-quote" data-dir="${dir}">
        <span class="coin-sym">${esc(r.s)}</span>
        <span class="coin-price">${esc(formatPrice(r.p))}</span>
        <span class="coin-chg ${dir === "up" ? "is-up" : dir === "down" ? "is-down" : ""}">${esc(formatPct(r.c24))}</span>
      </div>`;
    }).join("");
  }

  function paintAll() {
    paintChrome();
    paintList();
    paintDetail();
    paintBrief();
    paintMarkets();
    updateMapLayers();
  }

  function hasArc(e) {
    return Number.isFinite(e.lat2) && Number.isFinite(e.lon2)
      && (Math.abs(e.lat2 - e.lat) > 0.5 || Math.abs(e.lon2 - e.lon) > 0.5);
  }

  function layerData() {
    const items = visibleEvents();
    const mobile = window.matchMedia("(max-width: 800px)").matches;
    const quiet = reducedMotion();
    const arcs = (mobile || quiet) ? [] : items.filter(hasArc).slice(0, 40);
    return { items, arcs, quiet };
  }

  function catHex(cat) {
    const c = CAT_COLOR[cat] || CAT_COLOR.other || [122, 240, 224];
    return "#" + c.map((n) => n.toString(16).padStart(2, "0")).join("");
  }

  function bumpMap() {
    if (state.map && typeof state.map.invalidateSize === "function") state.map.invalidateSize();
  }

  function paintLegend() {
    const box = document.getElementById("ei-legend");
    if (!box) return;
    const present = new Set(visibleEvents().map((e) => e.category || "other"));
    const order = ["conflict", "threat", "sanction", "economy", "seismic", "other"];
    const cats = order.filter((c) => present.has(c));
    box.innerHTML = cats.map((c) =>
      `<li><i style="background:${catHex(c)}"></i>${esc(catLabel(c))}</li>`
    ).join("");
  }

  function clusterEvents(items) {
    const thresh = 2.2;
    const groups = [];
    for (const e of items) {
      let g = groups.find((x) => Math.hypot(e.lat - x.lat, (e.lon - x.lon) * Math.cos((e.lat * Math.PI) / 180)) < thresh);
      if (!g) {
        g = { lat: e.lat, lon: e.lon, items: [] };
        groups.push(g);
      }
      g.items.push(e);
    }
    return groups;
  }

  function eventPopupHtml(e) {
    const when = formatWhen(e.time_ms);
    return `<div class="ei-pop ei-pop-event">
      <p class="ei-pop-k">${esc(t("place"))}</p>
      <p class="ei-pop-place">${esc(e.place || "—")}</p>
      <p class="ei-pop-title">${esc(e.title || e.id)}</p>
      <p class="ei-pop-meta"><span>${esc(catLabel(e.category))}</span> · ${esc(when.rel || when.abs)}${e.magnitude != null ? ` · ${esc(t("mag", { n: e.magnitude }))}` : ""}</p>
    </div>`;
  }

  function openEventPopup(e) {
    if (!state.map || !window.L || !e) return;
    L.popup({ className: "ei-popup", closeButton: true, maxWidth: 280, autoPan: true })
      .setLatLng([e.lat, e.lon])
      .setContent(eventPopupHtml(e))
      .openOn(state.map);
  }

  function openClusterPopup(g) {
    if (!state.map || !window.L) return;
    const rows = g.items.map((e) => {
      const when = formatWhen(e.time_ms);
      return `<button type="button" class="ei-pop-row" data-eid="${esc(e.id)}">
        <i style="background:${catHex(e.category)}"></i>
        <span>
          <b>${esc(e.title || e.id)}</b>
          <em class="ei-pop-where">${esc(e.place || "—")}</em>
        </span>
        <em>${esc(when.rel || when.abs)}</em>
      </button>`;
    }).join("");
    const html = `<div class="ei-pop">
      <p class="ei-pop-h">${esc(t("cluster", { n: String(g.items.length) }))}</p>
      ${rows}
    </div>`;
    L.popup({ className: "ei-popup", closeButton: true, maxWidth: 300, autoPan: true })
      .setLatLng([g.lat, g.lon])
      .setContent(html)
      .openOn(state.map);
  }

  function updateMapLayers(opts) {
    if (!state.map || !window.L) return;
    const fit = !!(opts && opts.fit);
    const { items, arcs } = layerData();
    const sel = state.selected;
    if (!state.arcLayer) state.arcLayer = L.layerGroup().addTo(state.map);
    if (!state.dotLayer) state.dotLayer = L.layerGroup().addTo(state.map);
    state.arcLayer.clearLayers();
    state.dotLayer.clearLayers();
    for (const e of arcs) {
      const latlngs = greatCircle([e.lon2, e.lat2], [e.lon, e.lat]).map((p) => [p[1], p[0]]);
      L.polyline(latlngs, {
        color: catHex(e.category),
        weight: 1.8,
        opacity: 0.75,
        interactive: false
      }).addTo(state.arcLayer);
    }
    for (const g of clusterEvents(items)) {
      const head = g.items[0];
      const hex = catHex(head.category);
      const on = g.items.some((e) => e.id === sel);
      if (g.items.length === 1) {
        L.circleMarker([g.lat, g.lon], {
          radius: on ? 18 : 13,
          color: hex,
          weight: 0,
          fillColor: hex,
          fillOpacity: on ? 0.38 : 0.26,
          interactive: false
        }).addTo(state.dotLayer);
        const mark = L.circleMarker([g.lat, g.lon], {
          radius: on ? 8 : 5.6,
          color: "#fff",
          weight: 1.3,
          fillColor: hex,
          fillOpacity: 1
        });
        mark.on("click", () => { select(head.id, { fly: false }); openEventPopup(head); });
        mark.addTo(state.dotLayer);
      } else {
        const icon = L.divIcon({
          className: "ei-cluster" + (on ? " is-on" : ""),
          html: `<span class="ei-cluster-core" style="--ei-cat:${hex}">${g.items.length}</span>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        });
        const mark = L.marker([g.lat, g.lon], { icon, keyboard: true, riseOnHover: true });
        mark.on("click", () => {
          select(head.id, { fly: false });
          openClusterPopup(g);
        });
        mark.addTo(state.dotLayer);
      }
    }
    paintLegend();
    if ((fit || !state.didFit) && items.length) {
      const b = L.latLngBounds(items.map((e) => [e.lat, e.lon]));
      state.map.fitBounds(b, { animate: false, maxZoom: 3.5, padding: [28, 28] });
      state.didFit = true;
    }
  }

  function radiusOf(d) {
    const mag = Number(d.magnitude);
    if (Number.isFinite(mag)) return 4 + Math.max(0, mag - 4) * 1.4;
    const n = Number(d.num_mentions) || Number(d.num_sources) || 1;
    return 4 + Math.min(6, Math.log10(Math.max(1, n)) * 3);
  }

  function greatCircle(a, b, n = 32) {
    const toR = Math.PI / 180;
    const lng1 = a[0] * toR, lat1 = a[1] * toR, lng2 = b[0] * toR, lat2 = b[1] * toR;
    const d = 2 * Math.asin(Math.sqrt(Math.sin((lat2 - lat1) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lng2 - lng1) / 2) ** 2));
    if (!d || Number.isNaN(d)) return [a, b];
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      const A = Math.sin((1 - f) * d) / Math.sin(d);
      const B = Math.sin(f * d) / Math.sin(d);
      const x = A * Math.cos(lat1) * Math.cos(lng1) + B * Math.cos(lat2) * Math.cos(lng2);
      const y = A * Math.cos(lat1) * Math.sin(lng1) + B * Math.cos(lat2) * Math.sin(lng2);
      const z = A * Math.sin(lat1) + B * Math.sin(lat2);
      pts.push([(Math.atan2(y, x) * 180) / Math.PI, (Math.atan2(z, Math.sqrt(x * x + y * y)) * 180) / Math.PI]);
    }
    return pts;
  }

  async function initMap() {
    const container = document.getElementById("ei-map");
    if (!container || state.map || !window.L) return;
    const map = L.map(container, {
      center: [12, 20],
      zoom: 2.4,
      minZoom: 2,
      maxZoom: 6,
      maxBounds: [[-48, -179.5], [82, 179.5]],
      maxBoundsViscosity: 0.85,
      attributionControl: false,
      zoomControl: false,
      worldCopyJump: false
    });
    L.control.zoom({ position: "topright" }).addTo(map);
    map.on("popupopen", (ev) => {
      const root = ev.popup.getElement();
      if (!root) return;
      root.querySelectorAll("[data-eid]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-eid");
          const ev = visibleEvents().find((x) => x.id === id);
          select(id, { fly: false });
          if (ev) openEventPopup(ev);
        });
      });
    });
    const world = L.latLngBounds([[-85.05112878, -180], [85.05112878, 180]]);
    L.imageOverlay(new URL(BASEMAP_URL, document.baseURI).href, world, {
      opacity: 1,
      interactive: false,
      zIndex: 1
    }).addTo(map);
    state.map = map;
    bumpMap();
    requestAnimationFrame(bumpMap);
    setTimeout(bumpMap, 80);
    setTimeout(bumpMap, 300);
    updateMapLayers({ fit: true });
    window.addEventListener("resize", () => {
      if (state.active) bumpMap();
    });
  }

  function parseFeed(payload) {
    const records = (payload && payload.records) || [];
    let snap = null;
    let checked = 0;
    for (const rec of records) {
      const data = rec.data || rec;
      const s = data.snap || data;
      if (s && Array.isArray(s.events)) {
        snap = s;
        checked = Number(data.checked_ms || s.checked_ms) || 0;
        break;
      }
    }
    if (!snap) return { events: [], checked_ms: 0 };
    const events = [];
    for (const raw of snap.events) {
      if (!raw || raw.lat == null || raw.lon == null) continue;
      const lat = Number(raw.lat), lon = Number(raw.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      events.push({
        id: String(raw.id || ""),
        source: raw.source || "",
        category: raw.category || "other",
        market_relevant: !!raw.market_relevant,
        title: raw.title || "",
        place: raw.place || "",
        lat,
        lon,
        lat2: raw.lat2 == null ? null : Number(raw.lat2),
        lon2: raw.lon2 == null ? null : Number(raw.lon2),
        time_ms: Number(raw.time_ms) || 0,
        url: raw.url || "",
        source_name: raw.source_name || "",
        magnitude: raw.magnitude == null ? null : Number(raw.magnitude),
        num_sources: raw.num_sources,
        num_mentions: raw.num_mentions
      });
    }
    return { events, checked_ms: checked || Number(snap.checked_ms) || 0 };
  }

  function applyFeedPayload(payload) {
    const data = parseFeed(payload);
    state.events = data.events;
    state.checked_ms = data.checked_ms;
    state.status = data.events.length ? "live" : "empty";
    if (state.selected && !visibleEvents().some((e) => e.id === state.selected)) state.selected = null;
    if (state.built) paintAll();
  }

  let feedInflight = null;
  function prefetchFeed() {
    if (feedInflight) return feedInflight;
    feedInflight = fetch(FEED_URL, { cache: "no-cache" })
      .then((res) => {
        if (!res.ok) throw new Error("http " + res.status);
        return res.json();
      })
      .then((payload) => {
        applyFeedPayload(payload);
        return payload;
      })
      .catch((err) => {
        if (!state.events.length) {
          state.status = "error";
          if (state.built) paintChrome();
        }
        console.warn("event-intelligence feed", err);
      })
      .finally(() => { feedInflight = null; });
    return feedInflight;
  }

  async function pollFeed() {
    if (!state.active) return;
    await prefetchFeed();
  }

  async function pollMarkets() {
    if (!state.active) return;
    try {
      const res = await fetch(MARKET_API, { cache: "no-cache" });
      if (!res.ok) throw new Error("http " + res.status);
      const data = await res.json();
      const keys = data.k || [];
      const want = new Set(TAPE);
      const out = [];
      const seen = new Set();
      for (const r of data.rows || []) {
        const o = {};
        for (let i = 0; i < keys.length; i++) o[keys[i]] = r[i];
        if (o.s && want.has(o.s) && !seen.has(o.s)) {
          seen.add(o.s);
          out.push({ s: o.s, p: o.p, c24: o.c24 });
        }
      }
      out.sort((a, b) => TAPE.indexOf(a.s) - TAPE.indexOf(b.s));
      state.markets = out;
      paintMarkets();
    } catch (err) {
      if (!state.markets.length) paintMarkets();
      console.warn("event-intelligence markets", err);
    }
  }

  function startTimers() {
    stopTimers();
    pollFeed();
    pollMarkets();
    state.pollTimer = setInterval(pollFeed, POLL_MS);
    state.marketTimer = setInterval(pollMarkets, MARKET_MS);
  }

  function stopTimers() {
    clearInterval(state.pollTimer);
    clearInterval(state.marketTimer);
    state.pollTimer = 0;
    state.marketTimer = 0;
  }

  async function activate() {
    if (!state.built) buildShell();
    paintChrome();
    paintList();
    paintBrief();
    paintMarkets();
    startTimers();
    try {
      await ensureLibs();
      await initMap();
      if (state.map) {
        bumpMap();
        requestAnimationFrame(() => state.map && bumpMap());
        updateMapLayers();
      }
    } catch (err) {
      console.error("event-intelligence map", err);
    }
  }

  function deactivate() {
    stopTimers();
  }

  window.BTC007_EVENTS = {
    setActive(on) {
      const next = !!on;
      if (next === state.active) {
        if (next && state.map) bumpMap();
        return;
      }
      state.active = next;
      if (next) activate();
      else deactivate();
    },
    rerender() {
      if (!state.active) return;
      paintAll();
      if (state.map) bumpMap();
    }
  };
  prefetchFeed();
})();
