export default async function handler(req, res) {
  const API_KEY = "034d49f86772190e8bd3efe1c0a5e29e";

  const url = `https://gnews.io/api/v4/search?q=Argentina&lang=es&country=ar&max=10&apikey=${API_KEY}`;

  const response = await fetch(url);
  const data = await response.json();

  return res.status(200).json(data);
}
