export default async function handler(req, res) {
  const API_KEY = "034d49f86772190e8bd3efe1c0a5e29e";

  const query =
    '"Gimnasia La Plata" OR GELP OR "Gimnasia y Esgrima La Plata"';

  const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(
    query
  )}&lang=es&country=ar&max=50&apikey=${API_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    const articles = data.articles || [];

    const now = new Date();

    const filtered = articles
      .map((a) => {
        const published = new Date(a.publishedAt);
        const diffHours =
          (now.getTime() - published.getTime()) / (1000 * 60 * 60);

        return {
          title: a.title,
          description: a.description,
          link: a.url,
          source: a.source?.name || "Unknown",
          time: a.publishedAt,
          diffHours,
        };
      })
      // relaxed filter: last 48h instead of 24h
      .filter((a) => a.diffHours <= 48)
      .sort((a, b) => new Date(b.time) - new Date(a.time));

    return res.status(200).json(filtered);
  } catch (error) {
    return res.status(500).json({
      error: "API error",
      details: error.message,
    });
  }
}
