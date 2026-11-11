import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handle, parseBody, requireRole, requireUser } from "@/lib/api";
import { log } from "@/lib/log";
import { createServiceClient, createUserClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

const SOURCES = {
  arpd: ["arpd.fr"],
  "116000": ["116000enfantsdisparus.fr"],
  interpol: ["interpol.int"],
} as const;

const createSchema = z.object({
  sourceName: z.enum(["arpd", "116000", "interpol"]),
  sourceUrl: z.string().url().max(2048),
  sourceReference: z.string().trim().max(160).optional().nullable(),
  personName: z.string().trim().min(1).max(240),
  publishedDateText: z.string().trim().max(160).optional().nullable(),
  disappearanceLocation: z.string().trim().max(500).optional().nullable(),
  publishedSummary: z.string().trim().max(5000).optional().nullable(),
}).strict();

function allowedSourceUrl(raw: string, sourceName: keyof typeof SOURCES): URL {
  let url: URL;
  try { url = new URL(raw); } catch { throw new ApiError(422, "invalid_source_url"); }
  const allowed = SOURCES[sourceName] as readonly string[];
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password ||
      !allowed.some((domain) => hostname === domain || hostname === "www." + domain)) {
    throw new ApiError(422, "source_domain_not_allowed");
  }
  return url;
}

/** Avis publics saisis depuis leur publication originale ; lecture isolée par dossier sous RLS. */
export const GET = handle(async (_req: NextRequest, { params }: Params) => {
  await requireUser();
  const { id } = await params;
  await requireRole(id, "viewer");
  const supabase = await createUserClient();
  const [{ data: notices, error }, { data: revisions, error: revisionError }] = await Promise.all([
    supabase.from("missing_person_notices").select("id, source_name, source_url, source_reference, person_name, published_date_text, disappearance_location, published_summary, publication_status, review_status, collected_at, last_seen_at, reviewed_at, review_note, source_id").eq("notebook_id", id).order("created_at", { ascending: false }),
    supabase.from("missing_person_notice_revisions").select("id, notice_id, content_hash, captured_at").eq("notebook_id", id).order("captured_at", { ascending: false }).limit(100),
  ]);
  if (error) throw error;
  if (revisionError) throw revisionError;
  return NextResponse.json({ notices: notices ?? [], revisions: revisions ?? [] });
});

/** Crée une source web via le pipeline existant, puis enregistre sa fiche d'avis et sa provenance. */
export const POST = handle(async (req: NextRequest, { params }: Params) => {
  const user = await requireUser();
  const { id } = await params;
  await requireRole(id, "editor");
  const body = await parseBody(req, createSchema);
  const url = allowedSourceUrl(body.sourceUrl, body.sourceName);
  const db = createServiceClient();
  const { data: notebook, error: notebookError } = await db.from("notebooks").select("workspace_id").eq("id", id).single();
  if (notebookError || !notebook) throw new ApiError(404, "not_found");

  const snapshot = {
    sourceName: body.sourceName,
    sourceUrl: url.toString(),
    sourceReference: body.sourceReference ?? null,
    personName: body.personName,
    publishedDateText: body.publishedDateText ?? null,
    disappearanceLocation: body.disappearanceLocation ?? null,
    publishedSummary: body.publishedSummary ?? null,
  };
  const contentHash = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
  const { data: duplicate } = await db.from("missing_person_notices").select("id").eq("notebook_id", id).eq("content_hash", contentHash).maybeSingle();
  if (duplicate) throw new ApiError(409, "notice_already_imported", { noticeId: duplicate.id });
  const { data: sourceId, error: sourceError } = await db.rpc("add_source", {
    p_notebook: id,
    p_user: user.id,
    p_kind: "web",
    p_title: `Avis de recherche — ${body.personName}`,
    p_origin_url: url.toString(),
    p_idempotency_key: null,
  });
  if (sourceError) throw sourceError;

  const { data: notice, error: noticeError } = await db.from("missing_person_notices").insert({
    workspace_id: notebook.workspace_id,
    notebook_id: id,
    source_id: sourceId,
    source_name: body.sourceName,
    source_url: url.toString(),
    source_reference: body.sourceReference ?? null,
    person_name: body.personName,
    published_date_text: body.publishedDateText ?? null,
    disappearance_location: body.disappearanceLocation ?? null,
    published_summary: body.publishedSummary ?? null,
    content_hash: contentHash,
    created_by: user.id,
  }).select("id, source_id, person_name, review_status, publication_status, collected_at").single();

  if (noticeError) {
    await db.from("sources").delete().eq("id", sourceId).eq("notebook_id", id);
    throw noticeError;
  }

  const { error: revisionError } = await db.from("missing_person_notice_revisions").insert({
    workspace_id: notebook.workspace_id,
    notebook_id: id,
    notice_id: notice.id,
    content_hash: contentHash,
    snapshot,
    captured_by: user.id,
  });
  if (revisionError) log.error("missing_person_notice.revision_failed", { notebook_id: id, notice_id: notice.id });

  await db.from("audit_log").insert({
    workspace_id: notebook.workspace_id,
    actor_id: user.id,
    action: "missing_person_notice.import",
    target_type: "missing_person_notice",
    target_id: notice.id,
  });
  log.info("missing_person_notice.imported", { notebook_id: id, notice_id: notice.id, source_name: body.sourceName });
  return NextResponse.json({ notice }, { status: 201 });
});
