export default async function handler(req, res) {
  const rssUrl =
    "https://news.google.com/rss/search?q=Gimnasia+La+Plata&hl=es-419&gl=AR&ceid=AR:es-419";

  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  });

  const SPORT_KEYWORDS = {
    futbol: [
      "gimnasia",
      "gelp",
      "lobo",
      "tripero",
      "afa",
      "torneo",
      "partido",
      "gol",
      "plantel",
      "dt"
    ],
    basquet: [
      "básquet",
      "basquet",
      "liga nacional",
      "triple",
      "tablero"
    ],
    voley: [
      "vóley",
      "voley",
      "lobas",
      "set",
      "remate"
    ]
  };

  function detectSport(text) {
    const t = text.toLowerCase();

    if (SPORT_KEYWORDS.basquet.some(k => t.includes(k))) return "basquet";
    if (SPORT_KEYWORDS.voley.some(k => t.includes(k))) return "voley";
    return "futbol";
  }

  function extractSource(link) {
    if (!link) return "Google News";

    const match = link.match(
      /(ole|eldia|infocielo|0221|cielosports|diariohoy|laplata1|lavoz|elgrafico)/i
    );

    return match ? match[1] : "Google News";
  }

  try {
    const response = await fetch(rssUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    const xml = await response.text();

    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];

    const news = items.map(i => {
      const block = i[1];

      const title =
        (block.match(/<title>(.*?)<\/title>/) || [])[1] || "";

      const link =
        (block.match(/<link>(.*?)<\/link>/) || [])[1] || "";

      const pubDate =
        (block.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || "";

      const dateOnly = new Date(pubDate).toLocaleDateString("en-CA", {
        timeZone: "America/Argentina/Buenos_Aires",
      });

      return {
        title,
        link,
        time: pubDate,
        dateOnly,
        source: extractSource(link),
        sport: detectSport(title)
      };
    });

    // FILTER: only today (Argentina time)
    const filtered = news
      .filter(n => n.dateOnly === today)
      .sort((a, b) => new Date(b.time) - new Date(a.time));

    res.status(200).json(filtered);

  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch news",
      details: error.message
    });
  }
}
