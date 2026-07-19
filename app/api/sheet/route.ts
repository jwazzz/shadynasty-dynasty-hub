import { NextResponse } from "next/server";

const SPREADSHEET_ID = "17qdopVe8lPhWzDjBwGz2cNHFCngT783O-YEe5O1R700";

const SHEET_TABS = {
  draft: { title: "2026 Draft", gid: "138922991" },
  results: { title: "League Results", gid: "714171874" },
  trades: { title: "All Trades", gid: "1880006300" },
  "team-craig": { title: "Craig", gid: "1145997661" },
  "team-danny": { title: "Danny", gid: "364688444" },
  "team-dj": { title: "DJ", gid: "1391042481" },
  "team-eddie": { title: "Eddie", gid: "1546435182" },
  "team-evan": { title: "Evan", gid: "521994389" },
  "team-jeremy": { title: "Jeremy", gid: "1867658608" },
  "team-joe-c": { title: "Joe C", gid: "199769068" },
  "team-joe-f": { title: "Joe F", gid: "1320342917" },
  "team-joe-h": { title: "Joe H", gid: "947267993" },
  "team-john": { title: "John", gid: "1304976632" },
} as const;

type SheetKey = keyof typeof SHEET_TABS;

const TRADE_GROUP_COLUMN_INDEX = 27;

export const dynamic = "force-dynamic";

function parseCsv(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(value.trim());
      value = "";
    } else if (char === "\n") {
      row.push(value.trim());
      rows.push(row);
      row = [];
      value = "";
    } else if (char !== "\r") {
      value += char;
    }
  }

  if (value || row.length) {
    row.push(value.trim());
    rows.push(row);
  }

  return rows.map((currentRow, index) =>
    index === 0 && currentRow[0]
      ? [currentRow[0].replace(/^\uFEFF/, ""), ...currentRow.slice(1)]
      : currentRow,
  );
}

function addTradeGroupKeys(rows: string[][]) {
  let tradeSideIndex = 0;

  return rows.map((row, index) => {
    const cleanRow = [...row];

    if (index === 0) {
      cleanRow[TRADE_GROUP_COLUMN_INDEX] = "Trade Group";
      return cleanRow;
    }

    const hasTradeSide = Boolean(
      cleanRow[0]?.trim() && cleanRow[2]?.trim() && cleanRow[3]?.trim(),
    );

    if (hasTradeSide) {
      cleanRow[TRADE_GROUP_COLUMN_INDEX] = `trade-${Math.floor(tradeSideIndex / 2)}`;
      tradeSideIndex += 1;
    }

    return cleanRow;
  });
}

function sanitizeRows(rows: string[][], tabKey: string) {
  if (tabKey === "trades") {
    return addTradeGroupKeys(rows);
  }

  if (!tabKey.startsWith("team-")) {
    return rows;
  }

  return rows.slice(0, 120).map((row) => {
    const cleanRow = [...row];
    const phoneIndex = cleanRow.findIndex(
      (cell) => cell.trim().toLowerCase().replace(/:$/, "") === "phone number",
    );

    if (phoneIndex >= 0) {
      cleanRow[phoneIndex] = "";
      cleanRow[phoneIndex + 1] = "";
    }

    return cleanRow;
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedTab = searchParams.get("tab") ?? "draft";

  if (!Object.hasOwn(SHEET_TABS, requestedTab)) {
    return NextResponse.json(
      { error: "Unknown sheet tab." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const tab = SHEET_TABS[requestedTab as SheetKey];
  const csvUrl = new URL(
    `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export`,
  );
  csvUrl.searchParams.set("format", "csv");
  csvUrl.searchParams.set("gid", tab.gid);

  const response = await fetch(csvUrl, {
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache",
    },
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: `Google Sheets returned ${response.status}.` },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  const csv = await response.text();

  return NextResponse.json(
    {
      key: requestedTab,
      title: tab.title,
      gid: tab.gid,
      rows: sanitizeRows(parseCsv(csv), requestedTab),
      fetchedAt: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
