import { NextResponse, type NextRequest } from "next/server";
import { ApiError, handle, requireRole, requireUser } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

/** Planifie une extraction IA explicite sur les sources prêtes du dossier. */
export const POST = handle(async (_req: NextRequest, { params }: Params) => {
  const user = await requireUser();
  const { id } = await params;
  await requireRole(id, "editor");
  const db = createServiceClient();
  const { data: notebook, error: notebookError } = await db.from("notebooks")
    .select("id, workspace_id").eq("id", id).maybeSingle();
  if (notebookError) throw notebookError;
  if (!notebook) throw new ApiError(404, "not_found");
  const { data: sources, error } = await db.from("sources")
    .select("id, updated_at").eq("notebook_id", id).eq("status", "ready");
  if (error) throw error;
  if (!sources?.length) throw new ApiError(409, "no_ready_sources");
  const jobs = sources.map((source) => ({
    workspace_id: notebook.workspace_id,
    notebook_id: id,
    user_id: user.id,
    kind: "investigation_extract",
    target_id: source.id,
    payload: { offset: 0, version: source.updated_at, requested_by: user.id },
    idempotency_key: `investigation-extract:${source.id}:${source.updated_at}:0`,
  }));
  const { error: queueError } = await db.from("jobs").upsert(jobs, {
    onConflict: "idempotency_key", ignoreDuplicates: true,
  });
  if (queueError) throw queueError;
  await db.from("audit_log").insert({
    workspace_id: notebook.workspace_id, actor_id: user.id,
    action: "investigation.extract.request", target_type: "notebook", target_id: id,
    meta: { source_count: sources.length },
  });
  return NextResponse.json({ queued_sources: sources.length }, { status: 202 });
});
