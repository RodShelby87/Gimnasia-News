const API_HOST = "https://v3.football.api-sports.io";

async function apiFetch(path, apiKey) {
  const resp = await fetch(`${API_HOST}${path}`, {
    headers: { "x-apisports-key": apiKey },
  });
  return resp.json();
}

async function getTeamId(apiKey) {
  if (globalThis._gimnasiaTeamId) return globalThis._gimnasiaTeamId;
  const data = await apiFetch("/teams?search=Gimnasia&country=Argentina", apiKey);
  const team = (data.response || []).find(
    t => t.team && /la\s*plata/i.test(t.team.name)
  );
  if (team) {
    globalThis._gimnasiaTeamId = team.team.id;
    return team.team.id;
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  const API_KEY = process.env.FOOTBALL_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: "FOOTBALL_API_KEY not configured" });
  }

  const { action, league, season } = req.query || {};
  const now = Date.now();

  // ── ACTION: list current leagues ──
  if (action === "leagues") {
    if (
      globalThis._leaguesCache &&
      now - globalThis._leaguesCacheTime < 24 * 60 * 60 * 1000
    ) {
      return res.status(200).json(globalThis._leaguesCache);
    }
    try {
      const teamId = await getTeamId(API_KEY);
      if (!teamId) return res.status(200).json([]);

      const data = await apiFetch(
        `/leagues?team=${teamId}&current=true`,
        API_KEY
      );
      const leagues = (data.response || []).map(l => ({
        id:      l.league.id,
        name:    l.league.name,
        type:    l.league.type,
        logo:    l.league.logo,
        season:  l.seasons && l.seasons.length
                   ? l.seasons[l.seasons.length - 1].year
                   : new Date().getFullYear(),
        country: l.country && l.country.name,
      }));

      globalThis._leaguesCache = leagues;
      globalThis._leaguesCacheTime = now;
      return res.status(200).json(leagues);
    } catch (err) {
      return res
        .status(500)
        .json({ error: "Error al obtener ligas", details: err.message });
    }
  }

  // ── ACTION: get standings for a league ──
  if (league && season) {
    const cacheKey = `_standings_${league}_${season}`;
    if (
      globalThis[cacheKey] &&
      now - globalThis[cacheKey + "_time"] < 2 * 60 * 60 * 1000
    ) {
      return res.status(200).json(globalThis[cacheKey]);
    }
    try {
      const teamId = await getTeamId(API_KEY);
      const data = await apiFetch(
        `/standings?league=${league}&season=${season}`,
        API_KEY
      );
      const resp = data.response || [];
      let standings = [];
      if (resp.length > 0 && resp[0].league && resp[0].league.standings) {
        standings = resp[0].league.standings.map(group =>
          group.map(row => ({
            rank:         row.rank,
            teamId:       row.team.id,
            teamName:     row.team.name,
            teamLogo:     row.team.logo,
            points:       row.points,
            played:       row.all.played,
            win:          row.all.win,
            draw:         row.all.draw,
            lose:         row.all.lose,
            goalsFor:     row.all.goals.for,
            goalsAgainst: row.all.goals.against,
            goalDiff:     row.goalsDiff,
            form:         row.form,
            isGimnasia:   row.team.id === teamId,
          }))
        );
      }
      globalThis[cacheKey] = standings;
      globalThis[cacheKey + "_time"] = now;
      return res.status(200).json(standings);
    } catch (err) {
      return res
        .status(500)
        .json({ error: "Error al obtener posiciones", details: err.message });
    }
  }

  return res.status(400).json({
    error:
      "Parámetros faltantes. Usa ?action=leagues o ?league=ID&season=YEAR",
  });
}
