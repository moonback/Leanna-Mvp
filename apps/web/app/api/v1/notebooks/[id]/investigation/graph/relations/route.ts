import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { ApiError, handle, parseBody, requireRole, requireUser } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };
const uuid = z.string().uuid();
const relationSchema = z.object({
  subject_cluster_id: uuid,
  object_cluster_id: uuid,
  relation_type: z.enum(["knows","reported_about","seen_at","located_at","travelled_in","owns","uses","works_for","related_to","present_with","contacted","mentioned_with","other"]),
  description: z.string().trim().max(2000).optional(),
  source_id: uuid,
  quote: z.string().trim().min(1).max(4000),
  page_number: z.number().int().positive().nullable().optional(),
  char_start: z.number().int().nonnegative().nullable().optional(),
  char_end: z.number().int().positive().nullable().optional(),
  evidence_role: z.enum(["support","contrary","context"]).default("support"),
}).strict().superRefine((value, ctx) => {
  if (value.subject_cluster_id === value.object_cluster_id) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Une relation doit relier deux nœuds distincts.", path: ["object_cluster_id"] });
  }
  if ((value.char_start == null) !== (value.char_end == null)
    || (value.char_start != null && value.char_end != null && value.char_end <= value.char_start)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Offsets invalides.", path: ["char_end"] });
  }
});

/** Une relation est une affirmation sourcée, proposée à revue humaine. */
export const POST = handle(async (req: NextRequest, { params }: Params) => {
  const user = await requireUser();
  const { id } = await params;
  await requireRole(id, "editor");
  const body = await parseBody(req, relationSchema);
  const db = createServiceClient();

  const [{ data: subject, error: subjectError }, { data: object, error: objectError }, { data: source, error: sourceError }] = await Promise.all([
    db.from("investigation_entity_clusters").select("id, workspace_id, notebook_id, status").eq("id", body.subject_cluster_id).eq("notebook_id", id).maybeSingle(),
    db.from("investigation_entity_clusters").select("id, workspace_id, notebook_id, status").eq("id", body.object_cluster_id).eq("notebook_id", id).maybeSingle(),
    db.from("sources").select("id, workspace_id, notebook_id, status, extracted_text").eq("id", body.source_id).eq("notebook_id", id).maybeSingle(),
  ]);
  if (subjectError) throw subjectError;
  if (objectError) throw objectError;
  if (sourceError) throw sourceError;
  if (!subject || !object) throw new ApiError(404, "graph_node_not_found");
  if (subject.status !== "confirmed" || object.status !== "confirmed") throw new ApiError(409, "graph_nodes_not_confirmed");
  if (!source) throw new ApiError(404, "source_not_in_dossier");
  if (subject.workspace_id !== object.workspace_id || subject.workspace_id !== source.workspace_id) throw new ApiError(422, "workspace_mismatch");
  if (source.status !== "ready" || !source.extracted_text) throw new ApiError(409, "source_not_ready");
  const first = source.extracted_text.indexOf(body.quote);
  const unique = first >= 0 && first === source.extracted_text.lastIndexOf(body.quote);
  if (first < 0) throw new ApiError(422, "source_quote_not_found");
  if (body.char_start != null && body.char_end != null
    && source.extracted_text.slice(body.char_start, body.char_end) !== body.quote) {
    throw new ApiError(422, "source_offset_mismatch");
  }
  const charStart = body.char_start ?? (unique ? first : null);
  const charEnd = charStart == null ? null : charStart + body.quote.length;
  const { data: relation, error: relationError } = await db.from("investigation_relations").insert({
    workspace_id: source.workspace_id,
    notebook_id: id,
    subject_cluster_id: subject.id,
    object_cluster_id: object.id,
    relation_type: body.relation_type,
    description: body.description ?? null,
    status: "proposed",
    created_by: user.id,
  }).select("*").single();
  if (relationError) throw relationError;

  const quoteHash = createHash("sha256").update(body.quote).digest("hex");
  const { data: evidence, error: evidenceError } = await db.from("investigation_relation_evidence").insert({
    workspace_id: source.workspace_id,
    notebook_id: id,
    relation_id: relation.id,
    source_id: source.id,
    evidence_role: body.evidence_role,
    quote: body.quote,
    quote_hash: quoteHash,
    page_number: body.page_number ?? null,
    char_start: charStart,
    char_end: charEnd,
  }).select("*").single();
  if (evidenceError) {
    await db.from("investigation_relations").delete().eq("id", relation.id).eq("notebook_id", id);
    throw evidenceError;
  }

  const { error: auditError } = await db.from("audit_log").insert({
    workspace_id: source.workspace_id,
    actor_id: user.id,
    action: "investigation.graph.relation.create",
    target_type: "investigation_relation",
    target_id: relation.id,
    meta: { notebook_id: id, source_id: source.id, evidence_id: evidence.id, status: "proposed" },
  });
  if (auditError) throw auditError;
  return NextResponse.json({ relation, evidence }, { status: 201 });
});
