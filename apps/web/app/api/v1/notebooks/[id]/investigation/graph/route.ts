import { NextResponse, type NextRequest } from "next/server";
import { ApiError, handle, parseBody, requireRole, requireUser } from "@/lib/api";
import { createServiceClient, createUserClient } from "@/lib/supabase/server";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };
const uuid = z.string().uuid();
const createNodeSchema = z.object({
  entity_id: uuid,
  cluster_id: uuid.optional(),
  canonical_label: z.string().trim().min(1).max(240).optional(),
  match_rationale: z.string().trim().max(2000).optional(),
}).strict().superRefine((value, ctx) => {
  if (!value.cluster_id && !value.canonical_label) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Un libellé canonique est requis pour créer un nœud.", path: ["canonical_label"] });
  }
});

/** Lecture du graphe et de ses éléments de provenance, sous RLS du dossier. */
export const GET = handle(async (_req: NextRequest, { params }: Params) => {
  await requireUser();
  const { id } = await params;
  await requireRole(id, "viewer");
  const db = await createUserClient();
  const [
    clusters, mentions, entityRecords, relations, relationEvidence, sourceLineage,
    contradictions, contradictionEvidence, events,
  ] = await Promise.all([
    db.from("investigation_entity_clusters").select("*").eq("notebook_id", id).order("canonical_label"),
    db.from("investigation_entity_mentions").select("*").eq("notebook_id", id).order("created_at"),
    db.from("investigation_entities").select("id, source_id, entity_type, label, context_excerpt, page_number, char_start, char_end, verification_status, origin").eq("notebook_id", id).order("created_at"),
    db.from("investigation_relations").select("*").eq("notebook_id", id).order("created_at", { ascending: false }),
    db.from("investigation_relation_evidence").select("*").eq("notebook_id", id).order("created_at"),
    db.from("investigation_source_lineage").select("*").eq("notebook_id", id).order("created_at"),
    db.from("investigation_contradictions").select("*").eq("notebook_id", id).order("created_at", { ascending: false }),
    db.from("investigation_contradiction_evidence").select("*").eq("notebook_id", id).order("created_at"),
    db.from("investigation_events").select("id, source_id, title, description, original_date_text, occurred_at_start, occurred_at_end, date_precision, context_excerpt, page_number, char_start, char_end, verification_status, created_at").eq("notebook_id", id).order("occurred_at_start", { ascending: true, nullsFirst: false }),
  ]);
  for (const result of [clusters, mentions, entityRecords, relations, relationEvidence, sourceLineage, contradictions, contradictionEvidence, events]) {
    if (result.error) throw result.error;
  }
  return NextResponse.json({
    clusters: clusters.data ?? [],
    mentions: mentions.data ?? [],
    entityRecords: entityRecords.data ?? [],
    relations: relations.data ?? [],
    relationEvidence: relationEvidence.data ?? [],
    sourceLineage: sourceLineage.data ?? [],
    contradictions: contradictions.data ?? [],
    contradictionEvidence: contradictionEvidence.data ?? [],
    events: events.data ?? [],
  });
});

/**
 * Crée un nœud canonique candidat et rattache une mention existante.
 * Le rattachement n'est jamais confirmé automatiquement : un homonyme reste distinct
 * tant qu'un éditeur n'a pas explicitement validé le rapprochement.
 */
export const POST = handle(async (req: NextRequest, { params }: Params) => {
  const user = await requireUser();
  const { id } = await params;
  await requireRole(id, "editor");
  const body = await parseBody(req, createNodeSchema);
  const db = createServiceClient();
  const { data: mention, error: mentionError } = await db.from("investigation_entities")
    .select("id, workspace_id, notebook_id, source_id, entity_type, label")
    .eq("id", body.entity_id).eq("notebook_id", id).maybeSingle();
  if (mentionError) throw mentionError;
  if (!mention) throw new ApiError(404, "entity_mention_not_found");

  let cluster: { id: string; workspace_id: string; notebook_id: string; entity_type: string; canonical_label: string; status: string };
  if (body.cluster_id) {
    const { data: existingCluster, error: existingClusterError } = await db.from("investigation_entity_clusters")
      .select("*").eq("id", body.cluster_id).eq("notebook_id", id).maybeSingle();
    if (existingClusterError) throw existingClusterError;
    if (!existingCluster) throw new ApiError(404, "graph_node_not_found");
    if (existingCluster.entity_type !== mention.entity_type) throw new ApiError(422, "entity_type_mismatch");
    if (existingCluster.status !== "candidate" && existingCluster.status !== "confirmed") throw new ApiError(409, "graph_node_not_linkable");
    cluster = existingCluster;
  } else {
    const { data: createdCluster, error: clusterError } = await db.from("investigation_entity_clusters").insert({
      workspace_id: mention.workspace_id,
      notebook_id: id,
      entity_type: mention.entity_type,
      canonical_label: body.canonical_label,
      status: "candidate",
      created_by: user.id,
    }).select("*").single();
    if (clusterError) throw clusterError;
    cluster = createdCluster;
  }

  const { data: link, error: linkError } = await db.from("investigation_entity_mentions").insert({
    workspace_id: mention.workspace_id,
    notebook_id: id,
    entity_id: mention.id,
    cluster_id: cluster.id,
    match_status: "candidate",
    match_rationale: body.match_rationale ?? null,
    created_by: user.id,
  }).select("*").single();
  if (linkError) {
    if (!body.cluster_id) await db.from("investigation_entity_clusters").delete().eq("id", cluster.id).eq("notebook_id", id);
    if (linkError.code === "23505") throw new ApiError(409, "entity_already_linked");
    throw linkError;
  }

  const { error: auditError } = await db.from("audit_log").insert({
    workspace_id: mention.workspace_id,
    actor_id: user.id,
    action: body.cluster_id ? "investigation.graph.entity_mention.link" : "investigation.graph.entity_candidate.create",
    target_type: "investigation_entity_cluster",
    target_id: cluster.id,
    meta: { notebook_id: id, entity_id: mention.id, cluster_id: cluster.id, match_status: "candidate" },
  });
  if (auditError) throw auditError;
  return NextResponse.json({ cluster, mention: link }, { status: 201 });
});
