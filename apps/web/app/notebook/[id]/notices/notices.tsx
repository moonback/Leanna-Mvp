"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, FileText, Plus, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Alert, Badge, EmptyState } from "@/components/ui/feedback";
import { Card } from "@/components/ui/surfaces";
import { toast } from "@/components/ui/toast";

type Notice = {
  id: string; source_id: string; source_name: "arpd" | "116000" | "interpol";
  source_url: string; source_reference: string | null; person_name: string;
  published_date_text: string | null; disappearance_location: string | null;
  published_summary: string | null; publication_status: string; review_status: string;
  collected_at: string; last_seen_at: string; reviewed_at: string | null; review_note: string | null;
};
const SOURCE_LABELS = { arpd: "ARPD", "116000": "116 000 Enfants Disparus", interpol: "INTERPOL — notice jaune" };
const STATUS_LABELS: Record<string, string> = { unverified: "Publication à vérifier", active: "Publication active", changed: "Publication modifiée", removed: "Publication retirée", unavailable: "Source inaccessible", pending_review: "À examiner", approved: "Validé par un éditeur", rejected: "Écarté" };

export function MissingPersonNotices({ notebookId, canEdit }: { notebookId: string; canEdit: boolean }) {
  const [notices, setNotices] = React.useState<Notice[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [formOpen, setFormOpen] = React.useState(false);
  const [sourceName, setSourceName] = React.useState<Notice["source_name"]>("arpd");
  const [sourceUrl, setSourceUrl] = React.useState("");
  const [sourceReference, setSourceReference] = React.useState("");
  const [personName, setPersonName] = React.useState("");
  const [publishedDateText, setPublishedDateText] = React.useState("");
  const [disappearanceLocation, setDisappearanceLocation] = React.useState("");
  const [publishedSummary, setPublishedSummary] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true); setError(false);
    try {
      const response = await fetch(`/api/v1/notebooks/${notebookId}/notices`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const json = await response.json();
      setNotices(json.notices ?? []);
    } catch { setError(true); }
    finally { setLoading(false); }
  }, [notebookId]);
  React.useEffect(() => { void load(); }, [load]);

  async function addNotice(event: React.FormEvent) {
    event.preventDefault(); setSaving(true);
    try {
      const response = await fetch(`/api/v1/notebooks/${notebookId}/notices`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceName, sourceUrl, sourceReference: sourceReference || null, personName, publishedDateText: publishedDateText || null, disappearanceLocation: disappearanceLocation || null, publishedSummary: publishedSummary || null }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error === "source_domain_not_allowed" ? "Le domaine ne correspond pas à l’organisme sélectionné." : json.error === "notice_already_imported" ? "Cet avis identique existe déjà dans ce dossier." : "Import impossible. Vérifiez l’adresse et réessayez.");
      setFormOpen(false); setSourceUrl(""); setSourceReference(""); setPersonName(""); setPublishedDateText(""); setDisappearanceLocation(""); setPublishedSummary("");
      toast({ title: "Avis ajouté au dossier", description: "La page originale est en cours d’indexation." });
      await load();
    } catch (e) { toast({ title: "Import impossible", description: e instanceof Error ? e.message : "Réessayez.", tone: "error" }); }
    finally { setSaving(false); }
  }

  async function review(notice: Notice, patch: Record<string, string>) {
    const response = await fetch(`/api/v1/notebooks/${notebookId}/notices/${notice.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) });
    if (!response.ok) return toast({ title: "Mise à jour impossible", tone: "error" });
    await load();
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Badge>Sites pris en charge : ARPD, 116 000, INTERPOL</Badge>
          <Badge tone="warning">Import manuel — pas de scraping automatique</Badge>
        </div>
        {canEdit && <Button onClick={() => setFormOpen((v) => !v)}><Plus aria-hidden /> Ajouter un avis</Button>}
      </div>
      <div className="grid gap-2 rounded-lg border p-3 text-sm">
        <p className="font-medium">Consulter les publications originales</p>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <Link href="https://www.arpd.fr/fr/recherche-disparition-accueil" target="_blank" rel="noreferrer" className="text-accent hover:underline">ARPD</Link>
          <Link href="https://www.116000enfantsdisparus.fr/avis-de-recherche/" target="_blank" rel="noreferrer" className="text-accent hover:underline">116 000 Enfants Disparus</Link>
          <Link href="https://www.interpol.int/How-we-work/Notices/Yellow-Notices/View-Yellow-Notices" target="_blank" rel="noreferrer" className="text-accent hover:underline">INTERPOL — notices jaunes</Link>
        </div>
      </div>
      <Alert tone="warning" title="Prudence et confidentialité">
        N’ajoutez que des avis publiés et accessibles légalement. Pour les mineurs, limitez les données copiées au strict nécessaire. Le statut « retiré » indique seulement que la publication n’est plus disponible : il ne confirme pas que la personne a été retrouvée.
      </Alert>
      {formOpen && canEdit && (
        <Card className="grid gap-4 p-4">
          <div><h2 className="font-semibold">Importer un avis publié</h2><p className="text-sm text-text-muted">La fiche sera créée comme « À examiner » et la page web originale sera ajoutée aux Sources du dossier.</p></div>
          <form onSubmit={addNotice} className="grid gap-3 sm:grid-cols-2">
            <Field id="notice-source" label="Organisme">
              <select id="notice-source" className="h-10 rounded-md border bg-surface px-3 text-sm" value={sourceName} onChange={(e) => setSourceName(e.target.value as Notice["source_name"])}>
                <option value="arpd">ARPD</option><option value="116000">116 000 Enfants Disparus</option><option value="interpol">INTERPOL — notice jaune</option>
              </select>
            </Field>
            <Field id="notice-person" label="Nom tel que publié"><Input id="notice-person" required maxLength={240} value={personName} onChange={(e) => setPersonName(e.target.value)} /></Field>
            <div className="sm:col-span-2"><Field id="notice-url" label="URL exacte de l’avis publié"><Input id="notice-url" type="url" required placeholder="https://…" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} /></Field></div>
            <Field id="notice-reference" label="Référence de l’avis (facultatif)"><Input id="notice-reference" maxLength={160} value={sourceReference} onChange={(e) => setSourceReference(e.target.value)} /></Field>
            <Field id="notice-date" label="Date telle que publiée (facultatif)"><Input id="notice-date" maxLength={160} value={publishedDateText} onChange={(e) => setPublishedDateText(e.target.value)} placeholder="Conserver la formulation originale" /></Field>
            <div className="sm:col-span-2"><Field id="notice-location" label="Lieu tel que publié (facultatif)"><Input id="notice-location" maxLength={500} value={disappearanceLocation} onChange={(e) => setDisappearanceLocation(e.target.value)} /></Field></div>
            <div className="sm:col-span-2"><Field id="notice-summary" label="Résumé strictement issu de l’avis (facultatif)"><Textarea id="notice-summary" maxLength={5000} rows={3} value={publishedSummary} onChange={(e) => setPublishedSummary(e.target.value)} /></Field></div>
            <div className="sm:col-span-2 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>Annuler</Button><Button type="submit" loading={saving}>Importer dans le dossier</Button></div>
          </form>
        </Card>
      )}
      {error && <Alert tone="danger" title="Impossible de charger les avis" action={<Button size="sm" variant="secondary" onClick={() => void load()}>Réessayer</Button>} />}
      {loading ? <p className="text-sm text-text-muted">Chargement…</p> : notices.length === 0 ? (
        <Card><EmptyState icon={<FileText />} title="Aucun avis dans ce dossier">Ajoutez l’URL d’un avis officiel ou associatif publié pour l’archiver comme source documentaire.</EmptyState></Card>
      ) : (
        <div className="grid gap-3">
          {notices.map((notice) => (
            <Card key={notice.id} className="grid gap-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><p className="text-xs text-text-muted">{SOURCE_LABELS[notice.source_name]}{notice.source_reference ? ` · ${notice.source_reference}` : ""}</p><h2 className="mt-1 font-semibold">{notice.person_name}</h2></div>
                <div className="flex flex-wrap gap-1"><Badge tone={notice.review_status === "approved" ? "success" : notice.review_status === "rejected" ? "danger" : "warning"}>{STATUS_LABELS[notice.review_status]}</Badge><Badge>{STATUS_LABELS[notice.publication_status]}</Badge></div>
              </div>
              <div className="grid gap-1 text-sm text-text-muted sm:grid-cols-2">
                {notice.published_date_text && <p>Date publiée : {notice.published_date_text}</p>}
                {notice.disappearance_location && <p>Lieu publié : {notice.disappearance_location}</p>}
                <p>Collecté le {new Date(notice.collected_at).toLocaleString("fr-FR")}</p>
                {notice.publication_status !== "unverified" && <p>Dernière vérification positive : {new Date(notice.last_seen_at).toLocaleString("fr-FR")}</p>}
              </div>
              {notice.published_summary && <p className="whitespace-pre-wrap text-sm">{notice.published_summary}</p>}
              {notice.review_note && <p className="text-sm text-text-muted">Note de revue : {notice.review_note}</p>}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                <Link href={notice.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-accent hover:underline"><ExternalLink aria-hidden className="size-4" /> Publication originale</Link>
                <div className="flex flex-wrap gap-2">
                  {canEdit && notice.review_status === "pending_review" && <Button size="sm" variant="secondary" onClick={() => void review(notice, { reviewStatus: "approved" })}><ShieldCheck aria-hidden /> Valider la fiche</Button>}
                  {canEdit && notice.review_status !== "rejected" && <Button size="sm" variant="ghost" onClick={() => void review(notice, { reviewStatus: "rejected" })}>Écarter</Button>}
                  {canEdit && notice.publication_status === "unverified" && <Button size="sm" variant="secondary" onClick={() => void review(notice, { publicationStatus: "active" })}><ShieldCheck aria-hidden /> Confirmer la publication</Button>}
                  {canEdit && notice.publication_status === "active" && <Button size="sm" variant="ghost" onClick={() => void review(notice, { publicationStatus: "unavailable" })}><RefreshCw aria-hidden /> Signaler inaccessible</Button>}
                  {canEdit && notice.publication_status !== "removed" && <Button size="sm" variant="ghost" onClick={() => void review(notice, { publicationStatus: "removed" })}>Signaler le retrait</Button>}
                  <Button size="sm" variant="ghost" onClick={() => window.location.assign(`/notebook/${notebookId}#source-${notice.source_id}`)}>Voir la source</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
