export default async function handler(req, res) {
  const API_KEY = "034d49f86772190e8bd3efe1c0a5e29e";

  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  });

  const query =
    '"Gimnasia La Plata" OR GELP OR "Gimnasia y Esgrima La Plata"';

  const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(
    query
  )}&lang=es&country=ar&max=50&apikey=${API_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!data.articles) {
      return res.status(200).json([]);
    }

    const filtered = data.articles
      .map((a) => {
        const publishedDate = new Date(a.publishedAt).toLocaleDateString(
          "en-CA",
          { timeZone: "America/Argentina/Buenos_Aires" }
        );

        return {
          title: a.title,
          description: a.description,
          link: a.url,
          source: a.source?.name || "Desconocido",
          time: a.publishedAt,
          dateOnly: publishedDate,
        };
      })
      // ONLY TODAY (Argentina time)
      .filter((a) => a.dateOnly === today)
      // newest first
      .sort((a, b) => new Date(b.time) - new Date(a.time));

    return res.status(200).json(filtered);
  } catch (error) {
    return res.status(500).json({
      error: "Error fetching news",
      details: error.message,
    });
  }
}
