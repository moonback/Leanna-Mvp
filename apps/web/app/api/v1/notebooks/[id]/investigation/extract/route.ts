import { NextResponse, type NextRequest } from "next/server";
import { ApiError, handle, requireRole, requireUser } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

/** Planifie une extraction IA explicite sur les sources prêtes du dossier. */
export const POST = handle(async (_req: NextRequest, { params }: Params) => {
  const user = await requireUser();
  const { id } = await params;
  await requireRole(id, "editor");
  if (!process.env.OPENROUTER_API_KEY || !process.env.OPENROUTER_CHAT_MODEL) throw new ApiError(503, "ai_not_configured");
  const db = createServiceClient();
  const { data: notebook, error: notebookError } = await db.from("notebooks")
    .select("id, workspace_id").eq("id", id).maybeSingle();
  if (notebookError) throw notebookError;
  if (!notebook) throw new ApiError(404, "not_found");
  const { data: sources, error } = await db.from("sources")
    .select("id, updated_at").eq("notebook_id", id).eq("status", "ready");
  if (error) throw error;
  if (!sources?.length) throw new ApiError(409, "no_ready_sources");
  const { data: queued, error: queueError } = await db.rpc("queue_investigation_extract_jobs", {
    p_notebook: id,
    p_user: user.id,
    p_sources: sources.map((source) => ({ id: source.id, version: source.updated_at })),
  });
  if (queueError) {
    if (queueError.message.includes("quota_")) throw new ApiError(402, queueError.message);
    if (queueError.message.includes("source_not_ready_or_changed")) throw new ApiError(409, "source_changed_retry");
    throw queueError;
  }
  await db.from("audit_log").insert({
    workspace_id: notebook.workspace_id, actor_id: user.id,
    action: "investigation.extract.request", target_type: "notebook", target_id: id,
    meta: { source_count: sources.length },
  });
  return NextResponse.json({ queued_sources: queued ?? 0, ready_sources: sources.length }, { status: 202 });
});
