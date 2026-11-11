import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseHTML } from "linkedom";

const SOURCE = "116000";
const FEED_URL = "https://www.116000enfantsdisparus.fr/feed/";
const SYNC_INTERVAL_MS = 15 * 60_000;
const MAX_FEED_BYTES = 2_000_000;

type FeedItem = { id: string; url: string; title: string; excerpt: string | null; publishedAt: string | null };

function clean(value: string | null | undefined, max: number): string {
  return (value ?? "").replace(/\\s+/g, " ").trim().slice(0, max);
}

function parseFeed(xml: string): FeedItem[] {
  const { document } = parseHTML(xml);
  const nodes = [...document.querySelectorAll("item"), ...document.querySelectorAll("entry")];
  const items: FeedItem[] = [];
  for (const node of nodes.slice(0, 100)) {
    const title = clean(node.querySelector("title")?.textContent, 500);
    const linkNode = node.querySelector("link");
    const rawLink = linkNode?.getAttribute("href") || linkNode?.textContent || "";
    let url: URL;
    try { url = new URL(rawLink.trim()); } catch { continue; }
    if (url.protocol !== "https:" || !["116000enfantsdisparus.fr", "www.116000enfantsdisparus.fr"].includes(url.hostname.toLowerCase())) continue;
    const id = clean(node.querySelector("guid")?.textContent || node.querySelector("id")?.textContent || url.toString(), 500);
    const excerpt = clean(node.querySelector("description")?.textContent || node.querySelector("summary")?.textContent || node.querySelector("content")?.textContent, 3000) || null;
    const rawDate = node.querySelector("pubDate")?.textContent || node.querySelector("published")?.textContent || node.querySelector("updated")?.textContent;
    const parsedDate = rawDate ? new Date(rawDate) : null;
    items.push({ id, url: url.toString(), title: title || "Publication sans titre", excerpt, publishedAt: parsedDate && Number.isFinite(parsedDate.getTime()) ? parsedDate.toISOString() : null });
  }
  return items;
}

/**
 * Polls the official 116000 WordPress RSS feed. Only public feed metadata is stored:
 * no image download, no crawling of private pages, no inference that a missing RSS item is resolved.
 */
export async function syncMissingPersonNoticeFeed(db: SupabaseClient): Promise<number> {
  const { data: claimed, error: claimError } = await db.rpc("claim_missing_person_notice_sync", { p_source: SOURCE, p_lease_seconds: 90 });
  if (claimError) throw claimError;
  if (!claimed) return 0;

  let seen = 0;
  try {
    const { data: state, error: stateError } = await db.from("missing_person_notice_sync_state")
      .select("feed_url, etag, last_modified").eq("source_name", SOURCE).single();
    if (stateError || !state?.feed_url) throw stateError ?? new Error("feed_not_configured");
    const feed = new URL(state.feed_url);
    if (feed.protocol !== "https:" || feed.hostname !== "www.116000enfantsdisparus.fr") throw new Error("feed_host_not_allowed");

    const headers: Record<string, string> = { accept: "application/rss+xml, application/atom+xml, application/xml, text/xml", "user-agent": "Leanna-NoticeMonitor/1.0 (+https://github.com/moonback/Leanna-Mvp)" };
    if (state.etag) headers["if-none-match"] = state.etag;
    if (state.last_modified) headers["if-modified-since"] = state.last_modified;
    const response = await fetch(feed, { headers, signal: AbortSignal.timeout(12_000), redirect: "manual" });

    if (response.status === 304) {
      await db.from("missing_person_notice_sync_state").update({
        next_sync_at: new Date(Date.now() + SYNC_INTERVAL_MS).toISOString(), lease_until: null,
        last_success_at: new Date().toISOString(), last_status: "not_modified", last_error: null, updated_at: new Date().toISOString(),
      }).eq("source_name", SOURCE);
      return 0;
    }
    if (response.status >= 300 && response.status < 400) throw new Error("feed_redirect_refused");
    if (!response.ok) throw new Error("feed_http_" + response.status);
    const raw = new Uint8Array(await response.arrayBuffer());
    if (raw.byteLength > MAX_FEED_BYTES) throw new Error("feed_too_large");
    const xml = new TextDecoder("utf-8", { fatal: false }).decode(raw);
    const items = parseFeed(xml);
    if (!items.length && !/<(?:rss|feed)\\b/i.test(xml)) throw new Error("invalid_feed");
    const now = new Date().toISOString();

    for (const item of items) {
      const contentHash = createHash("sha256").update(JSON.stringify({ title: item.title, url: item.url, excerpt: item.excerpt, publishedAt: item.publishedAt })).digest("hex");
      const { data: previous } = await db.from("missing_person_notice_catalog").select("id, content_hash")
        .eq("source_name", SOURCE).eq("source_item_id", item.id).maybeSingle();
      const changed = Boolean(previous && previous.content_hash !== contentHash);
      const payload = {
        source_name: SOURCE, source_item_id: item.id, source_url: item.url, title: item.title,
        excerpt: item.excerpt, published_at: item.publishedAt, content_hash: contentHash,
        publication_status: changed ? "changed" : "active", last_seen_at: now,
        ...(changed ? { last_changed_at: now } : {}),
      };
      const { error } = await db.from("missing_person_notice_catalog").upsert(payload, { onConflict: "source_name,source_item_id" });
      if (error) throw error;
      seen += 1;
    }

    await db.from("missing_person_notice_sync_state").update({
      next_sync_at: new Date(Date.now() + SYNC_INTERVAL_MS).toISOString(), lease_until: null,
      etag: response.headers.get("etag"), last_modified: response.headers.get("last-modified"),
      last_success_at: now, last_status: "ok", last_error: null, items_seen: seen, updated_at: now,
    }).eq("source_name", SOURCE);
    return seen;
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 300) : "sync_failed";
    await db.from("missing_person_notice_sync_state").update({
      next_sync_at: new Date(Date.now() + 60 * 60_000).toISOString(), lease_until: null,
      last_status: "error", last_error: message, updated_at: new Date().toISOString(),
    }).eq("source_name", SOURCE);
    throw error;
  }
}
