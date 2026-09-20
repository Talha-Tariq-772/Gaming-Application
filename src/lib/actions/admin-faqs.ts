"use server";

import { requireAdmin } from "@/src/lib/auth/session";
import { createClient as createServiceClient } from "@/src/lib/supabase/server";
import { GUIDE_CATEGORIES, type FaqItem, type GuideCategory } from "@/src/types/database";

export interface FaqInput {
  slug: string;
  question: string;
  answer: string;
  /** Null is a valid, deliberate choice — see FaqItem.category. */
  category: GuideCategory | null;
  sortOrder: number;
  isPublished: boolean;
}

export type FaqActionResult = { ok: true; faq: FaqItem } | { ok: false; message: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapFaqRow(row: any): FaqItem {
  return {
    id: row.id,
    slug: row.slug,
    question: row.question,
    answer: row.answer,
    category: row.category,
    sortOrder: row.sort_order,
    isPublished: row.is_published,
  };
}

function isValidCategory(value: unknown): value is GuideCategory | null {
  return value === null || GUIDE_CATEGORIES.includes(value as GuideCategory);
}

/**
 * Normalises a slug to the shape the public page can safely use as a DOM
 * id / URL fragment: lowercase, alphanumeric and single dashes only. The
 * table's unique constraint is the real boundary against collisions —
 * this just stops an admin typing a slug that silently won't anchor.
 */
function normaliseSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Shared field validation for create and update — returns an error
 * message, or null when the input is usable. */
function validate(input: FaqInput): string | null {
  if (!normaliseSlug(input.slug)) return "Slug is required.";
  if (!input.question.trim()) return "Question is required.";
  if (!input.answer.trim()) return "Answer is required.";
  if (!isValidCategory(input.category)) return "Invalid category.";
  if (!Number.isInteger(input.sortOrder)) return "Order must be a whole number.";
  // smallint column — a larger value would fail at the DB with an opaque
  // 22003 rather than a sentence an admin can act on.
  if (input.sortOrder < 0 || input.sortOrder > 32767) return "Order must be between 0 and 32767.";
  return null;
}

function toRow(input: FaqInput) {
  return {
    slug: normaliseSlug(input.slug),
    question: input.question.trim(),
    answer: input.answer.trim(),
    category: input.category,
    sort_order: input.sortOrder,
    is_published: input.isPublished,
  };
}

export async function createFaq(input: FaqInput): Promise<FaqActionResult> {
  await requireAdmin();
  const invalid = validate(input);
  if (invalid) return { ok: false, message: invalid };

  const supabase = createServiceClient();
  const { data, error } = await supabase.from("faqs").insert(toRow(input)).select("*").single();
  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: "An FAQ with this slug already exists." };
    }
    console.error("[createFaq]", error);
    return { ok: false, message: "Something went wrong creating this FAQ." };
  }
  return { ok: true, faq: mapFaqRow(data) };
}

export async function updateFaq(faqId: string, input: FaqInput): Promise<FaqActionResult> {
  await requireAdmin();
  const invalid = validate(input);
  if (invalid) return { ok: false, message: invalid };

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("faqs")
    .update({ ...toRow(input), updated_at: new Date().toISOString() })
    .eq("id", faqId)
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: "An FAQ with this slug already exists." };
    }
    console.error("[updateFaq]", error);
    return { ok: false, message: "Something went wrong saving this FAQ." };
  }
  return { ok: true, faq: mapFaqRow(data) };
}

export async function setFaqPublished(faqId: string, isPublished: boolean): Promise<FaqActionResult> {
  await requireAdmin();
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("faqs")
    .update({ is_published: isPublished, updated_at: new Date().toISOString() })
    .eq("id", faqId)
    .select("*")
    .single();
  if (error) {
    console.error("[setFaqPublished]", error);
    return { ok: false, message: "Something went wrong updating this FAQ." };
  }
  return { ok: true, faq: mapFaqRow(data) };
}

export type DeleteFaqResult = { ok: true } | { ok: false; message: string };

/**
 * Hard delete, unlike deleteGame's soft-delete-when-referenced rule:
 * nothing references an FAQ row (no FK points at faqs), so removing one
 * destroys no history. An admin who wants it merely hidden unpublishes
 * it instead — that's what setFaqPublished is for.
 */
export async function deleteFaq(faqId: string): Promise<DeleteFaqResult> {
  await requireAdmin();
  const supabase = createServiceClient();

  const { error } = await supabase.from("faqs").delete().eq("id", faqId);
  if (error) {
    console.error("[deleteFaq]", error);
    return { ok: false, message: "Something went wrong deleting this FAQ." };
  }
  return { ok: true };
}
