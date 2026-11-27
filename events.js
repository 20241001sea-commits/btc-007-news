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
    economy: [70, 240, 176],
    company: [110, 190, 255],
    sanction: [240, 193, 75],
    conflict: [255, 107, 107],
    threat: [255, 155, 110],
    seismic: [160, 200, 255],
    other: [186, 168, 255]
  };
  const FINANCE_BASES = ["0311", "033", "061", "071", "081", "1031", "163"];
  const CONFLICT_CATS = new Set(["conflict", "threat", "seismic"]);

  const STR = {
    zh: {
      title: "事件情报",
      lead: "有坐标的公开经济与市场事件，不是本站快讯的地图化。",
      filter_market: "股票与市场",
      filter_all: "全部合格事件",
      filter_hint_market: "默认只显示股票、公司、贸易、金融与货币政策等经济事件，不含地震和冲突。坐标来自数据源，本站不补点。",
      filter_hint_all: "全部通过质量筛选且已有坐标的公开记录，包括地震与冲突。坐标来自数据源，本站不补点。",
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
      brief_notable: "来源条目",
      brief_places: "地点",
      empty_map: "当前筛选下暂无已定位的股票或市场事件。本站不会补点。",
      cluster: "附近有 {n} 起事件",
      legend: "图例",
      source: "来源",
      place: "地点",
      time: "时间",
      category: "类别",
      open_source: "打开来源",
      no_url: "无来源链接",
      attr: "地图底图：NASA Earth Observatory — Black Marble 2016。地震：美国地质调查局（USGS）。新闻事件：GDELT Project（如有）。坐标均来自上述来源，未人工补全。",
      cat_company: "公司",
      cat_seismic: "地震",
      cat_conflict: "冲突",
      cat_sanction: "制裁",
      cat_economy: "经济",
      cat_threat: "威胁",
      cat_other: "其他",
      connecting: "连接中",
      live: "已连接",
      detail: "事件详情",
      briefly: "根据当前列表的来源字段汇总，非编辑部撰写。",
      close: "关闭",
      mag: "震级 {n}"
    },
    en: {
      title: "Event Intelligence",
      lead: "Public, already-geocoded economic and market events — not a map of this site’s headlines.",
      filter_market: "Stocks & markets",
      filter_all: "All qualifying events",
      filter_hint_market: "Default: stocks, companies, trade, finance, and monetary-policy news. Earthquakes and conflicts are hidden. Coordinates come from the sources; none are added here.",
      filter_hint_all: "Every quality-filtered public record that already has coordinates, including earthquakes and conflicts. Coordinates come from the sources; we do not invent points.",
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
      brief_notable: "Sourced items",
      brief_places: "Places",
      empty_map: "No geocoded stock or market events in this filter. Coordinates are not invented.",
      cluster: "{n} events near this location",
      legend: "Legend",
      source: "Source",
      place: "Place",
      time: "Time",
      category: "Category",
      open_source: "Open source",
      no_url: "No source link",
      attr: "Basemap: NASA Earth Observatory — Black Marble 2016. Earthquakes: U.S. Geological Survey. News events: the GDELT Project (when present). Coordinates come from those sources and are not filled in by hand.",
      cat_company: "Company",
      cat_seismic: "Earthquake",
      cat_conflict: "Conflict",
      cat_sanction: "Sanctions",
      cat_economy: "Economy",
      cat_threat: "Threat",
      cat_other: "Other",
      connecting: "Connecting",
      live: "Live",
      detail: "Event detail",
      briefly: "A roll-up of fields from the current list, not an editorial brief.",
      close: "Close",
      mag: "Magnitude {n}"
    },
    ko: {
      title: "이벤트 인텔리전스",
      lead: "좌표가 있는 공개 경제·시장 사건입니다. 이 사이트의 헤드라인을 지도에 올린 것이 아닙니다.",
      filter_market: "주식·시장",
      filter_all: "적격 사건 전체",
      filter_hint_market: "기본값: 주식, 기업, 무역, 금융, 통화정책 관련 사건. 지진과 분쟁은 숨깁니다. 좌표는 출처에서 오며 임의로 채우지 않습니다.",
      filter_hint_all: "좌표가 있는 품질 필터를 통과한 공개 기록 전체(지진과 분쟁 포함). 좌표는 출처에서 오며 임의로 채우지 않습니다.",
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
      brief_notable: "출처 항목",
      brief_places: "장소",
      empty_map: "현재 필터에 위치가 있는 주식·시장 사건이 없습니다. 좌표를 임의로 채우지 않습니다.",
      cluster: "이 위치 근처에 사건 {n}건",
      legend: "범례",
      source: "출처",
      place: "위치",
      time: "시간",
      category: "분류",
      open_source: "출처 열기",
      no_url: "출처 링크 없음",
      attr: "배경 지도: NASA Earth Observatory — Black Marble 2016. 지진: U.S. Geological Survey. 뉴스 사건: GDELT Project(있는 경우). 좌표는 해당 출처에서 오며 수동으로 보완하지 않습니다.",
      cat_company: "기업",
      cat_seismic: "지진",
      cat_conflict: "분쟁",
      cat_sanction: "제재",
      cat_economy: "경제",
      cat_threat: "위협",
      cat_other: "기타",
      connecting: "연결 중",
      live: "연결됨",
      detail: "사건 상세",
      briefly: "현재 목록의 출처 필드 요약이며 편집부 작성이 아닙니다.",
      close: "닫기",
      mag: "규모 {n}"
    },
    tr: {
      title: "Olay İstihbaratı",
      lead: "Koordinatı olan kamuya açık ekonomik ve piyasa olayları; sitedeki manşetlerin haritası değil.",
      filter_market: "Hisse ve piyasalar",
      filter_all: "Tüm uygun olaylar",
      filter_hint_market: "Varsayılan: hisse, şirket, ticaret, finans ve para politikası haberleri. Depremler ve çatışmalar gizlenir. Koordinatlar kaynaklardan gelir; biz eklemeyiz.",
      filter_hint_all: "Koordinatı olan, kalite süzgecinden geçen tüm kamuya açık kayıtlar (deprem ve çatışmalar dahil). Koordinatlar kaynaklardan gelir; biz uydurmayız.",
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
      brief_notable: "Kaynak maddeler",
      brief_places: "Yerler",
      empty_map: "Bu süzgeçte konumu olan hisse veya piyasa olayı yok. Koordinat uydurulmaz.",
      cluster: "Bu konum yakınında {n} olay",
      legend: "Gösterge",
      source: "Kaynak",
      place: "Yer",
      time: "Zaman",
      category: "Kategori",
      open_source: "Kaynağı aç",
      no_url: "Kaynak bağlantısı yok",
      attr: "Altlık: NASA Earth Observatory — Black Marble 2016. Depremler: U.S. Geological Survey. Haber olayları: GDELT Project (varsa). Koordinatlar bu kaynaklardandır, elle tamamlanmaz.",
      cat_company: "Şirket",
      cat_seismic: "Deprem",
      cat_conflict: "Çatışma",
      cat_sanction: "Yaptırım",
      cat_economy: "Ekonomi",
      cat_threat: "Tehdit",
      cat_other: "Diğer",
      connecting: "Bağlanılıyor",
      live: "Canlı",
      detail: "Olay ayrıntısı",
      briefly: "Güncel listedeki kaynak alanlarının özeti; editoryal metin değildir.",
      close: "Kapat",
      mag: "Büyüklük {n}"
    },
    ru: {
      title: "Аналитика событий",
      lead: "Открытые экономические и рыночные события с уже известными координатами, а не карта заголовков этого сайта.",
      filter_market: "Акции и рынки",
      filter_all: "Все подходящие события",
      filter_hint_market: "По умолчанию: акции, компании, торговля, финансы и денежная политика. Землетрясения и конфликты скрыты. Координаты берутся из источников, мы их не добавляем.",
      filter_hint_all: "Все прошедшие фильтр качества открытые записи с координатами, включая землетрясения и конфликты. Координаты берутся из источников, мы их не придумываем.",
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
      brief_notable: "Пункты из источников",
      brief_places: "Места",
      empty_map: "В текущем фильтре нет событий по акциям или рынкам с координатами. Координаты не придумываются.",
      cluster: "Рядом с этой точкой: {n}",
      legend: "Легенда",
      source: "Источник",
      place: "Место",
      time: "Время",
      category: "Категория",
      open_source: "Открыть источник",
      no_url: "Нет ссылки на источник",
      attr: "Подложка: NASA Earth Observatory — Black Marble 2016. Землетрясения: U.S. Geological Survey. Новостные события: GDELT Project (если есть). Координаты взяты из этих источников и не дополняются вручную.",
      cat_company: "Компании",
      cat_seismic: "Землетрясение",
      cat_conflict: "Конфликт",
      cat_sanction: "Санкции",
      cat_economy: "Экономика",
      cat_threat: "Угроза",
      cat_other: "Другое",
      connecting: "Подключение",
      live: "Подключено",
      detail: "Сведения о событии",
      briefly: "Сводка полей из текущего списка, это не редакционный текст.",
      close: "Закрыть",
      mag: "Магнитуда {n}"
    }
  };

  const state = {
    active: false,
    built: false,
    filter: "market",
    catFilter: null,
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

  /* Zh display for structured GDELT CAMEO titles, actor types, and place names.
     Only used when the UI language is Simplified Chinese. Source fields stay in
     their original English. Unmapped leftovers are kept as in the source and
     noted via console.debug; in the current finance snapshot that includes
     the GDELT place token "Zhong Ying" (Shaanxi). */

  const ZH_NAME = {
    "united kingdom": "英国", "uk": "英国", "u.k.": "英国", "britain": "英国", "great britain": "英国",
    "england": "英格兰", "scotland": "苏格兰", "wales": "威尔士", "northern ireland": "北爱尔兰",
    "united states": "美国", "united states of america": "美国", "usa": "美国", "u.s.": "美国", "u.s.a.": "美国", "us": "美国", "america": "美国",
    "china": "中国", "people's republic of china": "中国", "taiwan": "台湾", "hong kong": "香港", "macau": "澳门", "macao": "澳门",
    "russia": "俄罗斯", "russian federation": "俄罗斯",
    "iran": "伊朗", "ukraine": "乌克兰", "canada": "加拿大", "israel": "以色列", "peru": "秘鲁",
    "new zealand": "新西兰", "japan": "日本", "south korea": "韩国", "republic of korea": "韩国",
    "north korea": "朝鲜", "dprk": "朝鲜", "korea, south": "韩国", "korea, north": "朝鲜",
    "india": "印度", "pakistan": "巴基斯坦", "afghanistan": "阿富汗", "iraq": "伊拉克",
    "syria": "叙利亚", "turkey": "土耳其", "turkiye": "土耳其", "saudi arabia": "沙特阿拉伯",
    "egypt": "埃及", "south africa": "南非", "australia": "澳大利亚",
    "france": "法国", "germany": "德国", "italy": "意大利", "spain": "西班牙", "portugal": "葡萄牙",
    "netherlands": "荷兰", "the netherlands": "荷兰", "the netherland": "荷兰", "holland": "荷兰",
    "belgium": "比利时", "switzerland": "瑞士", "sweden": "瑞典", "norway": "挪威", "finland": "芬兰",
    "denmark": "丹麦", "poland": "波兰", "czechia": "捷克", "czech republic": "捷克",
    "hungary": "匈牙利", "austria": "奥地利", "greece": "希腊", "ireland": "爱尔兰",
    "mexico": "墨西哥", "brazil": "巴西", "argentina": "阿根廷", "chile": "智利",
    "colombia": "哥伦比亚", "venezuela": "委内瑞拉", "cuba": "古巴",
    "nigeria": "尼日利亚", "kenya": "肯尼亚", "ethiopia": "埃塞俄比亚", "sudan": "苏丹",
    "south sudan": "南苏丹", "libya": "利比亚", "yemen": "也门", "lebanon": "黎巴嫩",
    "jordan": "约旦", "palestine": "巴勒斯坦", "qatar": "卡塔尔",
    "united arab emirates": "阿联酋", "uae": "阿联酋", "kuwait": "科威特", "oman": "阿曼", "bahrain": "巴林",
    "thailand": "泰国", "vietnam": "越南", "cambodia": "柬埔寨", "laos": "老挝", "myanmar": "缅甸", "burma": "缅甸",
    "malaysia": "马来西亚", "singapore": "新加坡", "indonesia": "印度尼西亚", "philippines": "菲律宾",
    "mongolia": "蒙古", "kazakhstan": "哈萨克斯坦", "uzbekistan": "乌兹别克斯坦",
    "kyrgyzstan": "吉尔吉斯斯坦", "tajikistan": "塔吉克斯坦", "turkmenistan": "土库曼斯坦",
    "armenia": "亚美尼亚", "azerbaijan": "阿塞拜疆",
    "belarus": "白俄罗斯", "moldova": "摩尔多瓦", "romania": "罗马尼亚", "bulgaria": "保加利亚",
    "serbia": "塞尔维亚", "croatia": "克罗地亚", "slovenia": "斯洛文尼亚", "slovakia": "斯洛伐克",
    "estonia": "爱沙尼亚", "latvia": "拉脱维亚", "lithuania": "立陶宛",
    "iceland": "冰岛", "luxembourg": "卢森堡", "cyprus": "塞浦路斯", "malta": "马耳他",
    "algeria": "阿尔及利亚", "morocco": "摩洛哥", "tunisia": "突尼斯", "ghana": "加纳",
    "uganda": "乌干达", "tanzania": "坦桑尼亚", "somalia": "索马里", "seychelles": "塞舌尔",
    "mauritius": "毛里求斯", "fiji": "斐济", "vanuatu": "瓦努阿图", "timor leste": "东帝汶",
    "timor-leste": "东帝汶", "east timor": "东帝汶", "papua new guinea": "巴布亚新几内亚",
    "sri lanka": "斯里兰卡", "bangladesh": "孟加拉国", "nepal": "尼泊尔", "bhutan": "不丹",
    "maldives": "马尔代夫", "bosnia and herzegovina": "波黑", "north macedonia": "北马其顿",
    "albania": "阿尔巴尼亚", "kosovo": "科索沃", "montenegro": "黑山",
    "west bank": "约旦河西岸", "gaza": "加沙",
    "european union": "欧盟", "europe": "欧洲",
    "djibouti": "吉布提", "guatemala": "危地马拉", "tuvalu": "图瓦卢",
    "red sea": "红海", "mauritius - reunion region": "毛里求斯－留尼汪地区",
    "vanuatu region": "瓦努阿图地区",
    "alabama": "阿拉巴马", "alaska": "阿拉斯加", "arizona": "亚利桑那", "arkansas": "阿肯色",
    "california": "加利福尼亚", "colorado": "科罗拉多", "connecticut": "康涅狄格",
    "delaware": "特拉华", "florida": "佛罗里达",
    "hawaii": "夏威夷", "idaho": "爱达荷", "illinois": "伊利诺伊", "indiana": "印第安纳",
    "iowa": "艾奥瓦", "kansas": "堪萨斯", "kentucky": "肯塔基", "louisiana": "路易斯安那",
    "maine": "缅因", "maryland": "马里兰", "massachusetts": "马萨诸塞", "michigan": "密歇根",
    "minnesota": "明尼苏达", "mississippi": "密西西比", "missouri": "密苏里", "montana": "蒙大拿",
    "nebraska": "内布拉斯加", "nevada": "内华达", "new hampshire": "新罕布什尔",
    "new jersey": "新泽西", "new mexico": "新墨西哥", "new york": "纽约",
    "north carolina": "北卡罗来纳", "north dakota": "北达科他", "ohio": "俄亥俄",
    "oklahoma": "俄克拉荷马", "oregon": "俄勒冈", "pennsylvania": "宾夕法尼亚",
    "rhode island": "罗得岛", "south carolina": "南卡罗来纳", "south dakota": "南达科他",
    "tennessee": "田纳西", "texas": "得克萨斯", "utah": "犹他", "vermont": "佛蒙特",
    "virginia": "弗吉尼亚", "washington": "华盛顿", "west virginia": "西弗吉尼亚",
    "wisconsin": "威斯康星", "wyoming": "怀俄明", "district of columbia": "哥伦比亚特区",
    "ontario": "安大略", "quebec": "魁北克", "british columbia": "不列颠哥伦比亚",
    "alberta": "阿尔伯塔", "manitoba": "马尼托巴", "saskatchewan": "萨斯喀彻温",
    "nova scotia": "新斯科舍", "new brunswick": "新不伦瑞克", "newfoundland and labrador": "纽芬兰与拉布拉多",
    "prince edward island": "爱德华王子岛", "northwest territories": "西北地区", "yukon": "育空", "nunavut": "努纳武特",
    "guangdong": "广东", "shaanxi": "陕西", "beijing": "北京", "shanghai": "上海",
    "tianjin": "天津", "chongqing": "重庆", "zhejiang": "浙江", "jiangsu": "江苏",
    "sichuan": "四川", "hubei": "湖北", "hunan": "湖南", "henan": "河南", "hebei": "河北",
    "shandong": "山东", "shanxi": "山西", "fujian": "福建", "anhui": "安徽",
    "jiangxi": "江西", "liaoning": "辽宁", "jilin": "吉林", "heilongjiang": "黑龙江",
    "yunnan": "云南", "guizhou": "贵州", "hainan": "海南", "gansu": "甘肃",
    "qinghai": "青海", "inner mongolia": "内蒙古", "xinjiang": "新疆", "tibet": "西藏",
    "ningxia": "宁夏", "guangxi": "广西", "lianjiang": "廉江",
    "moscow": "莫斯科", "boston": "波士顿", "toronto": "多伦多", "hollywood": "好莱坞",
    "montreal": "蒙特利尔", "london": "伦敦", "paris": "巴黎", "tokyo": "东京",
    "craigavon": "克雷加文", "cerro de pasco": "塞罗德帕斯科", "pasco": "帕斯科",
    "lospalos": "洛斯帕洛斯",
    "business": "企业", "company": "企业", "companies": "企业", "enterprise": "企业",
    "firm": "企业", "corporation": "企业", "mnc": "跨国企业",
    "investor": "投资者", "landlord": "房东", "bank": "银行", "media": "媒体",
    "politician": "政界人士", "regulator": "监管机构", "intelligence": "情报机构",
    "citizen": "公民", "civilian": "平民", "government": "政府", "military": "军方",
    "police": "警方", "university": "大学", "college": "学院", "website": "网站",
    "employee": "雇员", "worker": "工人", "judge": "法官", "minister": "部长",
    "minist": "部长", "defense minist": "国防部长", "defence minist": "国防部长",
    "defense minister": "国防部长", "chief executive": "首席执行官",
    "first lady": "第一夫人", "king": "国王", "boss": "管理者",
    "european": "欧方", "christian": "基督教人士",
    "development council": "发展理事会", "entrepreneur": "企业家",
    "producer": "生产商", "senate": "参议院", "hospital": "医院",
    "supreme court": "最高法院",
    "international criminal court": "国际刑事法院",
    "netflix": "奈飞", "nvidia": "英伟达",
    "charlotte": "夏洛特"
  };

  const ZH_US_STATES = new Set([
    "阿拉巴马", "阿拉斯加", "亚利桑那", "阿肯色", "加利福尼亚", "科罗拉多", "康涅狄格",
    "特拉华", "佛罗里达", "佐治亚", "夏威夷", "爱达荷", "伊利诺伊", "印第安纳", "艾奥瓦",
    "堪萨斯", "肯塔基", "路易斯安那", "缅因", "马里兰", "马萨诸塞", "密歇根", "明尼苏达",
    "密西西比", "密苏里", "蒙大拿", "内布拉斯加", "内华达", "新罕布什尔", "新泽西",
    "新墨西哥", "纽约", "北卡罗来纳", "北达科他", "俄亥俄", "俄克拉荷马", "俄勒冈",
    "宾夕法尼亚", "罗得岛", "南卡罗来纳", "南达科他", "田纳西", "得克萨斯", "犹他",
    "佛蒙特", "弗吉尼亚", "华盛顿", "西弗吉尼亚", "威斯康星", "怀俄明"
  ]);
  const ZH_CA_PROVINCES = new Set([
    "安大略", "魁北克", "不列颠哥伦比亚", "阿尔伯塔", "马尼托巴", "萨斯喀彻温",
    "新斯科舍", "新不伦瑞克", "纽芬兰与拉布拉多", "爱德华王子岛"
  ]);
  const ZH_CN_PROVINCES = new Set([
    "广东", "陕西", "浙江", "江苏", "四川", "湖北", "湖南", "河南", "河北", "山东",
    "山西", "福建", "安徽", "江西", "辽宁", "吉林", "黑龙江", "云南", "贵州", "海南",
    "甘肃", "青海", "内蒙古", "新疆", "西藏", "宁夏", "广西"
  ]);
  const ZH_COUNTRY_NAMES = new Set([
    "英国", "美国", "中国", "台湾", "香港", "澳门", "俄罗斯", "伊朗", "乌克兰", "加拿大",
    "以色列", "秘鲁", "新西兰", "日本", "韩国", "朝鲜", "印度", "巴基斯坦", "阿富汗",
    "伊拉克", "叙利亚", "土耳其", "沙特阿拉伯", "埃及", "南非", "澳大利亚", "法国",
    "德国", "意大利", "西班牙", "葡萄牙", "荷兰", "比利时", "瑞士", "瑞典", "挪威",
    "芬兰", "丹麦", "波兰", "捷克", "匈牙利", "奥地利", "希腊", "爱尔兰", "墨西哥",
    "巴西", "阿根廷", "智利", "哥伦比亚", "委内瑞拉", "古巴", "尼日利亚", "肯尼亚",
    "埃塞俄比亚", "苏丹", "南苏丹", "利比亚", "也门", "黎巴嫩", "约旦", "巴勒斯坦",
    "卡塔尔", "阿联酋", "科威特", "阿曼", "巴林", "泰国", "越南", "柬埔寨", "老挝",
    "缅甸", "马来西亚", "新加坡", "印度尼西亚", "菲律宾", "蒙古", "哈萨克斯坦",
    "乌兹别克斯坦", "吉尔吉斯斯坦", "塔吉克斯坦", "土库曼斯坦", "格鲁吉亚", "亚美尼亚",
    "阿塞拜疆", "白俄罗斯", "摩尔多瓦", "罗马尼亚", "保加利亚", "塞尔维亚", "克罗地亚",
    "斯洛文尼亚", "斯洛伐克", "爱沙尼亚", "拉脱维亚", "立陶宛", "冰岛", "卢森堡",
    "塞浦路斯", "马耳他", "阿尔及利亚", "摩洛哥", "突尼斯", "加纳", "乌干达", "坦桑尼亚",
    "索马里", "塞舌尔", "毛里求斯", "斐济", "瓦努阿图", "东帝汶", "巴布亚新几内亚",
    "斯里兰卡", "孟加拉国", "尼泊尔", "不丹", "马尔代夫", "波黑", "北马其顿", "阿尔巴尼亚",
    "科索沃", "黑山", "欧盟", "吉布提", "危地马拉", "图瓦卢"
  ]);

  const ZH_ACTION_BY_CODE = {
    "010": { kind: "statement", v: "发表声明" },
    "011": { kind: "statement", v: "拒绝置评" },
    "012": { kind: "statement", v: "发表悲观评论" },
    "013": { kind: "statement", v: "发表乐观评论" },
    "014": { kind: "statement", v: "考虑政策选项" },
    "015": { kind: "statement", v: "承认或声称负责" },
    "016": { kind: "statement", v: "否认责任" },
    "017": { kind: "statement", v: "举行象征性活动" },
    "018": { kind: "statement", v: "表示同意" },
    "01": { kind: "statement", v: "发表声明" },
    "020": { kind: "appeal", v: "发出呼吁" },
    "02": { kind: "appeal", v: "发出呼吁" },
    "030": { kind: "intend", v: "表达合作意向" },
    "0311": { kind: "intend", v: "表达经济合作意向" },
    "033": { kind: "intend", v: "表达提供经济援助的意向" },
    "036": { kind: "intend", v: "表达会谈意向" },
    "03": { kind: "intend", v: "表达意向" },
    "040": { kind: "consult", v: "磋商" },
    "041": { kind: "consult", v: "通话磋商" },
    "042": { kind: "visit", v: "到访" },
    "043": { kind: "host", v: "接待来访" },
    "044": { kind: "consult", v: "在第三地会晤" },
    "045": { kind: "consult", v: "进行斡旋" },
    "046": { kind: "consult", v: "谈判" },
    "04": { kind: "consult", v: "磋商" },
    "050": { kind: "cooperate", v: "开展外交合作", between: "之间的外交合作" },
    "051": { kind: "praise", v: "表示赞赏", v2: "赞赏" },
    "057": { kind: "cooperate", v: "签署正式协议" },
    "05": { kind: "cooperate", v: "开展外交合作", between: "之间的外交合作" },
    "060": { kind: "cooperate", v: "开展实质性合作", between: "之间的实质性合作" },
    "061": { kind: "cooperate", v: "开展经济合作", between: "之间的经济合作" },
    "06": { kind: "cooperate", v: "开展实质性合作", between: "之间的合作" },
    "070": { kind: "aid", v: "提供援助" },
    "071": { kind: "aid", v: "提供经济援助" },
    "072": { kind: "aid", v: "提供军事援助" },
    "073": { kind: "aid", v: "提供人道主义援助" },
    "07": { kind: "aid", v: "提供援助" },
    "080": { kind: "yield", v: "作出让步" },
    "081": { kind: "sanction", v: "放松制裁" },
    "083": { kind: "yield", v: "同意相关要求" },
    "084": { kind: "yield", v: "释放或交还人员" },
    "087": { kind: "yield", v: "降低军事对抗" },
    "0871": { kind: "yield", v: "宣布停火" },
    "08": { kind: "yield", v: "作出让步" },
    "09": { kind: "investigate", v: "展开调查" },
    "090": { kind: "investigate", v: "展开调查" },
    "100": { kind: "demand", v: "提出要求" },
    "1031": { kind: "demand", v: "要求经济合作" },
    "10": { kind: "demand", v: "提出要求" },
    "110": { kind: "disapprove", v: "表示反对" },
    "111": { kind: "disapprove", v: "提出批评" },
    "112": { kind: "accuse", v: "提出指责", v2: "指责" },
    "11": { kind: "disapprove", v: "表示反对" },
    "12": { kind: "reject", v: "予以拒绝" },
    "120": { kind: "reject", v: "予以拒绝" },
    "13": { kind: "threaten", v: "发出威胁" },
    "130": { kind: "threaten", v: "发出威胁" },
    "14": { kind: "protest", v: "举行抗议" },
    "15": { kind: "force", v: "展示武力" },
    "16": { kind: "relations", v: "降级关系" },
    "163": { kind: "sanction", v: "实施制裁或禁运" },
    "17": { kind: "coerce", v: "施压" },
    "172": { kind: "coerce", v: "实施行政制裁" },
    "18": { kind: "assault", v: "发动袭击" },
    "19": { kind: "fight", v: "发生交火" },
    "190": { kind: "fight", v: "发生交火" },
    "20": { kind: "violence", v: "发生大规模暴力" }
  };

  const ZH_ACTION_BY_LABEL = {
    "statement": { kind: "statement", v: "发表声明" },
    "appeal": { kind: "appeal", v: "发出呼吁" },
    "intend": { kind: "intend", v: "表达意向" },
    "consult": { kind: "consult", v: "磋商" },
    "diplomatic cooperation": { kind: "cooperate", v: "开展外交合作", between: "之间的外交合作" },
    "material cooperation": { kind: "cooperate", v: "开展实质性合作", between: "之间的实质性合作" },
    "economic cooperation": { kind: "cooperate", v: "开展经济合作", between: "之间的经济合作" },
    "economic aid": { kind: "aid", v: "提供经济援助" },
    "provide aid": { kind: "aid", v: "提供援助" },
    "yield": { kind: "yield", v: "作出让步" },
    "ease sanctions": { kind: "sanction", v: "放松制裁" },
    "investigate": { kind: "investigate", v: "展开调查" },
    "demand": { kind: "demand", v: "提出要求" },
    "demand economic cooperation": { kind: "demand", v: "要求经济合作" },
    "disapprove": { kind: "disapprove", v: "表示反对" },
    "reject": { kind: "reject", v: "予以拒绝" },
    "threaten": { kind: "threaten", v: "发出威胁" },
    "protest": { kind: "protest", v: "举行抗议" },
    "exhibit force": { kind: "force", v: "展示武力" },
    "reduce relations": { kind: "relations", v: "降级关系" },
    "sanctions / embargo": { kind: "sanction", v: "实施制裁或禁运" },
    "coerce": { kind: "coerce", v: "施压" },
    "assault": { kind: "assault", v: "发动袭击" },
    "fight": { kind: "fight", v: "发生交火" },
    "mass violence": { kind: "violence", v: "发生大规模暴力" },
    "event": { kind: "other", v: "发生事件" }
  };

  const zhUnmapped = new Set();
  const COMPANY_ACTORS = /^(BUSINESS|COMPANY|COMPANIES|ENTERPRISE|FIRM|CORPORATION|MNC)$/i;

  function zhKey(s) {
    return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function zhName(en, ctx) {
    const raw = String(en || "").trim();
    if (!raw) return "";
    const k = zhKey(raw);
    const ctxk = zhKey(ctx || "");
    // "Georgia" is the country unless the place clearly sits in the United States.
    if (k === "georgia") {
      if (/\bunited states\b|\bu\.s\.?\b|\busa\b/.test(ctxk)) return "佐治亚";
      return "格鲁吉亚";
    }
    const hit = ZH_NAME[k];
    if (hit) return hit;
    if (lang() === "zh") {
      if (k && !zhUnmapped.has(k)) {
        zhUnmapped.add(k);
        console.debug("event-intelligence zh unmapped name:", raw);
      }
    }
    return raw;
  }

  function suffixAdmin(name, country) {
    if (country === "美国" && ZH_US_STATES.has(name) && !name.endsWith("州")) return name + "州";
    if (country === "加拿大" && ZH_CA_PROVINCES.has(name) && !name.endsWith("省")) return name + "省";
    if (country === "中国" && ZH_CN_PROVINCES.has(name) && !name.endsWith("省")) return name + "省";
    return name;
  }

  function formatZhPlace(raw) {
    const source = String(raw || "");
    const parts = source.split(/\s*,\s*/).map((s) => s.trim()).filter(Boolean).map((s) => zhName(s, source));
    const out = [];
    const seen = new Set();
    for (const part of parts) {
      const k = part.replace(/\s+/g, "");
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(part);
    }
    if (!out.length) return "";
    // Drop a shorter token already contained in another (e.g. Pasco in Cerro de Pasco).
    const compact = (s) => s.replace(/\s+/g, "");
    const filtered = out.filter((part, i) => !out.some((other, j) => j !== i && compact(other).includes(compact(part)) && compact(other).length > compact(part).length));
    out.length = 0;
    out.push(...filtered);
    if (out.length >= 2 && ZH_COUNTRY_NAMES.has(out[out.length - 1])) {
      const country = out.pop();
      const admins = [];
      const locales = [];
      for (const part of out) {
        const stamped = suffixAdmin(part, country);
        const isAdmin = stamped !== part ||
          ZH_US_STATES.has(part) || ZH_CA_PROVINCES.has(part) || ZH_CN_PROVINCES.has(part) ||
          part === "北爱尔兰" || part === "英格兰" || part === "苏格兰" || part === "威尔士";
        if (isAdmin) admins.push(stamped);
        else locales.push(part);
      }
      return country + admins.join("") + locales.join("");
    }
    return out.join("，");
  }

  function parseTitleParts(title) {
    const raw = String(title || "");
    const idx = raw.indexOf(" — ");
    if (idx < 0) return { label: raw.trim(), actors: [] };
    return {
      label: raw.slice(0, idx).trim(),
      actors: raw.slice(idx + 3).split(" / ").map((s) => s.trim()).filter(Boolean)
    };
  }

  function lookupActionCode(code) {
    const c = String(code || "").trim();
    if (!c) return null;
    for (let n = c.length; n >= 2; n--) {
      const hit = ZH_ACTION_BY_CODE[c.slice(0, n)];
      if (hit) return hit;
    }
    return null;
  }

  function zhActionOf(e) {
    return lookupActionCode(e && e.event_code) ||
      ZH_ACTION_BY_LABEL[zhKey(parseTitleParts(e && e.title).label)] ||
      { kind: "other", v: "发生事件" };
  }

  function sameAsPlace(en, zh, placeZh) {
    if (!placeZh) return false;
    const compact = (s) => String(s || "").replace(/[，,、.（）()\s]/g, "").toLowerCase();
    const p = compact(placeZh);
    if (!p) return false;
    const z = compact(zh || zhName(en, placeZh));
    return !!(z && p.includes(z));
  }

  function composeZhPhrase(actorsEn, placeZh, action) {
    const a0 = actorsEn[0] || "";
    const a1 = actorsEn[1] || "";
    const A = a0 ? zhName(a0, placeZh) : "";
    const B = a1 ? zhName(a1, placeZh) : "";
    const AisPlace = !!(a0 && sameAsPlace(a0, A, placeZh));
    const BisPlace = !!(a1 && sameAsPlace(a1, B, placeZh));
    const left = AisPlace ? "" : A;
    const right = BisPlace ? "" : B;
    const kind = action.kind;
    const v = action.v;

    if (kind === "cooperate") {
      const onlyCompanies = (!a0 && !a1) ||
        (COMPANY_ACTORS.test(a0) && !a1) ||
        (COMPANY_ACTORS.test(a0) && COMPANY_ACTORS.test(a1));
      if (onlyCompanies && action.between) return "企业" + action.between;
      if (left && right) return left + "与" + right + "的" + (action.between ? action.between.replace(/^之间的/, "") : v.replace(/^开展/, ""));
      if (left) return left + v;
      if (right) return right + v;
      return v;
    }
    if (kind === "visit") {
      if (left && right) return left + "访问" + right;
      if (left) return left + "到访";
      if (right) return "访问" + right;
      return "到访";
    }
    if (kind === "host") {
      if (left && right) return left + "接待" + right + "来访";
      if (right) return "接待" + right + "来访";
      if (left) return left + "接待来访";
      return "接待来访";
    }
    if (kind === "demand") {
      if (left && right) return left + "向" + right + v;
      if (left) return left + v;
      if (right) return "向" + right + v;
      return v;
    }
    if (kind === "appeal") {
      if (left && right) return left + "向" + right + v;
      if (left) return left + v;
      if (right) return "向" + right + v;
      return v;
    }
    if (kind === "praise") {
      if (left && right) return left + (action.v2 || "赞赏") + right;
      if (left) return left + v;
      return v;
    }
    if (kind === "accuse") {
      if (left && right) return left + (action.v2 || "指责") + right;
      if (left) return left + v;
      if (right) return (action.v2 || "指责") + right;
      return v;
    }
    if (kind === "aid") {
      if (left && right) return left + "向" + right + v;
      if (left) return left + v;
      if (right) return "向" + right + v;
      return v;
    }
    const names = [left, right].filter(Boolean);
    if (names.length === 2) return names[0] + "与" + names[1] + v;
    if (names.length === 1) return names[0] + v;
    return v;
  }

  function zhSeismicTitle(e) {
    const mag = e.magnitude != null ? String(e.magnitude) : "";
    const place = displayPlace(e) || formatZhPlace(e.place || "");
    const m = String(e.title || "").match(/^M\s*([\d.]+)\s*[-–]\s*(.+)$/i);
    const loc = m ? formatZhPlace(m[2]) : place;
    const n = m ? m[1] : mag;
    if (loc && n) return loc + "发生 " + n + " 级地震";
    if (loc) return loc + "发生地震";
    if (n) return n + " 级地震";
    return "地震";
  }

  function displayPlace(eOrPlace) {
    const raw = typeof eOrPlace === "string" ? eOrPlace : (eOrPlace && eOrPlace.place) || "";
    if (!raw) return "";
    if (lang() !== "zh") return raw;
    return formatZhPlace(raw);
  }

  function displayTitle(e) {
    if (!e) return "";
    if (lang() !== "zh") return e.title || e.place || e.id || "";
    if (e.source === "usgs" || e.category === "seismic") return zhSeismicTitle(e);
    const place = displayPlace(e);
    const { label, actors } = parseTitleParts(e.title);
    const structured = !!(lookupActionCode(e.event_code) || ZH_ACTION_BY_LABEL[zhKey(label)] || (label && actors.length));
    if (!structured && label && !/ — /.test(e.title || "")) {
      return place ? place + " · " + label : label;
    }
    const phrase = composeZhPhrase(actors, place, zhActionOf(e));
    if (place && phrase) {
      if (phrase.includes(place)) return phrase;
      return place + " · " + phrase;
    }
    return phrase || place || e.title || "";
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

  function isFinance(e) {
    if (!e) return false;
    if (typeof e.finance === "boolean") return e.finance;
    if (e.source === "usgs" || e.category === "seismic") return false;
    if (CONFLICT_CATS.has(e.category)) return false;
    const code = String(e.event_code || "");
    if (FINANCE_BASES.some((b) => code === b || code.startsWith(b))) return true;
    if (e.category === "company" || e.category === "economy" || e.category === "sanction") {
      // Legacy snapshots often labelled Demand / Provide aid / Coerce as economy or sanctions.
      if (/^(Fight|Assault|Coerce|Threaten|Mass violence|Exhibit force|Protest|Demand|Provide aid|Reduce relations)\b/i.test(e.title || "")) return false;
      return e.category === "company";
    }
    return false;
  }

  function baseVisible() {
    return state.events.filter((e) => {
      if (!Number.isFinite(e.lat) || !Number.isFinite(e.lon)) return false;
      if (state.filter === "market") return isFinance(e);
      return true;
    });
  }

  function visibleEvents() {
    const list = baseVisible().filter((e) => !state.catFilter || e.category === state.catFilter);
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
          <div class="ei-map-empty" data-ei="map-empty" hidden></div>
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
          <span class="ei-row-title">${esc(displayTitle(e) || e.id)}</span>
          <span class="ei-row-meta"><span class="ei-chip" style="--ei-cat:${cssRgb(e.category)}">${esc(catLabel(e.category))}</span> ${esc(when.rel || when.abs)} · ${esc(e.source_name || e.source || "")}</span>
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
      <p class="ei-detail-title">${esc(displayTitle(ev) || ev.place || "")}</p>
      <dl class="ei-dl">
        <div><dt>${esc(t("place"))}</dt><dd>${esc(displayPlace(ev) || "—")}</dd></div>
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
    const items = visibleEvents();
    if (!items.length) {
      ul.innerHTML = `<li class="ei-empty">${esc(state.events.length ? t("brief_empty") : (state.status === "error" ? t("error") : t("loading")))}</li>`;
      return;
    }
    const catOrder = ["economy", "company", "sanction", "conflict", "threat", "seismic", "other"];
    const catCounts = {};
    const placeCounts = {};
    for (const e of items) {
      const cat = e.category || "other";
      catCounts[cat] = (catCounts[cat] || 0) + 1;
      const place = (e.place || "").trim();
      if (place) placeCounts[place] = (placeCounts[place] || 0) + 1;
    }
    const catLine = catOrder
      .filter((c) => catCounts[c])
      .map((c) => `${catLabel(c)} ${catCounts[c]}`)
      .join(" · ");
    const topPlaces = Object.entries(placeCounts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 4)
      .map(([name, n]) => {
          const label = displayPlace(name) || name;
          return n > 1 ? `${label} (${n})` : label;
        });
    // Notable sourced items: highest mention/source weight, at most one per place, not a list clone.
    const ranked = items.slice().sort((a, b) => {
      const wa = (Number(a.num_mentions) || 0) + (Number(a.num_sources) || 0) * 8;
      const wb = (Number(b.num_mentions) || 0) + (Number(b.num_sources) || 0) * 8;
      return wb - wa || (Number(b.time_ms) || 0) - (Number(a.time_ms) || 0);
    });
    const notable = [];
    const seenPlace = new Set();
    for (const e of ranked) {
      const key = (e.place || e.id || "").toLowerCase();
      if (seenPlace.has(key)) continue;
      seenPlace.add(key);
      notable.push(e);
      if (notable.length >= 4) break;
    }
    const notableHtml = notable.map((e) => {
      const when = formatWhen(e.time_ms);
      const place = displayPlace(e) || "—";
      let headline = displayTitle(e) || e.id || "";
      const prefix = place + " · ";
      if (place !== "—" && headline.startsWith(prefix)) headline = headline.slice(prefix.length);
      const inner = `${esc(place)} — ${esc(headline)} <span class="ei-brief-src">· ${esc(e.source_name || e.source || "")} · ${esc(when.rel || when.abs)}</span>`;
      if (e.url && /^https?:/i.test(e.url)) {
        return `<li class="ei-brief-item"><a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">${inner}</a></li>`;
      }
      return `<li class="ei-brief-item">${inner}</li>`;
    }).join("");
    ul.innerHTML = `
      <li class="ei-brief-roll">${esc(catLine)}</li>
      ${topPlaces.length ? `<li class="ei-brief-roll"><span class="ei-brief-k">${esc(t("brief_places"))}</span> ${esc(topPlaces.join(" · "))}</li>` : ""}
      <li class="ei-brief-k">${esc(t("brief_notable"))}</li>
      ${notableHtml}
    `;
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
    row.innerHTML = `<table class="ei-mkt-table"><tbody>${state.markets.map((r) => {
      const chg = Number(r.c24);
      const dir = !Number.isFinite(chg) || chg === 0 ? "flat" : chg > 0 ? "up" : "down";
      return `<tr data-dir="${dir}">
        <th scope="row">${esc(r.s)}</th>
        <td class="ei-mkt-px">${esc(formatPrice(r.p))}</td>
        <td class="ei-mkt-chg ${dir === "up" ? "is-up" : dir === "down" ? "is-down" : ""}">${esc(formatPct(r.c24))}</td>
      </tr>`;
    }).join("")}</tbody></table>`;
  }

  function paintAll() {
    paintChrome();
    paintList();
    paintDetail();
    paintBrief();
    paintMarkets();
    if (state.map) updateMapLayers();
    else paintMapEmpty(visibleEvents());
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
    const present = new Set(baseVisible().map((e) => e.category || "other"));
    const order = ["economy", "company", "sanction", "conflict", "threat", "seismic", "other"];
    const cats = order.filter((c) => present.has(c));
    if (state.catFilter && !present.has(state.catFilter)) state.catFilter = null;
    box.innerHTML = cats.map((c) =>
      `<li><button type="button" class="ei-leg${state.catFilter === c ? " is-on" : ""}" data-cat="${esc(c)}" aria-pressed="${state.catFilter === c}"><i style="background:${catHex(c)}"></i>${esc(catLabel(c))}</button></li>`
    ).join("");
    box.onclick = (ev) => {
      const btn = ev.target.closest("[data-cat]");
      if (!btn) return;
      const cat = btn.getAttribute("data-cat");
      state.catFilter = state.catFilter === cat ? null : cat;
      state.didFit = false;
      const still = visibleEvents().some((e) => e.id === state.selected);
      if (!still) state.selected = null;
      paintAll();
    };
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
      <p class="ei-pop-place">${esc(displayPlace(e) || "—")}</p>
      <p class="ei-pop-title">${esc(displayTitle(e) || e.id)}</p>
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
          <b>${esc(displayTitle(e) || e.id)}</b>
          <em class="ei-pop-where">${esc(displayPlace(e) || "—")}</em>
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
        weight: 1.25,
        opacity: 0.55,
        interactive: false
      }).addTo(state.arcLayer);
    }
    for (const g of clusterEvents(items)) {
      const head = g.items[0];
      const on = g.items.some((e) => e.id === sel);
      const weight = g.items.reduce((s, e) => s + (Number(e.num_mentions) || Number(e.magnitude) || 1), 0);
      const sized = { ...head, num_mentions: weight, magnitude: head.magnitude };
      const mark = L.marker([g.lat, g.lon], {
        icon: orbIcon(sized, { count: g.items.length, on }),
        keyboard: true,
        riseOnHover: true
      });
      if (g.items.length === 1) {
        mark.on("click", () => { select(head.id, { fly: false }); openEventPopup(head); });
      } else {
        mark.on("click", () => {
          select(head.id, { fly: false });
          openClusterPopup(g);
        });
      }
      mark.addTo(state.dotLayer);
    }
    paintMapEmpty(items);
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

  function orbIcon(e, { count = 1, on = false } = {}) {
    const r = Math.max(7.2, radiusOf(e) * (on ? 1.2 : 1) + (count > 1 ? 2.2 : 0));
    const hex = catHex(e.category);
    const clustered = count > 1;
    const size = Math.round(Math.max(clustered ? 36 : 30, r * 4.6));
    const n = clustered ? String(count) : "";
    return L.divIcon({
      className: "ei-orb-icon" + (on ? " is-on" : "") + (clustered ? " is-cluster" : ""),
      html: `<span class="ei-orb" style="--ei-cat:${hex};--ei-r:${r.toFixed(1)}px"><span class="ei-orb-bloom"></span><span class="ei-orb-halo"></span><span class="ei-orb-core">${n}</span></span>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    });
  }

  function paintMapEmpty(items) {
    const box = document.querySelector("[data-ei=map-empty]");
    if (!box) return;
    const ready = state.status === "live" || state.status === "empty" || state.events.length > 0;
    if (ready && (!items || !items.length)) {
      box.hidden = false;
      box.textContent = state.events.length ? t("empty_map") : (state.status === "error" ? t("error") : t("loading"));
    } else {
      box.hidden = true;
      box.textContent = "";
    }
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
        finance: typeof raw.finance === "boolean" ? raw.finance : null,
        event_code: raw.event_code ? String(raw.event_code) : "",
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
