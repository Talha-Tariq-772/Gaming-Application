"use client";

import { useMemo, useState } from "react";
import AdminButton from "@/src/components/admin/AdminButton";
import AdminTable, { type AdminTableColumn } from "@/src/components/admin/AdminTable";
import DeleteHardwareDialog from "@/src/components/admin/DeleteHardwareDialog";
import HardwareFormDialog from "@/src/components/admin/HardwareFormDialog";
import {
  createHardwareProduct,
  deleteHardwareProduct,
  setHardwareActive,
  updateHardwareProduct,
} from "@/src/lib/actions/admin-hardware";
import { formatPrice } from "@/src/lib/format";
import type { HardwareInput } from "@/src/lib/hardware-validation";
import { useToastStore } from "@/src/stores/toast-store";
import { HARDWARE_CATEGORY_LABELS, type AdminHardwareProduct } from "@/src/types/database";

/**
 * Hardware admin list. Deliberately its own screen rather than a tab on
 * /admin/games: hardware is a different table with a different inventory
 * model (a stock counter, not per-unit credential rows), and the two
 * forms share no fields beyond name and price.
 *
 * Feedback contract: every action below ends in a toast — success or
 * failure — and the form dialog renders its own inline error banner on
 * top of that. No path through this component leaves a click with no
 * visible result.
 */
export default function AdminHardwareClient({
  initialProducts,
}: {
  initialProducts: AdminHardwareProduct[];
}) {
  const [products, setProducts] = useState(initialProducts);
  const [search, setSearch] = useState("");
  // undefined = closed, null = adding new, product = editing that one.
  const [editing, setEditing] = useState<AdminHardwareProduct | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<AdminHardwareProduct | null>(null);
  const showToast = useToastStore((s) => s.showToast);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q),
    );
  }, [products, search]);

  const activeCount = products.filter((p) => p.isActive).length;
  const outOfStockCount = products.filter((p) => p.isActive && p.stockQuantity === 0).length;

  async function handleSave(values: HardwareInput): Promise<{ ok: boolean; message?: string }> {
    const result = editing
      ? await updateHardwareProduct(editing.id, values)
      : await createHardwareProduct(values);

    // Returned, not toasted: the dialog stays open and renders this in its
    // own error banner, right next to the fields being fixed.
    if (!result.ok) return result;

    setProducts((prev) =>
      editing
        ? prev.map((p) => (p.id === result.product.id ? result.product : p))
        : [result.product, ...prev],
    );
    showToast(editing ? `${result.product.name} updated` : `${result.product.name} added`);
    setEditing(undefined);
    return { ok: true };
  }

  async function handleToggleActive(product: AdminHardwareProduct) {
    const result = await setHardwareActive(product.id, !product.isActive);
    if (!result.ok) {
      showToast(result.message);
      return;
    }
    setProducts((prev) => prev.map((p) => (p.id === product.id ? result.product : p)));
    showToast(
      result.product.isActive ? `${result.product.name} is live` : `${result.product.name} hidden`,
    );
  }

  async function handleConfirmDelete() {
    if (!deleting) return;
    const result = await deleteHardwareProduct(deleting.id);
    if (!result.ok) {
      // The FK-blocked case lands here and is the one an admin most needs
      // to read, so it gets the longer action-toast treatment via the
      // Retry affordance rather than a 3-second flash.
      showToast(result.message, { label: "Set inactive", onClick: () => handleToggleActive(deleting) });
      setDeleting(null);
      return;
    }
    setProducts((prev) => prev.filter((p) => p.id !== deleting.id));
    showToast(`${deleting.name} deleted`);
    setDeleting(null);
  }

  const columns: AdminTableColumn<AdminHardwareProduct>[] = [
    {
      key: "name",
      header: "Product",
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium text-nova-bone">{row.name}</span>
          <span className="font-mono text-xs text-nova-smoke">/{row.slug}</span>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (row) => (
        <span className="text-nova-ash">{HARDWARE_CATEGORY_LABELS[row.category]}</span>
      ),
    },
    {
      key: "stock",
      header: "Stock",
      align: "right",
      render: (row) => (
        <span className={row.stockQuantity === 0 ? "font-semibold text-nova-blood" : "text-nova-ash"}>
          {row.stockQuantity}
        </span>
      ),
    },
    {
      key: "salePrice",
      header: "Price",
      align: "right",
      render: (row) => <span className="text-nova-ash">{formatPrice(row.salePrice)}</span>,
    },
    {
      key: "costPrice",
      header: "Cost",
      align: "right",
      render: (row) => (
        <span className={row.costPrice === null ? "text-nova-gild" : "text-nova-ash"}>
          {row.costPrice === null ? "not set" : formatPrice(row.costPrice)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
            row.isActive
              ? "border-nova-ember/40 text-nova-ember"
              : "border-nova-hairline text-nova-smoke"
          }`}
        >
          {row.isActive ? "Live" : "Draft"}
        </span>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      render: (row) => (
        <div className="flex justify-end gap-3 text-xs font-semibold">
          <button
            type="button"
            onClick={() => handleToggleActive(row)}
            className="text-nova-ash hover:text-nova-bone"
          >
            {row.isActive ? "Hide" : "Publish"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(row)}
            className="text-nova-ash hover:text-nova-bone"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setDeleting(row)}
            className="text-nova-blood hover:opacity-80"
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-nova-bone">Hardware</h1>
          <p className="mt-1 text-sm text-nova-ash">
            {products.length} product{products.length === 1 ? "" : "s"} · {activeCount} live
            {outOfStockCount > 0 && ` · ${outOfStockCount} live but out of stock`}
          </p>
        </div>
        <AdminButton variant="primary" onClick={() => setEditing(null)}>
          Add Hardware
        </AdminButton>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search hardware…"
        aria-label="Search hardware"
        className="min-h-11 w-full max-w-xs rounded-md border border-nova-hairline bg-nova-crypt px-3 py-2 text-sm text-nova-bone placeholder:text-nova-smoke focus:border-nova-ember focus:outline-none"
      />

      <AdminTable
        columns={columns}
        rows={filtered}
        rowKey={(row) => row.id}
        emptyMessage={
          products.length === 0
            ? "No hardware yet — add the first product."
            : "No hardware matches that search."
        }
        renderMobileCard={(row) => (
          <div className="flex flex-col gap-3 rounded-lg border border-nova-hairline bg-nova-void p-4">
            <div>
              <p className="font-medium text-nova-bone">{row.name}</p>
              <p className="font-mono text-xs text-nova-smoke">/{row.slug}</p>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-nova-smoke">Category</dt>
              <dd className="text-right text-nova-ash">
                {HARDWARE_CATEGORY_LABELS[row.category]}
              </dd>
              <dt className="text-nova-smoke">Stock</dt>
              <dd
                className={`text-right ${row.stockQuantity === 0 ? "font-semibold text-nova-blood" : "text-nova-ash"}`}
              >
                {row.stockQuantity}
              </dd>
              <dt className="text-nova-smoke">Price</dt>
              <dd className="text-right text-nova-ash">{formatPrice(row.salePrice)}</dd>
              <dt className="text-nova-smoke">Cost</dt>
              <dd className={`text-right ${row.costPrice === null ? "text-nova-gild" : "text-nova-ash"}`}>
                {row.costPrice === null ? "not set" : formatPrice(row.costPrice)}
              </dd>
              <dt className="text-nova-smoke">Status</dt>
              <dd className="text-right text-nova-ash">{row.isActive ? "Live" : "Draft"}</dd>
            </dl>
            <div className="flex flex-wrap gap-2">
              <AdminButton onClick={() => handleToggleActive(row)}>
                {row.isActive ? "Hide" : "Publish"}
              </AdminButton>
              <AdminButton onClick={() => setEditing(row)}>Edit</AdminButton>
              <AdminButton variant="destructive" onClick={() => setDeleting(row)}>
                Delete
              </AdminButton>
            </div>
          </div>
        )}
      />

      {editing !== undefined && (
        <HardwareFormDialog
          product={editing}
          onCancel={() => setEditing(undefined)}
          onSave={handleSave}
        />
      )}

      {deleting && (
        <DeleteHardwareDialog
          product={deleting}
          onCancel={() => setDeleting(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
}
