import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppHeader } from "@/components/app/app-header";
import { Button } from "@/components/ui/button";
import { createUserClient, getUser } from "@/lib/supabase/server";
import { MissingPersonNotices } from "./notices";

export const metadata: Metadata = { title: "Avis de recherche — dossier" };

export default async function MissingPersonNoticesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) redirect(`/login?next=/notebook/${id}/notices`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createUserClient();
  const [{ data: role }, { data: notebook }] = await Promise.all([
    supabase.rpc("my_notebook_role", { p_nb: id }),
    supabase.from("notebooks").select("id, title").eq("id", id).maybeSingle(),
  ]);
  if (!role || !notebook || role === "chat") notFound();
  return (
    <div className="min-h-dvh">
      <AppHeader notebookId={id}>
        <Button asChild size="sm" variant="secondary"><Link href={`/notebook/${id}`}><ArrowLeft aria-hidden /> Retour au dossier</Link></Button>
      </AppHeader>
      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-8 sm:px-6">
        <div>
          <p className="text-sm text-text-muted">Dossier : {notebook.title || "Sans titre"}</p>
          <h1 className="mt-1 text-2xl font-semibold">Avis de recherche</h1>
          <p className="mt-2 max-w-3xl text-sm text-text-muted">Leanna surveille automatiquement le flux public du 116 000. Examinez les nouvelles publications détectées, ajoutez-les à ce dossier ou créez une enquête privée. Les sources sans flux automatisable restent accessibles en import manuel.</p>
        </div>
        <MissingPersonNotices notebookId={id} canEdit={role === "editor" || role === "owner"} />
      </main>
    </div>
  );
}
