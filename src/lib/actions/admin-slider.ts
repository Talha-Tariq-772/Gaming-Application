"use server";

import { requireAdmin } from "@/src/lib/auth/session";
import { createClient as createServiceClient } from "@/src/lib/supabase/server";

const MAX_SLOTS = 6;

function isValidSlot(position: unknown): position is number {
  return typeof position === "number" && Number.isInteger(position) && position >= 1 && position <= MAX_SLOTS;
}

export interface SliderUpdate {
  gameId: string;
  sliderPosition: number | null;
}

export type SliderActionResult = { ok: true; updates: SliderUpdate[] } | { ok: false; message: string };

/**
 * Puts a game in slot `position`. Rejects if the slot already holds a
 * different game (advisory pre-check; games_slider_position_unique —
 * 20260831000005_slider_position_unique.sql — is the real boundary against
 * a race). "Max N slots" isn't a separate rule to enforce: position is
 * restricted to 1-MAX_SLOTS here, and uniqueness means at most MAX_SLOTS
 * rows can ever hold a non-null value at once. That migration's unique
 * index has no range check of its own — MAX_SLOTS here is the only place
 * the slot count is enforced, so raising it (as done for Dead Island 2's
 * 6th slot) never needs a schema change, only this constant plus
 * AdminSliderClient.tsx's SLOT_COUNT and StoreSlider.tsx's slice() cap.
 */
export async function assignSliderSlot(gameId: string, position: number): Promise<SliderActionResult> {
  await requireAdmin();
  if (!isValidSlot(position)) {
    return { ok: false, message: "Invalid slot." };
  }

  const service = createServiceClient();

  const { data: occupant, error: occupantErr } = await service
    .from("games")
    .select("id")
    .eq("slider_position", position)
    .maybeSingle();
  if (occupantErr) {
    console.error("[assignSliderSlot] occupant check", occupantErr);
    return { ok: false, message: "Something went wrong updating the slider." };
  }
  if (occupant && occupant.id !== gameId) {
    return { ok: false, message: "That slot is already taken — remove its game first." };
  }

  const { error } = await service.from("games").update({ slider_position: position }).eq("id", gameId);
  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: "That slot is already taken — remove its game first." };
    }
    console.error("[assignSliderSlot]", error);
    return { ok: false, message: "Something went wrong updating the slider." };
  }

  return { ok: true, updates: [{ gameId, sliderPosition: position }] };
}

export async function removeFromSliderSlot(gameId: string): Promise<SliderActionResult> {
  await requireAdmin();
  const service = createServiceClient();

  const { error } = await service.from("games").update({ slider_position: null }).eq("id", gameId);
  if (error) {
    console.error("[removeFromSliderSlot]", error);
    return { ok: false, message: "Something went wrong updating the slider." };
  }

  return { ok: true, updates: [{ gameId, sliderPosition: null }] };
}

/**
 * Swaps whatever occupies slot `position` with whatever occupies the
 * adjacent slot (either side may be empty — swapping with an empty slot is
 * just "move here"). Goes through a clear-then-fill sequence rather than
 * writing both new values directly: two straight UPDATEs (a := b's slot,
 * b := a's slot) would transiently give two rows the same slider_position
 * mid-sequence and trip games_slider_position_unique on the very first
 * write, since each call is its own statement, not one transaction.
 * Freeing the target's slot first, then moving the other game into it,
 * then moving the target into the now-vacated adjacent slot never creates
 * a collision at any step.
 */
export async function reorderSliderSlot(position: number, direction: "up" | "down"): Promise<SliderActionResult> {
  await requireAdmin();
  const swapPosition = direction === "up" ? position - 1 : position + 1;
  if (!isValidSlot(position) || !isValidSlot(swapPosition)) {
    return { ok: false, message: "Can't move that slot further." };
  }

  const service = createServiceClient();

  const { data: rows, error: listErr } = await service
    .from("games")
    .select("id, slider_position")
    .in("slider_position", [position, swapPosition]);
  if (listErr) {
    console.error("[reorderSliderSlot] list", listErr);
    return { ok: false, message: "Something went wrong reordering the slider." };
  }

  const target = rows?.find((r) => r.slider_position === position) ?? null;
  const other = rows?.find((r) => r.slider_position === swapPosition) ?? null;
  if (!target) {
    return { ok: true, updates: [] }; // nothing in that slot to move
  }

  const clear = await service.from("games").update({ slider_position: null }).eq("id", target.id);
  if (clear.error) {
    console.error("[reorderSliderSlot] clear", clear.error);
    return { ok: false, message: "Something went wrong reordering the slider." };
  }

  if (other) {
    const moveOther = await service.from("games").update({ slider_position: position }).eq("id", other.id);
    if (moveOther.error) {
      console.error("[reorderSliderSlot] move other", moveOther.error);
      return { ok: false, message: "Something went wrong reordering the slider." };
    }
  }

  const moveTarget = await service.from("games").update({ slider_position: swapPosition }).eq("id", target.id);
  if (moveTarget.error) {
    console.error("[reorderSliderSlot] move target", moveTarget.error);
    return { ok: false, message: "Something went wrong reordering the slider." };
  }

  const updates: SliderUpdate[] = [{ gameId: target.id, sliderPosition: swapPosition }];
  if (other) updates.push({ gameId: other.id, sliderPosition: position });
  return { ok: true, updates };
}
