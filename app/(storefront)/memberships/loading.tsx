import MembershipsSkeleton from "./MembershipsSkeleton";

/**
 * Overrides the generic app/(storefront)/loading.tsx — same reasoning as
 * every other route in this group: the generic ~500px fallback doesn't
 * reserve anywhere close to this route's real height. See
 * MembershipsSkeleton's own comment for the measured values behind it.
 */
export default function Loading() {
  return <MembershipsSkeleton />;
}
