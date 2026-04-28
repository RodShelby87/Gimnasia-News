export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  const API_KEY = process.env.GNEWS_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({
      error: "GNEWS_API_KEY no está configurada",
    });
  }

  // ── In-memory cache (15 min) — skip cache if ?debug=1 ──
  const now = Date.now();
  const debugMode = req.query && req.query.debug === "1";
  if (!debugMode && globalThis._newsCache && now - globalThis._newsCacheTime < 15 * 60 * 1000) {
    return res.status(200).json(globalThis._newsCache);
  }

  // ── Argentina "today" (UTC-3) ──
  const argNow = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" })
  );
  const todayStr = argNow.toLocaleDateString("en-CA");

  // ── Sport keyword map ──
  const SPORT_KW = {
    basquet: ["básquet", "basquet", "basketball", "liga nacional de básquet", "triple", "tablero"],
    voley:   ["vóley", "voley", "volleyball", "lobas", "set point"],
    hockey:  ["hockey", "césped", "bocha"],
    esgrima: ["esgrima", "fencing", "sable", "florete", "espada"],
  };

  function detectSport(text) {
    const t = (text || "").toLowerCase();
    for (const [sport, kws] of Object.entries(SPORT_KW)) {
      if (kws.some(k => t.includes(k))) return sport;
    }
    const futbolKw = [
      "gol","partido","torneo","liga profesional",
      "copa argentina","afa","plantel","dt","técnico","refuerzo",
      "fichaje","pase","transferencia","primera división",
      "superliga","fecha","arbitro","penal","offside","director técnico",
      "campeonato","eliminatoria"
    ];
    if (futbolKw.some(k => t.includes(k))) return "futbol";
    const clubKw = [
      "socios","elecciones","presidente","institución",
      "aniversario","sede","asamblea","balance","cuota","estatuto"
    ];
    if (clubKw.some(k => t.includes(k))) return "club";
    return "futbol";
  }

  try {
    const url =
      `https://gnews.io/api/v4/search` +
      `?q=Gimnasia+La+Plata` +
      `&lang=es&country=ar&max=10&sortby=publishedAt` +
      `&apikey=${API_KEY}`;

    const resp = await fetch(url);
    const rawText = await resp.text();

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      return res.status(500).json({
        error: "GNews no devolvió JSON válido",
        rawResponse: rawText.substring(0, 500),
      });
    }

    if (!resp.ok) {
      return res.status(resp.status).json({
        error: "GNews API error",
        status: resp.status,
        details: data,
      });
    }

    if (!data.articles || data.articles.length === 0) {
      return res.status(200).json({
        articles: [],
        debug: {
          message: "GNews no devolvió artículos",
          totalArticles: data.totalArticles || 0,
          gnewsResponse: data,
          queryUsed: "Gimnasia+La+Plata",
          todayFilter: todayStr,
        },
      });
    }

    const allMapped = data.articles.map(a => {
      const pubArg = new Date(
        new Date(a.publishedAt).toLocaleString("en-US", {
          timeZone: "America/Argentina/Buenos_Aires",
        })
      );
      return {
        title:       a.title,
        description: a.description || "",
        url:         a.url,
        image:       a.image || null,
        publishedAt: a.publishedAt,
        dateOnly:    pubArg.toLocaleDateString("en-CA"),
        source:      (a.source && a.source.name) || "Desconocido",
        sport:       detectSport((a.title || "") + " " + (a.description || "")),
      };
    });

    const filtered = allMapped
      .filter(a => a.dateOnly === todayStr)
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    // If no articles pass the date filter, show debug info
    if (filtered.length === 0 && debugMode) {
      return res.status(200).json({
        articles: [],
        debug: {
          message: "GNews devolvió artículos pero ninguno es de hoy",
          todayFilter: todayStr,
          articlesReceived: allMapped.map(a => ({
            title: a.title,
            dateOnly: a.dateOnly,
            publishedAt: a.publishedAt,
          })),
        },
      });
    }

    if (filtered.length === 0) {
      return res.status(200).json([]);
    }

    globalThis._newsCache = filtered;
    globalThis._newsCacheTime = now;

    return res.status(200).json(filtered);
  } catch (err) {
    return res.status(500).json({
      error: "Error al obtener noticias",
      details: err.message,
      stack: err.stack,
    });
  }
}
