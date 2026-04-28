export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  const now = Date.now();
  if (globalThis._newsCache && now - globalThis._newsCacheTime < 10 * 60 * 1000) {
    return res.status(200).json(globalThis._newsCache);
  }

  const argNow = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" })
  );
  const todayStr = argNow.toLocaleDateString("en-CA");

  // ── Trusted La Plata portals — always keep articles from these ──
  const TRUSTED = [
    "eldia.com", "0221.com.ar", "infocielo.com", "cielosports",
    "diariohoy.net", "elclasico.com.ar", "infoplatense",
    "laredonda", "gimnasia.org"
  ];

  function isTrustedSource(source, url) {
    const s = (source || "").toLowerCase();
    const u = (url || "").toLowerCase();
    return TRUSTED.some(t => s.includes(t) || u.includes(t));
  }

  // ── Exclusion: other "Gimnasia" clubs ──
  const OTHER_CLUBS = [
    "mendoza", "jujuy", "tucumán", "tucuman", "salta",
    "concepción del uruguay", "concepcion del uruguay",
    "chivilcoy", "comodoro", "santa fe",
    "gimnasia de mendoza", "gimnasia de jujuy",
    "gimnasia de tucumán"
  ];
  const LP_MARKERS = [
    "la plata", "gelp", "bosque", "zerillo", "estancia chica",
    "tripero", "lobo platense", "albiazul", "men sana",
    "barros schelotto", "pereyra", "nacho fernández",
    "liga profesional", "copa argentina", "bosquecito"
  ];

  function isLaPlata(title, desc, source, url) {
    if (isTrustedSource(source, url)) return true;
    const text = ((title || "") + " " + (desc || "")).toLowerCase();
    const hasOther = OTHER_CLUBS.some(k => text.includes(k));
    if (!hasOther) return true;
    const hasLP = LP_MARKERS.some(k => text.includes(k));
    return hasLP;
  }

  // ── Sport detection ──
  const SPORT_KW = {
    basquet: ["básquet", "basquet", "basketball", "liga nacional de básquet",
              "triple", "tablero", "boffelli", "polideportivo", "nethol"],
    voley:   ["vóley", "voley", "volleyball", "lobas", "set point", "vogel"],
    hockey:  ["hockey", "césped", "lobizonas", "metropolitano", "palo corto"],
    esgrima: ["esgrima", "fencing", "sable", "florete", "espada"],
  };

  function detectSport(text) {
    const t = (text || "").toLowerCase();
    for (const [sport, kws] of Object.entries(SPORT_KW)) {
      if (kws.some(k => t.includes(k))) return sport;
    }
    const futbolKw = [
      "gol", "partido", "torneo", "liga profesional", "copa argentina",
      "afa", "plantel", "dt", "técnico", "refuerzo", "fichaje", "pase",
      "transferencia", "primera división", "superliga", "fecha", "arbitro",
      "penal", "offside", "director técnico", "campeonato", "eliminatoria",
      "apertura", "clausura", "playoff", "bosque", "estancia chica",
      "barros schelotto", "pereyra", "clasificación", "goleador"
    ];
    if (futbolKw.some(k => t.includes(k))) return "futbol";
    const clubKw = [
      "socios", "elecciones", "presidente", "institución", "aniversario",
      "sede", "asamblea", "balance", "cuota", "estatuto", "comisión directiva",
      "vitalicios", "marketing"
    ];
    if (clubKw.some(k => t.includes(k))) return "club";
    return "futbol";
  }

  function extractSource(block) {
    const match = block.match(/<source[^>]*>(.*?)<\/source>/);
    return match ? match[1].trim() : "Desconocido";
  }

  try {
    const rssUrl =
      "https://news.google.com/rss/search?" +
      "q=%22Gimnasia+y+Esgrima+La+Plata%22+OR+%22Gimnasia+La+Plata%22+OR+GELP" +
      "&hl=es-419&gl=AR&ceid=AR:es-419";

    const resp = await fetch(rssUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GelpNews/1.0)" },
    });

    if (!resp.ok) {
      return res.status(resp.status).json({
        error: "Google News RSS error", status: resp.status,
      });
    }

    const xml = await resp.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];

    const allArticles = items.map(i => {
      const block = i[1];
      const title = (block.match(/<title>(.*?)<\/title>/) || [])[1] || "";
      const link = (block.match(/<link>(.*?)<\/link>/) || [])[1] ||
                   (block.match(/<link\/>\s*(https?:\/\/[^\s<]+)/) || [])[1] || "";
      const pubDate = (block.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || "";
      const source = extractSource(block);

      let desc = (block.match(/<description>(.*?)<\/description>/) || [])[1] || "";
      desc = desc
        .replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, "")
        .replace(/<[^>]+>/g, "").replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
      if (desc.length > 200) desc = desc.substring(0, 200).trim() + "…";

      const cleanTitle = title.replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, "")
        .replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();

      const pubArg = new Date(
        new Date(pubDate).toLocaleString("en-US", {
          timeZone: "America/Argentina/Buenos_Aires",
        })
      );

      return {
        title: cleanTitle,
        description: desc,
        url: link.trim(),
        image: null,
        publishedAt: pubDate ? new Date(pubDate).toISOString() : "",
        dateOnly: pubArg.toLocaleDateString("en-CA"),
        source,
        sport: detectSport(cleanTitle + " " + desc),
      };
    }).filter(a => isLaPlata(a.title, a.description, a.source, a.url));

    const todayNews = allArticles
      .filter(a => a.dateOnly === todayStr)
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    const recentNews = allArticles
      .filter(a => a.dateOnly !== todayStr)
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .slice(0, 10);

    const result = { today: todayNews, recent: recentNews, todayDate: todayStr };

    globalThis._newsCache = result;
    globalThis._newsCacheTime = now;
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: "Error al obtener noticias", details: err.message });
  }
}
