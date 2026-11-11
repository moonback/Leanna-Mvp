import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handle, parseBody, requireRole, requireUser } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };
const schema = z.object({
  parent_source_id: z.string().uuid(),
  child_source_id: z.string().uuid(),
  lineage_type: z.enum(["copy","excerpt","translation","transcription","derived","unknown"]),
  note: z.string().trim().max(2000).optional(),
}).strict().refine((value) => value.parent_source_id !== value.child_source_id, {
  message: "Une source ne peut pas être sa propre origine.",
  path: ["child_source_id"],
});

/** Déclare une filiation documentaire ; la migration refuse les cycles. */
export const POST = handle(async (req: NextRequest, { params }: Params) => {
  const user = await requireUser();
  const { id } = await params;
  await requireRole(id, "editor");
  const body = await parseBody(req, schema);
  const db = createServiceClient();
  const { data: sources, error: sourceError } = await db.from("sources")
    .select("id, workspace_id, notebook_id")
    .eq("notebook_id", id)
    .in("id", [body.parent_source_id, body.child_source_id]);
  if (sourceError) throw sourceError;
  if (!sources || sources.length !== 2) throw new ApiError(404, "source_not_in_dossier");
  if (sources[0].workspace_id !== sources[1].workspace_id) throw new ApiError(422, "workspace_mismatch");
  const { data, error } = await db.from("investigation_source_lineage").insert({
    workspace_id: sources[0].workspace_id,
    notebook_id: id,
    parent_source_id: body.parent_source_id,
    child_source_id: body.child_source_id,
    lineage_type: body.lineage_type,
    note: body.note ?? null,
    created_by: user.id,
  }).select("*").single();
  if (error?.code === "23505") throw new ApiError(409, "lineage_already_exists");
  if (error?.message?.includes("source_lineage_cycle")) throw new ApiError(422, "source_lineage_cycle");
  if (error) throw error;
  const { error: auditError } = await db.from("audit_log").insert({
    workspace_id: sources[0].workspace_id, actor_id: user.id,
    action: "investigation.graph.source_lineage.create", target_type: "source",
    target_id: body.child_source_id,
    meta: { notebook_id: id, parent_source_id: body.parent_source_id, lineage_type: body.lineage_type },
  });
  if (auditError) throw auditError;
  return NextResponse.json({ lineage: data }, { status: 201 });
});
