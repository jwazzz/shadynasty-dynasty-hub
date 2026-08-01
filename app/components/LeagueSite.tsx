"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

type SheetState = {
  rows: string[][];
  rookieRows: number[];
  fetchedAt: string;
  loading: boolean;
  error: string;
};

type DraftPick = {
  round: string;
  pick: string;
  team: string;
  selection: string;
};

type Standing = {
  place: string;
  team: string;
  record: string;
  pointsFor: string;
  pointsAgainst: string;
};

type SeasonBlock = {
  year: string;
  standings: Standing[];
};

type TeamSummary = {
  owner: string;
  teamName: string;
  updated: string;
  roster: RosterPlayer[];
  positions: PositionCount[];
  picks2026: string[];
  picks2027: string[];
  picks2025: PickHistory[];
  trades: TeamTrade[];
};

type RosterPlayer = {
  player: string;
  pos: string;
  nflTeam: string;
  points: string;
  age: string;
  rank: string;
  isRookie?: boolean;
};

type AllRosterPlayer = RosterPlayer & {
  owner: string;
  rowIndex: number;
  adp: string;
};

type RosterRanking = {
  owner: string;
  def: string;
  flex: string;
  kicker: string;
  qb: string;
  rb: string;
  te: string;
  wr: string;
  posPlayers: string;
};

type CutRequirement = {
  owner: string;
  cuts: number;
};

type PositionCount = {
  pos: string;
  count: string;
};

type PickHistory = {
  pick: string;
  player: string;
};

type TradeSide = {
  assets: string;
  to: string;
  time: string;
};

type Trade = {
  id: string;
  time: string;
  sides: TradeSide[];
  teams: string[];
};

type OwnerTradeCount = {
  owner: string;
  total: number;
};

type TeamTrade = {
  year: string;
  give: string;
  receive: string;
  withTeam: string;
};

const TEAM_TABS = [
  { key: "team-craig", owner: "Craig", alias: "Craig" },
  { key: "team-danny", owner: "Danny", alias: "Danny" },
  { key: "team-dj", owner: "DJ", alias: "DJ" },
  { key: "team-eddie", owner: "Eddie", alias: "Eddie" },
  { key: "team-evan", owner: "Evan", alias: "Evan" },
  { key: "team-jeremy", owner: "Jeremy", alias: "Jeremy" },
  { key: "team-joe-c", owner: "Joe C", alias: "Corrado" },
  { key: "team-joe-f", owner: "Joe F", alias: "Ferraro" },
  { key: "team-joe-h", owner: "Joe H", alias: "Hack" },
  { key: "team-john", owner: "John", alias: "John" },
] as const;

const ROSTER_POSITIONS = ["All", "QB", "RB", "WR", "TE", "DEF", "K"] as const;

const TRADE_OWNER_FILTERS = [
  { owner: "Craig", tokens: ["Craig"] },
  { owner: "Danny", tokens: ["Danny", "Dannys", "Turd Ferguson"] },
  { owner: "DJ", tokens: ["DJ", "All Hail Houston", "Ma'Homies"] },
  { owner: "Eddie", tokens: ["Eddie", "I Know You Want Me"] },
  { owner: "Evan", tokens: ["Evan", "Evans", "Flowers For Evan"] },
  { owner: "Jeremy", tokens: ["Jeremy", "Jwaz", "Mongorians", "MilkWasABadChoice", "BYE Week"] },
  { owner: "Joe C", tokens: ["Joe C", "Corrado", "London Has Fallen"] },
  { owner: "Joe F", tokens: ["Joe F", "Ferraro", "Super Happy Fun Time"] },
  { owner: "Joe H", tokens: ["Joe H", "Hack", "High Rollers"] },
  { owner: "John", tokens: ["John", "Johns Grand Team", "Luck My Chubb"] },
] as const;

const TRADE_GROUP_COLUMN_INDEX = 27;
const WEEK_ONE_KICKOFF_ISO = "2026-09-09T20:20:00-04:00";
const CUT_DEADLINE_ISO = "2026-08-24T23:59:00-04:00";

const CUT_REQUIREMENTS: CutRequirement[] = [
  { owner: "Craig", cuts: 4 },
  { owner: "Danny", cuts: 5 },
  { owner: "DJ", cuts: 10 },
  { owner: "Eddie", cuts: 9 },
  { owner: "Evan", cuts: 3 },
  { owner: "Jeremy", cuts: 4 },
  { owner: "Ferraro", cuts: 4 },
  { owner: "Corrado", cuts: 4 },
  { owner: "Hack", cuts: 4 },
  { owner: "John", cuts: 1 },
];

const OWNER_ALIASES = [
  { owner: "Craig", aliases: ["Craig"] },
  { owner: "Danny", aliases: ["Danny"] },
  { owner: "DJ", aliases: ["DJ"] },
  { owner: "Eddie", aliases: ["Eddie"] },
  { owner: "Evan", aliases: ["Evan"] },
  { owner: "Jeremy", aliases: ["Jeremy"] },
  { owner: "Ferraro", aliases: ["Ferraro", "Joe F"] },
  { owner: "Corrado", aliases: ["Corrado", "Joe C"] },
  { owner: "Hack", aliases: ["Hack", "Joe H"] },
  { owner: "John", aliases: ["John"] },
];

const EMPTY_SHEET: SheetState = {
  rows: [],
  rookieRows: [],
  fetchedAt: "",
  loading: true,
  error: "",
};

function useSheet(tabKey: string, intervalMs = 0) {
  const [sheet, setSheet] = useState<SheetState>(EMPTY_SHEET);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setInterval> | undefined;

    async function loadSheet(showLoading: boolean) {
      if (showLoading) {
        setSheet((current) => ({ ...current, loading: true, error: "" }));
      }

      try {
        const response = await fetch(`/api/sheet?tab=${tabKey}&ts=${Date.now()}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Sheet request failed: ${response.status}`);
        }

        const payload = (await response.json()) as {
          rows: string[][];
          rookieRows?: number[];
          fetchedAt: string;
        };

        if (active) {
          setSheet({
            rows: payload.rows,
            rookieRows: payload.rookieRows ?? [],
            fetchedAt: payload.fetchedAt,
            loading: false,
            error: "",
          });
        }
      } catch (error) {
        if (active) {
          setSheet((current) => ({
            ...current,
            loading: false,
            error: error instanceof Error ? error.message : "Unable to load sheet.",
          }));
        }
      }
    }

    loadSheet(true);

    if (intervalMs > 0) {
      timer = setInterval(() => loadSheet(false), intervalMs);
    }

    return () => {
      active = false;
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [tabKey, intervalMs]);

  return sheet;
}

function useAllTeamNames() {
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;

    Promise.all(
      TEAM_TABS.map(async (team) => {
        try {
          const response = await fetch(`/api/sheet?tab=${team.key}`, { cache: "no-store" });
          if (!response.ok) {
            return [team.key, ""] as const;
          }

          const payload = (await response.json()) as { rows: string[][] };
          return [team.key, findValueAfterLabel(payload.rows, "Team Name")] as const;
        } catch {
          return [team.key, ""] as const;
        }
      }),
    ).then((entries) => {
      if (active) {
        setNames(Object.fromEntries(entries.filter(([, name]) => name)));
      }
    });

    return () => {
      active = false;
    };
  }, []);

  return names;
}

function normalize(value: string | undefined) {
  return (value ?? "").trim();
}

function parseNumber(value: string | undefined) {
  return Number((value ?? "").replace(/,/g, "")) || 0;
}

function formatRosterValue(value: string | undefined) {
  const clean = normalize(value);

  if (!clean) {
    return "";
  }

  const normalizedNumber = clean.replace(/,/g, "");

  if (/^-?\d+(\.\d+)?$/.test(normalizedNumber)) {
    return String(Number(normalizedNumber));
  }

  return clean;
}

function getPositiveSortValue(value: string | undefined) {
  const number = parseNumber(value);

  return number > 0 ? number : Number.POSITIVE_INFINITY;
}

function compareRosterByAdp(a: AllRosterPlayer, b: AllRosterPlayer) {
  const adpDifference = getPositiveSortValue(a.adp) - getPositiveSortValue(b.adp);

  if (adpDifference !== 0) {
    return adpDifference;
  }

  const rankDifference = getPositiveSortValue(a.rank) - getPositiveSortValue(b.rank);

  if (rankDifference !== 0) {
    return rankDifference;
  }

  return a.player.localeCompare(b.player);
}

function normalizeSearch(value: string | undefined) {
  return normalize(value)
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalOwner(owner: string | undefined) {
  const normalizedOwner = normalizeSearch(owner);
  const match = OWNER_ALIASES.find((entry) =>
    entry.aliases.some((alias) => normalizeSearch(alias) === normalizedOwner),
  );

  return match?.owner ?? normalize(owner);
}

function getCutRequirement(owner: string | undefined) {
  const canonical = canonicalOwner(owner);

  return CUT_REQUIREMENTS.find((entry) => entry.owner === canonical)?.cuts ?? 0;
}

function getCountdownParts(targetIso: string, now: number) {
  const totalSeconds = Math.max(0, Math.floor((new Date(targetIso).getTime() - now) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    days,
    hours,
    minutes,
    seconds,
    complete: totalSeconds === 0,
  };
}

function useCountdown(targetIso: string) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);

    return () => clearInterval(timer);
  }, []);

  return getCountdownParts(targetIso, now);
}

function containsSearchToken(value: string, token: string) {
  const haystack = ` ${normalizeSearch(value)} `;
  const needle = ` ${normalizeSearch(token)} `;

  return needle.trim() ? haystack.includes(needle) : false;
}

function formatFetchTime(iso: string) {
  if (!iso) {
    return "syncing";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(iso));
}

function findValueAfterLabel(rows: string[][], label: string) {
  const target = label.toLowerCase().replace(/:$/, "");

  for (const row of rows) {
    const index = row.findIndex(
      (cell) => normalize(cell).toLowerCase().replace(/:$/, "") === target,
    );

    if (index >= 0) {
      return normalize(row[index + 1]);
    }
  }

  return "";
}

function parseDraft(rows: string[][]): DraftPick[] {
  const picks: DraftPick[] = [];
  let currentRound = "";

  rows.forEach((row) => {
    const firstCell = normalize(row[0]);

    if (/^ROUND\s+\d+/i.test(firstCell)) {
      currentRound = firstCell.replace(/\s+/g, " ");
      return;
    }

    if (firstCell === "Draft Pick" || !firstCell) {
      return;
    }

    const team = normalize(row[1]);

    if (!team) {
      return;
    }

    picks.push({
      round: currentRound || "Draft",
      pick: firstCell,
      team,
      selection: normalize(row[2]),
    });
  });

  return picks;
}

function getDraftPickKey(pick: DraftPick) {
  return `${pick.round}-${pick.pick}-${pick.team}`;
}

// The owning team of a pick, without trade notes like "DJ (f/ Craig)".
function draftPickTeam(team: string) {
  return team.split("(")[0].trim();
}

function getCurrentDraftPickKey(picks: DraftPick[]) {
  const currentPick = picks.find((pick) => !pick.selection);

  return currentPick ? getDraftPickKey(currentPick) : "";
}

function getDraftPickStatus(pick: DraftPick, currentPickKey: string) {
  if (pick.selection) {
    return pick.selection;
  }

  return getDraftPickKey(pick) === currentPickKey ? "On the clock" : "TBD";
}

function getDraftPickClass(pick: DraftPick, currentPickKey: string) {
  if (pick.selection) {
    return "is-selected";
  }

  return getDraftPickKey(pick) === currentPickKey ? "is-open" : "is-pending";
}

function parseResults(rows: string[][]) {
  const yearRow = rows[1] ?? [];
  const seasons: SeasonBlock[] = [];

  for (let start = 0; start < yearRow.length; start += 5) {
    const year = normalize(yearRow[start]);

    if (!/^\d{4}$/.test(year)) {
      continue;
    }

    const standings = rows
      .slice(3, 13)
      .map((row) => ({
        place: normalize(row[start]),
        team: normalize(row[start + 1]),
        record: normalize(row[start + 2]),
        pointsFor: normalize(row[start + 3]),
        pointsAgainst: normalize(row[start + 4]),
      }))
      .filter((standing) => standing.place && standing.team);

    seasons.push({ year, standings });
  }

  const allTimeHeader = rows.findIndex(
    (row) =>
      normalize(row[0]) === "Team" &&
      normalize(row[1]) === "2025" &&
      row.some((cell) => normalize(cell) === "Total"),
  );

  const allTime = allTimeHeader >= 0
    ? rows
        .slice(allTimeHeader + 1, allTimeHeader + 11)
        .map((row) => ({
          team: normalize(row[0]),
          record: normalize(row[12]),
        }))
        .filter((record) => record.team && record.record)
    : [];

  const decadeStart = rows.findIndex(
    (row) => normalize(row[0]) === "All Decade Team - Leaderboard",
  );

  const decade = decadeStart >= 0
    ? rows
        .slice(decadeStart + 2, decadeStart + 12)
        .map((row) => ({
          team: normalize(row[0]),
          total: normalize(row[6]),
          points: parseNumber(row[6]),
        }))
        .filter((entry) => entry.team && entry.total)
    : [];

  return {
    seasons,
    latestSeason: seasons[0],
    allTime,
    decade,
  };
}

function parseTrades(rows: string[][]) {
  const tradeSides: Array<TradeSide & { groupKey: string }> = [];

  rows.slice(1).forEach((row) => {
    const side = {
      assets: normalize(row[0]),
      to: normalize(row[2]),
      time: normalize(row[3]),
    };

    if (!side.assets || !side.to || !side.time) {
      return;
    }

    tradeSides.push({
      ...side,
      groupKey:
        normalize(row[TRADE_GROUP_COLUMN_INDEX]) ||
        `trade-${Math.floor(tradeSides.length / 2)}`,
    });
  });

  const groupedTrades = new Map<string, Trade>();

  tradeSides.forEach(({ groupKey, ...side }) => {
    const id = `${groupKey}-${side.time}`;
    const currentTrade = groupedTrades.get(id) ?? {
      id,
      time: side.time,
      sides: [],
      teams: [],
    };

    currentTrade.sides.push(side);

    if (!currentTrade.teams.some((team) => normalizeSearch(team) === normalizeSearch(side.to))) {
      currentTrade.teams.push(side.to);
    }

    groupedTrades.set(id, currentTrade);
  });

  const trades = Array.from(groupedTrades.values());

  const ownerHeaderIndex = rows.findIndex((row) =>
    row.some((cell) => normalize(cell) === "Owners"),
  );
  const ownerHeader = rows[ownerHeaderIndex] ?? [];
  const ownerColumn = ownerHeader.findIndex((cell) => normalize(cell) === "Owners");

  const ownerCounts: OwnerTradeCount[] = ownerColumn >= 0
    ? rows
        .slice(ownerHeaderIndex + 1)
        .map((row) => ({
          owner: normalize(row[ownerColumn]),
          total: parseNumber(row[ownerColumn + 12]),
        }))
        .filter((row) => row.owner && row.owner !== "Grand Total" && row.total > 0)
        .sort((a, b) => b.total - a.total)
    : [];

  return {
    allTrades: trades.slice().reverse(),
    latestTrades: tradeSides
      .slice(-12)
      .map(({ groupKey, ...side }) => side)
      .reverse(),
    totalTrades: trades.length,
    ownerCounts,
  };
}

function parsePositionCounts(rows: string[][]) {
  const allowedPositions = new Set(["QB", "RB", "WR", "TE", "DEF", "K", "Total"]);
  const positionsHeaderIndex = rows.findIndex((row) =>
    row.some((cell) => normalize(cell) === "Positions"),
  );
  const rosterBreakdownIndex = rows.findIndex((row) =>
    row.some((cell) => normalize(cell) === "Roster Breakdown"),
  );

  const headerIndex = positionsHeaderIndex >= 0 ? positionsHeaderIndex : rosterBreakdownIndex;
  const label = positionsHeaderIndex >= 0 ? "Positions" : "Roster Breakdown";
  const positionsColumn = rows[headerIndex]?.findIndex((cell) => normalize(cell) === label) ?? -1;

  return positionsColumn >= 0
    ? rows
        .slice(headerIndex + 1, headerIndex + 10)
        .map((row) => ({
          pos: normalize(row[positionsColumn]),
          count: normalize(row[positionsColumn + 1]),
        }))
        .filter((row) => allowedPositions.has(row.pos))
    : [];
}

function tradeMatchesOwner(trade: Trade, owner: string) {
  const filter = TRADE_OWNER_FILTERS.find((entry) => entry.owner === owner);

  if (!filter) {
    return false;
  }

  return filter.tokens.some((token) =>
    trade.sides.some((side) => containsSearchToken(side.to, token)),
  );
}

function parseTeam(rows: string[][], fallbackOwner: string): TeamSummary {
  const owner = findValueAfterLabel(rows, "Owner") || fallbackOwner;
  const teamName = findValueAfterLabel(rows, "Team Name") || `${owner}'s team`;
  const updated = rows.flat().find((cell) => normalize(cell).startsWith("Updated")) ?? "";
  const rosterHeaderIndex = rows.findIndex((row) =>
    row.some(
      (cell, index) => normalize(cell) === "Player" && normalize(row[index + 1]) === "Pos",
    ),
  );
  const rosterHeader = rows[rosterHeaderIndex] ?? [];
  const rosterColumn = rosterHeader.findIndex(
    (cell, index) => normalize(cell) === "Player" && normalize(rosterHeader[index + 1]) === "Pos",
  );
  // Side tables (draft picks, then a Year/Give trades table) sit to the RIGHT
  // of the roster in later columns, some starting partway down the roster rows.
  // The trades boundary only bounds those right-hand columns, not the roster.
  const tradeHeaderIndex = rows.findIndex((row) =>
    row.some(
      (cell, index) => normalize(cell) === "Year" && normalize(row[index + 1]) === "Give",
    ),
  );
  const sideTableEndIndex =
    tradeHeaderIndex > rosterHeaderIndex ? tradeHeaderIndex : rows.length;
  const rosterRows =
    rosterHeaderIndex >= 0 ? rows.slice(rosterHeaderIndex + 1, sideTableEndIndex) : [];
  const picks2026Column = rosterHeader.findIndex((cell) => normalize(cell) === "2026");
  const picks2027Column = rosterHeader.findIndex((cell) => normalize(cell) === "2027");
  const picks2025Column = rosterHeader.findIndex((cell) => normalize(cell) === "2025");

  // The roster is the contiguous block of player rows below the header. Read it
  // until the first blank Player row (which separates the current roster from
  // the historical rosters further down), so every player is listed, no cap.
  const roster: {
    player: string;
    pos: string;
    nflTeam: string;
    points: string;
    age: string;
    rank: string;
  }[] = [];
  if (rosterHeaderIndex >= 0) {
    for (let index = rosterHeaderIndex + 1; index < rows.length; index += 1) {
      const row = rows[index] ?? [];
      const player = normalize(row[rosterColumn]);
      const pos = normalize(row[rosterColumn + 1]);
      if (!player || !pos) break;
      roster.push({
        player,
        pos,
        nflTeam: normalize(row[rosterColumn + 2]),
        points: normalize(row[rosterColumn + 3]),
        age: normalize(row[rosterColumn + 4]),
        rank: normalize(row[rosterColumn + 5]),
      });
    }
  }

  const positions = parsePositionCounts(rows);

  const collectPickColumn = (columnIndex: number) =>
    columnIndex >= 0
      ? rosterRows
          .map((row) => normalize(row[columnIndex]))
          .filter(Boolean)
          .slice(0, 8)
      : [];

  const picks2025 = picks2025Column >= 0
    ? rosterRows
        .map((row) => ({
          pick: normalize(row[picks2025Column]),
          player: normalize(row[picks2025Column + 1]),
        }))
        .filter((pick) => pick.pick || pick.player)
        .slice(0, 6)
    : [];

  const tradeColumn = rows[tradeHeaderIndex]?.findIndex(
    (cell, index) => normalize(cell) === "Year" && normalize(rows[tradeHeaderIndex]?.[index + 1]) === "Give",
  ) ?? -1;

  const trades = tradeHeaderIndex >= 0 && tradeColumn >= 0
    ? rows
        .slice(tradeHeaderIndex + 1)
        .map((row) => ({
          year: normalize(row[tradeColumn]),
          give: normalize(row[tradeColumn + 1]),
          receive: normalize(row[tradeColumn + 2]),
          withTeam: normalize(row[tradeColumn + 3]),
        }))
        .filter((trade) => trade.year && trade.give && trade.receive)
        .slice(0, 6)
    : [];

  return {
    owner,
    teamName,
    updated,
    roster,
    positions,
    picks2026: collectPickColumn(picks2026Column),
    picks2027: collectPickColumn(picks2027Column),
    picks2025,
    trades,
  };
}

type FreeAgent = {
  player: string;
  pos: string;
  team: string;
  points: string;
};

function parseFreeAgents(rows: string[][]): FreeAgent[] {
  const headerIndex = rows.findIndex((row) =>
    row.some(
      (cell, index) => normalize(cell) === "Player" && normalize(row[index + 1]) === "Pos",
    ),
  );
  if (headerIndex < 0) {
    return [];
  }
  const header = rows[headerIndex];
  const playerColumn = header.findIndex(
    (cell, index) => normalize(cell) === "Player" && normalize(header[index + 1]) === "Pos",
  );

  return rows
    .slice(headerIndex + 1)
    .map((row) => ({
      player: normalize(row[playerColumn]),
      // Uppercase so filters match and stray spacing (e.g. "K ") is ignored.
      pos: normalize(row[playerColumn + 1]).toUpperCase(),
      team: normalize(row[playerColumn + 2]),
      points: normalize(row[playerColumn + 3]),
    }))
    .filter((agent) => agent.player && agent.pos);
}

function parseAllRosterRows(rows: string[][], rookieRows: number[]): AllRosterPlayer[] {
  const rookieRowSet = new Set(rookieRows);

  return rows
    .map((row, rowIndex) => {
      const pos = normalize(row[2]).toUpperCase();
      const rawAge = normalize(row[5]);
      const rawRank = normalize(row[6]);
      const rawAdp = normalize(row[7]);
      const defenseAdpOnly = pos === "DEF" && rawAge && rawAge !== "-" && !rawRank && !rawAdp;

      return {
        owner: canonicalOwner(row[0]),
        player: normalize(row[1]),
        pos,
        nflTeam: normalize(row[3]),
        points: normalize(row[4]),
        age: pos === "DEF" ? "-" : rawAge,
        rank: rawRank,
        adp: defenseAdpOnly ? rawAge : rawAdp,
        rowIndex,
        isRookie: rookieRowSet.has(rowIndex),
      };
    })
    .filter((player) => player.rowIndex > 1 && player.owner && player.player && player.pos);
}

function parseRosterRankings(rows: string[][]): RosterRanking[] {
  const headerIndex = rows.findIndex(
    (row) =>
      normalize(row[9]) === "Teams" &&
      normalize(row[10]) === "DEF" &&
      normalize(row[17]) === "Pos Players ONLY",
  );

  if (headerIndex < 0) {
    return [];
  }

  return rows
    .slice(headerIndex + 1, headerIndex + 11)
    .map((row) => ({
      owner: canonicalOwner(row[9]),
      def: normalize(row[10]),
      flex: normalize(row[11]),
      kicker: normalize(row[12]),
      qb: normalize(row[13]),
      rb: normalize(row[14]),
      te: normalize(row[15]),
      wr: normalize(row[16]),
      posPlayers: normalize(row[17]),
    }))
    .filter((ranking) => ranking.owner);
}

function getRosterOwnerSummaries(players: AllRosterPlayer[]) {
  return CUT_REQUIREMENTS.map((cut) => {
    const ownerPlayers = players.filter((player) => player.owner === cut.owner);
    const ages = ownerPlayers.map((player) => parseNumber(player.age)).filter(Boolean);
    const rookieCount = ownerPlayers.filter((player) => player.isRookie).length;
    const top100 = ownerPlayers.filter((player) => {
      const rank = parseNumber(player.rank);

      return rank > 0 && rank <= 100;
    }).length;

    return {
      ...cut,
      rosterCount: ownerPlayers.length,
      rookieCount,
      top100,
      averageAge: ages.length
        ? ages.reduce((total, age) => total + age, 0) / ages.length
        : 0,
    };
  });
}

function getRookiePlayerKeys(players: AllRosterPlayer[]) {
  return new Set(
    players
      .filter((player) => player.isRookie)
      .map((player) => `${player.owner}::${normalizeSearch(player.player)}`),
  );
}

function markTeamRookies(team: TeamSummary, rookieKeys: Set<string>): TeamSummary {
  const owner = canonicalOwner(team.owner);

  return {
    ...team,
    roster: team.roster.map((player) => ({
      ...player,
      isRookie: rookieKeys.has(`${owner}::${normalizeSearch(player.player)}`),
    })),
  };
}

function groupDraftByRound(picks: DraftPick[]) {
  return picks.reduce<Record<string, DraftPick[]>>((groups, pick) => {
    groups[pick.round] ??= [];
    groups[pick.round].push(pick);
    return groups;
  }, {});
}

function getOwnerTab(key: string) {
  return TEAM_TABS.find((team) => team.key === key) ?? TEAM_TABS[5];
}

const NAV_LINKS = [
  { href: "/", label: "Home", id: "home" },
  { href: "/draft", label: "Draft", id: "draft" },
  { href: "/rosters", label: "All Rosters", id: "rosters" },
  { href: "/results", label: "League History", id: "results" },
  { href: "/trades", label: "All Trades", id: "trades" },
  { href: "/teams", label: "Teams", id: "teams" },
  { href: "/free-agents", label: "Free Agents", id: "free-agents" },
] as const;

function useParallaxMotion() {
  useEffect(() => {
    const root = document.documentElement;

    const onPointerMove = (event: PointerEvent) => {
      const x = ((event.clientX / window.innerWidth) - 0.5) * 28;
      const y = ((event.clientY / window.innerHeight) - 0.5) * 28;
      root.style.setProperty("--mx", x.toFixed(2));
      root.style.setProperty("--my", y.toFixed(2));
    };

    const onScroll = () => {
      root.style.setProperty("--scroll-y", window.scrollY.toFixed(0));
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
}

function PageChrome({
  active,
  children,
}: {
  active: (typeof NAV_LINKS)[number]["id"];
  children: ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <main className="dynasty-site">
      <div className="field-grid" aria-hidden="true" />
      <div className="page-shell">
        <header className="site-nav">
          <a className="brand-logo" href="/" aria-label="Shadynasty home">
            <img className="site-logo-image" src="/shadynasty-logo.png" alt="" />
          </a>
          <button
            aria-controls="primary-navigation"
            aria-expanded={mobileNavOpen}
            aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
            className={`menu-toggle ${mobileNavOpen ? "is-open" : ""}`}
            onClick={() => setMobileNavOpen((isOpen) => !isOpen)}
            type="button"
          >
            <span />
            <span />
            <span />
          </button>
          <nav
            aria-label="Primary"
            className={mobileNavOpen ? "is-open" : ""}
            id="primary-navigation"
          >
            {NAV_LINKS.map((link) => (
              <a
                className={link.id === active ? "active" : ""}
                href={link.href}
                key={link.id}
                onClick={() => setMobileNavOpen(false)}
              >
                {link.label}
              </a>
            ))}
          </nav>
        </header>
        {children}
      </div>
    </main>
  );
}

function CountdownCard({ compact = false }: { compact?: boolean }) {
  const countdown = useCountdown(WEEK_ONE_KICKOFF_ISO);
  const countdownParts = [
    { label: "Days", value: countdown.days },
    { label: "Hours", value: countdown.hours },
    { label: "Min", value: countdown.minutes },
    { label: "Sec", value: countdown.seconds },
  ];

  return (
    <article className={`countdown-card ${compact ? "is-compact" : ""}`}>
      <div className="panel-title">
        <span>Week 1 kickoff</span>
        <h3>Patriots at Seahawks</h3>
      </div>
      <div className="countdown-grid" aria-label="Countdown to NFL Week 1 kickoff">
        {countdownParts.map((part) => (
          <div key={part.label}>
            <strong>{String(part.value).padStart(2, "0")}</strong>
            <span>{part.label}</span>
          </div>
        ))}
      </div>
      <p>Sept. 9, 2026 at 8:20 PM ET</p>
    </article>
  );
}

function CutTracker({ players = [] }: { players?: AllRosterPlayer[] }) {
  const cutCountdown = useCountdown(CUT_DEADLINE_ISO);
  const summaries = useMemo(() => getRosterOwnerSummaries(players), [players]);
  const maxCuts = Math.max(...CUT_REQUIREMENTS.map((entry) => entry.cuts), 1);
  const totalCuts = CUT_REQUIREMENTS.reduce((total, entry) => total + entry.cuts, 0);

  return (
    <section className="cut-tracker" aria-labelledby="cut-tracker-title">
      <div className="cut-header">
        <div>
          <p className="eyebrow">Cuts due Aug. 24</p>
          <h3 id="cut-tracker-title">Cut Tracker</h3>
        </div>
        <div className="cut-clock">
          <span>{cutCountdown.days}</span>
          <small>days left</small>
        </div>
        <div className="cut-total">
          <span>{totalCuts}</span>
          <small>total cuts</small>
        </div>
      </div>
      <div className="cut-grid">
        {summaries.map((summary) => (
          <article
            className={`cut-card ${summary.cuts >= 8 ? "is-critical" : ""}`}
            key={summary.owner}
          >
            <div>
              <span>{summary.owner}</span>
              <strong>{summary.cuts}</strong>
            </div>
            <div className="cut-meter" aria-hidden="true">
              <span style={{ width: `${(summary.cuts / maxCuts) * 100}%` }} />
            </div>
            <small>
              {summary.rosterCount ? `${summary.rosterCount} rostered` : "syncing"}
              {summary.rookieCount ? ` / ${summary.rookieCount} highlighted` : ""}
            </small>
          </article>
        ))}
      </div>
    </section>
  );
}

export function HomePage() {
  const rosterSheet = useSheet("all-rosters");
  const rosterPlayers = useMemo(
    () => parseAllRosterRows(rosterSheet.rows, rosterSheet.rookieRows),
    [rosterSheet.rows, rosterSheet.rookieRows],
  );

  useParallaxMotion();

  return (
    <PageChrome active="home">
      <section className="hero-section route-hero home-hero" id="top">
        <div className="hero-copy">
          <h1 className="home-title">League Hub</h1>
          <p className="home-lede">
            Everything you ever need to know is just below.
          </p>
        </div>
        <div className="home-hero-countdown">
          <CountdownCard compact />
        </div>
      </section>

      <section className="section-band hub-band">
        <div className="hub-grid">
          <a className="hub-card" href="/draft">
            <span>Draft board</span>
            <strong>Draft</strong>
            <small>The final 2026 draft board.</small>
          </a>
          <a className="hub-card" href="/rosters">
            <span>Age and rankings</span>
            <strong>All Rosters</strong>
            <small>Ranks, ages, cuts, and rookies.</small>
          </a>
          <a className="hub-card" href="/teams">
            <span>Team rooms</span>
            <strong>Teams</strong>
            <small>Every current owner tab.</small>
          </a>
          <a className="hub-card" href="/free-agents">
            <span>Free agency</span>
            <strong>Free Agents</strong>
            <small>Search the 2025 available pool.</small>
          </a>
          <a className="hub-card" href="/trades">
            <span>Market</span>
            <strong>All Trades</strong>
            <small>Search the full ledger by team.</small>
          </a>
          <a className="hub-card" href="/results">
            <span>Archive</span>
            <strong>League History</strong>
            <small>Season records and all-time leaders.</small>
          </a>
        </div>
      </section>

      <section className="home-dashboard" aria-label="League cuts">
        <CutTracker players={rosterPlayers} />
      </section>
    </PageChrome>
  );
}

export function DraftPage() {
  // Draft is locked/final, so fetch once instead of polling live.
  const draftSheet = useSheet("draft");
  const draftPicks = useMemo(() => parseDraft(draftSheet.rows), [draftSheet.rows]);
  const draftTeams = useMemo(() => {
    const seen: string[] = [];
    draftPicks.forEach((pick) => {
      const team = draftPickTeam(pick.team);
      if (team && !seen.includes(team)) {
        seen.push(team);
      }
    });
    return seen.sort((a, b) => a.localeCompare(b));
  }, [draftPicks]);
  const roundCount = useMemo(
    () => Object.keys(groupDraftByRound(draftPicks)).length,
    [draftPicks],
  );

  const [teamFilter, setTeamFilter] = useState("All");
  const visiblePicks = useMemo(
    () =>
      teamFilter === "All"
        ? draftPicks
        : draftPicks.filter((pick) => draftPickTeam(pick.team) === teamFilter),
    [draftPicks, teamFilter],
  );
  const draftGroups = useMemo(() => groupDraftByRound(visiblePicks), [visiblePicks]);

  useParallaxMotion();

  return (
    <PageChrome active="draft">
      <section className="section-band route-section draft-band" id="draft">
        <div className="section-heading">
          <p className="eyebrow">Draft board</p>
          <h2>Draft</h2>
        </div>
        <div className="draft-status-bar">
          <div>
            <span>Status</span>
            <strong>Final</strong>
          </div>
          <div>
            <span>Picks</span>
            <strong>{draftPicks.length || "..."}</strong>
          </div>
          <div>
            <span>Rounds</span>
            <strong>{roundCount || "..."}</strong>
          </div>
          <div>
            <span>Teams</span>
            <strong>{draftTeams.length || "..."}</strong>
          </div>
        </div>
        <div
          className="position-filter"
          role="tablist"
          aria-label="Filter draft by team"
        >
          <button
            aria-pressed={teamFilter === "All"}
            className={teamFilter === "All" ? "active" : ""}
            onClick={() => setTeamFilter("All")}
            type="button"
          >
            All
          </button>
          {draftTeams.map((team) => (
            <button
              aria-pressed={teamFilter === team}
              className={teamFilter === team ? "active" : ""}
              key={team}
              onClick={() => setTeamFilter(team)}
              type="button"
            >
              {team}
            </button>
          ))}
        </div>
        {draftSheet.error ? (
          <StatusMessage label="Draft feed unavailable" detail={draftSheet.error} />
        ) : (
          <div className="draft-rounds">
            {Object.entries(draftGroups).map(([round, picks]) => (
              <article className="round-panel" key={round}>
                <h3>{round}</h3>
                <div className="pick-list">
                  {picks.map((pick) => (
                    <div className="pick-row is-selected" key={getDraftPickKey(pick)}>
                      <span className="pick-number">{pick.pick}</span>
                      <strong>{pick.team}</strong>
                      <span>{pick.selection || "TBD"}</span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
            {draftSheet.loading && !draftPicks.length && (
              <StatusMessage label="Loading draft board" detail="Pulling the 2026 Draft tab." />
            )}
            {!draftSheet.loading && visiblePicks.length === 0 && (
              <p className="roster-empty">No picks for {teamFilter}.</p>
            )}
          </div>
        )}
      </section>
    </PageChrome>
  );
}

export function RostersPage() {
  const [selectedOwner, setSelectedOwner] = useState("All");
  const [selectedPosition, setSelectedPosition] = useState("All");
  const [rosterQuery, setRosterQuery] = useState("");
  const [rookiesOnly, setRookiesOnly] = useState(false);
  const teamNames = useAllTeamNames();
  const rosterSheet = useSheet("all-rosters", 60000);
  const players = useMemo(
    () => parseAllRosterRows(rosterSheet.rows, rosterSheet.rookieRows),
    [rosterSheet.rows, rosterSheet.rookieRows],
  );
  const rankings = useMemo(() => parseRosterRankings(rosterSheet.rows), [rosterSheet.rows]);
  const ownerSummaries = useMemo(() => getRosterOwnerSummaries(players), [players]);
  const positions = useMemo(
    () => Array.from(new Set(players.map((player) => player.pos))).filter(Boolean).sort(),
    [players],
  );
  const positionOptions = useMemo(
    () => ROSTER_POSITIONS.filter((position) => position === "All" || positions.includes(position)),
    [positions],
  );
  const filteredPlayers = useMemo(() => {
    const query = normalizeSearch(rosterQuery);

    const filtered = players.filter((player) => {
      const searchable = [
        player.owner,
        player.player,
        player.pos,
        player.nflTeam,
        player.age,
        player.rank,
        player.adp,
      ].join(" ");
      const matchesQuery = !query || normalizeSearch(searchable).includes(query);
      const matchesOwner = selectedOwner === "All" || player.owner === selectedOwner;
      const matchesPosition = selectedPosition === "All" || player.pos === selectedPosition;
      const matchesRookie = !rookiesOnly || player.isRookie;

      return matchesQuery && matchesOwner && matchesPosition && matchesRookie;
    });

    return filtered.slice().sort(compareRosterByAdp);
  }, [players, rookiesOnly, rosterQuery, selectedOwner, selectedPosition]);
  const rookieCount = players.filter((player) => player.isRookie).length;
  const averageAge = players.length
    ? players.reduce((total, player) => total + parseNumber(player.age), 0) / players.length
    : 0;
  const top100Count = players.filter((player) => {
    const rank = parseNumber(player.rank);

    return rank > 0 && rank <= 100;
  }).length;

  const handleRosterJump = (targetId: string) => {
    if (typeof window === "undefined") {
      return;
    }

    const target = document.getElementById(targetId);
    if (!target) {
      return;
    }

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    const root = document.documentElement;
    const previousBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    target.scrollIntoView({ block: "start" });
    root.style.scrollBehavior = previousBehavior;
    window.history.replaceState(null, "", `#${targetId}`);
  };

  useParallaxMotion();

  return (
    <PageChrome active="rosters" status={`Age rankings sync ${formatFetchTime(rosterSheet.fetchedAt)}`}>
      <section className="section-band route-section roster-command-band" id="rosters">
        <div className="roster-hero-grid">
          <div className="section-heading">
            <p className="eyebrow">All rosters</p>
            <h2>All Rosters: Age & Rankings</h2>
            <p>
              Ages, 2026 positional ranks, superflex ADP, owner filters, and
              the sheet-highlighted rookie tags in one board.
            </p>
          </div>
          <CountdownCard compact />
        </div>

        <CutTracker players={players} />

        <div className="roster-stat-strip">
          <div>
            <span>Players loaded</span>
            <strong>{players.length || "..."}</strong>
          </div>
          <div>
            <span>Highlighted rookies</span>
            <strong>{rookieCount || "..."}</strong>
          </div>
          <div>
            <span>Average age</span>
            <strong>{averageAge ? averageAge.toFixed(1) : "..."}</strong>
          </div>
          <div>
            <span>Top 100 ranks</span>
            <strong>{top100Count || "..."}</strong>
          </div>
        </div>

        <div className="roster-controls">
          <label className="trade-search roster-search">
            <span>Search</span>
            <input
              aria-label="Search all rosters"
              onChange={(event) => setRosterQuery(event.target.value)}
              placeholder="Player, owner, NFL team"
              type="search"
              value={rosterQuery}
            />
          </label>
          <label className="rookie-toggle">
            <input
              checked={rookiesOnly}
              onChange={(event) => setRookiesOnly(event.target.checked)}
              type="checkbox"
            />
            <span>Rookies</span>
          </label>
        </div>

        <nav className="roster-jump-nav" aria-label="All rosters sections">
          <button onClick={() => handleRosterJump("all-roster-list")} type="button">
            Players
          </button>
          <button onClick={() => handleRosterJump("position-strength")} type="button">
            Position Strength
          </button>
          <button onClick={() => handleRosterJump("age-depth")} type="button">
            Age & Depth
          </button>
        </nav>

        <div className="team-switcher all-roster-owner-tabs" role="tablist" aria-label="Owner filters">
          <button
            aria-selected={selectedOwner === "All"}
            className={selectedOwner === "All" ? "active" : ""}
            onClick={() => setSelectedOwner("All")}
            role="tab"
            type="button"
          >
            <span>All</span>
            <small>{players.length || "..."} players</small>
          </button>
          {TEAM_TABS.map((team) => {
            const owner = team.alias;
            const ownerCount = players.filter((player) => player.owner === owner).length;

            return (
              <button
                aria-selected={selectedOwner === owner}
                className={selectedOwner === owner ? "active" : ""}
                key={team.key}
                onClick={() => setSelectedOwner(owner)}
                role="tab"
                type="button"
              >
                <span>{owner}</span>
                <small>{teamNames[team.key] || `${ownerCount || "..."} players`}</small>
              </button>
            );
          })}
        </div>

        <div className="roster-board-layout">
          <article className="all-roster-panel" id="all-roster-list">
            <div className="panel-title">
              <span>{filteredPlayers.length} shown</span>
              <h3>{selectedOwner === "All" ? "All Players" : `${selectedOwner} Roster`}</h3>
            </div>
            <div
              className="position-filter roster-position-filter"
              role="tablist"
              aria-label="Filter all rosters by position"
            >
              {positionOptions.map((position) => (
                <button
                  aria-pressed={selectedPosition === position}
                  className={selectedPosition === position ? "active" : ""}
                  key={position}
                  onClick={() => setSelectedPosition(position)}
                  type="button"
                >
                  {position}
                </button>
              ))}
            </div>
            <div className="roster-table all-roster-table">
              {filteredPlayers.map((player) => {
                const age = formatRosterValue(player.age);
                const adp = formatRosterValue(player.adp);
                const points = formatRosterValue(player.points);
                const rank = formatRosterValue(player.rank);

                return (
                  <div
                    className={`roster-row all-roster-row ${player.isRookie ? "is-rookie" : ""}`}
                    key={`${player.rowIndex}-${player.owner}-${player.player}`}
                  >
                    <strong>
                      {player.player}
                      {player.isRookie && <em>Rookie</em>}
                    </strong>
                    <span>{player.pos}</span>
                    <span>{player.nflTeam || "-"}</span>
                    <span>{rank ? `#${rank}` : "-"}</span>
                    <small className="all-roster-meta">
                      <span>Age {age || "-"}</span>
                      <span>ADP {adp || "-"}</span>
                      <span>Pts {points || "-"}</span>
                    </small>
                  </div>
                );
              })}
            </div>
            {!rosterSheet.loading && filteredPlayers.length === 0 && (
              <StatusMessage label="No players found" detail="Try another owner, position, or search." />
            )}
          </article>

          <aside className="roster-side-panels">
            <article className="ranking-panel" id="position-strength">
              <div className="panel-title">
                <span>Sheet ranks</span>
                <h3>Position Strength</h3>
              </div>
              <div className="ranking-list">
                {rankings.map((ranking) => (
                  <div className="ranking-row" key={ranking.owner}>
                    <strong>{ranking.owner}</strong>
                    <span>QB {ranking.qb}</span>
                    <span>RB {ranking.rb}</span>
                    <span>WR {ranking.wr}</span>
                    <span>TE {ranking.te}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="ranking-panel" id="age-depth">
              <div className="panel-title">
                <span>Owner snapshot</span>
                <h3>Age and Depth</h3>
              </div>
              <div className="owner-summary-list">
                {ownerSummaries.map((summary) => (
                  <div className="owner-summary-row" key={summary.owner}>
                    <strong>{summary.owner}</strong>
                    <span>{summary.rosterCount || "-"} players</span>
                    <span>{summary.averageAge ? summary.averageAge.toFixed(1) : "-"} avg age</span>
                    <span>{summary.top100} top 100</span>
                  </div>
                ))}
              </div>
            </article>
          </aside>
        </div>
        {rosterSheet.error && (
          <StatusMessage label="Rosters feed unavailable" detail={rosterSheet.error} />
        )}
        {rosterSheet.loading && !players.length && (
          <StatusMessage label="Loading rosters" detail="Pulling the All Rosters - Age & 2026 Rankings tab." />
        )}
      </section>
    </PageChrome>
  );
}

export function ResultsPage() {
  const resultsSheet = useSheet("results");
  const results = useMemo(() => parseResults(resultsSheet.rows), [resultsSheet.rows]);
  const [selectedYear, setSelectedYear] = useState("");
  const activeSeason =
    results.seasons.find((season) => season.year === selectedYear) ?? results.latestSeason;

  useParallaxMotion();

  return (
    <PageChrome active="results">
      <section className="section-band route-section results-band" id="results">
        <div className="section-heading">
          <p className="eyebrow">Archive</p>
          <h2>League History</h2>
        </div>
        <div className="results-layout">
          <article className="leaderboard-panel">
            <div className="panel-title">
              <span>All time</span>
              <h3>All-Time Records</h3>
            </div>
            <div className="mini-list">
              {results.allTime.slice(0, 10).map((entry, index) => (
                <div className="mini-row" key={entry.team}>
                  <span>{index + 1}</span>
                  <strong>{entry.team}</strong>
                  <small>{entry.record}</small>
                </div>
              ))}
            </div>
          </article>
          <article className="leaderboard-panel decade-panel">
            <div className="panel-title">
              <span>2021-2025</span>
              <h3>All Decade Points Race</h3>
            </div>
            <div className="bar-list">
              {results.decade.map((entry) => {
                const max = Math.max(...results.decade.map((item) => item.points), 1);
                return (
                  <div className="bar-row" key={entry.team}>
                    <div>
                      <strong>{entry.team}</strong>
                      <span>{entry.total}</span>
                    </div>
                    <div className="bar-track">
                      <span style={{ width: `${(entry.points / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
          <article className="standings-panel">
            <div className="panel-title">
              <span>Season</span>
              <h3>{activeSeason?.year ?? ""} League Standings</h3>
            </div>
            <div
              className="year-filter"
              role="tablist"
              aria-label="Choose a season"
            >
              {results.seasons.map((season) => (
                <button
                  aria-pressed={activeSeason?.year === season.year}
                  className={activeSeason?.year === season.year ? "active" : ""}
                  key={season.year}
                  onClick={() => setSelectedYear(season.year)}
                  type="button"
                >
                  {season.year}
                </button>
              ))}
            </div>
            <div className="standings-table">
              {(activeSeason?.standings ?? []).map((standing) => (
                <div className="standing-row" key={`${standing.place}-${standing.team}`}>
                  <span>{standing.place}</span>
                  <strong>{standing.team}</strong>
                  <span>{standing.record}</span>
                  <span>{standing.pointsFor}</span>
                </div>
              ))}
            </div>
          </article>
        </div>
        {resultsSheet.error && (
          <StatusMessage label="Results feed unavailable" detail={resultsSheet.error} />
        )}
      </section>
    </PageChrome>
  );
}

export function TradesPage() {
  const [selectedOwners, setSelectedOwners] = useState<string[]>([]);
  const [tradeQuery, setTradeQuery] = useState("");
  const tradesSheet = useSheet("trades");
  const trades = useMemo(() => parseTrades(tradesSheet.rows), [tradesSheet.rows]);
  const filteredTrades = useMemo(() => {
    const searchQuery = normalizeSearch(tradeQuery);

    return trades.allTrades.filter((trade) => {
      const searchableTrade = [
        trade.time,
        ...trade.teams,
        ...trade.sides.flatMap((side) => [side.assets, side.to]),
      ].join(" ");
      const matchesSearch = !searchQuery || normalizeSearch(searchableTrade).includes(searchQuery);
      const matchesOwners =
        selectedOwners.length === 0 ||
        selectedOwners.every((owner) => tradeMatchesOwner(trade, owner));

      return matchesSearch && matchesOwners;
    });
  }, [selectedOwners, tradeQuery, trades.allTrades]);
  const activeTradeLabel = selectedOwners.length ? selectedOwners.join(" + ") : "All Teams";

  const toggleOwner = (owner: string) => {
    setSelectedOwners((currentOwners) =>
      currentOwners.includes(owner)
        ? currentOwners.filter((currentOwner) => currentOwner !== owner)
        : [...currentOwners, owner],
    );
  };

  useParallaxMotion();

  return (
    <PageChrome active="trades">
      <section className="section-band route-section trades-band" id="trades">
        <div className="section-heading">
          <p className="eyebrow">Market</p>
          <h2>All Trades</h2>
        </div>
        <div className="trade-controls">
          <label className="trade-search">
            <span>Search</span>
            <input
              aria-label="Search all trades"
              onChange={(event) => setTradeQuery(event.target.value)}
              placeholder="Player, pick, owner, season"
              type="search"
              value={tradeQuery}
            />
          </label>
          <div className="owner-filter-bar" aria-label="Team filters">
            <button
              className={selectedOwners.length === 0 ? "active" : ""}
              onClick={() => setSelectedOwners([])}
              type="button"
            >
              All
            </button>
            {TRADE_OWNER_FILTERS.map((filter) => (
              <button
                aria-pressed={selectedOwners.includes(filter.owner)}
                className={selectedOwners.includes(filter.owner) ? "active" : ""}
                key={filter.owner}
                onClick={() => toggleOwner(filter.owner)}
                type="button"
              >
                {filter.owner}
              </button>
            ))}
          </div>
        </div>
        <div className="trade-layout">
          <article className="trade-feed">
            <div className="panel-title">
              <span>{filteredTrades.length} of {trades.totalTrades || "..."} shown</span>
              <h3>{activeTradeLabel}</h3>
            </div>
            <div className="trade-list">
              {filteredTrades.map((trade) => (
                <article className="trade-group" key={trade.id}>
                  <div className="trade-group-title">
                    <span>{trade.time}</span>
                    <strong>{trade.teams.join(" / ")}</strong>
                  </div>
                  <div className="trade-sides">
                    {trade.sides.map((side, index) => (
                      <div className="trade-side-row" key={`${trade.id}-${side.to}-${index}`}>
                        <strong>{side.assets}</strong>
                        <small>To {side.to}</small>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
            {!tradesSheet.loading && filteredTrades.length === 0 && (
              <StatusMessage label="No trades found" detail="Try a different search or team filter." />
            )}
          </article>
          <article className="trade-counts">
            <div className="panel-title">
              <span>Activity</span>
              <h3>Owner Totals</h3>
            </div>
            <div className="bar-list">
              {trades.ownerCounts.slice(0, 10).map((entry) => {
                const max = Math.max(...trades.ownerCounts.map((item) => item.total), 1);
                return (
                  <div className="bar-row" key={entry.owner}>
                    <div>
                      <strong>{entry.owner}</strong>
                      <span>{entry.total}</span>
                    </div>
                    <div className="bar-track trade-track">
                      <span style={{ width: `${(entry.total / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        </div>
        {tradesSheet.error && (
          <StatusMessage label="Trades feed unavailable" detail={tradesSheet.error} />
        )}
      </section>
    </PageChrome>
  );
}

export function TeamsPage() {
  const [activeTeamKey, setActiveTeamKey] = useState("team-jeremy");
  const activeTeamTab = getOwnerTab(activeTeamKey);
  const activeTeamSheet = useSheet(activeTeamKey, 30000);
  const teamNames = useAllTeamNames();
  const rosterSheet = useSheet("all-rosters", 60000);
  const rosterPlayers = useMemo(
    () => parseAllRosterRows(rosterSheet.rows, rosterSheet.rookieRows),
    [rosterSheet.rows, rosterSheet.rookieRows],
  );
  const rookiePlayerKeys = useMemo(() => getRookiePlayerKeys(rosterPlayers), [rosterPlayers]);
  const activeTeam = useMemo(
    () => markTeamRookies(parseTeam(activeTeamSheet.rows, activeTeamTab.owner), rookiePlayerKeys),
    [activeTeamSheet.rows, activeTeamTab.owner, rookiePlayerKeys],
  );
  const activeCutCount = getCutRequirement(activeTeam.owner || activeTeamTab.owner);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [positionFilter, setPositionFilter] =
    useState<(typeof ROSTER_POSITIONS)[number]>("All");
  const filteredRoster =
    positionFilter === "All"
      ? activeTeam.roster
      : activeTeam.roster.filter(
          (player) => player.pos.toUpperCase() === positionFilter,
        );

  useParallaxMotion();

  const handleSelectTeam = (key: string) => {
    setActiveTeamKey(key);
    // On mobile the dashboard sits below the tab grid, so a tap looks like
    // nothing happened. Scroll it into view past the list of team names.
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 820px)").matches) {
      // Blur the tapped tab first: a focused button keeps the browser
      // scrolling it back into view, which fights the scroll below.
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      requestAnimationFrame(() => {
        const el = dashboardRef.current;
        if (!el) return;
        // Smooth scrolling is unreliable on this page (parallax transforms on
        // ancestor elements), so force an instant jump to the dashboard.
        const root = document.documentElement;
        const previousBehavior = root.style.scrollBehavior;
        root.style.scrollBehavior = "auto";
        el.scrollIntoView({ block: "start" });
        root.style.scrollBehavior = previousBehavior;
      });
    }
  };

  return (
    <PageChrome active="teams">
      <section className="section-band route-section teams-band" id="teams">
        <div className="section-heading">
          <p className="eyebrow">Rosters</p>
          <h2>Teams</h2>
        </div>

        <div className="team-switcher" role="tablist" aria-label="Team tabs">
          {TEAM_TABS.map((team) => (
            <button
              aria-selected={team.key === activeTeamKey}
              className={team.key === activeTeamKey ? "active" : ""}
              key={team.key}
              onClick={() => handleSelectTeam(team.key)}
              role="tab"
              type="button"
            >
              <span>{team.owner}</span>
              <small>{teamNames[team.key] || team.owner}</small>
            </button>
          ))}
        </div>

        <div className="team-dashboard" ref={dashboardRef}>
          <article className="team-identity">
            <span className="team-updated">{activeTeam.updated || "Sheet sync"}</span>
            <h3>{activeTeam.teamName}</h3>
            <p>{activeTeam.owner}</p>
            <div className="team-cut-summary">
              <span>Aug. 24 cuts</span>
              <strong>{activeCutCount}</strong>
            </div>
            <div className="position-grid">
              {activeTeam.positions.map((position) => (
                <div key={`${position.pos}-${position.count}`}>
                  <span>{position.pos}</span>
                  <strong>{position.count}</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="roster-panel">
            <div className="panel-title">
              <span>{filteredRoster.filter((player) => player.isRookie).length} highlighted</span>
              <h3>Current roster</h3>
            </div>
            <div
              className="position-filter"
              role="tablist"
              aria-label="Filter roster by position"
            >
              {ROSTER_POSITIONS.map((position) => (
                <button
                  aria-pressed={positionFilter === position}
                  className={positionFilter === position ? "active" : ""}
                  key={position}
                  onClick={() => setPositionFilter(position)}
                  type="button"
                >
                  {position}
                </button>
              ))}
            </div>
            <div className="roster-table">
              {filteredRoster.map((player) => (
                <div
                  className={`roster-row ${player.isRookie ? "is-rookie" : ""}`}
                  key={`${player.player}-${player.pos}`}
                >
                  <strong>
                    {player.player}
                    {player.isRookie && <em>Rookie</em>}
                  </strong>
                  <span>{player.pos}</span>
                  <span>{player.nflTeam}</span>
                  <span>{player.points || "-"}</span>
                  <small>Age {player.age || "-"}</small>
                </div>
              ))}
              {filteredRoster.length === 0 && (
                <p className="roster-empty">No {positionFilter} on this roster.</p>
              )}
            </div>
          </article>

          <article className="picks-panel">
            <div className="panel-title">
              <span>Draft capital</span>
              <h3>Upcoming picks</h3>
            </div>
            <div className="pick-columns">
              <div>
                <h4>2026</h4>
                {activeTeam.picks2026.map((pick) => (
                  <span key={`2026-${pick}`}>{pick}</span>
                ))}
              </div>
              <div>
                <h4>2027</h4>
                {activeTeam.picks2027.map((pick) => (
                  <span key={`2027-${pick}`}>{pick}</span>
                ))}
              </div>
            </div>
            <div className="history-picks">
              <h4>2025 selections</h4>
              {activeTeam.picks2025.map((pick) => (
                <div key={`${pick.pick}-${pick.player}`}>
                  <span>{pick.pick}</span>
                  <strong>{pick.player}</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="team-trades-panel">
            <div className="panel-title">
              <span>Team ledger</span>
              <h3>Recent trades</h3>
            </div>
            <div className="team-trade-list">
              {activeTeam.trades.map((trade) => (
                <div className="team-trade-row" key={`${trade.year}-${trade.give}`}>
                  <span>{trade.year}</span>
                  <strong>{trade.receive}</strong>
                  <small>Sent {trade.give}</small>
                </div>
              ))}
            </div>
          </article>
        </div>
        {activeTeamSheet.error && (
          <StatusMessage label={`${activeTeamTab.owner} feed unavailable`} detail={activeTeamSheet.error} />
        )}
      </section>
    </PageChrome>
  );
}

export function FreeAgentsPage() {
  const freeAgentsSheet = useSheet("free-agents", 30000);
  const freeAgents = useMemo(
    () => parseFreeAgents(freeAgentsSheet.rows),
    [freeAgentsSheet.rows],
  );

  const [query, setQuery] = useState("");
  const [positionFilter, setPositionFilter] =
    useState<(typeof ROSTER_POSITIONS)[number]>("All");
  const [sortKey, setSortKey] = useState<"player" | "pos" | "team" | "points">("points");
  const [sortAscending, setSortAscending] = useState(false);

  useParallaxMotion();

  const visibleAgents = useMemo(() => {
    const search = normalizeSearch(query);
    const filtered = freeAgents.filter((agent) => {
      const matchesPosition = positionFilter === "All" || agent.pos === positionFilter;
      const matchesSearch =
        !search ||
        normalizeSearch(`${agent.player} ${agent.team} ${agent.pos}`).includes(search);
      return matchesPosition && matchesSearch;
    });

    return [...filtered].sort((a, b) => {
      const comparison =
        sortKey === "points"
          ? parseNumber(a.points) - parseNumber(b.points)
          : a[sortKey].localeCompare(b[sortKey]);
      return sortAscending ? comparison : -comparison;
    });
  }, [freeAgents, query, positionFilter, sortKey, sortAscending]);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortAscending((current) => !current);
      return;
    }
    setSortKey(key);
    // Points default high to low; text columns default A to Z.
    setSortAscending(key !== "points");
  };

  const sortIndicator = (key: typeof sortKey) =>
    sortKey === key ? (sortAscending ? " ▲" : " ▼") : "";

  return (
    <PageChrome active="free-agents">
      <section className="section-band route-section free-agents-band" id="free-agents">
        <div className="section-heading">
          <p className="eyebrow">Free agency</p>
          <h2>2025 Free Agents</h2>
        </div>

        <div className="fa-controls">
          <label className="trade-search">
            <span>Search</span>
            <input
              aria-label="Search free agents"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Player or team"
              type="search"
              value={query}
            />
          </label>
          <div
            className="position-filter"
            role="tablist"
            aria-label="Filter free agents by position"
          >
            {ROSTER_POSITIONS.map((position) => (
              <button
                aria-pressed={positionFilter === position}
                className={positionFilter === position ? "active" : ""}
                key={position}
                onClick={() => setPositionFilter(position)}
                type="button"
              >
                {position}
              </button>
            ))}
          </div>
        </div>

        <article className="fa-panel">
          <div className="panel-title">
            <span>{visibleAgents.length} shown</span>
            <h3>Available players</h3>
          </div>
          <div className="fa-table">
            <div className="fa-head">
              <button onClick={() => toggleSort("player")} type="button">
                Player{sortIndicator("player")}
              </button>
              <button onClick={() => toggleSort("pos")} type="button">
                Pos{sortIndicator("pos")}
              </button>
              <button onClick={() => toggleSort("team")} type="button">
                Team{sortIndicator("team")}
              </button>
              <button onClick={() => toggleSort("points")} type="button">
                Pts{sortIndicator("points")}
              </button>
            </div>
            {visibleAgents.map((agent) => (
              <div className="fa-row" key={`${agent.player}-${agent.pos}-${agent.team}`}>
                <strong>{agent.player}</strong>
                <span>{agent.pos}</span>
                <span>{agent.team}</span>
                <span>{agent.points || "-"}</span>
              </div>
            ))}
            {visibleAgents.length === 0 && (
              <p className="roster-empty">No free agents match.</p>
            )}
          </div>
        </article>
        {freeAgentsSheet.error && (
          <StatusMessage label="Free agents feed unavailable" detail={freeAgentsSheet.error} />
        )}
      </section>
    </PageChrome>
  );
}

export function LeagueSite() {
  const draftSheet = useSheet("draft", 10000);
  const resultsSheet = useSheet("results");
  const tradesSheet = useSheet("trades");
  const [activeTeamKey, setActiveTeamKey] = useState("team-jeremy");
  const activeTeamTab = getOwnerTab(activeTeamKey);
  const activeTeamSheet = useSheet(activeTeamKey);

  useEffect(() => {
    const root = document.documentElement;

    const onPointerMove = (event: PointerEvent) => {
      const x = ((event.clientX / window.innerWidth) - 0.5) * 28;
      const y = ((event.clientY / window.innerHeight) - 0.5) * 28;
      root.style.setProperty("--mx", x.toFixed(2));
      root.style.setProperty("--my", y.toFixed(2));
    };

    const onScroll = () => {
      root.style.setProperty("--scroll-y", window.scrollY.toFixed(0));
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const draftPicks = useMemo(() => parseDraft(draftSheet.rows), [draftSheet.rows]);
  const draftGroups = useMemo(() => groupDraftByRound(draftPicks), [draftPicks]);
  const results = useMemo(() => parseResults(resultsSheet.rows), [resultsSheet.rows]);
  const trades = useMemo(() => parseTrades(tradesSheet.rows), [tradesSheet.rows]);
  const activeTeam = useMemo(
    () => parseTeam(activeTeamSheet.rows, activeTeamTab.owner),
    [activeTeamSheet.rows, activeTeamTab.owner],
  );

  const openPicks = draftPicks.filter((pick) => !pick.selection).length;
  const selectedPicks = draftPicks.length - openPicks;
  const currentDraftPickKey = getCurrentDraftPickKey(draftPicks);

  return (
    <main className="dynasty-site">
      <div className="field-grid" aria-hidden="true" />
      <div className="page-shell">
        <header className="site-nav">
          <a className="brand-logo" href="#top" aria-label="Shadynasty home">
            <img className="site-logo-image" src="/shadynasty-logo.png" alt="" />
          </a>
          <nav aria-label="Primary">
            <a href="#draft">Draft</a>
            <a href="#results">League History</a>
            <a href="#trades">All Trades</a>
            <a href="#teams">Teams</a>
          </nav>
          <div className="nav-status">
            <span className="pulse-dot" />
            Draft sync {formatFetchTime(draftSheet.fetchedAt)}
          </div>
        </header>

        <section className="hero-section" id="top">
          <div className="hero-copy">
            <p className="eyebrow">Dynasty league command center</p>
            <h1>Shadynasty</h1>
            <p className="hero-lede">
              A live draft board, league history, trade heat, and every roster
              in one cinematic league hub.
            </p>
            <div className="hero-actions" aria-label="Quick links">
              <a href="#draft">Enter draft room</a>
              <a href="#teams">View teams</a>
            </div>
          </div>

          <div className="hero-stage" aria-label="2026 draft snapshot">
            <img className="hero-art" src="/og.png" alt="" aria-hidden="true" />
            <div className="tilt-card tilt-card-back">
              <span>League Results</span>
              <strong>{results.latestSeason?.standings[0]?.team ?? "Loading"}</strong>
              <small>latest champion pace</small>
            </div>
            <div className="tilt-card tilt-card-mid">
              <span>Trade Market</span>
              <strong>{trades.totalTrades || "..."}</strong>
              <small>recorded moves</small>
            </div>
            <div className="draft-console">
              <div>
                <span className="console-kicker">2026 Draft</span>
                <strong>{selectedPicks} selected</strong>
                <small>{openPicks} open picks</small>
              </div>
              <div className="console-list">
                {draftPicks.slice(0, 5).map((pick) => (
                  <div className="console-row" key={getDraftPickKey(pick)}>
                    <span>{pick.pick}</span>
                    <strong>{pick.team}</strong>
                    <small>{getDraftPickStatus(pick, currentDraftPickKey)}</small>
                  </div>
                ))}
                {draftSheet.loading && <div className="console-row muted">Loading draft...</div>}
              </div>
            </div>
          </div>
        </section>

        <section className="section-band draft-band" id="draft">
          <div className="section-heading">
            <p className="eyebrow">Live from Google Sheets</p>
            <h2>2026 Draft Board</h2>
            <p>
              Picks, owners, and selections straight from the 2026 Draft tab.
            </p>
          </div>
          <div className="draft-status-bar">
            <div>
              <span>Last sync</span>
              <strong>{formatFetchTime(draftSheet.fetchedAt)}</strong>
            </div>
            <div>
              <span>Picks loaded</span>
              <strong>{draftPicks.length || "..."}</strong>
            </div>
            <div>
              <span>Selections made</span>
              <strong>{selectedPicks}</strong>
            </div>
            <div>
              <span>Open slots</span>
              <strong>{openPicks}</strong>
            </div>
          </div>
          {draftSheet.error ? (
            <StatusMessage label="Draft feed unavailable" detail={draftSheet.error} />
          ) : (
            <div className="draft-rounds">
              {Object.entries(draftGroups).map(([round, picks]) => (
                <article className="round-panel" key={round}>
                  <h3>{round}</h3>
                  <div className="pick-list">
                    {picks.map((pick) => (
                      <div
                        className={`pick-row ${getDraftPickClass(pick, currentDraftPickKey)}`}
                        key={getDraftPickKey(pick)}
                      >
                        <span className="pick-number">{pick.pick}</span>
                        <strong>{pick.team}</strong>
                        <span>{getDraftPickStatus(pick, currentDraftPickKey)}</span>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
              {draftSheet.loading && !draftPicks.length && (
                <StatusMessage label="Loading draft board" detail="Pulling the 2026 Draft tab." />
              )}
            </div>
          )}
        </section>

        <section className="section-band results-band" id="results">
          <div className="section-heading">
            <p className="eyebrow">League history</p>
            <h2>Results and records</h2>
            <p>
              Season standings, all-time records, and the five-year points
              leaderboard from the League Results tab.
            </p>
          </div>
          <div className="results-layout">
            <article className="standings-panel">
              <div className="panel-title">
                <span>{results.latestSeason?.year ?? "2025"}</span>
                <h3>Latest standings</h3>
              </div>
              <div className="standings-table">
                {(results.latestSeason?.standings ?? []).map((standing) => (
                  <div className="standing-row" key={`${standing.place}-${standing.team}`}>
                    <span>{standing.place}</span>
                    <strong>{standing.team}</strong>
                    <span>{standing.record}</span>
                    <span>{standing.pointsFor}</span>
                  </div>
                ))}
              </div>
            </article>
            <article className="leaderboard-panel">
              <div className="panel-title">
                <span>All time</span>
                <h3>Records</h3>
              </div>
              <div className="mini-list">
                {results.allTime.slice(0, 10).map((entry, index) => (
                  <div className="mini-row" key={entry.team}>
                    <span>{index + 1}</span>
                    <strong>{entry.team}</strong>
                    <small>{entry.record}</small>
                  </div>
                ))}
              </div>
            </article>
            <article className="leaderboard-panel decade-panel">
              <div className="panel-title">
                <span>2021-2025</span>
                <h3>Points race</h3>
              </div>
              <div className="bar-list">
                {results.decade.map((entry) => {
                  const max = Math.max(...results.decade.map((item) => item.points), 1);
                  return (
                    <div className="bar-row" key={entry.team}>
                      <div>
                        <strong>{entry.team}</strong>
                        <span>{entry.total}</span>
                      </div>
                      <div className="bar-track">
                        <span style={{ width: `${(entry.points / max) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          </div>
          {resultsSheet.error && (
            <StatusMessage label="Results feed unavailable" detail={resultsSheet.error} />
          )}
        </section>

        <section className="section-band trades-band" id="trades">
          <div className="section-heading">
            <p className="eyebrow">Trade archive</p>
            <h2>All Trades</h2>
            <p>
              A market wall for the full ledger, with recent moves and the most
              active owners by total trades.
            </p>
          </div>
          <div className="trade-layout">
            <article className="trade-feed">
              <div className="panel-title">
                <span>{trades.totalTrades || "..."} total</span>
                <h3>Latest logged moves</h3>
              </div>
              <div className="trade-list">
                {trades.latestTrades.map((trade, index) => (
                  <div className="trade-row" key={`${trade.time}-${trade.assets}-${index}`}>
                    <span>{trade.time}</span>
                    <strong>{trade.assets}</strong>
                    <small>To {trade.to}</small>
                  </div>
                ))}
              </div>
            </article>
            <article className="trade-counts">
              <div className="panel-title">
                <span>Activity</span>
                <h3>Owner totals</h3>
              </div>
              <div className="bar-list">
                {trades.ownerCounts.slice(0, 10).map((entry) => {
                  const max = Math.max(...trades.ownerCounts.map((item) => item.total), 1);
                  return (
                    <div className="bar-row" key={entry.owner}>
                      <div>
                        <strong>{entry.owner}</strong>
                        <span>{entry.total}</span>
                      </div>
                      <div className="bar-track trade-track">
                        <span style={{ width: `${(entry.total / max) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          </div>
          {tradesSheet.error && (
            <StatusMessage label="Trades feed unavailable" detail={tradesSheet.error} />
          )}
        </section>

        <section className="section-band teams-band" id="teams">
          <div className="section-heading">
            <p className="eyebrow">Roster rooms</p>
            <h2>Team navigation</h2>
            <p>
              Craig, Danny, DJ, Eddie, Evan, Jeremy, Joe C, Joe F, Joe H, and
              John in one owner switcher.
            </p>
          </div>

          <div className="team-switcher" role="tablist" aria-label="Team tabs">
            {TEAM_TABS.map((team) => (
              <button
                aria-selected={team.key === activeTeamKey}
                className={team.key === activeTeamKey ? "active" : ""}
                key={team.key}
                onClick={() => setActiveTeamKey(team.key)}
                role="tab"
                type="button"
              >
                <span>{team.owner}</span>
                <small>{team.alias}</small>
              </button>
            ))}
          </div>

          <div className="team-dashboard">
            <article className="team-identity">
              <span className="team-updated">{activeTeam.updated || "Sheet sync"}</span>
              <h3>{activeTeam.teamName}</h3>
              <p>{activeTeam.owner}</p>
              <div className="position-grid">
                {activeTeam.positions.map((position) => (
                  <div key={`${position.pos}-${position.count}`}>
                    <span>{position.pos}</span>
                    <strong>{position.count}</strong>
                  </div>
                ))}
              </div>
            </article>

            <article className="roster-panel">
              <div className="panel-title">
                <span>Current roster</span>
                <h3>Top players</h3>
              </div>
              <div className="roster-table">
                {activeTeam.roster.map((player) => (
                  <div className="roster-row" key={`${player.player}-${player.pos}`}>
                    <strong>{player.player}</strong>
                    <span>{player.pos}</span>
                    <span>{player.nflTeam}</span>
                    <span>{player.points || "-"}</span>
                    <small>Age {player.age || "-"}</small>
                  </div>
                ))}
              </div>
            </article>

            <article className="picks-panel">
              <div className="panel-title">
                <span>Draft capital</span>
                <h3>Upcoming picks</h3>
              </div>
              <div className="pick-columns">
                <div>
                  <h4>2026</h4>
                  {activeTeam.picks2026.map((pick) => (
                    <span key={`2026-${pick}`}>{pick}</span>
                  ))}
                </div>
                <div>
                  <h4>2027</h4>
                  {activeTeam.picks2027.map((pick) => (
                    <span key={`2027-${pick}`}>{pick}</span>
                  ))}
                </div>
              </div>
              <div className="history-picks">
                <h4>2025 selections</h4>
                {activeTeam.picks2025.map((pick) => (
                  <div key={`${pick.pick}-${pick.player}`}>
                    <span>{pick.pick}</span>
                    <strong>{pick.player}</strong>
                  </div>
                ))}
              </div>
            </article>

            <article className="team-trades-panel">
              <div className="panel-title">
                <span>Team ledger</span>
                <h3>Recent trades</h3>
              </div>
              <div className="team-trade-list">
                {activeTeam.trades.map((trade) => (
                  <div className="team-trade-row" key={`${trade.year}-${trade.give}`}>
                    <span>{trade.year}</span>
                    <strong>{trade.receive}</strong>
                    <small>Sent {trade.give}</small>
                  </div>
                ))}
              </div>
            </article>
          </div>
          {activeTeamSheet.error && (
            <StatusMessage label={`${activeTeamTab.owner} feed unavailable`} detail={activeTeamSheet.error} />
          )}
        </section>
      </div>
    </main>
  );
}

function StatusMessage({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="status-message">
      <strong>{label}</strong>
      <span>{detail}</span>
    </div>
  );
}
