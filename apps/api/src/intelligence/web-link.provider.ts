import { PDFParse } from "pdf-parse";

export interface WebLinkContent {
  title: string;
  text: string;
}

function stripHtml(html: string): WebLinkContent {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : "(untitled page)";
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return { title, text };
}

function stripNulBytes(text: string): string {
  const NUL = String.fromCharCode(0);
  return text.split(NUL).join("");
}

// The simplest possible intelligence source: paste any public URL, no
// service account, no folder sharing. Handles a plain webpage or a PDF —
// same text-extraction path Drive-sourced PDFs already use.
export async function fetchWebLinkText(url: string): Promise<WebLinkContent> {
  const res = await fetch(url, {
    headers: { "User-Agent": "DataPayBot/1.0 (+intelligence ingestion)" },
  });
  if (!res.ok) {
    throw new Error(`Couldn't fetch ${url} (${res.status})`);
  }
  const contentType = res.headers.get("content-type") ?? "";

  if (contentType.includes("application/pdf")) {
    const buffer = Buffer.from(await res.arrayBuffer());
    const parser = new PDFParse({ data: buffer });
    try {
      const { text } = await parser.getText();
      // Glyph/font artifacts PDF extraction can surface, which Postgres'
      // UTF8 text columns reject outright — same reason drive.provider.ts
      // strips them from its own PDF path.
      return { title: url, text: stripNulBytes(text) };
    } finally {
      await parser.destroy();
    }
  }

  const html = await res.text();
  const content = stripHtml(html);
  if (!content.text) {
    throw new Error(`No readable text found at ${url}`);
  }
  return content;
}
