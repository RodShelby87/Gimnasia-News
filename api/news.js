export default async function handler(req, res) {
  const API_KEY = "034d49f86772190e8bd3efe1c0a5e29e";

  // BROADER SEARCH (this is the key fix)
  const url = `https://gnews.io/api/v4/search?q=Gimnasia&lang=es&country=ar&max=50&apikey=${API_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    const articles = data.articles || [];

    const keywords = [
      "gimnasia",
      "gelp",
      "lobo",
      "tripero",
      "esgrima la plata"
    ];

    const now = new Date();

    const filtered = articles
      .map((a) => {
        const published = new Date(a.publishedAt);
        const diffHours = (now - published) / (1000 * 60 * 60);

        return {
          title: a.title,
          description: a.description,
          link: a.url,
          source: a.source?.name || "Unknown",
          time: a.publishedAt,
          diffHours,
          text: (a.title + " " + (a.description || "")).toLowerCase(),
        };
      })
      // filter by relevance (NOT strict name match)
      .filter((a) =>
        keywords.some((k) => a.text.includes(k))
      )
      // last 72h (more realistic)
      .filter((a) => a.diffHours <= 72)
      .sort((a, b) => new Date(b.time) - new Date(a.time));

    return res.status(200).json(filtered);
  } catch (error) {
    return res.status(500).json({
      error: error.message,
    });
  }
}
