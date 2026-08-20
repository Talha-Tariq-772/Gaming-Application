"use client";

import { useRef, useState } from "react";
import { addCredential, addCredentialsBulk } from "@/src/lib/actions/admin-credentials";
import { useFocusTrap } from "@/src/lib/use-focus-trap";
import type { CredentialStockEntry } from "@/src/lib/admin-queries";
import type { Game } from "@/src/types/database";

export default function CredentialGamePanel({
  game,
  stock,
  onClose,
  onStockChange,
}: {
  game: Game;
  stock: CredentialStockEntry;
  onClose: () => void;
  onStockChange: (gameId: string, available: number) => void;
}) {
  const panelRef = useFocusTrap<HTMLDivElement>(true, onClose);

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [singleSubmitting, setSingleSubmitting] = useState(false);
  const [singleError, setSingleError] = useState<string | null>(null);
  const [singleSuccess, setSingleSuccess] = useState(false);

  const [csvText, setCsvText] = useState("");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ successCount: number; failCount: number; failedLines: number[] } | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSingleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSingleSubmitting(true);
    setSingleError(null);
    setSingleSuccess(false);

    const result = await addCredential(game.id, login, password);

    setSingleSubmitting(false);
    if (!result.ok) {
      setSingleError(result.message);
      return;
    }
    // Cleared immediately on success — plaintext never lingers in the form.
    setLogin("");
    setPassword("");
    setSingleSuccess(true);
    onStockChange(game.id, stock.available + 1);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  async function handleBulkAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!csvText.trim()) return;
    setBulkSubmitting(true);
    setBulkResult(null);

    const result = await addCredentialsBulk(game.id, csvText);

    setBulkSubmitting(false);
    setBulkResult(result);
    // Cleared immediately on success — plaintext never lingers.
    setCsvText("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (result.successCount > 0) onStockChange(game.id, stock.available + result.successCount);
  }

  return (
    <>
      <div onClick={onClose} aria-hidden="true" className="fixed inset-0 z-40 bg-bg/70" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="credential-panel-heading"
        className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col overflow-y-auto border-l border-border bg-surface-1"
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <h2 id="credential-panel-heading" className="font-display text-lg font-bold text-text">
            {game.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center text-text-muted hover:text-text"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-8 px-5 py-5">
          <section className="grid grid-cols-4 gap-2 text-center">
            {(
              [
                ["Available", stock.available],
                ["Reserved", stock.reserved],
                ["Sold", stock.sold],
                ["Revoked", stock.revoked],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-md border border-border bg-surface-2 p-3">
                <p className="text-xs text-text-faint">{label}</p>
                <p className="mt-1 text-lg font-bold text-text">{value}</p>
              </div>
            ))}
          </section>

          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-faint">
              Add one credential
            </h3>
            <form onSubmit={handleSingleAdd} className="flex flex-col gap-3">
              <input
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="Login"
                aria-label="Login"
                required
                className="min-h-11 w-full rounded-md border border-border bg-surface-2 px-3 py-2 font-mono text-sm text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
              />
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                aria-label="Password"
                required
                className="min-h-11 w-full rounded-md border border-border bg-surface-2 px-3 py-2 font-mono text-sm text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
              />
              {singleError && <p className="text-xs text-danger">{singleError}</p>}
              {singleSuccess && <p className="text-xs text-success">Credential added.</p>}
              <button
                type="submit"
                disabled={singleSubmitting}
                className="min-h-11 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition-colors duration-(--duration-fast) ease-standard hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
              >
                {singleSubmitting ? "Adding…" : "Add Credential"}
              </button>
            </form>
          </section>

          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-faint">
              Bulk add (CSV)
            </h3>
            <p className="mb-3 text-xs text-text-faint">One login,password pair per line.</p>
            <form onSubmit={handleBulkAdd} className="flex flex-col gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv,text/plain"
                onChange={handleFileChange}
                aria-label="Upload CSV file"
                className="text-sm text-text-muted file:mr-3 file:min-h-11 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-text hover:file:bg-surface-3"
              />
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={"login1@example.com,password1\nlogin2@example.com,password2"}
                rows={4}
                aria-label="CSV content"
                className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 font-mono text-xs text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
              />
              {bulkResult && (
                <p className="text-xs text-text-muted">
                  {bulkResult.successCount} added, {bulkResult.failCount} failed
                  {bulkResult.failCount > 0 && ` (lines: ${bulkResult.failedLines.join(", ")})`}.
                </p>
              )}
              <button
                type="submit"
                disabled={bulkSubmitting || !csvText.trim()}
                className="min-h-11 rounded-md border border-border px-4 py-2 text-sm font-semibold text-text transition-colors duration-(--duration-fast) ease-standard hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {bulkSubmitting ? "Uploading…" : "Bulk Add"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </>
  );
}
