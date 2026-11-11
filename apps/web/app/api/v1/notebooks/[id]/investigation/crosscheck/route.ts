import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { ApiError, handle, requireRole, requireUser } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

/** Lance une comparaison inter-sources ; aucune piste n'est validée automatiquement. */
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
  const [entities, events, statements] = await Promise.all([
    db.from("investigation_entities").select("source_id").eq("notebook_id", id).limit(500),
    db.from("investigation_events").select("source_id").eq("notebook_id", id).limit(500),
    db.from("investigation_statements").select("source_id").eq("notebook_id", id).limit(500),
  ]);
  for (const result of [entities,events,statements]) if (result.error) throw result.error;
  const sourceCount = new Set([
    ...(entities.data ?? []).map((x) => x.source_id),
    ...(events.data ?? []).map((x) => x.source_id),
    ...(statements.data ?? []).map((x) => x.source_id),
  ]).size;
  if (sourceCount < 2) throw new ApiError(409, "insufficient_sources");
  const { error } = await db.from("jobs").insert({
    workspace_id: notebook.workspace_id, notebook_id: id, user_id: user.id,
    kind: "investigation_crosscheck", target_id: null,
    payload: { requested_by: user.id },
    idempotency_key: `investigation-crosscheck:${id}:${randomUUID()}`,
  });
  if (error) throw error;
  await db.from("audit_log").insert({
    workspace_id: notebook.workspace_id, actor_id: user.id,
    action: "investigation.crosscheck.request", target_type: "notebook", target_id: id,
    meta: { source_count: sourceCount },
  });
  return NextResponse.json({ source_count: sourceCount, status: "queued" }, { status: 202 });
});
