"use client";

import * as React from "react";
import { AlertTriangle, Check, FileText, Plus, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Panel } from "@/components/ui/surfaces";
import { toast } from "@/components/ui/toast";

type Source = { id: string; title: string; status: string };
type Common = { id: string; source_id: string; context_excerpt?: string; page_number?: number | null; verification_status?: string; origin?: "manual" | "ai_extracted" };
type Entity = Common & { entity_type: string; label: string };
type EventRecord = Common & { title: string; description: string; original_date_text: string; date_precision: string };
type Statement = Common & { statement_type: string; content: string; speaker_label?: string | null };
type Lead = Common & { title: string; verification_question: string; supporting_excerpt: string; counter_evidence: string; next_check: string; confidence: string; status: string };
type ExtractionJob = { id: string; kind: string; target_id: string | null; status: string; progress: number; stage: string | null; error_code: string | null; created_at: string };
type LeadEvidence = { id: string; lead_id: string; source_id: string; evidence_role: "support" | "contrary"; quote: string; page_number: number | null };
type Data = { entities: Entity[]; events: EventRecord[]; statements: Statement[]; leads: Lead[]; leadEvidence: LeadEvidence[]; extractionJobs: ExtractionJob[] };
type Kind = "entity" | "event" | "statement" | "lead";

const empty: Data = { entities: [], events: [], statements: [], leads: [], leadEvidence: [], extractionJobs: [] };
const statusLabel: Record<string,string> = {
  unverified: "Non vérifié", under_review: "À examiner", verified: "Vérifié", rejected: "Rejeté",
  proposed: "Proposée", in_review: "En revue", validated: "Validée", closed: "Clôturée",
};
const typeLabel: Record<string,string> = {
  person: "Personne mentionnée", place: "Lieu", vehicle: "Véhicule", object: "Objet", organization: "Organisation",
  documented_fact: "Fait consigné", testimony: "Témoignage", unverified_information: "Information non vérifiée",
  hypothesis: "Hypothèse", contradiction: "Contradiction",
};

export function InvestigationPanel({ notebookId, canEdit, sources, onOpenSource }: {
  notebookId: string; canEdit: boolean; sources: Source[]; onOpenSource: (sourceId: string) => void;
}) {
  const [data, setData] = React.useState<Data>(empty);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [kind, setKind] = React.useState<Kind>("entity");
  const [formOpen, setFormOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [extracting, setExtracting] = React.useState(false);
  const [crosschecking, setCrosschecking] = React.useState(false);
  const [sourceId, setSourceId] = React.useState("");
  const [fields, setFields] = React.useState<Record<string,string>>({});

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/notebooks/${notebookId}/investigation`);
      if (!res.ok) throw new Error("load");
      setData(await res.json() as Data);
      setError(false);
    } catch { setError(true); }
    finally { setLoading(false); }
  }, [notebookId]);
  React.useEffect(() => { void load(); }, [load]);
  React.useEffect(() => {
    if (!data.extractionJobs.some((job) => job.status === "queued" || job.status === "running")) return;
    const timer = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(timer);
  }, [data.extractionJobs, load]);

  const set = (key: string, value: string) => setFields((old) => ({ ...old, [key]: value }));
  const startExtraction = async () => {
    setExtracting(true);
    try {
      const res = await fetch(`/api/v1/notebooks/${notebookId}/investigation/extract`, { method: "POST" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "extract_failed");
      toast({ title: "Analyse documentaire planifiée", description: `${result.queued_sources} source(s) prête(s) ajoutée(s) à la file d’analyse.`, tone: "success" });
      await load();
    } catch (e) {
      const code = e instanceof Error ? e.message : "extract_failed";
      toast({ title: code === "ai_not_configured" ? "Modèle IA non configuré" : code === "no_ready_sources" ? "Aucune source prête" : "Analyse impossible", description: code, tone: "error" });
    } finally { setExtracting(false); }
  };


  const startCrosscheck = async () => {
    setCrosschecking(true);
    try {
      const res = await fetch(`/api/v1/notebooks/${notebookId}/investigation/crosscheck`, { method: "POST" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "crosscheck_failed");
      toast({ title: "Recoupement multi-sources planifié", description: `${result.source_count} sources vont être comparées. Les pistes proposées resteront à valider.`, tone: "success" });
      await load();
    } catch (e) {
      const code = e instanceof Error ? e.message : "crosscheck_failed";
      toast({ title: code === "ai_not_configured" ? "Modèle IA non configuré" : code === "insufficient_sources" ? "Pas assez de sources recoupables" : "Recoupement impossible", description: code, tone: "error" });
    } finally { setCrosschecking(false); }
  };

  const begin = (next: Kind) => {
    setKind(next);
    setFields({});
    setSourceId(sources.find((s) => s.status === "ready")?.id ?? "");
    setFormOpen(true);
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!sourceId) { toast({ title: "Sélectionnez une source prête", tone: "error" }); return; }
    const base = { kind, source_id: sourceId };
    let body: Record<string, unknown>;
    if (kind === "entity") body = { ...base, entity_type: fields.entity_type || "person", label: fields.label, context_excerpt: fields.context_excerpt, page_number: fields.page_number ? Number(fields.page_number) : null };
    else if (kind === "event") body = { ...base, title: fields.title, description: fields.description, original_date_text: fields.original_date_text, date_precision: fields.date_precision || "unknown", occurred_at_start: fields.occurred_at_start ? new Date(fields.occurred_at_start).toISOString() : null, occurred_at_end: fields.occurred_at_end ? new Date(fields.occurred_at_end).toISOString() : null, context_excerpt: fields.context_excerpt, page_number: fields.page_number ? Number(fields.page_number) : null };
    else if (kind === "statement") body = { ...base, statement_type: fields.statement_type || "testimony", content: fields.content, speaker_label: fields.speaker_label || null, context_excerpt: fields.context_excerpt, page_number: fields.page_number ? Number(fields.page_number) : null };
    else body = { ...base, title: fields.title, verification_question: fields.verification_question, supporting_excerpt: fields.supporting_excerpt, counter_evidence: fields.counter_evidence || "", next_check: fields.next_check, confidence: fields.confidence || "low", page_number: fields.page_number ? Number(fields.page_number) : null };
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/notebooks/${notebookId}/investigation`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "create_failed");
      setFormOpen(false);
      toast({ title: "Élément ajouté au dossier", tone: "success" });
      await load();
    } catch (e) {
      const code = e instanceof Error ? e.message : "create_failed";
      toast({ title: code === "source_not_ready" ? "La source n’est pas encore prête" : "Enregistrement impossible", description: code, tone: "error" });
    } finally { setSaving(false); }
  };

  const review = async (type: Kind, id: string, status: string) => {
    try {
      const res = await fetch(`/api/v1/notebooks/${notebookId}/investigation/${type}/${id}`, {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Revue enregistrée", tone: "success" });
      await load();
    } catch { toast({ title: "Impossible d’enregistrer la revue", tone: "error" }); }
  };

  const sourceName = (id: string) => sources.find((s) => s.id === id)?.title ?? "Source du dossier";
  const sourceRef = (id: string, page?: number | null) => (
    <button type="button" onClick={() => onOpenSource(id)} className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
      <FileText className="size-3.5" /> {sourceName(id)}{page ? ` · p. ${page}` : ""}
    </button>
  );
  const status = (value?: string) => <Badge tone={value === "verified" || value === "validated" ? "success" : value === "rejected" ? "danger" : "neutral"}>{statusLabel[value ?? "unverified"] ?? value}</Badge>;
  const excerpt = (value?: string) => value ? <p className="mt-2 whitespace-pre-wrap rounded-md bg-surface-secondary p-2 text-xs text-text-muted">« {value} »</p> : null;

  const records = [
    ...data.entities.map((x) => ({ id:x.id, kind:"entity" as const, title:x.label, subtitle:`${typeLabel[x.entity_type]} · ${x.origin === "ai_extracted" ? "Extrait par IA" : "Ajout manuel"}`, source_id:x.source_id, page:x.page_number, excerpt:x.context_excerpt, status:x.verification_status })),
    ...data.events.map((x) => ({ id:x.id, kind:"event" as const, title:x.title, subtitle:`${x.original_date_text} · ${x.origin === "ai_extracted" ? "Extrait par IA" : "Ajout manuel"}`, source_id:x.source_id, page:x.page_number, excerpt:x.context_excerpt, status:x.verification_status })),
    ...data.statements.map((x) => ({ id:x.id, kind:"statement" as const, title:x.content, subtitle:`${typeLabel[x.statement_type]} · ${x.origin === "ai_extracted" ? "Extrait par IA" : "Ajout manuel"}`, source_id:x.source_id, page:x.page_number, excerpt:x.context_excerpt, status:x.verification_status })),
  ];

  return (
    <Panel id="investigation" title="Éléments d’enquête" className="h-full" actions={canEdit && <Button size="sm" onClick={() => begin("entity")}><Plus aria-hidden /> Ajouter</Button>}>
      <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3">
        <div className="rounded-lg border border-border-subtle bg-surface-secondary p-3">
          <div className="flex items-center gap-2 text-sm font-medium"><AlertTriangle className="size-4 text-warning" /> Traçabilité et validation humaine</div>
          <p className="mt-1 text-xs text-text-muted">Une mention est un élément consigné dans une source, pas une preuve indépendante. Les pistes restent à vérifier.</p>
        </div>
        {canEdit && <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="secondary" onClick={() => void startExtraction()} disabled={extracting || !sources.some((s) => s.status === "ready")}>{extracting ? "Planification…" : "Analyser les sources"}</Button>
          <Button size="sm" variant="secondary" onClick={() => void startCrosscheck()} disabled={crosschecking || data.entities.length + data.events.length + data.statements.length < 2}>{crosschecking ? "Planification…" : "Croiser les sources"}</Button>
        </div>}
        {data.extractionJobs.length > 0 && <section className="grid gap-2">
          <h3 className="text-sm font-semibold">Analyses IA récentes</h3>
          {data.extractionJobs.map((job) => <div key={job.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-2 text-xs">
            <span className="min-w-0 truncate">{job.kind === "investigation_crosscheck" ? "Recoupement multi-sources" : sourceName(job.target_id ?? "")}</span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="text-text-muted">{job.status === "queued" ? "En attente" : job.status === "running" ? (job.stage ?? (job.kind === "investigation_crosscheck" ? "Recoupement" : "Analyse en cours")) : job.status === "succeeded" ? "Terminé" : job.status === "failed" ? (job.error_code ?? "Échec") : job.status}</span>
              <Badge tone={job.status === "succeeded" ? "success" : job.status === "failed" ? "danger" : job.status === "running" || job.status === "queued" ? "accent" : "neutral"}>{job.status === "running" ? `${job.progress}%` : statusLabel[job.status] ?? job.status}</Badge>
            </span>
          </div>)}
        </section>}
        {canEdit && <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="secondary" onClick={() => begin("entity")}>Personne / lieu / objet</Button>
          <Button size="sm" variant="secondary" onClick={() => begin("event")}>Événement</Button>
          <Button size="sm" variant="secondary" onClick={() => begin("statement")}>Déclaration</Button>
          <Button size="sm" variant="secondary" onClick={() => begin("lead")}>Piste à vérifier</Button>
        </div>}
        {formOpen && (
          <form onSubmit={submit} className="grid gap-3 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Nouvel élément — {({entity:"entité",event:"événement",statement:"déclaration",lead:"piste"})[kind]}</h3>
              <Button type="button" size="icon-sm" variant="ghost" aria-label="Fermer" onClick={() => setFormOpen(false)}><X aria-hidden /></Button>
            </div>
            <Field id="investigation-source" label="Source d’origine">
              <select id="investigation-source" required value={sourceId} onChange={(e) => setSourceId(e.target.value)} className="h-10 w-full rounded-md border border-border-input bg-surface px-3 text-sm">
                <option value="">Choisir une source prête…</option>
                {sources.filter((s) => s.status === "ready").map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            </Field>
            {kind === "entity" && <>
              <Field id="entity-kind" label="Type"><select id="entity-kind" value={fields.entity_type ?? "person"} onChange={(e) => set("entity_type",e.target.value)} className="h-10 rounded-md border border-border-input bg-surface px-3 text-sm">{Object.entries({person:"Personne",place:"Lieu",vehicle:"Véhicule",object:"Objet",organization:"Organisation"}).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></Field>
              <Field id="entity-label" label="Libellé tel qu’il apparaît dans la source"><Input id="entity-label" required maxLength={240} value={fields.label ?? ""} onChange={(e)=>set("label",e.target.value)} /></Field>
              <Field id="entity-excerpt" label="Extrait exact de la source"><Textarea id="entity-excerpt" required maxLength={4000} value={fields.context_excerpt ?? ""} onChange={(e)=>set("context_excerpt",e.target.value)} /></Field>
            </>}
            {kind === "event" && <>
              <Field id="event-title" label="Événement"><Input id="event-title" required value={fields.title ?? ""} onChange={(e)=>set("title",e.target.value)} /></Field>
              <Field id="event-description" label="Description documentée"><Textarea id="event-description" required value={fields.description ?? ""} onChange={(e)=>set("description",e.target.value)} /></Field>
              <Field id="event-date" label="Date telle qu’écrite dans la source"><Input id="event-date" required value={fields.original_date_text ?? ""} onChange={(e)=>set("original_date_text",e.target.value)} placeholder="Ex. : vers le 12 juin, en soirée" /></Field>
              <Field id="event-precision" label="Précision"><select id="event-precision" value={fields.date_precision ?? "unknown"} onChange={(e)=>set("date_precision",e.target.value)} className="h-10 rounded-md border border-border-input bg-surface px-3 text-sm"><option value="exact">Exacte</option><option value="approximate">Approximative</option><option value="range">Intervalle</option><option value="unknown">Inconnue</option></select></Field>
              <Field id="event-start" label="Date / heure normalisée (facultatif)" hint="À renseigner uniquement si la date peut être normalisée sans supposition. La formulation originale reste conservée."><Input id="event-start" type="datetime-local" value={fields.occurred_at_start ?? ""} onChange={(e)=>set("occurred_at_start",e.target.value)} /></Field>
              <Field id="event-end" label="Fin de l’intervalle (facultatif)"><Input id="event-end" type="datetime-local" value={fields.occurred_at_end ?? ""} onChange={(e)=>set("occurred_at_end",e.target.value)} /></Field>
              <Field id="event-excerpt" label="Extrait exact de la source"><Textarea id="event-excerpt" required value={fields.context_excerpt ?? ""} onChange={(e)=>set("context_excerpt",e.target.value)} /></Field>
            </>}
            {kind === "statement" && <>
              <Field id="statement-type" label="Catégorie"><select id="statement-type" value={fields.statement_type ?? "testimony"} onChange={(e)=>set("statement_type",e.target.value)} className="h-10 rounded-md border border-border-input bg-surface px-3 text-sm">{Object.entries({documented_fact:"Fait consigné",testimony:"Témoignage",unverified_information:"Information non vérifiée",hypothesis:"Hypothèse",contradiction:"Contradiction"}).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></Field>
              <Field id="statement-content" label="Contenu / formulation"><Textarea id="statement-content" required value={fields.content ?? ""} onChange={(e)=>set("content",e.target.value)} /></Field>
              <Field id="statement-speaker" label="Auteur ou témoin mentionné (si connu)"><Input id="statement-speaker" value={fields.speaker_label ?? ""} onChange={(e)=>set("speaker_label",e.target.value)} /></Field>
              <Field id="statement-excerpt" label="Extrait exact de la source"><Textarea id="statement-excerpt" required value={fields.context_excerpt ?? ""} onChange={(e)=>set("context_excerpt",e.target.value)} /></Field>
            </>}
            {kind === "lead" && <>
              <Field id="lead-title" label="Intitulé neutre de la piste"><Input id="lead-title" required value={fields.title ?? ""} onChange={(e)=>set("title",e.target.value)} /></Field>
              <Field id="lead-question" label="Question à vérifier"><Textarea id="lead-question" required value={fields.verification_question ?? ""} onChange={(e)=>set("verification_question",e.target.value)} /></Field>
              <Field id="lead-support" label="Élément source qui motive la piste"><Textarea id="lead-support" required value={fields.supporting_excerpt ?? ""} onChange={(e)=>set("supporting_excerpt",e.target.value)} /></Field>
              <Field id="lead-counter" label="Éléments contraires / limites"><Textarea id="lead-counter" value={fields.counter_evidence ?? ""} onChange={(e)=>set("counter_evidence",e.target.value)} /></Field>
              <Field id="lead-next" label="Vérification documentaire proposée"><Textarea id="lead-next" required value={fields.next_check ?? ""} onChange={(e)=>set("next_check",e.target.value)} /></Field>
              <Field id="lead-confidence" label="Solidité documentaire"><select id="lead-confidence" value={fields.confidence ?? "low"} onChange={(e)=>set("confidence",e.target.value)} className="h-10 rounded-md border border-border-input bg-surface px-3 text-sm"><option value="low">Faible</option><option value="moderate">Modérée</option><option value="high">Élevée</option></select></Field>
            </>}
            {kind !== "lead" && <Field id="investigation-page" label="Page (facultatif)"><Input id="investigation-page" type="number" min="1" value={fields.page_number ?? ""} onChange={(e)=>set("page_number",e.target.value)} /></Field>}
            {kind === "lead" && <Field id="lead-page" label="Page de la source (facultatif)"><Input id="lead-page" type="number" min="1" value={fields.page_number ?? ""} onChange={(e)=>set("page_number",e.target.value)} /></Field>}
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setFormOpen(false)}>Annuler</Button><Button type="submit" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button></div>
          </form>
        )}
        {error && <div className="flex items-center justify-between rounded-md border border-danger/30 p-3 text-sm"><span>Impossible de charger les éléments.</span><Button size="sm" variant="secondary" onClick={() => void load()}><RefreshCw aria-hidden /> Réessayer</Button></div>}
        {loading ? <p className="py-6 text-center text-sm text-text-muted">Chargement du dossier…</p> : <>
          <section className="grid gap-2">
            <h3 className="text-sm font-semibold">Éléments documentés ({records.length})</h3>
            {records.length === 0 ? <EmptyState icon={<FileText />} title="Aucun élément structuré">Ajoutez une personne mentionnée, un événement ou une déclaration en la reliant à sa source.</EmptyState> : records.map((r) => (
              <article key={r.id} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-sm font-medium">{r.title}</p><p className="mt-0.5 text-xs text-text-muted">{r.subtitle}</p></div>{status(r.status)}</div>
                {excerpt(r.excerpt)}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">{sourceRef(r.source_id,r.page)}{canEdit && r.status !== "verified" && r.status !== "rejected" && <span className="flex gap-1"><Button size="sm" variant="secondary" onClick={()=>void review(r.kind,r.id,"verified")}><Check aria-hidden /> Valider</Button><Button size="sm" variant="ghost" onClick={()=>void review(r.kind,r.id,"rejected")}><X aria-hidden /> Rejeter</Button></span>}</div>
              </article>
            ))}
          </section>
          <section className="grid gap-2">
            <h3 className="text-sm font-semibold">Pistes à vérifier ({data.leads.length})</h3>
            {data.leads.length === 0 ? <p className="rounded-lg border border-dashed p-4 text-sm text-text-muted">Aucune piste enregistrée. Une piste doit toujours formuler une question vérifiable et présenter ses limites.</p> : data.leads.map((lead) => (
              <article key={lead.id} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-2"><h4 className="text-sm font-semibold">{lead.title}</h4>{status(lead.status)}</div>
                <p className="mt-2 text-sm">{lead.verification_question}</p>
                {excerpt(lead.supporting_excerpt)}
                {lead.counter_evidence && <p className="mt-2 text-xs text-text-muted">Limites / éléments contraires : {lead.counter_evidence}</p>}
                {data.leadEvidence.filter((item) => item.lead_id === lead.id).map((item) => <div key={item.id} className="mt-2 rounded-md bg-surface-secondary p-2">
                  <div className="flex items-center justify-between gap-2 text-xs"><span className="font-medium">{item.evidence_role === "support" ? "Élément à l’appui" : "Élément contraire"}</span>{sourceRef(item.source_id,item.page_number)}</div>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-text-muted">« {item.quote} »</p>
                </div>)} 
                <p className="mt-2 text-xs text-text-muted">Solidité documentaire : {lead.confidence === "high" ? "élevée" : lead.confidence === "moderate" ? "modérée" : "faible"}. Vérification proposée : {lead.next_check}</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">{sourceRef(lead.source_id,lead.page_number)}{canEdit && lead.status !== "validated" && lead.status !== "rejected" && <span className="flex gap-1"><Button size="sm" variant="secondary" onClick={()=>void review("lead",lead.id,"validated")}><Check aria-hidden /> Valider</Button><Button size="sm" variant="ghost" onClick={()=>void review("lead",lead.id,"rejected")}><X aria-hidden /> Rejeter</Button></span>}</div>
              </article>
            ))}
          </section>
        </>}
      </div>
    </Panel>
  );
}
