/**
 * Ingest endpoint for the licitor bookmarklet.
 *
 * The bookmarklet runs on a licitor.com detail page the user is ALREADY
 * viewing as a human buyer. It reads document.documentElement.outerHTML
 * (no new fetch to licitor) and POSTs it here along with the current URL.
 * We parse + upsert into past_auctions.
 *
 * CORS is open (Access-Control-Allow-Origin: *). Auth is a shared secret
 * header `X-Ingest-Token` matched against INGEST_BEARER_TOKEN env var.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseLicitorHtml } from "@/lib/ingest-parser";

export const maxDuration = 15;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Ingest-Token",
  "Access-Control-Max-Age": "86400",
};

function jsonCors(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────
  const token = request.headers.get("x-ingest-token");
  const expected = process.env.INGEST_BEARER_TOKEN;
  if (!expected) {
    return jsonCors({ ok: false, error: "Server misconfigured (no token set)" }, 500);
  }
  if (token !== expected) {
    return jsonCors({ ok: false, error: "Unauthorized" }, 401);
  }

  // ── Body ────────────────────────────────────────────────────────────────
  let body: { url?: string; html?: string };
  try {
    body = await request.json();
  } catch {
    return jsonCors({ ok: false, error: "Invalid JSON" }, 400);
  }
  const { url, html } = body;
  if (!url || !html) {
    return jsonCors({ ok: false, error: "Missing url or html" }, 400);
  }
  if (!/licitor\.com/i.test(url)) {
    return jsonCors({ ok: false, error: "URL must be a licitor.com page" }, 400);
  }

  // ── Parse ───────────────────────────────────────────────────────────────
  const parsed = parseLicitorHtml(url, html);
  if (!parsed) {
    return jsonCors({ ok: false, error: "Could not parse licitor_id from URL" }, 400);
  }

  // ── Upsert ──────────────────────────────────────────────────────────────
  const db = adminClient();
  const now = new Date().toISOString();

  // 1. Upsert the lot_index=0 row with everything (creates if missing, updates if not).
  const { error: errUpsert } = await db.from("past_auctions").upsert(
    {
      licitor_id: parsed.licitor_id,
      lot_index: 0,
      url: parsed.url,
      // shared
      tribunal: parsed.tribunal,
      auction_date: parsed.auction_date,
      adjudication_date: parsed.adjudication_date,
      visit_date: parsed.visit_date,
      lawyer_name: parsed.lawyer_name,
      lawyer_firm: parsed.lawyer_firm,
      lawyer_address: parsed.lawyer_address,
      // per-lot
      property_type: parsed.property_type,
      property_description: parsed.property_description,
      surface: parsed.surface,
      surface_annexe: parsed.surface_annexe,
      occupancy: parsed.occupancy,
      floor: parsed.floor,
      city: parsed.city,
      address: parsed.address,
      mise_a_prix: parsed.mise_a_prix,
      adjudication_price: parsed.adjudication_price,
      status: parsed.status,
      detail_fetched_at: now,
      last_fetched_at: now,
      first_seen_at: now, // ignored on conflict (NOT NULL insert default)
    },
    { onConflict: "licitor_id,lot_index", ignoreDuplicates: false }
  );
  if (errUpsert) {
    return jsonCors(
      { ok: false, error: "Upsert failed", details: JSON.stringify(errUpsert) },
      500
    );
  }

  // 2. Propagate shared fields to any other lots (lot_index > 0) of the same
  //    announcement. If there aren't any, this is a no-op.
  const { error: errShared } = await db
    .from("past_auctions")
    .update({
      tribunal: parsed.tribunal,
      auction_date: parsed.auction_date,
      adjudication_date: parsed.adjudication_date,
      visit_date: parsed.visit_date,
      lawyer_name: parsed.lawyer_name,
      lawyer_firm: parsed.lawyer_firm,
      lawyer_address: parsed.lawyer_address,
      detail_fetched_at: now,
      last_fetched_at: now,
    })
    .eq("licitor_id", parsed.licitor_id)
    .gt("lot_index", 0);
  if (errShared) {
    // non-fatal — lot 0 already has the data
    console.warn("ingest: shared-fields update failed", errShared);
  }

  console.info(
    JSON.stringify({
      evt: "ingest.ok",
      licitor_id: parsed.licitor_id,
      status: parsed.status,
      has_adjudication: parsed.adjudication_price != null,
      has_mise_a_prix: parsed.mise_a_prix != null,
      warnings: parsed.warnings.length,
    })
  );

  return jsonCors({
    ok: true,
    licitor_id: parsed.licitor_id,
    status: parsed.status,
    mise_a_prix: parsed.mise_a_prix,
    adjudication_price: parsed.adjudication_price,
    surface: parsed.surface,
    visit_date: parsed.visit_date,
    tribunal: parsed.tribunal,
    warnings: parsed.warnings,
  });
}
