export default async function handler(req, res) {
  const rssUrl =
    "https://news.google.com/rss/search?q=Gimnasia+La+Plata&hl=es-419&gl=AR&ceid=AR:es-419";

  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  });

  const KEYWORDS = [
    "gimnasia",
    "gelp",
    "tripero",
    "bosque",
    "mens sana",
    "lobo",
    "la plata"
  ];

  try {
    const response = await fetch(rssUrl);
    const xml = await response.text();

    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];

    const news = items.map((i) => {
      const block = i[1];

      const title = (block.match(/<title>(.*?)<\/title>/) || [])[1] || "";
      const link = (block.match(/<link>(.*?)<\/link>/) || [])[1] || "";
      const pubDate = (block.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || "";

      const dateOnly = new Date(pubDate).toLocaleDateString("en-CA", {
        timeZone: "America/Argentina/Buenos_Aires",
      });

      return {
        title,
        link,
        time: pubDate,
        dateOnly
      };
    });

    const filtered = news
      .filter(n => n.dateOnly === today)
      .filter(n =>
        KEYWORDS.some(k =>
          n.title.toLowerCase().includes(k)
        )
      )
      .sort((a, b) => new Date(b.time) - new Date(a.time));

    res.status(200).json(filtered);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
