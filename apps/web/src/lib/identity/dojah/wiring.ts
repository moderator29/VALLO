import "server-only";

import { getAdminClient } from "@/lib/supabase/service";
import { bvnHmac, ninHmac } from "../nin";
import { dojahClient, type DojahFetch } from "./client";
import type { DojahConfig } from "./config";
import type { CheckRow, ProcessDeps } from "./process";

/**
 * The real effects behind `processDojahResult`, as the service role.
 *
 * FILES. Only links on Dojah's own hosts are fetched (nothing in a payload can
 * point this server at another address), at most 10 MB each, images and PDFs
 * only, into the private `identity-checks` bucket. Nothing is public: the KYC
 * desk streams them through the console.
 */

export const IDENTITY_BUCKET = "identity-checks";
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf" };

export function isDojahFileUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && (url.hostname === "dojah.io" || url.hostname.endsWith(".dojah.io"));
  } catch {
    return false;
  }
}

type Loose = {
  from(t: string): {
    select(c: string): {
      eq(c: string, v: string): {
        maybeSingle(): Promise<{ data: unknown; error: unknown }>;
        order(c: string, o: { ascending: boolean }): { limit(n: number): { maybeSingle(): Promise<{ data: unknown; error: unknown }> } };
      };
    };
  };
  rpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
  storage: {
    from(bucket: string): {
      upload(path: string, body: ArrayBuffer, o: { contentType: string; upsert: boolean }): Promise<{ error: unknown }>;
    };
  };
};

export function dojahProcessDeps(config: DojahConfig, env: Record<string, string | undefined> = process.env, doFetch: DojahFetch = fetch): ProcessDeps | null {
  const db = getAdminClient() as unknown as Loose | null;
  if (!db) return null;
  const key = env.VALLO_NIN_HMAC_KEY ?? "";
  const client = dojahClient(config, doFetch);
  const amlOn = (env.DOJAH_AML ?? "").trim().toLowerCase() === "on";

  return {
    async loadCheck(id) {
      const { data } = await db.from("identity_checks").select("id, subject_id, status").eq("id", id).maybeSingle();
      return (data as CheckRow | null) ?? null;
    },
    async expectedName(subjectId) {
      const { data: app } = await db
        .from("agent_applications")
        .select("full_name")
        .eq("user_id", subjectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const applied = (app as { full_name?: string | null } | null)?.full_name?.trim();
      if (applied) return applied;
      const { data: profile } = await db.from("profiles").select("display_name, first_name, surname").eq("id", subjectId).maybeSingle();
      const p = profile as { display_name?: string | null; first_name?: string | null; surname?: string | null } | null;
      const legal = [p?.first_name, p?.surname].map((s) => (s ?? "").trim()).filter(Boolean).join(" ");
      return legal || (p?.display_name ?? "").trim();
    },
    aml: amlOn ? (name, dob, reference) => client.aml({ schema: "individual", name, dateOfBirth: dob ?? undefined, nationality: undefined, reference }) : null,
    async copyFile(url, path) {
      if (!isDojahFileUrl(url)) return null;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15_000);
      try {
        const response = await doFetch(url, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) return null;
        const length = Number(response.headers.get("content-length") ?? "0");
        if (length > MAX_FILE_BYTES) return null;
        const body = await response.arrayBuffer();
        if (body.byteLength === 0 || body.byteLength > MAX_FILE_BYTES) return null;
        const extension = path.split(".").pop() ?? "jpg";
        const { error } = await db.storage
          .from(IDENTITY_BUCKET)
          .upload(path, body, { contentType: TYPES[extension] ?? "image/jpeg", upsert: true });
        return error ? null : path;
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
      }
    },
    hmac: key.length >= 32 ? { nin: (n) => ninHmac(n, key), bvn: (n) => bvnHmac(n, key) } : null,
    async record(args) {
      const { data, error } = await db.rpc("record_dojah_check", args);
      if (error || typeof data !== "string") throw new Error("record_dojah_check failed");
      return data;
    },
  };
}
