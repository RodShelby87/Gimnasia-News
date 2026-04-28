export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  const API_KEY = process.env.GNEWS_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: "GNEWS_API_KEY not configured" });
  }

  // ── In-memory cache (15 min) ──
  const now = Date.now();
  if (globalThis._newsCache && now - globalThis._newsCacheTime < 15 * 60 * 1000) {
    return res.status(200).json(globalThis._newsCache);
  }

  // ── Argentina "today" boundaries (UTC-3) ──
  const argNow = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" })
  );
  const todayStr = argNow.toLocaleDateString("en-CA");

  // ── Sport keyword map ──
  const SPORT_KW = {
    basquet: ["básquet", "basquet", "basketball", "liga nacional de básquet", "triple", "tablero", "cancha de basquet"],
    voley:   ["vóley", "voley", "volleyball", "lobas", "set point", "remate de voley"],
    hockey:  ["hockey", "césped", "palo de hockey", "bocha"],
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
      "superliga","fecha","arbitro","penal","offside","director técnico"
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
      `&token=${API_KEY}`;

    const resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const data = await resp.json();

    if (!data.articles) {
      return res.status(200).json([]);
    }

    const articles = data.articles
      .map(a => {
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
      })
      .filter(a => a.dateOnly === todayStr)
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    globalThis._newsCache = articles;
    globalThis._newsCacheTime = now;

    return res.status(200).json(articles);
  } catch (err) {
    return res.status(500).json({ error: "Error al obtener noticias", details: err.message });
  }
}
