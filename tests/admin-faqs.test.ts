import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { deleteWithRetry, runCleanupSteps } from "./helpers/cleanup";

/** Same requireAdmin()-via-mocked-session pattern as the rest of this suite. */
const sessionState = vi.hoisted(() => ({ client: null as SupabaseClient | null }));

vi.mock("@/src/lib/supabase/server-session", () => ({
  createClient: async () => sessionState.client,
}));

const { createFaq, updateFaq, setFaqPublished, deleteFaq } = await import(
  "@/src/lib/actions/admin-faqs"
);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const service = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Stateless anon client — the same one src/lib/faqs.ts uses for the
 * public page, so RLS assertions here exercise the real anon path. */
const anon = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function signedInClient(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

const run = randomUUID().slice(0, 8);
const password = `AdminFaqTest!${randomUUID()}`;
const slugPrefix = `zz-test-faq-${run}`;

let admin: { id: string; email: string };
let customer: { id: string; email: string };

/** Every row this suite creates, so cleanup never depends on a test
 * having reached its own delete. */
const createdIds = new Set<string>();

function track(id: string | undefined): void {
  if (id) createdIds.add(id);
}

beforeAll(async () => {
  const emailAdmin = `admin-faqs-admin-${run}@example.com`;
  const emailCustomer = `admin-faqs-customer-${run}@example.com`;

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

  sessionState.client = await signedInClient(admin.email, password);
});

afterAll(async () => {
  await runCleanupSteps([
    {
      label: "faqs",
      run: async () => {
        // Sweep by slug prefix as well as by tracked id: a row created by
        // an action whose result this suite never saw (a timeout mid-write)
        // still has this run's unique prefix, and would otherwise be left
        // behind in the live project.
        if (createdIds.size) {
          await deleteWithRetry(
            () => service.from("faqs").delete().in("id", [...createdIds]),
            "faqs by id",
          );
        }
        await deleteWithRetry(
          () => service.from("faqs").delete().like("slug", `${slugPrefix}%`),
          "faqs by slug prefix",
        );
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

describe("createFaq", () => {
  it("creates a published entry and normalises the slug", async () => {
    const result = await createFaq({
      slug: `  ${slugPrefix}-Mixed CASE!!  `,
      question: "  Does it trim?  ",
      answer: "  Yes.  ",
      category: "payment",
      sortOrder: 5,
      isPublished: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    track(result.faq.id);

    expect(result.faq.slug).toBe(`${slugPrefix}-mixed-case`);
    expect(result.faq.question).toBe("Does it trim?");
    expect(result.faq.answer).toBe("Yes.");
    expect(result.faq.category).toBe("payment");
    expect(result.faq.sortOrder).toBe(5);
    expect(result.faq.isPublished).toBe(true);
  });

  it("accepts a null category", async () => {
    const result = await createFaq({
      slug: `${slugPrefix}-uncategorised`,
      question: "No category?",
      answer: "Allowed.",
      category: null,
      sortOrder: 0,
      isPublished: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    track(result.faq.id);
    expect(result.faq.category).toBeNull();
  });

  it("rejects a duplicate slug with a readable message, not a raw Postgres error", async () => {
    const first = await createFaq({
      slug: `${slugPrefix}-dupe`,
      question: "First",
      answer: "First answer.",
      category: "payment",
      sortOrder: 1,
      isPublished: true,
    });
    expect(first.ok).toBe(true);
    if (first.ok) track(first.faq.id);

    const second = await createFaq({
      slug: `${slugPrefix}-dupe`,
      question: "Second",
      answer: "Second answer.",
      category: "payment",
      sortOrder: 2,
      isPublished: true,
    });

    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.message).toMatch(/already exists/i);
  });

  it("rejects empty fields and an out-of-range order before touching the database", async () => {
    const cases = [
      { label: "blank slug", input: { slug: "   ", question: "Q", answer: "A" } },
      { label: "slug with no usable characters", input: { slug: "!!!", question: "Q", answer: "A" } },
      { label: "blank question", input: { slug: `${slugPrefix}-x`, question: "  ", answer: "A" } },
      { label: "blank answer", input: { slug: `${slugPrefix}-x`, question: "Q", answer: "  " } },
    ];

    for (const { label, input } of cases) {
      const result = await createFaq({
        ...input,
        category: "payment",
        sortOrder: 0,
        isPublished: true,
      });
      expect(result.ok, label).toBe(false);
    }

    for (const bad of [-1, 40_000]) {
      const result = await createFaq({
        slug: `${slugPrefix}-order-${bad}`,
        question: "Q",
        answer: "A",
        category: "payment",
        sortOrder: bad,
        isPublished: true,
      });
      expect(result.ok, `order ${bad}`).toBe(false);
    }

    // Nothing above should have been written.
    const { count } = await service
      .from("faqs")
      .select("id", { count: "exact", head: true })
      .like("slug", `${slugPrefix}-order-%`);
    expect(count).toBe(0);
  });

  it("rejects a category outside GUIDE_CATEGORIES", async () => {
    const result = await createFaq({
      slug: `${slugPrefix}-bad-category`,
      question: "Q",
      answer: "A",
      // deliberately outside the union — this is the boundary the check exists for
      category: "not-a-category" as never,
      sortOrder: 0,
      isPublished: true,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/invalid category/i);
  });
});

describe("updateFaq / setFaqPublished / deleteFaq", () => {
  it("updates every editable field", async () => {
    const created = await createFaq({
      slug: `${slugPrefix}-editable`,
      question: "Before",
      answer: "Before answer.",
      category: "payment",
      sortOrder: 1,
      isPublished: true,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    track(created.faq.id);

    const updated = await updateFaq(created.faq.id, {
      slug: `${slugPrefix}-editable-renamed`,
      question: "After",
      answer: "After answer.",
      category: "troubleshooting",
      sortOrder: 9,
      isPublished: false,
    });

    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.faq.id).toBe(created.faq.id);
    expect(updated.faq.slug).toBe(`${slugPrefix}-editable-renamed`);
    expect(updated.faq.question).toBe("After");
    expect(updated.faq.category).toBe("troubleshooting");
    expect(updated.faq.sortOrder).toBe(9);
    expect(updated.faq.isPublished).toBe(false);
  });

  it("toggles published state without touching any other field", async () => {
    const created = await createFaq({
      slug: `${slugPrefix}-toggle`,
      question: "Toggle me",
      answer: "Answer stays put.",
      category: "account-setup",
      sortOrder: 3,
      isPublished: true,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    track(created.faq.id);

    const unpublished = await setFaqPublished(created.faq.id, false);
    expect(unpublished.ok).toBe(true);
    if (!unpublished.ok) return;
    expect(unpublished.faq.isPublished).toBe(false);
    expect(unpublished.faq.question).toBe("Toggle me");
    expect(unpublished.faq.answer).toBe("Answer stays put.");
    expect(unpublished.faq.sortOrder).toBe(3);

    const republished = await setFaqPublished(created.faq.id, true);
    expect(republished.ok).toBe(true);
    if (republished.ok) expect(republished.faq.isPublished).toBe(true);
  });

  it("hard-deletes the row", async () => {
    const created = await createFaq({
      slug: `${slugPrefix}-deletable`,
      question: "Delete me",
      answer: "Gone.",
      category: "payment",
      sortOrder: 1,
      isPublished: true,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    track(created.faq.id);

    const result = await deleteFaq(created.faq.id);
    expect(result.ok).toBe(true);

    const { data } = await service.from("faqs").select("id").eq("id", created.faq.id).maybeSingle();
    expect(data).toBeNull();
  });
});

describe("authorization — every action requires an admin session", () => {
  it("rejects a customer session before writing anything", async () => {
    sessionState.client = await signedInClient(customer.email, password);

    await expect(
      createFaq({
        slug: `${slugPrefix}-customer-attempt`,
        question: "Should never exist",
        answer: "No.",
        category: "payment",
        sortOrder: 0,
        isPublished: true,
      }),
    ).rejects.toThrow();

    const { count } = await service
      .from("faqs")
      .select("id", { count: "exact", head: true })
      .eq("slug", `${slugPrefix}-customer-attempt`);
    expect(count).toBe(0);

    sessionState.client = await signedInClient(admin.email, password);
  });

  it("rejects a signed-out session", async () => {
    const previous = sessionState.client;
    sessionState.client = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    await expect(deleteFaq(randomUUID())).rejects.toThrow();

    sessionState.client = previous;
  });
});

describe("RLS — anon sees published rows only", () => {
  it("hides an unpublished entry from the public (anon) client but keeps it for service role", async () => {
    const created = await createFaq({
      slug: `${slugPrefix}-draft`,
      question: "Draft question",
      answer: "Draft answer.",
      category: "payment",
      sortOrder: 1,
      isPublished: false,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    track(created.faq.id);

    const { data: anonRow } = await anon.from("faqs").select("id").eq("id", created.faq.id).maybeSingle();
    expect(anonRow).toBeNull();

    const { data: serviceRow } = await service
      .from("faqs")
      .select("id")
      .eq("id", created.faq.id)
      .maybeSingle();
    expect(serviceRow?.id).toBe(created.faq.id);

    // Publishing makes it visible to anon through the same policy.
    const published = await setFaqPublished(created.faq.id, true);
    expect(published.ok).toBe(true);

    const { data: anonAfter } = await anon.from("faqs").select("id").eq("id", created.faq.id).maybeSingle();
    expect(anonAfter?.id).toBe(created.faq.id);
  });

  it("does not let anon insert, update, or delete", async () => {
    const created = await createFaq({
      slug: `${slugPrefix}-anon-write`,
      question: "Anon cannot touch this",
      answer: "Original answer.",
      category: "payment",
      sortOrder: 1,
      isPublished: true,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    track(created.faq.id);

    const insert = await anon
      .from("faqs")
      .insert({ slug: `${slugPrefix}-anon-inserted`, question: "Q", answer: "A" });
    expect(insert.error).not.toBeNull();

    await anon.from("faqs").update({ answer: "Tampered." }).eq("id", created.faq.id);
    await anon.from("faqs").delete().eq("id", created.faq.id);

    // Whatever PostgREST reported, the row must be untouched and present.
    const { data: after } = await service
      .from("faqs")
      .select("answer")
      .eq("id", created.faq.id)
      .maybeSingle();
    expect(after?.answer).toBe("Original answer.");
  });
});

describe("seeded content — the deep links that existed before the table", () => {
  it("keeps the three slugs other pages link to resolvable and published", async () => {
    const linked = ["faq-how-verification-works", "faq-verification-time", "faq-platforms-supported"];

    const { data, error } = await service
      .from("faqs")
      .select("slug, is_published")
      .in("slug", linked);
    expect(error).toBeNull();

    for (const slug of linked) {
      const row = (data ?? []).find((r) => r.slug === slug);
      expect(row, `${slug} should exist — StepConfirmation/legal-content link to it`).toBeTruthy();
      expect(row?.is_published, `${slug} should be published`).toBe(true);
    }
  });
});
