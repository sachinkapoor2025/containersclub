import AWS from "aws-sdk";
import dotenv from "dotenv"; dotenv.config();
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import MockProvider from "../providers/mock.js";
import MSCAdapter from "../providers/msc.js";
import MaerskAdapter from "../providers/maersk.js";
import CMAAdapter from "../providers/cma.js";
import { isoCheckDigit } from "../providers/common.js";

const ddb = new AWS.DynamoDB.DocumentClient();
const SUB_TABLE   = process.env.SUBMISSION_TABLE;
const CACHE_TABLE = process.env.CACHE_TABLE;
const USERS_TABLE = process.env.USERS_TABLE; // Users table PK = phone (as in your template)
const DEBUG = String(process.env.DEBUG || "").toLowerCase() === "true";
const SKIP_ISO = String(process.env.SKIP_ISO_CHECK || "").toLowerCase() === "true";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const carriers = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../providers/carriers.json"), "utf-8")
);

/* ----------------- helpers ----------------- */
function slog(reqId, step, more = {}) {
  try { console.log(JSON.stringify({ reqId, step, ...more })); }
  catch { console.log(`[${reqId}] ${step}`, more); }
}
function j(statusCode, body, reqId, step, reason) {
  slog(reqId, step || "return", { statusCode, reason });
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "*",
    },
    body: JSON.stringify(body),
  };
}
function expectedIsoDigit(prefix10) {
  const m = {A:10,B:12,C:13,D:14,E:15,F:16,G:17,H:18,I:19,J:20,K:21,L:23,M:24,N:25,O:26,P:27,Q:28,R:29,S:30,T:31,U:32,V:34,W:35,X:36,Y:37,Z:38};
  const w = [1,2,4,8,16,32,64,128,256,512];
  const val = ch => /\d/.test(ch) ? +ch : (m[ch] || 0);
  const s = prefix10.toUpperCase();
  const sum = s.split("").reduce((acc,ch,i)=>acc+val(ch)*w[i],0);
  const r = sum % 11;
  return r === 10 ? 0 : r;
}
function getProvider(code) {
  if (code === "MSCU") return new MSCAdapter();
  if (code === "MAEU") return new MaerskAdapter();
  if (code === "CMAU") return new CMAAdapter();
  return new MockProvider();
}
function guessCarrierFromContainer(c) {
  const prefix = (c || "").slice(0,4).toUpperCase();
  const hit = carriers.find(x => x.code === prefix);
  return hit ? hit.code : "";
}
// simple phone normalizer for PK usage
function normalizePhone(raw = "") {
  return raw.replace(/[^\d+]/g, "").trim();
}

/* ----------------- handler ----------------- */
export const handler = async (event) => {
  const reqId = event?.requestContext?.requestId || "n/a";
  const method = (event.requestContext?.http?.method || event.httpMethod || "GET").toUpperCase();
  const route  = (event.requestContext?.http?.path   || event.path || "").toLowerCase();

  slog(reqId, "entry", { method, route, hasBody: !!event.body });
  if (DEBUG) slog(reqId, "headers", { headers: event.headers });

  if (method === "OPTIONS") {
    return j(200, { ok: true }, reqId, "cors_ok", "preflight");
  }

  let body = {};
  if (event.body) {
    try {
      body = JSON.parse(event.body);
      slog(reqId, "body_parsed", { keys: Object.keys(body) });
      if (DEBUG) slog(reqId, "body_full", { body });
    } catch (e) {
      slog(reqId, "body_parse_error", { message: e.message, snippet: String(event.body).slice(0,200) });
      return j(400, { error: "Invalid JSON body" }, reqId, "bad_request", "parse_error");
    }
  } else {
    slog(reqId, "no_body");
  }

  // -------- carriers --------
  if (route.endsWith("/api/carriers") && method === "GET") {
    slog(reqId, "carriers_start");
    return j(200, carriers, reqId, "carriers_return", "ok");
  }

  // -------- resolve --------
  if (route.endsWith("/api/resolve") && method === "POST") {
    slog(reqId, "resolve_start", { container: body.container });
    const code = guessCarrierFromContainer(body.container || "");
    const c = carriers.find(x => x.code === code);
    slog(reqId, "resolve_done", { guessed: code, found: !!c });
    return j(200, c || {}, reqId, "resolve_return", c ? "ok" : "empty");
  }

  // -------- init --------
  if (route.endsWith("/api/track/init") && method === "POST") {
    slog(reqId, "init_start");
    const { company, container, consent, user } = body;

    if (!consent) return j(400, { error: "Consent is required." }, reqId, "init_fail", "no_consent");

    const cont = String(container || "").toUpperCase().trim();
    const last = cont.slice(-1);
    const expected = cont.length >= 10 ? expectedIsoDigit(cont.slice(0,10)) : null;

    let isoOk = true;
    if (!SKIP_ISO) isoOk = !!isoCheckDigit(cont);
    slog(reqId, "init_iso", { cont, isoOk, skipISO: SKIP_ISO, supplied: last, expected });
    if (!isoOk) return j(400, { error: "Invalid container number." }, reqId, "init_fail", "iso");

    const code = company || guessCarrierFromContainer(cont) || "";
    const id = cont;

    // Submissions table (per tracking)
    slog(reqId, "ddb_put_submission_start", { table: SUB_TABLE, id, code });
    await ddb.put({
      TableName: SUB_TABLE,
      Item: {
        id,
        container: cont,
        company: code,
        consent: !!consent,
        user: {
          name:    user?.name    || "",
          email:   user?.email   || "",
          phone:   user?.phone   || "",
          company: user?.company || "",
          role:    user?.role    || "",
          country: user?.country || ""   // keep country ISO2
        },
        created_at: new Date().toISOString(),
      },
    }).promise();
    slog(reqId, "ddb_put_submission_done", { id });

    // Users table upsert (PK = phone as per your template)
    if (USERS_TABLE) {
      const phoneKey = normalizePhone(user?.phone || "");
      if (phoneKey) {
        slog(reqId, "users_put_start", { table: USERS_TABLE, phone: phoneKey });

        // Upsert user profile; maintain EmailIndex by keeping "email" attribute
        await ddb.update({
          TableName: USERS_TABLE,
          Key: { phone: phoneKey },
          UpdateExpression:
            "SET #n = :n, email = :e, company = :c, country = :cc, role = :r, last_seen = :ls ADD submissions :one",
          ExpressionAttributeNames: { "#n": "name" },
          ExpressionAttributeValues: {
            ":n":  user?.name    || "",
            ":e":  user?.email   || "",
            ":c":  user?.company || "",
            ":cc": user?.country || "",
            ":r":  user?.role    || "",
            ":ls": new Date().toISOString(),
            ":one": 1
          }
        }).promise();

        slog(reqId, "users_put_done", { phone: phoneKey });
      } else {
        slog(reqId, "users_put_skip_no_phone");
      }
    }

    return j(200, { ok: true, id, company: code }, reqId, "init_ok", "stored");
  }

  // -------- details --------
  if (route.endsWith("/api/track/details") && method === "POST") {
    slog(reqId, "details_start");
    const { company, container } = body;

    const cont = String(container || "").toUpperCase().trim();
    const last = cont.slice(-1);
    const expected = cont.length >= 10 ? expectedIsoDigit(cont.slice(0,10)) : null;

    let isoOk = true;
    if (!SKIP_ISO) isoOk = !!isoCheckDigit(cont);
    slog(reqId, "details_iso", { cont, isoOk, skipISO: SKIP_ISO, supplied: last, expected });
    if (!isoOk) return j(400, { error: "Invalid container number." }, reqId, "details_fail", "iso");

    const carrierCode = company || guessCarrierFromContainer(cont) || "";
    const cacheKey = cont;

    // Try cache
    slog(reqId, "cache_get_start", { table: CACHE_TABLE, key: cacheKey });
    const cached = await ddb.get({ TableName: CACHE_TABLE, Key: { container: cacheKey } }).promise();
    const now = Date.now();
    const fresh = cached.Item && cached.Item.expires_at && cached.Item.expires_at > now;
    slog(reqId, "cache_get_done", { hit: !!cached.Item, fresh });
    if (fresh) {
      slog(reqId, "cache_hit_return");
      return j(200, cached.Item.payload, reqId, "details_ok", "cache");
    }

    // Provider fetch (guarded)
    let payload;
    try {
      const provider = getProvider(carrierCode);
      slog(reqId, "provider_fetch_start", { carrierCode, provider: provider?.constructor?.name });
      const t0 = Date.now();
      payload = await provider.fetch({ carrier: carrierCode, container: cont });
      slog(reqId, "provider_fetch_done", { ms: Date.now() - t0, summaryKeys: Object.keys(payload || {}) });
    } catch (e) {
      slog(reqId, "provider_fetch_error", { message: e.message });
      return j(502, { error: "Carrier provider error." }, reqId, "details_fail", "provider");
    }

    // Cache for 6 hours
    const ttlMillis = 6 * 60 * 60 * 1000;
    slog(reqId, "cache_put_start");
    await ddb.put({
      TableName: CACHE_TABLE,
      Item: {
        container: cacheKey,
        payload,
        updated_at: new Date().toISOString(),
        expires_at: now + ttlMillis,
      },
    }).promise();
    slog(reqId, "cache_put_done");

    return j(200, payload, reqId, "details_ok", "fresh");
  }

  // -------- 404 --------
  slog(reqId, "not_found", { route, method });
  return j(404, { error: "Not found" }, reqId, "return_404", "no_route");
};
