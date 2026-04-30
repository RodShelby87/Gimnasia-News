const API_HOST = "https://v3.football.api-sports.io";
const FALLBACK_TEAM_ID = 1064;
// Liga Profesional Argentina 2025
const LP_LEAGUE_ID = 128;
const LP_SEASON = 2025;

async function apiFetch(path, apiKey) {
  const resp = await fetch(`${API_HOST}${path}`, {
    method: "GET",
    headers: { "x-apisports-key": apiKey },
  });
  return resp.json();
}

async function getTeamId(apiKey) {
  if (globalThis._gimnasiaTeamId) return globalThis._gimnasiaTeamId;
  try {
    const data = await apiFetch("/teams?search=Gimnasia&country=Argentina", apiKey);
    if (data.response && data.response.length > 0) {
      let team = data.response.find(t => t.team && /la\s*plata/i.test(t.team.name));
      if (!team) team = data.response.find(
        t => t.team && /gimnasia/i.test(t.team.name) && /esgrima/i.test(t.team.name)
      );
      if (team) { globalThis._gimnasiaTeamId = team.team.id; return team.team.id; }
    }
  } catch (e) {}
  globalThis._gimnasiaTeamId = FALLBACK_TEAM_ID;
  return FALLBACK_TEAM_ID;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  const API_KEY = process.env.FOOTBALL_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: "FOOTBALL_API_KEY no configurada" });

  const now = Date.now();
  const { action } = req.query || {};

  // ══════ Standings (default) ══════
  if (!action) {
    const cacheKey = "_lp_standings";
    if (globalThis[cacheKey] && now - globalThis[cacheKey + "_time"] < 12 * 60 * 60 * 1000) {
      return res.status(200).json(globalThis[cacheKey]);
    }
    try {
      const teamId = await getTeamId(API_KEY);
      const data = await apiFetch(`/standings?league=${LP_LEAGUE_ID}&season=${LP_SEASON}`, API_KEY);

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
      return res.status(500).json({ error: "Error posiciones", details: err.message });
    }
  }

  // ══════ Next/Last match ══════
  if (action === "nextmatch") {
    try {
      const teamId = await getTeamId(API_KEY);
      const [nextData, lastData] = await Promise.all([
        apiFetch(`/fixtures?team=${teamId}&league=${LP_LEAGUE_ID}&season=${LP_SEASON}&next=1`, API_KEY),
        apiFetch(`/fixtures?team=${teamId}&league=${LP_LEAGUE_ID}&season=${LP_SEASON}&last=1`, API_KEY),
      ]);

      const fmt = (f) => f ? {
        id:     f.fixture.id,
        date:   f.fixture.date,
        status: f.fixture.status,
        venue:  f.fixture.venue?.name,
        league: f.league?.name,
        round:  f.league?.round,
        home: { name: f.teams.home.name, logo: f.teams.home.logo, goals: f.goals.home },
        away: { name: f.teams.away.name, logo: f.teams.away.logo, goals: f.goals.away },
      } : null;

      return res.status(200).json({
        nextMatch: nextData.response?.[0] ? fmt(nextData.response[0]) : null,
        lastMatch: lastData.response?.[0] ? fmt(lastData.response[0]) : null,
      });
    } catch (err) {
      return res.status(500).json({ error: "Error fixtures", details: err.message });
    }
  }

  return res.status(400).json({ error: "Acción no reconocida" });
}
