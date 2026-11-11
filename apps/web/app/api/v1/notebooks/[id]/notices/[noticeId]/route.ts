import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handle, parseBody, requireRole, requireUser } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string; noticeId: string }> };

const reviewSchema = z.object({
  reviewStatus: z.enum(["approved", "rejected", "pending_review"]).optional(),
  publicationStatus: z.enum(["active", "changed", "removed", "unavailable"]).optional(),
  reviewNote: z.string().trim().max(2000).nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Aucune modification.");

export const PATCH = handle(async (req: NextRequest, { params }: Params) => {
  const user = await requireUser();
  const { id, noticeId } = await params;
  await requireRole(id, "editor");
  const body = await parseBody(req, reviewSchema);
  const db = createServiceClient();
  const { data: current } = await db.from("missing_person_notices").select("workspace_id").eq("id", noticeId).eq("notebook_id", id).maybeSingle();
  if (!current) throw new ApiError(404, "not_found");
  const update: Record<string, unknown> = { ...body };
  if (body.reviewStatus !== undefined) {
    update.reviewed_by = user.id;
    update.reviewed_at = new Date().toISOString();
  }
  const { data, error } = await db.from("missing_person_notices").update(update)
    .eq("id", noticeId).eq("notebook_id", id)
    .select("id, review_status, publication_status, review_note, reviewed_at").single();
  if (error) throw error;
  await db.from("audit_log").insert({
    workspace_id: current.workspace_id,
    actor_id: user.id,
    action: "missing_person_notice.review",
    target_type: "missing_person_notice",
    target_id: noticeId,
  });
  return NextResponse.json({ notice: data });
});
