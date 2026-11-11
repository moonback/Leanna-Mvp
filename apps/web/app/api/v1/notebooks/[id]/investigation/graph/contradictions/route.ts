import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { ApiError, handle, parseBody, requireRole, requireUser } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };
const evidenceSchema = z.object({
  statement_id: z.string().uuid(),
  position: z.enum(["conflicts","qualifies","context"]),
  quote: z.string().trim().min(1).max(4000),
  page_number: z.number().int().positive().nullable().optional(),
}).strict();
const schema = z.object({
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().min(1).max(3000),
  evidence: z.array(evidenceSchema).min(2).max(20),
}).strict().superRefine((value, ctx) => {
  const ids = value.evidence.map((item) => item.statement_id);
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Chaque déclaration doit être ajoutée une seule fois.", path: ["evidence"] });
  }
  if (value.evidence.filter((item) => item.position === "conflicts").length < 2) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Deux déclarations en tension sont nécessaires.", path: ["evidence"] });
  }
});

/** Crée une contradiction documentaire seulement si deux sources distinctes sont citées exactement. */
export const POST = handle(async (req: NextRequest, { params }: Params) => {
  const user = await requireUser();
  const { id } = await params;
  await requireRole(id, "editor");
  const body = await parseBody(req, schema);
  const db = createServiceClient();
  const statementIds = [...new Set(body.evidence.map((item) => item.statement_id))];
  if (statementIds.length < 2) throw new ApiError(422, "contradiction_requires_distinct_statements");

  const { data: statements, error: statementError } = await db.from("investigation_statements")
    .select("id, workspace_id, notebook_id, source_id, context_excerpt, page_number")
    .eq("notebook_id", id).in("id", statementIds);
  if (statementError) throw statementError;
  if (!statements || statements.length !== statementIds.length) throw new ApiError(404, "statement_not_in_dossier");
  const sourceIds = [...new Set(statements.map((item) => item.source_id))];
  if (sourceIds.length < 2) throw new ApiError(422, "contradiction_requires_distinct_sources");

  const { data: sources, error: sourceError } = await db.from("sources")
    .select("id, workspace_id, extracted_text, status").eq("notebook_id", id).in("id", sourceIds);
  if (sourceError) throw sourceError;
  if (!sources || sources.length !== sourceIds.length) throw new ApiError(404, "source_not_in_dossier");
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const statementById = new Map(statements.map((statement) => [statement.id, statement]));
  const rows = body.evidence.map((item) => {
    const statement = statementById.get(item.statement_id);
    const source = statement ? sourceById.get(statement.source_id) : null;
    if (!statement || !source || source.status !== "ready" || !source.extracted_text?.includes(item.quote)) {
      throw new ApiError(422, "contradiction_quote_not_found");
    }
    if (!statement.context_excerpt.includes(item.quote)) {
      throw new ApiError(422, "contradiction_quote_not_in_statement");
    }
    const first = source.extracted_text.indexOf(item.quote);
    const unique = first >= 0 && first === source.extracted_text.lastIndexOf(item.quote);
    return {
      workspace_id: statement.workspace_id, notebook_id: id, statement_id: statement.id,
      source_id: source.id, position: item.position, quote: item.quote,
      quote_hash: createHash("sha256").update(item.quote).digest("hex"),
      page_number: item.page_number ?? statement.page_number,
      char_start: unique ? first : null, char_end: unique ? first + item.quote.length : null,
    };
  });
  const workspaceId = statements[0].workspace_id;
  if (statements.some((statement) => statement.workspace_id !== workspaceId)) throw new ApiError(422, "workspace_mismatch");

  const { data: contradiction, error: contradictionError } = await db.from("investigation_contradictions").insert({
    workspace_id: workspaceId, notebook_id: id, title: body.title, description: body.description,
    status: "proposed", created_by: user.id,
  }).select("*").single();
  if (contradictionError) throw contradictionError;
  const { data: evidence, error: evidenceError } = await db.from("investigation_contradiction_evidence").insert(
    rows.map((row) => ({ ...row, contradiction_id: contradiction.id })),
  ).select("*");
  if (evidenceError) {
    await db.from("investigation_contradictions").delete().eq("id", contradiction.id).eq("notebook_id", id);
    throw evidenceError;
  }
  const { error: auditError } = await db.from("audit_log").insert({
    workspace_id: workspaceId, actor_id: user.id, action: "investigation.graph.contradiction.create",
    target_type: "investigation_contradiction", target_id: contradiction.id,
    meta: { notebook_id: id, evidence_count: evidence?.length ?? 0, source_count: sourceIds.length },
  });
  if (auditError) throw auditError;
  return NextResponse.json({ contradiction, evidence }, { status: 201 });
});
