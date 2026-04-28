const API_HOST = "https://v3.football.api-sports.io";

// Hardcoded fallback — Gimnasia LP team ID in API-Football
const FALLBACK_TEAM_ID = 1064;

async function apiFetch(path, apiKey) {
  const resp = await fetch(`${API_HOST}${path}`, {
    method: "GET",
    headers: {
      "x-apisports-key": apiKey,
    },
  });
  return resp.json();
}

async function getTeamId(apiKey) {
  if (globalThis._gimnasiaTeamId) return globalThis._gimnasiaTeamId;

  try {
    const data = await apiFetch("/teams?search=Gimnasia&country=Argentina", apiKey);

    if (data.response && data.response.length > 0) {
      // Try to find the La Plata one specifically
      let team = data.response.find(
        t => t.team && /la\s*plata/i.test(t.team.name)
      );
      // Fallback: any "Gimnasia y Esgrima" from Argentina
      if (!team) {
        team = data.response.find(
          t => t.team && /gimnasia/i.test(t.team.name) && /esgrima/i.test(t.team.name)
        );
      }
      if (team) {
        globalThis._gimnasiaTeamId = team.team.id;
        return team.team.id;
      }
    }
  } catch (e) {
    // Fallback silently
  }

  // Use hardcoded fallback
  globalThis._gimnasiaTeamId = FALLBACK_TEAM_ID;
  return FALLBACK_TEAM_ID;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  const API_KEY = process.env.FOOTBALL_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({
      error: "FOOTBALL_API_KEY no está configurada en las variables de entorno de Vercel",
      help: "Andá a Vercel → Settings → Environment Variables y agregá FOOTBALL_API_KEY",
    });
  }

  const now = Date.now();

  // Cache check
  if (
    globalThis._matchCache &&
    now - globalThis._matchCacheTime < (globalThis._matchCacheTTL || 60000)
  ) {
    return res.status(200).json(globalThis._matchCache);
  }

  try {
    const teamId = await getTeamId(API_KEY);

    // 1. Check live fixtures
    const liveData = await apiFetch(`/fixtures?live=all&team=${teamId}`, API_KEY);

    if (liveData.errors && Object.keys(liveData.errors).length > 0) {
      return res.status(200).json({
        live: false,
        fixtures: [],
        events: [],
        debug: { teamId, errors: liveData.errors },
      });
    }

    const liveFixtures = liveData.response || [];

    if (liveFixtures.length > 0) {
      const fix = liveFixtures[0];
      const evData = await apiFetch(
        `/fixtures/events?fixture=${fix.fixture.id}`,
        API_KEY
      );

      const result = {
        live: true,
        fixture: {
          id:      fix.fixture.id,
          status:  fix.fixture.status,
          elapsed: fix.fixture.status.elapsed,
          venue:   fix.fixture.venue && fix.fixture.venue.name,
          league:  fix.league && fix.league.name,
          home: {
            id:    fix.teams.home.id,
            name:  fix.teams.home.name,
            logo:  fix.teams.home.logo,
            goals: fix.goals.home,
          },
          away: {
            id:    fix.teams.away.id,
            name:  fix.teams.away.name,
            logo:  fix.teams.away.logo,
            goals: fix.goals.away,
          },
        },
        events: (evData.response || []).map(e => ({
          time:   e.time && e.time.elapsed,
          extra:  e.time && e.time.extra,
          team:   e.team && e.team.name,
          teamId: e.team && e.team.id,
          player: e.player && e.player.name,
          assist: e.assist && e.assist.name,
          type:   e.type,
          detail: e.detail,
        })),
      };

      globalThis._matchCache = result;
      globalThis._matchCacheTime = now;
      globalThis._matchCacheTTL = 60 * 1000;
      return res.status(200).json(result);
    }

    // 2. No live match → today's fixtures
    const todayStr = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Argentina/Buenos_Aires",
    });
    const todayData = await apiFetch(
      `/fixtures?date=${todayStr}&team=${teamId}&timezone=America/Argentina/Buenos_Aires`,
      API_KEY
    );

    const fixtures = (todayData.response || []).map(f => ({
      id:     f.fixture.id,
      date:   f.fixture.date,
      status: f.fixture.status,
      venue:  f.fixture.venue && f.fixture.venue.name,
      league: f.league && f.league.name,
      home: {
        name:  f.teams.home.name,
        logo:  f.teams.home.logo,
        goals: f.goals.home,
      },
      away: {
        name:  f.teams.away.name,
        logo:  f.teams.away.logo,
        goals: f.goals.away,
      },
    }));

    const result = {
      live: false,
      fixtures,
      events: [],
      debug: { teamId, date: todayStr },
    };
    globalThis._matchCache = result;
    globalThis._matchCacheTime = now;
    globalThis._matchCacheTTL = 5 * 60 * 1000;
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({
      error: "Error al obtener partido",
      details: err.message,
      stack: err.stack,
    });
  }
}
