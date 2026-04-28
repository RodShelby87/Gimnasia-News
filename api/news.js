export default async function handler(req, res) {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  });

  const feeds = [
    {
      name: "El Día",
      url: "https://www.eldia.com/rss/deportes.xml",
    },
    {
      name: "Olé",
      url: "https://www.ole.com.ar/rss/gimnasia-la-plata.xml",
    },
    {
      name: "0221",
      url: "https://www.0221.com.ar/rss.xml",
    },
    {
      name: "Cielosports",
      url: "https://www.cielosports.com/rss.xml",
    },
  ];

  const parseRSS = async (url) => {
    const res = await fetch(url);
    const xml = await res.text();

    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];

    return items.map((i) => {
      const block = i[1];

      const title =
        (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
          block.match(/<title>(.*?)<\/title>/))?.[1] || "";

      const link = (block.match(/<link>(.*?)<\/link>/) || [])[1] || "";

      const pubDate =
        (block.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || "";

      const description =
        (block.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) ||
          block.match(/<description>(.*?)<\/description>/))?.[1] || "";

      return {
        title,
        link,
        description,
        source: url,
        time: new Date(pubDate).toISOString(),
        dateOnly: new Date(pubDate).toLocaleDateString("en-CA", {
          timeZone: "America/Argentina/Buenos_Aires",
        }),
      };
    });
  };

  try {
    const all = await Promise.all(feeds.map((f) => parseRSS(f.url)));

    const flat = all.flat();

    const filtered = flat
      .filter((n) => n.title.toLowerCase().includes("gimnasia"))
      .filter((n) => n.dateOnly === today)
      .sort((a, b) => new Date(b.time) - new Date(a.time));

    res.status(200).json(filtered);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
