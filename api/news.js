export default async function handler(req, res) {
  const todayAR = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  });

  const portals = [
    { name: "El Día", url: "https://www.eldia.com/seccion/gimnasia" },
    { name: "Cielosports", url: "https://www.cielosports.com/gimnasia" },
    { name: "0221", url: "https://www.0221.com.ar/gimnasia" },
    { name: "Olé", url: "https://www.ole.com.ar/gimnasia" },
  ];

  const news = [];

  for (const portal of portals) {
    try {
      const r = await fetch(portal.url);
      const html = await r.text();

      const links = [...html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/g)];

      for (const l of links) {
        const link = l[1];
        const title = l[2].replace(/<[^>]+>/g, "").trim();

        if (
          title.toLowerCase().includes("gimnasia") &&
          link.startsWith("http")
        ) {
          news.push({
            title,
            link,
            source: portal.name,
            time: todayAR,
          });
        }
      }
    } catch (e) {}
  }

  res.status(200).json(news.slice(0, 40));
}
