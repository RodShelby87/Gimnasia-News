export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  // ── In-memory cache (10 min) ──
  const now = Date.now();
  if (globalThis._newsCache && now - globalThis._newsCacheTime < 10 * 60 * 1000) {
    return res.status(200).json(globalThis._newsCache);
  }

  // ── Argentina "today" (UTC-3) ──
  const argNow = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" })
  );
  const todayStr = argNow.toLocaleDateString("en-CA");

  // ── Sport keyword map ──
  const SPORT_KW = {
    basquet: ["básquet", "basquet", "basketball", "liga nacional de básquet", "triple", "tablero", "boffelli", "polideportivo"],
    voley:   ["vóley", "voley", "volleyball", "lobas", "set point", "vogel"],
    hockey:  ["hockey", "césped", "lobizonas", "metropolitano"],
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

  // ── Extract real source URL from Google News redirect ──
  function extractRealUrl(googleUrl) {
    // Google News RSS links look like: https://news.google.com/rss/articles/...
    // We return as-is; they redirect to the real article
    return googleUrl || "";
  }

  // ── Extract source name from Google News ──
  function extractSource(block) {
    const match = block.match(/<source[^>]*>(.*?)<\/source>/);
    return match ? match[1].trim() : "Desconocido";
  }

  try {
    // Google News RSS — no API key needed, excellent local coverage
    const rssUrl =
      "https://news.google.com/rss/search?" +
      "q=Gimnasia+y+Esgrima+La+Plata" +
      "&hl=es-419&gl=AR&ceid=AR:es-419";

    const resp = await fetch(rssUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GelpNews/1.0)" },
    });

    if (!resp.ok) {
      return res.status(resp.status).json({
        error: "Google News RSS respondió con error",
        status: resp.status,
      });
    }

    const xml = await resp.text();

    // Parse RSS items
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];

    const allArticles = items.map(i => {
      const block = i[1];
      const title = (block.match(/<title>(.*?)<\/title>/) || [])[1] || "";
      const link = (block.match(/<link>(.*?)<\/link>/) || [])[1] ||
                   (block.match(/<link\/>\s*(https?:\/\/[^\s<]+)/) || [])[1] || "";
      const pubDate = (block.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || "";
      const source = extractSource(block);

      // Description from RSS (often contains HTML snippet)
      let desc = (block.match(/<description>(.*?)<\/description>/) || [])[1] || "";
      // Clean HTML tags and CDATA
      desc = desc
        .replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, "")
        .replace(/<[^>]+>/g, "").replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
        .trim();
      // Often the description is just a list of related articles — limit it
      if (desc.length > 200) desc = desc.substring(0, 200).trim() + "…";

      const pubArg = new Date(
        new Date(pubDate).toLocaleString("en-US", {
          timeZone: "America/Argentina/Buenos_Aires",
        })
      );
      const dateOnly = pubArg.toLocaleDateString("en-CA");

      return {
        title: title.replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, "").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim(),
        description: desc,
        url: link.trim(),
        image: null,
        publishedAt: pubDate ? new Date(pubDate).toISOString() : "",
        dateOnly,
        source,
        sport: detectSport(title + " " + desc),
      };
    });

    // Filter today only, sort newest first
    const todayNews = allArticles
      .filter(a => a.dateOnly === todayStr)
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    const recentNews = allArticles
      .filter(a => a.dateOnly !== todayStr)
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .slice(0, 10); // keep max 10 recent

    const result = {
      today: todayNews,
      recent: recentNews,
      todayDate: todayStr,
    };

    globalThis._newsCache = result;
    globalThis._newsCacheTime = now;

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({
      error: "Error al obtener noticias",
      details: err.message,
    });
  }
}
