"use client";

import * as React from "react";
import { AlertTriangle, ArrowRight, Check, GitBranch, Network, RefreshCw, ShieldCheck, X } from "lucide-react";
import { Badge, EmptyState } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/surfaces";
import { toast } from "@/components/ui/toast";

type Source = { id: string; title: string; status: string };
type Cluster = { id: string; entity_type: string; canonical_label: string; status: string; created_at: string };
type EntityRecord = { id: string; source_id: string; entity_type: string; label: string; context_excerpt: string; page_number: number | null; verification_status: string; origin: string };
type Mention = { id: string; entity_id: string; cluster_id: string; match_status: string; match_rationale: string | null };
type Relation = { id: string; subject_cluster_id: string; object_cluster_id: string; relation_type: string; description: string | null; status: string };
type RelationEvidence = { id: string; relation_id: string; source_id: string; evidence_role: string; quote: string; page_number: number | null };
type EventRecord = { id: string; source_id: string; title: string; description: string; original_date_text: string; occurred_at_start: string | null; occurred_at_end: string | null; date_precision: string; context_excerpt: string; page_number: number | null; verification_status: string };
type SourceLineage = { id: string; parent_source_id: string; child_source_id: string; lineage_type: string; note: string | null };
type StatementRecord = { id: string; source_id: string; statement_type: string; content: string; speaker_label: string | null; context_excerpt: string; page_number: number | null; verification_status: string };
type Contradiction = { id: string; title: string; description: string; status: string };
type ContradictionEvidence = { id: string; contradiction_id: string; statement_id: string; source_id: string; position: string; quote: string; page_number: number | null };
type GraphData = {
  clusters: Cluster[];
  mentions: Mention[];
  entityRecords: EntityRecord[];
  relations: Relation[];
  relationEvidence: RelationEvidence[];
  sourceLineage: SourceLineage[];
  contradictions: Contradiction[];
  contradictionEvidence: ContradictionEvidence[];
  events: EventRecord[];
  statements: StatementRecord[];
};
type View = "graph" | "timeline" | "contradictions" | "provenance";

const empty: GraphData = { clusters: [], mentions: [], entityRecords: [], relations: [], relationEvidence: [], sourceLineage: [], contradictions: [], contradictionEvidence: [], events: [], statements: [] };
const entityLabels: Record<string,string> = { person: "Personne", place: "Lieu", vehicle: "Véhicule", object: "Objet", organization: "Organisation" };
const relationLabels: Record<string,string> = { knows: "connaît", reported_about: "a déclaré au sujet de", seen_at: "aurait été vu à", located_at: "situé à", travelled_in: "aurait voyagé dans", owns: "posséderait", uses: "aurait utilisé", works_for: "travaillerait pour", related_to: "serait lié à", present_with: "aurait été présent avec", contacted: "aurait contacté", mentioned_with: "mentionné avec", other: "relation à préciser" };

export function InvestigationGraphPanel({ notebookId, canEdit, sources, onOpenSource }: {
  notebookId: string; canEdit: boolean; sources: Source[]; onOpenSource: (sourceId: string) => void;
}) {
  const [data, setData] = React.useState<GraphData>(empty);
  const [loading, setLoading] = React.useState(true);
  const [view, setView] = React.useState<View>("graph");
  const [creatingNode, setCreatingNode] = React.useState<string | null>(null);
  const [linkTargets, setLinkTargets] = React.useState<Record<string,string>>({});
  const [creatingRelation, setCreatingRelation] = React.useState(false);
  const [subjectId, setSubjectId] = React.useState("");
  const [objectId, setObjectId] = React.useState("");
  const [sourceId, setSourceId] = React.useState("");
  const [relationType, setRelationType] = React.useState("seen_at");
  const [quote, setQuote] = React.useState("");
  const [lineageParent, setLineageParent] = React.useState("");
  const [lineageChild, setLineageChild] = React.useState("");
  const [lineageType, setLineageType] = React.useState("copy");
  const [lineageNote, setLineageNote] = React.useState("");
  const [contradictionTitle, setContradictionTitle] = React.useState("");
  const [contradictionDescription, setContradictionDescription] = React.useState("");
  const [statementA, setStatementA] = React.useState("");
  const [statementB, setStatementB] = React.useState("");
  const [quoteA, setQuoteA] = React.useState("");
  const [quoteB, setQuoteB] = React.useState("");
  const [savingLineage, setSavingLineage] = React.useState(false);
  const [savingContradiction, setSavingContradiction] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/notebooks/${notebookId}/investigation/graph`);
      if (!response.ok) throw new Error("graph_load_failed");
      setData(await response.json() as GraphData);
    } catch {
      toast({ title: "Chargement du graphe impossible", tone: "error" });
    } finally { setLoading(false); }
  }, [notebookId]);
  React.useEffect(() => { void load(); }, [load]);

  const sourceTitle = (id: string) => sources.find((source) => source.id === id)?.title ?? "Source du dossier";
  const unlinkedEntities = data.entityRecords.filter((entity) => {
    const existing = data.mentions.find((mention) => mention.entity_id === entity.id);
    return !existing || existing.match_status === "rejected";
  });
  const confirmedClusters = data.clusters.filter((cluster) => cluster.status === "confirmed");

  const createNode = async (entity: EntityRecord, clusterId?: string) => {
    setCreatingNode(entity.id);
    try {
      const response = await fetch(`/api/v1/notebooks/${notebookId}/investigation/graph`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ entity_id: entity.id, ...(clusterId ? { cluster_id: clusterId } : { canonical_label: entity.label }), match_rationale: clusterId ? "Rapprochement proposé par un éditeur ; validation explicite requise." : "Nœud candidat créé à partir d'une mention source. Identité non confirmée." }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "node_create_failed");
      toast({ title: "Nœud candidat créé", description: "L'identité reste à confirmer par un éditeur.", tone: "success" });
      await load();
    } catch (error) {
      toast({ title: "Création impossible", description: error instanceof Error ? error.message : "node_create_failed", tone: "error" });
    } finally { setCreatingNode(null); }
  };

  const createRelation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!subjectId || !objectId || !sourceId || !quote.trim()) return;
    setCreatingRelation(true);
    try {
      const response = await fetch(`/api/v1/notebooks/${notebookId}/investigation/graph/relations`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ subject_cluster_id: subjectId, object_cluster_id: objectId, relation_type: relationType, source_id: sourceId, quote }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "relation_create_failed");
      setQuote("");
      toast({ title: "Relation proposée", description: "Elle reste non confirmée jusqu'à la revue humaine.", tone: "success" });
      await load();
    } catch (error) {
      toast({ title: "Relation non enregistrée", description: error instanceof Error ? error.message : "relation_create_failed", tone: "error" });
    } finally { setCreatingRelation(false); }
  };

  const createLineage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!lineageParent || !lineageChild || lineageParent === lineageChild) return;
    setSavingLineage(true);
    try {
      const response = await fetch("/api/v1/notebooks/" + notebookId + "/investigation/graph/lineage", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ parent_source_id: lineageParent, child_source_id: lineageChild, lineage_type: lineageType, note: lineageNote || undefined }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "lineage_create_failed");
      setLineageNote("");
      toast({ title: "Filiation documentaire enregistrée", description: "Le lien original → dérivé est conservé dans le dossier.", tone: "success" });
      await load();
    } catch (error) {
      toast({ title: "Filiation non enregistrée", description: error instanceof Error ? error.message : "lineage_create_failed", tone: "error" });
    } finally { setSavingLineage(false); }
  };

  const createContradiction = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!statementA || !statementB || statementA === statementB || !quoteA.trim() || !quoteB.trim()) return;
    setSavingContradiction(true);
    try {
      const response = await fetch("/api/v1/notebooks/" + notebookId + "/investigation/graph/contradictions", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: contradictionTitle, description: contradictionDescription,
          evidence: [
            { statement_id: statementA, position: "conflicts", quote: quoteA },
            { statement_id: statementB, position: "conflicts", quote: quoteB },
          ],
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "contradiction_create_failed");
      setContradictionTitle(""); setContradictionDescription(""); setStatementA(""); setStatementB(""); setQuoteA(""); setQuoteB("");
      toast({ title: "Contradiction proposée", description: "Les deux déclarations et leurs sources sont conservées séparément.", tone: "success" });
      await load();
    } catch (error) {
      toast({ title: "Contradiction non enregistrée", description: error instanceof Error ? error.message : "contradiction_create_failed", tone: "error" });
    } finally { setSavingContradiction(false); }
  };

  const review = async (kind: "cluster" | "mention" | "relation" | "contradiction", recordId: string, status: "confirmed" | "rejected" | "resolved") => {
    try {
      const response = await fetch(`/api/v1/notebooks/${notebookId}/investigation/graph/${kind}/${recordId}`, {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("review_failed");
      toast({ title: status === "confirmed" ? "Élément confirmé par l'éditeur" : "Élément rejeté", tone: "success" });
      await load();
    } catch { toast({ title: "Revue impossible", tone: "error" }); }
  };

  const positions = data.clusters.map((cluster, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(data.clusters.length, 1) - Math.PI / 2;
    return { id: cluster.id, x: 450 + Math.cos(angle) * (data.clusters.length > 5 ? 320 : 230), y: 245 + Math.sin(angle) * (data.clusters.length > 5 ? 165 : 125) };
  });
  const positionById = new Map(positions.map((point) => [point.id, point]));

  return (
    <Panel id="investigation-graph" title="Graphe d'enquête" className="h-full">
      <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label="Nœuds canoniques" value={data.clusters.length} />
          <Metric label="Mentions sources" value={data.mentions.length} />
          <Metric label="Relations" value={data.relations.length} />
          <Metric label="Contradictions" value={data.contradictions.length} />
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg border border-border-subtle bg-surface-secondary p-1">
          {([
            ["graph","Graphe",Network],["timeline","Chronologie",GitBranch],
            ["contradictions","Contradictions",AlertTriangle],["provenance","Provenance",ShieldCheck],
          ] as const).map(([key,label,Icon]) => (
            <button key={key} type="button" onClick={() => setView(key)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors ${view === key ? "bg-surface-raised text-text shadow-sm" : "text-text-muted hover:text-text"}`}>
              <Icon className="size-3.5" aria-hidden />{label}
            </button>
          ))}
          <button type="button" onClick={() => void load()} className="ml-auto inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs text-text-muted hover:text-text" aria-label="Actualiser le graphe">
            <RefreshCw className="size-3.5" aria-hidden /> Actualiser
          </button>
        </div>

        {loading ? <div className="rounded-lg border border-border p-8 text-center text-sm text-text-muted">Chargement des relations documentaires…</div> : (
          <>
            {view === "graph" && (
              <section className="grid gap-3">
                <div className="overflow-hidden rounded-xl border border-border bg-surface-secondary">
                  {data.clusters.length === 0 ? (
                    <EmptyState title="Le graphe est encore vide" description="Créez des nœuds candidats à partir des mentions extraites. Aucun homonyme ne sera fusionné automatiquement." />
                  ) : (
                    <svg viewBox="0 0 900 490" role="img" aria-label="Graphe des entités et relations du dossier" className="h-auto max-h-[520px] w-full">
                      <defs><marker id="graph-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="currentColor" /></marker></defs>
                      {data.relations.map((relation) => {
                        const a = positionById.get(relation.subject_cluster_id);
                        const b = positionById.get(relation.object_cluster_id);
                        if (!a || !b) return null;
                        return <g key={relation.id}>
                          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="currentColor" strokeOpacity={relation.status === "confirmed" ? 0.65 : 0.25} strokeWidth={relation.status === "confirmed" ? 2.5 : 1.5} strokeDasharray={relation.status === "confirmed" ? undefined : "5 5"} markerEnd="url(#graph-arrow)" />
                          <text x={(a.x+b.x)/2} y={(a.y+b.y)/2-8} textAnchor="middle" fontSize="11" fill="currentColor">{relationLabels[relation.relation_type] ?? relation.relation_type}</text>
                        </g>;
                      })}
                      {positions.map((point) => {
                        const node = data.clusters.find((cluster) => cluster.id === point.id)!;
                        return <g key={point.id}>
                          <circle cx={point.x} cy={point.y} r="34" fill="currentColor" fillOpacity={node.status === "confirmed" ? 0.16 : 0.07} stroke="currentColor" strokeOpacity={node.status === "confirmed" ? 0.8 : 0.35} strokeWidth="2" />
                          <text x={point.x} y={point.y+4} textAnchor="middle" fontSize="10" fill="currentColor">{entityLabels[node.entity_type] ?? "Entité"}</text>
                          <text x={point.x} y={point.y+51} textAnchor="middle" fontSize="13" fill="currentColor">{node.canonical_label.slice(0,22)}</text>
                        </g>;
                      })}
                    </svg>
                  )}
                </div>
                <div className="grid gap-2">
                  <h3 className="text-sm font-semibold">Nœuds et rapprochements</h3>
                  {data.clusters.map((cluster) => (
                    <div key={cluster.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{cluster.canonical_label}</div>
                        <div className="text-xs text-text-muted">{entityLabels[cluster.entity_type]} · {data.mentions.filter((mention) => mention.cluster_id === cluster.id).length} mention(s) · {cluster.status === "confirmed" ? "Identité confirmée" : cluster.status === "rejected" ? "Rejeté" : "Candidat"}</div>
                      </div>
                      {canEdit && cluster.status === "candidate" && <div className="flex gap-1">
                        <Button size="sm" variant="secondary" onClick={() => void review("cluster",cluster.id,"confirmed")}><Check className="size-3.5"/>Confirmer</Button>
                        <Button size="sm" variant="ghost" onClick={() => void review("cluster",cluster.id,"rejected")}><X className="size-3.5"/>Rejeter</Button>
                      </div>}
                    </div>
                  ))}
                </div>
                {data.relations.length > 0 && <div className="grid gap-2">
                  <h3 className="text-sm font-semibold">Relations et justificatifs</h3>
                  {data.relations.map((relation) => (
                    <div key={relation.id} className="grid gap-2 rounded-lg border border-border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-medium">{data.clusters.find((node) => node.id === relation.subject_cluster_id)?.canonical_label ?? "Nœud"} <span className="text-text-muted">{relationLabels[relation.relation_type] ?? relation.relation_type}</span> {data.clusters.find((node) => node.id === relation.object_cluster_id)?.canonical_label ?? "Nœud"}</div>
                        <Badge>{relation.status === "confirmed" ? "Confirmée" : relation.status === "rejected" ? "Rejetée" : "Proposée"}</Badge>
                      </div>
                      {relation.description && <p className="text-xs text-text-muted">{relation.description}</p>}
                      {data.relationEvidence.filter((item) => item.relation_id === relation.id).map((item) => (
                        <div key={item.id} className="rounded-md bg-surface-secondary p-2">
                          <div className="text-[11px] text-text-muted">{item.evidence_role === "contrary" ? "Élément contraire" : item.evidence_role === "context" ? "Contexte" : "Élément favorable"} · {sourceTitle(item.source_id)}</div>
                          <p className="mt-1 text-xs">« {item.quote} »</p>
                          <button type="button" onClick={() => onOpenSource(item.source_id)} className="mt-1 text-xs text-accent hover:underline">Ouvrir la source{item.page_number ? ` · p. ${item.page_number}` : ""}</button>
                        </div>
                      ))}
                      {canEdit && relation.status === "proposed" && <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => void review("relation",relation.id,"confirmed")}><Check className="size-3.5"/>Confirmer</Button>
                        <Button size="sm" variant="ghost" onClick={() => void review("relation",relation.id,"rejected")}><X className="size-3.5"/>Rejeter</Button>
                      </div>}
                    </div>
                  ))}
                </div>}
                {data.mentions.length > 0 && <div className="grid gap-2">
                  <h3 className="text-sm font-semibold">Rapprochements des mentions</h3>
                  {data.mentions.map((mention) => {
                    const entity = data.entityRecords.find((item) => item.id === mention.entity_id);
                    const cluster = data.clusters.find((item) => item.id === mention.cluster_id);
                    if (!entity || !cluster) return null;
                    return <div key={mention.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-2">
                      <div className="min-w-0 text-xs"><span className="font-medium">{entity.label}</span><span className="text-text-muted"> → {cluster.canonical_label} · {mention.match_status === "confirmed" ? "Rapprochement confirmé" : mention.match_status === "rejected" ? "Rapprochement rejeté" : "À examiner"}</span></div>
                      {canEdit && mention.match_status === "candidate" && <div className="flex gap-1">
                        <Button size="sm" variant="secondary" onClick={() => void review("mention",mention.id,"confirmed")}>Confirmer le rapprochement</Button>
                        <Button size="sm" variant="ghost" onClick={() => void review("mention",mention.id,"rejected")}>Rejeter</Button>
                      </div>}
                    </div>;
                  })}
                </div>}
                {canEdit && unlinkedEntities.length > 0 && (
                  <div className="grid gap-2">
                    <h3 className="text-sm font-semibold">Mentions à transformer en nœuds candidats</h3>
                    <p className="text-xs text-text-muted">Chaque mention crée son propre nœud. Le rapprochement de deux mentions reste une décision distincte à valider.</p>
                    {unlinkedEntities.map((entity) => (
                      <div key={entity.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm">{entity.label}</div>
                          <div className="truncate text-xs text-text-muted">{entityLabels[entity.entity_type]} · {sourceTitle(entity.source_id)}{entity.page_number ? ` · p. ${entity.page_number}` : ""}</div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
  {data.clusters.some((cluster) => cluster.entity_type === entity.entity_type && cluster.status !== "rejected") && <>
    <select aria-label="Rattacher à un nœud existant" value={linkTargets[entity.id] ?? ""} onChange={(event) => setLinkTargets((old) => ({ ...old, [entity.id]: event.target.value }))} className="h-8 max-w-40 rounded-md border border-border bg-surface px-2 text-xs">
      <option value="">Rattacher à…</option>{data.clusters.filter((cluster) => cluster.entity_type === entity.entity_type && cluster.status !== "rejected").map((cluster) => <option key={cluster.id} value={cluster.id}>{cluster.canonical_label}</option>)}
    </select>
    <Button size="sm" variant="secondary" disabled={creatingNode === entity.id || !linkTargets[entity.id]} onClick={() => void createNode(entity, linkTargets[entity.id])}>Rattacher</Button>
  </>}
  <Button size="sm" variant="secondary" disabled={creatingNode === entity.id} onClick={() => void createNode(entity)}>{creatingNode === entity.id ? "Création…" : "Créer le nœud"}</Button>
</div>
                      </div>
                    ))}
                  </div>
                )}
                {canEdit && confirmedClusters.length >= 2 && (
                  <form onSubmit={createRelation} className="grid gap-2 rounded-xl border border-border p-3">
                    <h3 className="text-sm font-semibold">Proposer une relation sourcée</h3>
                    <p className="text-xs text-text-muted">La citation doit être présente exactement dans le document. La relation restera proposée jusqu'à revue.</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <select required value={subjectId} onChange={(event) => setSubjectId(event.target.value)} className="h-10 rounded-md border border-border bg-surface px-3 text-sm">
                        <option value="">Nœud de départ</option>{confirmedClusters.map((node) => <option key={node.id} value={node.id}>{node.canonical_label}</option>)}
                      </select>
                      <select required value={objectId} onChange={(event) => setObjectId(event.target.value)} className="h-10 rounded-md border border-border bg-surface px-3 text-sm">
                        <option value="">Nœud d'arrivée</option>{confirmedClusters.map((node) => <option key={node.id} value={node.id}>{node.canonical_label}</option>)}
                      </select>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <select required value={relationType} onChange={(event) => setRelationType(event.target.value)} className="h-10 rounded-md border border-border bg-surface px-3 text-sm">
                        {Object.entries(relationLabels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}
                      </select>
                      <select required value={sourceId} onChange={(event) => setSourceId(event.target.value)} className="h-10 rounded-md border border-border bg-surface px-3 text-sm">
                        <option value="">Document source</option>{sources.filter((source) => source.status === "ready").map((source) => <option key={source.id} value={source.id}>{source.title}</option>)}
                      </select>
                    </div>
                    <textarea required minLength={1} maxLength={4000} value={quote} onChange={(event) => setQuote(event.target.value)} placeholder="Citation exacte du document qui soutient ou nuance la relation…" className="min-h-20 rounded-md border border-border bg-surface px-3 py-2 text-sm" />
                    <Button type="submit" size="sm" disabled={creatingRelation || !subjectId || !objectId || subjectId === objectId || !sourceId || !quote.trim()}>{creatingRelation ? "Enregistrement…" : "Proposer la relation"}</Button>
                  </form>
                )}
              </section>
            )}

            {view === "timeline" && (
              <section className="grid gap-2">
                <h3 className="text-sm font-semibold">Chronologie multi-sources</h3>
                {data.events.length === 0 ? <EmptyState title="Aucun événement extrait" description="Les événements documentaires apparaîtront ici avec leur date originale et leur source." /> : [...data.events].sort((a,b) => (a.occurred_at_start ?? "9999").localeCompare(b.occurred_at_start ?? "9999")).map((event) => (
                  <div key={event.id} className="grid grid-cols-[auto_1fr] gap-3 rounded-lg border border-border p-3">
                    <div className="flex min-w-24 flex-col items-center text-center">
                      <span className="text-xs font-semibold">{event.occurred_at_start ? new Date(event.occurred_at_start).toLocaleDateString("fr-FR") : "Date inconnue"}</span>
                      <span className="text-[10px] text-text-muted">{event.date_precision === "exact" ? "Date exacte rapportée" : event.date_precision === "approximate" ? "Période approximative" : event.date_precision === "range" ? "Intervalle" : "Non précisée"}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{event.title}</div>
                      <p className="mt-1 text-xs text-text-muted">{event.description}</p>
                      <button type="button" onClick={() => onOpenSource(event.source_id)} className="mt-2 text-xs text-accent hover:underline">{sourceTitle(event.source_id)}{event.page_number ? ` · page ${event.page_number}` : ""}</button>
                      <p className="mt-1 whitespace-pre-wrap text-xs text-text-muted">« {event.context_excerpt} »</p>
                    </div>
                  </div>
                ))}
              </section>
            )}

            {view === "contradictions" && (
              <section className="grid gap-2">
                <h3 className="text-sm font-semibold">Contradictions documentaires</h3>
                {data.contradictions.length === 0 ? <EmptyState title="Aucune contradiction consignée" description="Les contradictions devront relier des déclarations provenant d'au moins deux sources distinctes." /> : data.contradictions.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-medium">{item.title}</h4><Badge>{item.status === "proposed" ? "À examiner" : item.status}</Badge></div>
                    <p className="mt-1 text-xs text-text-muted">{item.description}</p>
                    <div className="mt-3 grid gap-2">
                      {data.contradictionEvidence.filter((evidence) => evidence.contradiction_id === item.id).map((evidence) => (
                        <div key={evidence.id} className="rounded-md bg-surface-secondary p-2">
                          <div className="text-[11px] text-text-muted">{evidence.position === "conflicts" ? "Déclaration en tension" : evidence.position === "qualifies" ? "Nuance" : "Contexte"} · {sourceTitle(evidence.source_id)}</div>
                          <p className="mt-1 text-xs">« {evidence.quote} »</p>
                          <button type="button" onClick={() => onOpenSource(evidence.source_id)} className="mt-1 text-xs text-accent hover:underline">Ouvrir la source</button>
                        </div>
                      ))}
                    </div>
                    {canEdit && item.status === "proposed" && <div className="mt-3 flex gap-2"><Button size="sm" variant="secondary" onClick={() => void review("contradiction",item.id,"resolved")}>Marquer comme résolue</Button></div>}
                  </div>
                ))}
              </section>
            )}

            {view === "provenance" && (
              <section className="grid gap-2">
                <h3 className="text-sm font-semibold">Filiation des documents</h3>
                {data.sourceLineage.length === 0 ? <EmptyState title="Aucune filiation enregistrée" description="Les copies, extraits, traductions et transcriptions peuvent être reliés à leur document d'origine pour éviter de compter plusieurs fois une même information." /> : data.sourceLineage.map((lineage) => (
                  <div key={lineage.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3 text-sm">
                    <button type="button" onClick={() => onOpenSource(lineage.parent_source_id)} className="text-accent hover:underline">{sourceTitle(lineage.parent_source_id)}</button>
                    <ArrowRight className="size-4 text-text-muted"/>
                    <button type="button" onClick={() => onOpenSource(lineage.child_source_id)} className="text-accent hover:underline">{sourceTitle(lineage.child_source_id)}</button>
                    <Badge>{lineage.lineage_type}</Badge>
                    {lineage.note && <p className="w-full text-xs text-text-muted">{lineage.note}</p>}
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border border-border bg-surface-secondary p-3"><div className="text-xl font-semibold tabular-nums">{value}</div><div className="text-[11px] text-text-muted">{label}</div></div>;
}
