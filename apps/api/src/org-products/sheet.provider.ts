// The simplest possible product-sheet source: paste a public Google Sheets
// share link, or any plain CSV URL — no service account, no OAuth (same
// "simplest reasonable thing" call already made for intelligence sources,
// ../intelligence/web-link.provider.ts). Raw CSV text goes straight to the
// LLM — no CSV parsing library needed, the model handles messy layouts.
const GOOGLE_SHEETS_URL_RE =
  /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([^/]+)(?:\/.*)?(?:[?#].*)?$/;

function toCsvExportUrl(url: string): string {
  const match = url.match(GOOGLE_SHEETS_URL_RE);
  if (!match) return url;
  const sheetId = match[1];
  const gidMatch = url.match(/[?#&]gid=(\d+)/);
  const gidParam = gidMatch ? `&gid=${gidMatch[1]}` : "";
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gidParam}`;
}

export async function fetchSheetText(url: string): Promise<string> {
  const fetchUrl = toCsvExportUrl(url);
  const res = await fetch(fetchUrl, {
    headers: { "User-Agent": "DataPayBot/1.0 (+product catalog ingestion)" },
  });
  if (!res.ok) {
    throw new Error(`Couldn't fetch ${url} (${res.status}) — make sure it's shared publicly ("Anyone with the link")`);
  }
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(`No content found at ${url}`);
  }
  return text;
}
