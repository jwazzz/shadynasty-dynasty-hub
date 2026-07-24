"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";

type SheetState = {
  rows: string[][];
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

const EMPTY_SHEET: SheetState = {
  rows: [],
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
          fetchedAt: string;
        };

        if (active) {
          setSheet({
            rows: payload.rows,
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

function normalizeSearch(value: string | undefined) {
  return normalize(value)
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
  const rosterRows = rosterHeaderIndex >= 0 ? rows.slice(rosterHeaderIndex + 1) : [];
  const picks2026Column = rosterHeader.findIndex((cell) => normalize(cell) === "2026");
  const picks2027Column = rosterHeader.findIndex((cell) => normalize(cell) === "2027");
  const picks2025Column = rosterHeader.findIndex((cell) => normalize(cell) === "2025");

  const roster = rosterRows
    .map((row) => ({
      player: normalize(row[rosterColumn]),
      pos: normalize(row[rosterColumn + 1]),
      nflTeam: normalize(row[rosterColumn + 2]),
      points: normalize(row[rosterColumn + 3]),
      age: normalize(row[rosterColumn + 4]),
      rank: normalize(row[rosterColumn + 5]),
    }))
    .filter((player) => player.player && player.pos)
    .slice(0, 16);

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

  const tradeHeaderIndex = rows.findIndex((row) =>
    row.some(
      (cell, index) => normalize(cell) === "Year" && normalize(row[index + 1]) === "Give",
    ),
  );
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
  { href: "/results", label: "League History", id: "results" },
  { href: "/trades", label: "All Trades", id: "trades" },
  { href: "/teams", label: "Teams", id: "teams" },
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

export function HomePage() {
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
      </section>

      <section className="section-band hub-band">
        <div className="hub-grid">
          <a className="hub-card" href="/draft">
            <span>Live room</span>
            <strong>Draft</strong>
            <small>Auto-refreshing 2026 board.</small>
          </a>
          <a className="hub-card" href="/teams">
            <span>Rosters</span>
            <strong>Teams</strong>
            <small>Every current owner tab.</small>
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
    </PageChrome>
  );
}

export function DraftPage() {
  const draftSheet = useSheet("draft", 10000);
  const draftPicks = useMemo(() => parseDraft(draftSheet.rows), [draftSheet.rows]);
  const draftGroups = useMemo(() => groupDraftByRound(draftPicks), [draftPicks]);
  const openPicks = draftPicks.filter((pick) => !pick.selection).length;
  const selectedPicks = draftPicks.length - openPicks;
  const currentDraftPickKey = getCurrentDraftPickKey(draftPicks);

  useParallaxMotion();

  return (
    <PageChrome active="draft">
      <section className="section-band route-section draft-band" id="draft">
        <div className="section-heading">
          <p className="eyebrow">Live room</p>
          <h2>Draft</h2>
          <p>
            This page is focused only on the live draft. It refreshes while open
            so picks update from the Sheet without a reload.
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
    </PageChrome>
  );
}

export function ResultsPage() {
  const resultsSheet = useSheet("results");
  const results = useMemo(() => parseResults(resultsSheet.rows), [resultsSheet.rows]);

  useParallaxMotion();

  return (
    <PageChrome active="results">
      <section className="section-band route-section results-band" id="results">
        <div className="section-heading">
          <p className="eyebrow">Archive</p>
          <h2>League History</h2>
          <p>
            All-time records, the all-decade points race, and the 2025 league
            standings from the League Results tab.
          </p>
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
              <span>{results.latestSeason?.year ?? "2025"}</span>
              <h3>2025 League Standings</h3>
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
          <p>
            Every full trade from the All Trades tab. Team buttons match the
            Team column; multiple selected teams show only shared trades.
          </p>
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
  const activeTeamSheet = useSheet(activeTeamKey);
  const teamNames = useAllTeamNames();
  const activeTeam = useMemo(
    () => parseTeam(activeTeamSheet.rows, activeTeamTab.owner),
    [activeTeamSheet.rows, activeTeamTab.owner],
  );

  useParallaxMotion();

  return (
    <PageChrome active="teams">
      <section className="section-band route-section teams-band" id="teams">
        <div className="section-heading">
          <p className="eyebrow">Rosters</p>
          <h2>Teams</h2>
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
              <small>{teamNames[team.key] || team.owner}</small>
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
