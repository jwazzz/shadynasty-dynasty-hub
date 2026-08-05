import { unzipSync } from "fflate";
import { NextResponse } from "next/server";

const SPREADSHEET_ID = "17qdopVe8lPhWzDjBwGz2cNHFCngT783O-YEe5O1R700";

const SHEET_TABS = {
  draft: { title: "2026 Draft", gid: "138922991" },
  results: { title: "League Results", gid: "714171874" },
  trades: { title: "All Trades", gid: "1880006300" },
  "free-agents": { title: "2025 Free Agents", gid: "297281140" },
  "all-rosters": {
    title: "All Rosters - Age & 2026 Rankings",
    sheetName: "All Rosters - Age & 2026 Rankin",
  },
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
type SheetPayload = {
  key: string;
  title: string;
  gid?: string;
  rows: string[][];
  rookieRows?: number[];
  fetchedAt: string;
};

const TRADE_GROUP_COLUMN_INDEX = 27;
const ROOKIE_FILL_COLOR = "FFCFE2F3";
const DEFAULT_CACHE_TTL_MS = 60_000;
const STALE_FALLBACK_MS = 10 * 60_000;
const decoder = new TextDecoder();
const sheetCache = new Map<
  string,
  {
    expiresAt: number;
    staleUntil: number;
    payload: SheetPayload;
  }
>();

export const dynamic = "force-dynamic";

function getCacheTtlMs(tabKey: string) {
  if (tabKey === "draft") {
    return 10_000;
  }

  if (tabKey.startsWith("team-")) {
    return 30_000;
  }

  if (tabKey === "all-rosters") {
    return 120_000;
  }

  return DEFAULT_CACHE_TTL_MS;
}

function getSheetCache(tabKey: string, allowStale = false) {
  const cached = sheetCache.get(tabKey);
  const now = Date.now();

  if (!cached) {
    return null;
  }

  if (cached.expiresAt > now) {
    return { payload: cached.payload, status: "HIT" };
  }

  if (allowStale && cached.staleUntil > now) {
    return { payload: cached.payload, status: "STALE" };
  }

  return null;
}

function setSheetCache(tabKey: string, payload: SheetPayload) {
  const ttl = getCacheTtlMs(tabKey);
  const now = Date.now();

  sheetCache.set(tabKey, {
    expiresAt: now + ttl,
    staleUntil: now + ttl + STALE_FALLBACK_MS,
    payload,
  });

  return payload;
}

function getSheetCacheHeaders(tabKey: string, status: string) {
  const seconds = Math.max(1, Math.floor(getCacheTtlMs(tabKey) / 1000));

  return {
    "Cache-Control": `public, max-age=${seconds}, s-maxage=${seconds}, stale-while-revalidate=300`,
    "X-Sheet-Cache": status,
  };
}

function sheetJson(payload: SheetPayload, tabKey: string, status: string) {
  return NextResponse.json(payload, {
    headers: getSheetCacheHeaders(tabKey, status),
  });
}

function sheetError(message: string) {
  return NextResponse.json(
    { error: message },
    { status: 502, headers: { "Cache-Control": "no-store" } },
  );
}

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

function addPairTradeGroupKeys(rows: string[][]) {
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

function getXmlAttribute(source: string, name: string) {
  return new RegExp(`${name}="([^"]*)"`).exec(source)?.[1] ?? "";
}

function decodeXml(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function columnIndexFromReference(reference: string) {
  const letters = reference.match(/^[A-Z]+/i)?.[0] ?? "";

  return letters
    .toUpperCase()
    .split("")
    .reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function parseSharedStrings(sharedStringsXml: string) {
  return [...sharedStringsXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) =>
    [...match[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
      .map((textMatch) => decodeXml(textMatch[1]))
      .join(""),
  );
}

function parseStyleFillIds(stylesXml: string) {
  const cellXfsSection = stylesXml.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] ?? "";

  return [...cellXfsSection.matchAll(/<xf\b([^>]*)>/g)].map((match) =>
    getXmlAttribute(match[1], "fillId") || "0",
  );
}

function parseFillColors(stylesXml: string) {
  const fillsSection = stylesXml.match(/<fills[^>]*>([\s\S]*?)<\/fills>/)?.[1] ?? "";

  return [...fillsSection.matchAll(/<fill>([\s\S]*?)<\/fill>/g)].map((match) =>
    getXmlAttribute(match[1], "rgb").toUpperCase(),
  );
}

function parseCellValue(cellAttributes: string, cellXml: string, sharedStrings: string[]) {
  const type = getXmlAttribute(cellAttributes, "t");
  const rawValue = cellXml.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";

  if (type === "s") {
    return sharedStrings[Number(rawValue)] ?? "";
  }

  if (type === "inlineStr") {
    return [...cellXml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
      .map((match) => decodeXml(match[1]))
      .join("");
  }

  return decodeXml(rawValue);
}

function addStyledTradeGroupKeys(rows: string[][], rowStyleKeys: Map<number, string>) {
  let tradeGroupIndex = -1;
  let tradeSideIndex = 0;
  let previousStyleKey = "";

  return rows.map((row, index) => {
    const cleanRow = [...row];

    if (index === 0) {
      cleanRow[TRADE_GROUP_COLUMN_INDEX] = "Trade Group";
      return cleanRow;
    }

    const hasTradeSide = Boolean(
      cleanRow[0]?.trim() && cleanRow[2]?.trim() && cleanRow[3]?.trim(),
    );

    if (!hasTradeSide) {
      return cleanRow;
    }

    const styleKey = rowStyleKeys.get(index + 1) ?? "";

    if (tradeGroupIndex < 0) {
      tradeGroupIndex = 0;
    } else if (styleKey && previousStyleKey && styleKey !== previousStyleKey) {
      tradeGroupIndex += 1;
    } else if (!styleKey) {
      tradeGroupIndex = Math.floor(tradeSideIndex / 2);
    }

    cleanRow[TRADE_GROUP_COLUMN_INDEX] = `trade-${tradeGroupIndex}`;
    previousStyleKey = styleKey || previousStyleKey;
    tradeSideIndex += 1;

    return cleanRow;
  });
}

function parseXlsxRows(input: ArrayBuffer) {
  const files = unzipSync(new Uint8Array(input));
  const worksheetXml = files["xl/worksheets/sheet1.xml"];
  const stylesXml = files["xl/styles.xml"];

  if (!worksheetXml || !stylesXml) {
    throw new Error("Missing worksheet data.");
  }

  const sharedStrings = files["xl/sharedStrings.xml"]
    ? parseSharedStrings(decoder.decode(files["xl/sharedStrings.xml"]))
    : [];
  const styleFillIds = parseStyleFillIds(decoder.decode(stylesXml));
  const rows: string[][] = [];
  const rowStyleKeys = new Map<number, string>();
  const worksheet = decoder.decode(worksheetXml);

  for (const rowMatch of worksheet.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rowNumber = Number(getXmlAttribute(rowMatch[1], "r"));
    const row: string[] = [];

    for (const cellMatch of rowMatch[2].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const cellAttributes = cellMatch[1];
      const reference = getXmlAttribute(cellAttributes, "r");
      const columnIndex = columnIndexFromReference(reference);

      if (columnIndex < 0) {
        continue;
      }

      row[columnIndex] = parseCellValue(cellAttributes, cellMatch[2], sharedStrings).trim();

      if (columnIndex === 0) {
        const styleIndex = Number(getXmlAttribute(cellAttributes, "s"));
        rowStyleKeys.set(rowNumber, styleFillIds[styleIndex] ?? `style-${styleIndex}`);
      }
    }

    rows[rowNumber - 1] = row;
  }

  return addStyledTradeGroupKeys(rows.map((row) => row ?? []), rowStyleKeys);
}

function normalizeWorksheetPath(target: string) {
  return `xl/${target.replace(/^\//, "").replace(/^xl\//, "")}`;
}

function parseWorkbookSheets(workbookXml: string, workbookRelsXml: string) {
  const relationships = new Map(
    [...workbookRelsXml.matchAll(/<Relationship\b([^>]*)\/>/g)].map((match) => [
      getXmlAttribute(match[1], "Id"),
      normalizeWorksheetPath(getXmlAttribute(match[1], "Target")),
    ]),
  );

  return [...workbookXml.matchAll(/<sheet\b([^>]*)\/>/g)].map((match) => {
    const relationshipId = getXmlAttribute(match[1], "r:id");

    return {
      name: decodeXml(getXmlAttribute(match[1], "name")),
      path: relationships.get(relationshipId) ?? "",
    };
  });
}

function parseStyledWorkbookRows(input: ArrayBuffer, sheetName: string) {
  const files = unzipSync(new Uint8Array(input));
  const workbookXml = files["xl/workbook.xml"];
  const workbookRelsXml = files["xl/_rels/workbook.xml.rels"];
  const stylesXmlFile = files["xl/styles.xml"];

  if (!workbookXml || !workbookRelsXml || !stylesXmlFile) {
    throw new Error("Missing workbook data.");
  }

  const workbookSheets = parseWorkbookSheets(
    decoder.decode(workbookXml),
    decoder.decode(workbookRelsXml),
  );
  const worksheetPath =
    workbookSheets.find((sheet) => sheet.name === sheetName)?.path ??
    workbookSheets.find((sheet) => sheet.name.startsWith(sheetName.slice(0, 24)))?.path;
  const worksheetXml = worksheetPath ? files[worksheetPath] : undefined;

  if (!worksheetXml) {
    throw new Error("Missing worksheet data.");
  }

  const sharedStrings = files["xl/sharedStrings.xml"]
    ? parseSharedStrings(decoder.decode(files["xl/sharedStrings.xml"]))
    : [];
  const stylesXml = decoder.decode(stylesXmlFile);
  const styleFillIds = parseStyleFillIds(stylesXml).map(Number);
  const fillColors = parseFillColors(stylesXml);
  const worksheet = decoder.decode(worksheetXml);
  const rows: string[][] = [];
  const rookieRows = new Set<number>();

  for (const rowMatch of worksheet.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rowNumber = Number(getXmlAttribute(rowMatch[1], "r"));
    const row: string[] = [];

    for (const cellMatch of rowMatch[2].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const cellAttributes = cellMatch[1];
      const reference = getXmlAttribute(cellAttributes, "r");
      const columnIndex = columnIndexFromReference(reference);

      if (columnIndex < 0) {
        continue;
      }

      row[columnIndex] = parseCellValue(cellAttributes, cellMatch[2], sharedStrings).trim();

      const styleIndex = Number(getXmlAttribute(cellAttributes, "s") || 0);
      const fillId = styleFillIds[styleIndex] ?? 0;
      const fillColor = fillColors[fillId] ?? "";

      if (fillColor === ROOKIE_FILL_COLOR && columnIndex <= 7) {
        rookieRows.add(rowNumber - 1);
      }
    }

    rows[rowNumber - 1] = row;
  }

  const cleanRows = rows.map((row) => row ?? []);

  return {
    rows: cleanRows,
    rookieRows: [...rookieRows]
      .filter((rowIndex) => {
        const row = cleanRows[rowIndex] ?? [];

        return rowIndex > 1 && Boolean(row[0]?.trim() && row[1]?.trim() && row[2]?.trim());
      })
      .sort((a, b) => a - b),
  };
}

async function fetchStyledTradeRows(gid: string) {
  const xlsxUrl = new URL(
    `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export`,
  );
  xlsxUrl.searchParams.set("format", "xlsx");
  xlsxUrl.searchParams.set("gid", gid);

  const response = await fetch(xlsxUrl, {
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache",
    },
  });

  if (!response.ok) {
    throw new Error(`Google Sheets returned ${response.status}.`);
  }

  return parseXlsxRows(await response.arrayBuffer());
}

async function fetchStyledWorkbookRows(sheetName: string) {
  const xlsxUrl = new URL(
    `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export`,
  );
  xlsxUrl.searchParams.set("format", "xlsx");

  const response = await fetch(xlsxUrl, {
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache",
    },
  });

  if (!response.ok) {
    throw new Error(`Google Sheets returned ${response.status}.`);
  }

  return parseStyledWorkbookRows(await response.arrayBuffer(), sheetName);
}

function sanitizeRows(rows: string[][], tabKey: string) {
  if (tabKey === "trades") {
    return addPairTradeGroupKeys(rows);
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
  const cached = getSheetCache(requestedTab);

  if (cached) {
    return sheetJson(cached.payload, requestedTab, cached.status);
  }

  if (requestedTab === "all-rosters" && "sheetName" in tab) {
    try {
      const rosterSheet = await fetchStyledWorkbookRows(tab.sheetName);
      const payload = setSheetCache(requestedTab, {
        key: requestedTab,
        title: tab.title,
        rows: sanitizeRows(rosterSheet.rows, requestedTab),
        rookieRows: rosterSheet.rookieRows,
        fetchedAt: new Date().toISOString(),
      });

      return sheetJson(payload, requestedTab, "MISS");
    } catch (error) {
      const stale = getSheetCache(requestedTab, true);

      if (stale) {
        return sheetJson(stale.payload, requestedTab, stale.status);
      }

      return sheetError(
        error instanceof Error ? error.message : "Unable to load roster workbook.",
      );
    }
  }

  if (requestedTab === "trades" && "gid" in tab) {
    try {
      const rows = await fetchStyledTradeRows(tab.gid);

      if (rows.length) {
        const payload = setSheetCache(requestedTab, {
          key: requestedTab,
          title: tab.title,
          gid: tab.gid,
          rows,
          fetchedAt: new Date().toISOString(),
        });

        return sheetJson(payload, requestedTab, "MISS");
      }
    } catch {
      // Fall back to CSV below if the styled export is temporarily unavailable.
    }
  }

  if (!("gid" in tab)) {
    return NextResponse.json(
      { error: "Sheet tab is not available as CSV." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const csvUrl = new URL(
    `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export`,
  );
  csvUrl.searchParams.set("format", "csv");
  csvUrl.searchParams.set("gid", tab.gid);

  try {
    const response = await fetch(csvUrl, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache",
      },
    });

    if (!response.ok) {
      throw new Error(`Google Sheets returned ${response.status}.`);
    }

    const csv = await response.text();
    const payload = setSheetCache(requestedTab, {
      key: requestedTab,
      title: tab.title,
      gid: tab.gid,
      rows: sanitizeRows(parseCsv(csv), requestedTab),
      fetchedAt: new Date().toISOString(),
    });

    return sheetJson(payload, requestedTab, "MISS");
  } catch (error) {
    const stale = getSheetCache(requestedTab, true);

    if (stale) {
      return sheetJson(stale.payload, requestedTab, stale.status);
    }

    return sheetError(
      error instanceof Error ? error.message : "Unable to load Google Sheet.",
    );
  }
}
