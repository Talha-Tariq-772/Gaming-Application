import { formatDateTime } from "@/src/lib/date";
import type { Order } from "@/src/types/database";

interface TimelineEvent {
  label: string;
  timestamp: string;
  description?: string;
  tone: "default" | "success" | "danger";
}

/**
 * The Order type doesn't store a separate status-change log — its own
 * timestamp fields (createdAt, claimedAt, reviewedAt, reservedUntil) already
 * mark each transition, so the timeline is derived from those rather than
 * a parallel history table.
 */
function buildTimeline(order: Order): TimelineEvent[] {
  const events: TimelineEvent[] = [
    { label: "Order placed", timestamp: order.createdAt, tone: "default" },
  ];

  if (order.claimedAt) {
    events.push({
      label: "Payment submitted",
      timestamp: order.claimedAt,
      tone: "default",
    });
  }

  if (order.reviewedAt) {
    if (order.status === "approved") {
      events.push({
        label: "Approved",
        timestamp: order.reviewedAt,
        tone: "success",
      });
    } else if (order.status === "rejected") {
      events.push({
        label: "Rejected",
        timestamp: order.reviewedAt,
        description: order.rejectionReason ?? undefined,
        tone: "danger",
      });
    }
  }

  if (order.status === "expired" && !order.claimedAt) {
    events.push({
      label: "Reservation expired",
      timestamp: order.reservedUntil,
      tone: "default",
    });
  }

  return events;
}

const DOT_TONE_CLASS: Record<TimelineEvent["tone"], string> = {
  default: "bg-nova-smoke",
  success: "bg-nova-ember",
  danger: "bg-nova-blood",
};

export default function OrderTimeline({ order }: { order: Order }) {
  const events = buildTimeline(order);

  return (
    <ol className="flex flex-col gap-6">
      {events.map((event, i) => (
        <li key={event.label} className="flex gap-4">
          <div className="flex flex-col items-center">
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT_TONE_CLASS[event.tone]}`}
            />
            {i < events.length - 1 && (
              <span className="mt-1 w-px flex-1 bg-nova-hairline" aria-hidden="true" />
            )}
          </div>
          <div className="pb-2">
            <p className="text-sm font-semibold text-nova-bone">{event.label}</p>
            <p className="text-xs text-nova-smoke">
              {formatDateTime(event.timestamp)}
            </p>
            {event.description && (
              <p className="mt-2 max-w-md text-sm text-nova-ash">
                {event.description}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
