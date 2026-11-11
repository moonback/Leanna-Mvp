import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handle, parseBody, requireRole, requireUser } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string; kind: string; recordId: string }> };
const bodySchema = z.object({
  status: z.enum(["candidate","confirmed","rejected","proposed","under_review","resolved"]),
  review_note: z.string().trim().max(2000).optional(),
}).strict();

const targets = {
  cluster: { table: "investigation_entity_clusters", statuses: ["candidate","confirmed","rejected"] },
  mention: { table: "investigation_entity_mentions", statuses: ["candidate","confirmed","rejected"] },
  relation: { table: "investigation_relations", statuses: ["proposed","confirmed","rejected"] },
  contradiction: { table: "investigation_contradictions", statuses: ["proposed","under_review","resolved","rejected"] },
} as const;

/** Toute confirmation ou résolution est une décision humaine journalisée. */
export const PATCH = handle(async (req: NextRequest, { params }: Params) => {
  const user = await requireUser();
  const { id, kind, recordId } = await params;
  await requireRole(id, "editor");
  if (!Object.prototype.hasOwnProperty.call(targets, kind)) throw new ApiError(404, "not_found");
  const target = targets[kind as keyof typeof targets];
  const body = await parseBody(req, bodySchema);
  if (!(target.statuses as readonly string[]).includes(body.status)) throw new ApiError(422, "invalid_review_status");
  const db = createServiceClient();
  const statusColumn = kind === "cluster" || kind === "mention" || kind === "relation" ? "status" : "status";
  const { data, error } = await db.from(target.table).update({
    [statusColumn]: body.status,
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString(),
  }).eq("id", recordId).eq("notebook_id", id).select("id, workspace_id, notebook_id, reviewed_at").maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(404, "not_found");
  const { error: auditError } = await db.from("audit_log").insert({
    workspace_id: data.workspace_id,
    actor_id: user.id,
    action: `investigation.graph.${kind}.review`,
    target_type: target.table,
    target_id: recordId,
    meta: { notebook_id: id, status: body.status, note: body.review_note ?? null },
  });
  if (auditError) throw auditError;
  return NextResponse.json({ id: data.id, status: body.status, reviewed_at: data.reviewed_at });
});
