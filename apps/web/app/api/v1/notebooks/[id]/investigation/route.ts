import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { ApiError, handle, parseBody, requireRole, requireUser } from "@/lib/api";
import { createServiceClient, createUserClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };
const uuid = z.string().uuid();
const sourceFields = {
  source_id: uuid,
  context_excerpt: z.string().trim().min(1).max(4000),
  page_number: z.number().int().positive().nullable().optional(),
};
const entitySchema = z.object({
  kind: z.literal("entity"), ...sourceFields,
  entity_type: z.enum(["person","place","vehicle","object","organization"]),
  label: z.string().trim().min(1).max(240),
  char_start: z.number().int().nonnegative().nullable().optional(),
  char_end: z.number().int().positive().nullable().optional(),
}).strict();
const eventSchema = z.object({
  kind: z.literal("event"), ...sourceFields,
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().min(1).max(4000),
  original_date_text: z.string().trim().min(1).max(160),
  occurred_at_start: z.string().datetime({ offset: true }).nullable().optional(),
  occurred_at_end: z.string().datetime({ offset: true }).nullable().optional(),
  date_precision: z.enum(["exact","approximate","range","unknown"]),
}).strict();
const statementSchema = z.object({
  kind: z.literal("statement"), ...sourceFields,
  statement_type: z.enum(["documented_fact","testimony","unverified_information","hypothesis","contradiction"]),
  content: z.string().trim().min(1).max(5000),
  speaker_label: z.string().trim().max(240).nullable().optional(),
  recorded_at: z.string().datetime({ offset: true }).nullable().optional(),
}).strict();
const leadSchema = z.object({
  kind: z.literal("lead"), source_id: uuid,
  title: z.string().trim().min(1).max(240),
  verification_question: z.string().trim().min(1).max(3000),
  supporting_excerpt: z.string().trim().min(1).max(4000),
  counter_evidence: z.string().max(4000).default(""),
  next_check: z.string().trim().min(1).max(2000),
  confidence: z.enum(["low","moderate","high"]).default("low"),
  page_number: z.number().int().positive().nullable().optional(),
}).strict();
const createSchema = z.discriminatedUnion("kind", [entitySchema,eventSchema,statementSchema,leadSchema]).superRefine((value, ctx) => {
  if (value.kind === "entity") {
    if (value.char_start != null && value.char_end != null && value.char_end <= value.char_start) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Offsets invalides.", path: ["char_end"] });
    }
    if (!value.context_excerpt.includes(value.label)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Le libellé doit apparaître dans l’extrait source.", path: ["label"] });
    }
  }
  if (value.kind === "event" && value.occurred_at_start && value.occurred_at_end
      && new Date(value.occurred_at_end) < new Date(value.occurred_at_start)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Intervalle de dates invalide.", path: ["occurred_at_end"] });
  }
  if (value.kind === "statement" && value.speaker_label && !value.context_excerpt.includes(value.speaker_label)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "L’attribution doit apparaître dans l’extrait source.", path: ["speaker_label"] });
  }
});

const TABLES = {
  entity: "investigation_entities",
  event: "investigation_events",
  statement: "investigation_statements",
  lead: "investigation_leads",
} as const;

/** Registre structuré du dossier. Toutes les entrées sont rattachées à une source du même dossier. */
export const GET = handle(async (_req: NextRequest, { params }: Params) => {
  await requireUser();
  const { id } = await params;
  await requireRole(id, "viewer");
  const db = await createUserClient();
  const [entities, events, statements, leads, leadEvidence, extractionJobs] = await Promise.all([
    db.from("investigation_entities").select("*").eq("notebook_id", id).order("created_at", { ascending: false }),
    db.from("investigation_events").select("*").eq("notebook_id", id).order("occurred_at_start", { ascending: true, nullsFirst: false }),
    db.from("investigation_statements").select("*").eq("notebook_id", id).order("created_at", { ascending: false }),
    db.from("investigation_leads").select("*").eq("notebook_id", id).order("created_at", { ascending: false }),
    db.from("investigation_lead_evidence").select("id, lead_id, source_id, evidence_role, quote, page_number").eq("notebook_id", id).order("created_at", { ascending: true }),
    db.from("jobs").select("id, kind, target_id, status, progress, stage, error_code, created_at").eq("notebook_id", id).in("kind", ["investigation_extract", "investigation_crosscheck"]).order("created_at", { ascending: false }).limit(30),
  ]);
  for (const result of [entities,events,statements,leads,leadEvidence,extractionJobs]) if (result.error) throw result.error;
  return NextResponse.json({
    entities: entities.data ?? [],
    events: events.data ?? [],
    statements: statements.data ?? [],
    leads: leads.data ?? [],
    leadEvidence: leadEvidence.data ?? [],
    extractionJobs: extractionJobs.data ?? [],
  });
});

export const POST = handle(async (req: NextRequest, { params }: Params) => {
  const user = await requireUser();
  const { id } = await params;
  await requireRole(id, "editor");
  const body = await parseBody(req, createSchema);
  const db = createServiceClient();
  const { data: source, error: sourceError } = await db.from("sources")
    .select("id, workspace_id, status, extracted_text").eq("id", body.source_id).eq("notebook_id", id).maybeSingle();
  if (sourceError) throw sourceError;
  if (!source) throw new ApiError(422, "source_not_in_dossier");
  if (source.status !== "ready") throw new ApiError(409, "source_not_ready");
  const exactExcerpt = body.kind === "lead" ? body.supporting_excerpt : body.context_excerpt;
  if (!source.extracted_text || !source.extracted_text.includes(exactExcerpt)) throw new ApiError(422, "source_excerpt_not_found");
  if (body.kind === "entity" && body.char_start != null && body.char_end != null && source.extracted_text.slice(body.char_start, body.char_end) !== body.context_excerpt) throw new ApiError(422, "source_offset_mismatch");
  const { kind, ...fields } = body;
  const { data, error } = await db.from(TABLES[kind])
    .insert({ ...fields, notebook_id: id, workspace_id: source.workspace_id, created_by: user.id })
    .select("*").single();
  if (error) throw error;
  if (kind === "lead") {
    const quote = body.supporting_excerpt;
    const charStart = source.extracted_text.indexOf(quote);
    const { error: evidenceError } = await db.from("investigation_lead_evidence").insert({
      workspace_id: source.workspace_id, notebook_id: id, lead_id: data.id, source_id: source.id,
      evidence_role: "support", quote, quote_hash: createHash("sha256").update(quote).digest("hex"), page_number: body.page_number ?? null,
      char_start: charStart >= 0 ? charStart : null, char_end: charStart >= 0 ? charStart + quote.length : null,
    });
    if (evidenceError) { await db.from("investigation_leads").delete().eq("id", data.id); throw evidenceError; }
  }
  await db.from("audit_log").insert({
    workspace_id: source.workspace_id, actor_id: user.id,
    action: `investigation.${kind}.create`, target_type: `investigation_${kind}`, target_id: data.id,
    meta: { notebook_id: id, source_id: source.id },
  });
  return NextResponse.json({ record: data }, { status: 201 });
});
