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
      <div onClick={onClose} aria-hidden="true" className="fixed inset-0 z-40 bg-nova-void/70" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="credential-panel-heading"
        className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col overflow-y-auto border-l border-nova-hairline bg-nova-crypt"
      >
        <div className="flex items-start justify-between border-b border-nova-hairline px-5 py-4">
          <h2 id="credential-panel-heading" className="font-display text-lg font-bold text-nova-bone">
            {game.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center text-nova-ash hover:text-nova-bone"
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
              <div key={label} className="rounded-md border border-nova-hairline bg-nova-slab p-3">
                <p className="text-xs text-nova-smoke">{label}</p>
                <p className="mt-1 text-lg font-bold text-nova-bone">{value}</p>
              </div>
            ))}
          </section>

          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-nova-smoke">
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
                className="min-h-11 w-full rounded-md border border-nova-hairline bg-nova-slab px-3 py-2 font-mono text-sm text-nova-bone placeholder:text-nova-smoke focus:border-nova-ember focus:outline-none"
              />
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                aria-label="Password"
                required
                className="min-h-11 w-full rounded-md border border-nova-hairline bg-nova-slab px-3 py-2 font-mono text-sm text-nova-bone placeholder:text-nova-smoke focus:border-nova-ember focus:outline-none"
              />
              {singleError && <p className="text-xs text-nova-blood">{singleError}</p>}
              {singleSuccess && <p className="text-xs text-nova-ember-text">Credential added.</p>}
              <button
                type="submit"
                disabled={singleSubmitting}
                className="min-h-11 rounded-md bg-nova-ember-lo px-4 py-2 text-sm font-semibold text-nova-bone transition-colors duration-(--duration-fast) ease-standard hover:bg-nova-ember-deep disabled:cursor-not-allowed disabled:opacity-40"
              >
                {singleSubmitting ? "Adding…" : "Add Credential"}
              </button>
            </form>
          </section>

          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-nova-smoke">
              Bulk add (CSV)
            </h3>
            <p className="mb-3 text-xs text-nova-smoke">One login,password pair per line.</p>
            <form onSubmit={handleBulkAdd} className="flex flex-col gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv,text/plain"
                onChange={handleFileChange}
                aria-label="Upload CSV file"
                className="text-sm text-nova-ash file:mr-3 file:min-h-11 file:rounded-md file:border-0 file:bg-nova-slab file:px-3 file:py-2 file:text-sm file:font-semibold file:text-nova-bone hover:file:bg-nova-slab"
              />
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={"login1@example.com,password1\nlogin2@example.com,password2"}
                rows={4}
                aria-label="CSV content"
                className="w-full rounded-md border border-nova-hairline bg-nova-slab px-3 py-2 font-mono text-xs text-nova-bone placeholder:text-nova-smoke focus:border-nova-ember focus:outline-none"
              />
              {bulkResult && (
                <p className="text-xs text-nova-ash">
                  {bulkResult.successCount} added, {bulkResult.failCount} failed
                  {bulkResult.failCount > 0 && ` (lines: ${bulkResult.failedLines.join(", ")})`}.
                </p>
              )}
              <button
                type="submit"
                disabled={bulkSubmitting || !csvText.trim()}
                className="min-h-11 rounded-md border border-nova-hairline px-4 py-2 text-sm font-semibold text-nova-bone transition-colors duration-(--duration-fast) ease-standard hover:bg-nova-slab disabled:cursor-not-allowed disabled:opacity-40"
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
