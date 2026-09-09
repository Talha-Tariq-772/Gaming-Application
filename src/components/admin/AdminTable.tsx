import type { ReactNode } from "react";

export interface AdminTableColumn<T> {
  key: string;
  /** Pass a <span className="sr-only"> yourself for a visually-hidden
   * header (action columns) — this stays a plain ReactNode rather than
   * a boolean flag so callers aren't limited to plain-text headers. */
  header: ReactNode;
  align?: "right";
  /** Monospaces the cell — used for the reference column so PSC-XXXXXX
   * stays scannable against proportional text around it. */
  mono?: boolean;
  render: (row: T) => ReactNode;
}

/**
 * Single table implementation shared by every admin list (orders, games,
 * users, credentials) — desktop <table> plus its md:hidden stacked-card
 * fallback. Row hover/clickability is conditional on onRowClick being
 * passed, since not every table's rows open something (users/credentials
 * embed their own inline controls per row instead).
 *
 * contain-layout on the scroll wrapper is load-bearing, not decorative:
 * overflow-x-auto alone correctly scrolls the table internally, but its
 * content's true width still leaks into document.documentElement.
 * scrollWidth — measured at 768px, a 768px-wide document with a table
 * like this inside reports up to 805px scrollWidth, and
 * window.scrollTo(x, 0) genuinely moves the whole page sideways. This is
 * specifically an overflow-auto vs document-level overflow-x:clip
 * (globals.css, html/body) interaction in this Chromium build —
 * switching to overflow-x:hidden does NOT fix it; contain:layout does,
 * by establishing a real independent formatting context.
 */
export default function AdminTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  isRowSelected,
  rowAriaLabel,
  emptyMessage,
  renderMobileCard,
}: {
  columns: AdminTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  isRowSelected?: (row: T) => boolean;
  rowAriaLabel?: (row: T) => string;
  emptyMessage: string;
  renderMobileCard: (row: T) => ReactNode;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-nova-hairline bg-nova-crypt px-4 py-12 text-center text-sm text-nova-ash">
        {emptyMessage}
      </div>
    );
  }

  const clickable = Boolean(onRowClick);

  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border border-nova-hairline contain-layout md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-nova-hairline bg-nova-crypt text-xs uppercase tracking-wider text-nova-smoke">
              {columns.map((col) => (
                <th key={col.key} className={`px-4 py-3 font-medium ${col.align === "right" ? "text-right" : ""}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const key = rowKey(row);
              const selected = isRowSelected?.(row) ?? false;
              return (
                <tr
                  key={key}
                  onClick={clickable ? () => onRowClick!(row) : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  role={clickable ? "button" : undefined}
                  aria-label={clickable ? rowAriaLabel?.(row) : undefined}
                  onKeyDown={
                    clickable
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onRowClick!(row);
                          }
                        }
                      : undefined
                  }
                  className={`border-b border-nova-hairline transition-colors duration-(--duration-fast) ease-standard last:border-b-0 ${
                    clickable
                      ? `cursor-pointer hover:bg-nova-crypt ${selected ? "bg-nova-crypt" : "bg-nova-void"}`
                      : ""
                  }`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 ${col.align === "right" ? "text-right" : ""} ${col.mono ? "font-mono" : ""}`}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Stacked cards — below md */}
      <div className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => (
          <div key={rowKey(row)}>{renderMobileCard(row)}</div>
        ))}
      </div>
    </>
  );
}
