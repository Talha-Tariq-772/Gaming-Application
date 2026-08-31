import { GAME_PLATFORMS } from "@/src/types/database";
import type { GamePlatform, PriceSource, ProfileRole } from "@/src/types/database";

/**
 * Pure decision function behind the last-admin guardrail, split out from
 * changeUserRole so it's testable without needing to actually drive a real
 * database's admin count down to zero. Lives outside admin-users.ts because
 * "use server" files may only export async functions.
 */
export function isLastAdminDemotion(
  oldRole: ProfileRole,
  newRole: ProfileRole,
  currentAdminCount: number,
): boolean {
  if (oldRole !== "admin" || newRole === "admin") return false;
  return currentAdminCount <= 1;
}

/**
 * Real, server-side enforcement of the games_platform_check DB constraint
 * (20260829000002_games_catalog_columns.sql) — checked by createGame/
 * updateGame (admin-games.ts) before ever reaching the database, so an
 * invalid value comes back as a normal { ok: false } action result instead
 * of a raw Postgres constraint-violation error. src/lib/validation.ts's
 * gameFormSchema checks the same thing, but that file is documented as
 * UX-only and explicitly not trusted as a security boundary — this is the
 * real one.
 */
export function isValidGamePlatform(value: unknown): value is GamePlatform {
  return typeof value === "string" && (GAME_PLATFORMS as readonly string[]).includes(value);
}

/**
 * Real, server-side enforcement of "a game must keep at least one active
 * variant" — checked by setVariantActive (admin-variants.ts) before ever
 * writing, same fast-friendly-rejection role isLastAdminDemotion plays for
 * changeUserRole. currentActiveCount includes the variant being
 * deactivated itself (it's still active at the time of the check), matching
 * that function's "count includes the target" convention.
 *
 * Advisory only, same caveat as isLastAdminDemotion: this is a
 * SELECT-then-UPDATE with no locking. The real boundary is the
 * trg_prevent_last_active_variant_update/delete triggers
 * (20260831000003_prevent_last_active_variant_removal.sql), which lock
 * every active variant row for the game before counting.
 */
export function isLastActiveVariantDeactivation(
  oldIsActive: boolean,
  newIsActive: boolean,
  currentActiveCount: number,
): boolean {
  if (!oldIsActive || newIsActive) return false;
  return currentActiveCount <= 1;
}

/**
 * Real, server-side enforcement of the game_variants price_source CHECK
 * constraint (20260829000003_game_variants.sql) — same role
 * isValidGamePlatform plays for games.platform.
 */
export function isValidPriceSource(value: unknown): value is PriceSource {
  return value === "catalog" || value === "estimate";
}
