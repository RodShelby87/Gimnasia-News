export default async function handler(req, res) {
  const rssUrl =
    "https://news.google.com/rss/search?q=Gimnasia+La+Plata&hl=es-419&gl=AR&ceid=AR:es-419";

  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  });

  const SPORT_KEYWORDS = {
    futbol: ["gimnasia", "lobo", "tripero", "afa", "partido", "gol"],
    basquet: ["basquet", "básquet", "liga nacional"],
    voley: ["voley", "vóley", "lobas"]
  };

  try {
    const response = await fetch(rssUrl);
    const xml = await response.text();

    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];

    const news = items.map(i => {
      const block = i[1];

      const title = (block.match(/<title>(.*?)<\/title>/) || [])[1] || "";
      const link = (block.match(/<link>(.*?)<\/link>/) || [])[1] || "";
      const pubDate = (block.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || "";

      const dateOnly = new Date(pubDate).toLocaleDateString("en-CA", {
        timeZone: "America/Argentina/Buenos_Aires",
      });

      // fake but useful source extraction (Google News link contains publisher)
      let source = "Google News";
      const match = link.match(/(infocielo|eldia|ole|0221|cielosports|diariohoy)/i);
      if (match) source = match[1];

      // sport classification
      let sport = "futbol";
      const text = title.toLowerCase();

      if (SPORT_KEYWORDS.basquet.some(k => text.includes(k))) sport = "basquet";
      if (SPORT_KEYWORDS.voley.some(k => text.includes(k))) sport = "voley";

      return {
        title,
        link,
        time: pubDate,
        dateOnly,
        source,
        sport
      };
    });

    const filtered = news
      .filter(n => n.dateOnly === today)
      .sort((a,b)=>new Date(b.time)-new Date(a.time));

    res.status(200).json(filtered);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
