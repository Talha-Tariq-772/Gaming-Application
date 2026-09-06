import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { deleteWithRetry, runCleanupSteps } from "./helpers/cleanup";

/** Same requireAdmin()-via-mocked-session pattern as tests/admin-users.test.ts. */
const sessionState = vi.hoisted(() => ({ client: null as SupabaseClient | null }));

vi.mock("@/src/lib/supabase/server-session", () => ({
  createClient: async () => sessionState.client,
}));

const { uploadGameImage } = await import("@/src/lib/actions/admin-images");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const service = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function signedInClient(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

const run = randomUUID().slice(0, 8);
const password = `AdminImagesTest!${randomUUID()}`;

let admin: { id: string; email: string };
let customer: { id: string; email: string };
let game: { id: string; slug: string };
let membership: { id: string; slug: string };

let realImageBuffer: Buffer;

beforeAll(async () => {
  const emailAdmin = `admin-images-admin-${run}@example.com`;
  const emailCustomer = `admin-images-customer-${run}@example.com`;

  const { data: createdAdmin, error: adminErr } = await service.auth.admin.createUser({
    email: emailAdmin,
    password,
    email_confirm: true,
  });
  if (adminErr) throw adminErr;
  admin = { id: createdAdmin.user.id, email: emailAdmin };
  await service.from("profiles").update({ role: "admin" }).eq("id", admin.id);

  const { data: createdCustomer, error: customerErr } = await service.auth.admin.createUser({
    email: emailCustomer,
    password,
    email_confirm: true,
  });
  if (customerErr) throw customerErr;
  customer = { id: createdCustomer.user.id, email: emailCustomer };

  const { data: gameRow, error: gameErr } = await service
    .from("games")
    .insert({ title: `Admin Images Test Game ${run}`, slug: `admin-images-test-game-${run}`, price: 999, is_active: true })
    .select("id, slug")
    .single();
  if (gameErr) throw gameErr;
  game = gameRow;

  const { data: membershipRow, error: membershipErr } = await service
    .from("games")
    .insert({
      title: `Admin Images Test Membership ${run}`,
      slug: `admin-images-test-membership-${run}`,
      price: 999,
      is_active: true,
      product_type: "membership",
    })
    .select("id, slug")
    .single();
  if (membershipErr) throw membershipErr;
  membership = membershipRow;

  // Real source art already on disk (raw catalog art scripts/upload-catalog-images.mjs
  // and scripts/generate-image-manifest.mjs both process) — a genuine,
  // decodable jpeg, not a synthetic fixture. public/products/card|header
  // hold only generated derivatives (see that script's own header comment),
  // so the real, unprocessed source lives in assets/product-images instead.
  const cardSourceDir = path.join(process.cwd(), "assets", "product-images", "card");
  const [firstFile] = await fs.readdir(cardSourceDir);
  realImageBuffer = await fs.readFile(path.join(cardSourceDir, firstFile));
});

afterAll(async () => {
  await runCleanupSteps([
    {
      label: "storage: game-images covers",
      run: async () => {
        if (game?.slug) {
          await deleteWithRetry(
            () => service.storage.from("game-images").remove([`covers/${game.slug}-400.webp`, `covers/${game.slug}-800.webp`]),
            "storage: game-images covers",
          );
        }
      },
    },
    {
      label: "games",
      run: async () => {
        const ids = [game?.id, membership?.id].filter((id): id is string => Boolean(id));
        if (ids.length) await deleteWithRetry(() => service.from("games").delete().in("id", ids), "games");
      },
    },
    {
      label: "admin",
      run: async () => {
        if (admin?.id) await deleteWithRetry(() => service.auth.admin.deleteUser(admin.id), "admin");
      },
    },
    {
      label: "customer",
      run: async () => {
        if (customer?.id) await deleteWithRetry(() => service.auth.admin.deleteUser(customer.id), "customer");
      },
    },
  ]);
}, 40_000);

function formDataWith(fields: Record<string, string>, file: { name: string; type: string; bytes: Buffer }): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  fd.set("file", new File([file.bytes as unknown as BlobPart], file.name, { type: file.type }));
  return fd;
}

describe("uploadGameImage: auth boundary", () => {
  it("a non-admin session is rejected before any file processing", async () => {
    sessionState.client = await signedInClient(customer.email, password);
    const fd = formDataWith(
      { gameId: game.id, kind: "cover" },
      { name: "cover.jpg", type: "image/jpeg", bytes: realImageBuffer },
    );
    await expect(uploadGameImage(fd)).rejects.toThrow();

    const { data: recheck } = await service.from("games").select("cover_path").eq("id", game.id).single();
    expect(recheck?.cover_path).toBeNull();
  });
});

describe("uploadGameImage: byte-level validation, not the declared MIME type", () => {
  beforeAll(async () => {
    sessionState.client = await signedInClient(admin.email, password);
  });

  it("a non-image file with a spoofed image/jpeg Content-Type is rejected, not resized", async () => {
    const notAnImage = Buffer.from("#!/bin/sh\necho this is a shell script, not an image\n".repeat(50), "utf8");
    const fd = formDataWith(
      { gameId: game.id, kind: "cover" },
      { name: "totally-a-photo.jpg", type: "image/jpeg", bytes: notAnImage },
    );

    const result = await uploadGameImage(fd);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/isn't a readable image/i);
    }

    // Row-level effect check, not just the return value: confirm nothing
    // was actually written to the game row or the bucket.
    const { data: recheck } = await service.from("games").select("cover_path").eq("id", game.id).single();
    expect(recheck?.cover_path).toBeNull();

    const { data: listed } = await service.storage.from("game-images").list("covers", { search: game.slug });
    expect(listed ?? []).toHaveLength(0);
  });

  it("declared MIME type alone is not trusted for a genuine image either way (control case)", async () => {
    // Same bytes as above, but with an honest text/plain type — proves the
    // rejection above is driven by the actual bytes, not merely by seeing
    // an unexpected extension/type combination.
    const notAnImage = Buffer.from("still not an image\n".repeat(50), "utf8");
    const fd = formDataWith(
      { gameId: game.id, kind: "cover" },
      { name: "note.txt", type: "text/plain", bytes: notAnImage },
    );
    const result = await uploadGameImage(fd);
    expect(result.ok).toBe(false);
  });

  it("rejects a file over the 10MB cap before processing", async () => {
    const oversized = Buffer.alloc(10 * 1024 * 1024 + 1);
    const fd = formDataWith({ gameId: game.id, kind: "cover" }, { name: "huge.jpg", type: "image/jpeg", bytes: oversized });
    const result = await uploadGameImage(fd);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/10MB/);
  });

  it("rejects when the game has no slug yet (create mode, no gameId)", async () => {
    const fd = formDataWith({ gameId: "", kind: "cover" }, { name: "cover.jpg", type: "image/jpeg", bytes: realImageBuffer });
    const result = await uploadGameImage(fd);
    expect(result.ok).toBe(false);
  });

  it("rejects a cover upload for a membership row (memberships have no cover art)", async () => {
    const fd = formDataWith(
      { gameId: membership.id, kind: "cover" },
      { name: "cover.jpg", type: "image/jpeg", bytes: realImageBuffer },
    );
    const result = await uploadGameImage(fd);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/don't have cover art/i);
  });
});

describe("uploadGameImage: real image, happy path", () => {
  beforeAll(async () => {
    sessionState.client = await signedInClient(admin.email, password);
  });

  it("accepts a genuine jpeg, writes both derivatives, and updates cover_path", async () => {
    const fd = formDataWith(
      { gameId: game.id, kind: "cover" },
      { name: "cover.jpg", type: "image/jpeg", bytes: realImageBuffer },
    );
    const result = await uploadGameImage(fd);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.path).toBe(`covers/${game.slug}`);

    const { data: recheck } = await service.from("games").select("cover_path").eq("id", game.id).single();
    expect(recheck?.cover_path).toBe(`covers/${game.slug}`);

    for (const width of [400, 800]) {
      const { data: downloaded, error } = await service.storage
        .from("game-images")
        .download(`covers/${game.slug}-${width}.webp`);
      expect(error).toBeNull();
      expect(downloaded).not.toBeNull();
      expect(downloaded!.size).toBeGreaterThan(0);
    }
  });
});
