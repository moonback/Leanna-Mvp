import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handle, parseBody, requireRole, requireUser } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string; kind: string; recordId: string }> };
const commonStatus = z.enum(["unverified","under_review","verified","rejected"]);
const leadStatus = z.enum(["proposed","in_review","validated","rejected","closed"]);
const bodySchema = z.object({ status: z.string().min(1).max(32), review_note: z.string().trim().max(2000).optional() }).strict();

const TABLES = {
  entity: "investigation_entities",
  event: "investigation_events",
  statement: "investigation_statements",
  lead: "investigation_leads",
} as const;

/** Revue humaine explicite ; les modifications sont journalisées. */
export const PATCH = handle(async (req: NextRequest, { params }: Params) => {
  const user = await requireUser();
  const { id, kind, recordId } = await params;
  await requireRole(id, "editor");
  if (!(kind in TABLES)) throw new ApiError(404, "not_found");
  const parsed = await parseBody(req, bodySchema);
  const status = (kind === "lead" ? leadStatus : commonStatus).safeParse(parsed.status);
  if (!status.success) throw new ApiError(422, "invalid_review_status");
  const db = createServiceClient();
  const table = TABLES[kind as keyof typeof TABLES];
  const { data, error } = await db.from(table).update({
    [kind === "lead" ? "status" : "verification_status"]: status.data,
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString(),
  }).eq("id", recordId).eq("notebook_id", id).select("id, workspace_id, notebook_id").maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(404, "not_found");
  await db.from("audit_log").insert({
    workspace_id: data.workspace_id, actor_id: user.id,
    action: `investigation.${kind}.review`, target_type: `investigation_${kind}`, target_id: recordId,
    meta: { notebook_id: id, status: status.data, note: parsed.review_note ?? null },
  });
  return NextResponse.json({ id: data.id, status: status.data, reviewed_at: new Date().toISOString() });
});
