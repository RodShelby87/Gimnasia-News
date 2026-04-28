const API_HOST = "https://v3.football.api-sports.io";
const FALLBACK_TEAM_ID = 1064;

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
  if (!API_KEY) {
    return res.status(500).json({
      error: "FOOTBALL_API_KEY no está configurada",
    });
  }

  const { action, league, season } = req.query || {};
  const now = Date.now();
  const currentYear = new Date().getFullYear();

  // ══════ ACTION: leagues ══════
  if (action === "leagues") {
    if (globalThis._leaguesCache && now - globalThis._leaguesCacheTime < 12 * 60 * 60 * 1000) {
      return res.status(200).json(globalThis._leaguesCache);
    }
    try {
      const teamId = await getTeamId(API_KEY);
      const data = await apiFetch(`/leagues?team=${teamId}&current=true`, API_KEY);

      if (data.errors && Object.keys(data.errors).length > 0) {
        return res.status(200).json({ error: "API error", debug: data.errors });
      }

      const leagues = (data.response || [])
        .map(l => {
          const latestSeason = l.seasons && l.seasons.length
            ? l.seasons[l.seasons.length - 1].year : currentYear;
          return {
            id:      l.league.id,
            name:    l.league.name,
            type:    l.league.type,
            logo:    l.league.logo,
            season:  latestSeason,
            country: l.country && l.country.name,
          };
        })
        // Filter out old seasons (more than 1 year behind current year)
        .filter(l => l.season >= currentYear - 1);

      globalThis._leaguesCache = leagues;
      globalThis._leaguesCacheTime = now;
      return res.status(200).json(leagues);
    } catch (err) {
      return res.status(500).json({ error: "Error al obtener ligas", details: err.message });
    }
  }

  // ══════ ACTION: nextmatch ══════
  if (action === "nextmatch" && league && season) {
    try {
      const teamId = await getTeamId(API_KEY);

      // Get next fixture
      const nextData = await apiFetch(
        `/fixtures?team=${teamId}&league=${league}&season=${season}&next=1`,
        API_KEY
      );
      // Get last fixture
      const lastData = await apiFetch(
        `/fixtures?team=${teamId}&league=${league}&season=${season}&last=1`,
        API_KEY
      );

      const formatFixture = (f) => {
        if (!f) return null;
        return {
          id:     f.fixture.id,
          date:   f.fixture.date,
          status: f.fixture.status,
          venue:  f.fixture.venue && f.fixture.venue.name,
          league: f.league && f.league.name,
          round:  f.league && f.league.round,
          home: {
            name: f.teams.home.name,
            logo: f.teams.home.logo,
            goals: f.goals.home,
          },
          away: {
            name: f.teams.away.name,
            logo: f.teams.away.logo,
            goals: f.goals.away,
          },
        };
      };

      const nextMatch = nextData.response && nextData.response.length > 0
        ? formatFixture(nextData.response[0]) : null;
      const lastMatch = lastData.response && lastData.response.length > 0
        ? formatFixture(lastData.response[0]) : null;

      return res.status(200).json({ nextMatch, lastMatch });
    } catch (err) {
      return res.status(500).json({ error: "Error al obtener fixtures", details: err.message });
    }
  }

  // ══════ ACTION: standings ══════
  if (league && season) {
    const cacheKey = `_standings_${league}_${season}`;
    if (globalThis[cacheKey] && now - globalThis[cacheKey + "_time"] < 2 * 60 * 60 * 1000) {
      return res.status(200).json(globalThis[cacheKey]);
    }
    try {
      const teamId = await getTeamId(API_KEY);
      const data = await apiFetch(`/standings?league=${league}&season=${season}`, API_KEY);

      if (data.errors && Object.keys(data.errors).length > 0) {
        return res.status(200).json({ error: "API error", debug: data.errors });
      }

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

  return res.status(400).json({
    error: "Parámetros faltantes. Usa ?action=leagues, ?action=nextmatch&league=ID&season=YEAR, o ?league=ID&season=YEAR",
  });
}
