export default async function handler(req, res) {
  const feeds = [
    "https://www.ole.com.ar/rss/gimnasia-la-plata.xml",
  ];

  const result = [];

  try {
    const r = await fetch(feeds[0]);
    const text = await r.text();

    return res.status(200).json({
      length: text.length,
      sample: text.slice(0, 1000),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
