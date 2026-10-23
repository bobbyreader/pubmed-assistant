/* PubMed 文献研究助手 v2 — Cloudflare Pages advanced-mode worker.
 *
 * Same-origin server-side aggregation so browsers (notably in mainland China,
 * where translate.googleapis.com is unreachable and every NCBI call is a
 * separate cross-border round trip) make ONE request instead of 3+:
 *   GET  /api/search?term=&retmax=&retstart=&sort=  esearch + esummary, edge-cached 5 min
 *   GET  /api/abstract?pmid=                        efetch XML, edge-cached 24 h
 *   POST /api/translate {text, sl, tl, mode}        Agnes LLM (env.AGNES_API_KEY) -> Google fallback
 * Everything else is served from the Pages static assets (env.ASSETS).
 * The frontend keeps direct browser calls as fallbacks, so the site also
 * works when deployed as a bare static file with no worker.
 */

const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const TOOL = "pubmed-assistant-v2";
const AGNES_BASE = "https://apihub.agnes-ai.com/v1";

function jsonResponse(obj, status, extraHeaders) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign({ "Content-Type": "application/json" }, extraHeaders || {}),
  });
}

async function fetchWithTimeout(url, options, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, Object.assign({}, options || {}, { signal: ctrl.signal }));
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------- /api/search ---------------- */
async function handleSearch(request, ctx) {
  const url = new URL(request.url);
  const term = (url.searchParams.get("term") || "").trim();
  if (!term) return jsonResponse({ error: "term is required" }, 400);
  if (term.length >= 2000) return jsonResponse({ error: "term too long" }, 400);
  let retmax = parseInt(url.searchParams.get("retmax") || "10", 10);
  if (!Number.isFinite(retmax) || retmax < 1) retmax = 10;
  if (retmax > 100) retmax = 100;
  let retstart = parseInt(url.searchParams.get("retstart") || "0", 10);
  if (!Number.isFinite(retstart) || retstart < 0) retstart = 0;
  const sort = url.searchParams.get("sort") || "relevance";

  const cache = caches.default;
  const cacheKey = new Request(url.toString(), { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  try {
    const esParams = new URLSearchParams({
      db: "pubmed", term, retmax: String(retmax), retstart: String(retstart),
      retmode: "json", sort, tool: TOOL,
    });
    const esRes = await fetchWithTimeout(EUTILS + "/esearch.fcgi?" + esParams.toString(), {}, 20000);
    if (esRes.status === 429) return jsonResponse({ error: "RATE_LIMIT" }, 429);
    if (!esRes.ok) return jsonResponse({ error: "esearch upstream HTTP " + esRes.status }, 502);
    const esData = await esRes.json();
    const r = esData && esData.esearchresult;
    if (!r) return jsonResponse({ error: "esearch bad response" }, 502);
    const ids = r.idlist || [];
    const count = parseInt(r.count, 10) || 0;
    const translation = r.querytranslation || "";

    let result = {};
    if (ids.length) {
      const sumParams = new URLSearchParams({
        db: "pubmed", id: ids.join(","), retmode: "json", version: "2.0", tool: TOOL,
      });
      const sumRes = await fetchWithTimeout(EUTILS + "/esummary.fcgi?" + sumParams.toString(), {}, 20000);
      if (sumRes.status === 429) return jsonResponse({ error: "RATE_LIMIT" }, 429);
      if (!sumRes.ok) return jsonResponse({ error: "esummary upstream HTTP " + sumRes.status }, 502);
      const sumData = await sumRes.json();
      result = (sumData && sumData.result) || {};
    }

    const response = jsonResponse(
      { count, ids, translation, result },
      200,
      { "Cache-Control": "public, s-maxage=300" }
    );
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch (e) {
    return jsonResponse({ error: "search upstream failed: " + (e && e.message ? e.message : String(e)) }, 502);
  }
}

/* ---------------- /api/abstract ---------------- */
async function handleAbstract(request, ctx) {
  const url = new URL(request.url);
  const pmid = (url.searchParams.get("pmid") || "").trim();
  if (!/^\d+$/.test(pmid)) return jsonResponse({ error: "pmid must be digits only" }, 400);

  const cache = caches.default;
  const cacheKey = new Request(url.toString(), { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({ db: "pubmed", id: pmid, retmode: "xml", tool: TOOL });
    const res = await fetchWithTimeout(EUTILS + "/efetch.fcgi?" + params.toString(), {}, 20000);
    if (res.status === 429) return jsonResponse({ error: "RATE_LIMIT" }, 429);
    if (!res.ok) return jsonResponse({ error: "efetch upstream HTTP " + res.status }, 502);
    const text = await res.text();
    const response = new Response(text, {
      status: 200,
      headers: {
        "Content-Type": "text/xml",
        "Cache-Control": "public, s-maxage=86400",
      },
    });
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch (e) {
    return jsonResponse({ error: "abstract upstream failed: " + (e && e.message ? e.message : String(e)) }, 502);
  }
}

/* ---------------- /api/translate ---------------- */
function agnesSystemPrompt(mode, sl, tl) {
  if (mode === "query") {
    return "You are a professional medical translator. Translate the user's Chinese medical search query into English suitable for searching PubMed. Use standard medical terminology, generic drug names, and MeSH-style terms where appropriate. Output ONLY the translated query text — no quotes, no explanations, no extra words.";
  }
  if (mode === "abstract") {
    return "You are a professional medical translator. Translate the user's English medical abstract into Simplified Chinese. Preserve section headings, numbers, units, abbreviations, gene symbols and drug names exactly as in the source where appropriate. If the text contains separator lines consisting of @@@SEG@@@, keep those separator lines exactly as-is and in the same positions. Output ONLY the translation — no quotes, no explanations, no extra words.";
  }
  return "You are a professional translator. Translate the user's text faithfully from " + sl + " to " + tl + ". Output ONLY the translation — no quotes, no explanations, no extra words.";
}

async function translateViaAgnes(text, sl, tl, mode, env) {
  const res = await fetchWithTimeout(AGNES_BASE + "/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + env.AGNES_API_KEY,
    },
    body: JSON.stringify({
      model: env.AGNES_MODEL || "agnes-2.5-flash",
      messages: [
        { role: "system", content: agnesSystemPrompt(mode, sl, tl) },
        { role: "user", content: text },
      ],
      temperature: 0,
      max_tokens: 3000,
    }),
  }, 20000);
  if (!res.ok) throw new Error("agnes HTTP " + res.status);
  const data = await res.json();
  const choice = data && data.choices && data.choices[0];
  let content = choice && choice.message ? choice.message.content : "";
  if (Array.isArray(content)) {
    content = content.map(part => (typeof part === "string" ? part : (part && part.text) || "")).join("");
  }
  const out = String(content || "").trim();
  if (!out) throw new Error("agnes empty response");
  return out;
}

async function translateViaGoogle(text, sl, tl) {
  const url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=" + encodeURIComponent(sl) +
              "&tl=" + encodeURIComponent(tl) + "&dt=t&q=" + encodeURIComponent(text);
  const res = await fetchWithTimeout(url, {}, 15000);
  if (!res.ok) throw new Error("google translate HTTP " + res.status);
  const data = await res.json();
  if (!data || !Array.isArray(data[0])) throw new Error("google translate bad response");
  return data[0].map(seg => (seg && seg[0]) || "").join("");
}

async function handleTranslate(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }
  const text = body && typeof body.text === "string" ? body.text : "";
  if (!text.trim()) return jsonResponse({ error: "text is required" }, 400);
  if (text.length > 8000) return jsonResponse({ error: "text too long (max 8000 chars)" }, 400);
  const sl = (body.sl || "zh-CN").toString();
  const tl = (body.tl || "en").toString();
  const mode = (body.mode || "generic").toString();

  let agnesDetail = "no-key";
  if (env.AGNES_API_KEY) {
    try {
      const out = await translateViaAgnes(text, sl, tl, mode, env);
      return jsonResponse({ text: out, source: "agnes" });
    } catch (e) {
      agnesDetail = String(e && e.message || e);
      /* fall through to Google */
    }
  }
  try {
    const out = await translateViaGoogle(text, sl, tl);
    return jsonResponse({ text: out, source: "google" });
  } catch (e) {
    return jsonResponse({ error: "TRANSLATE_FAILED", detail: "agnes: " + agnesDetail + "; google: " + String(e && e.message || e) }, 502);
  }
}

/* ---------------- router ---------------- */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      if (url.pathname === "/api/search") {
        if (request.method !== "GET") return jsonResponse({ error: "method not allowed" }, 405);
        return handleSearch(request, ctx);
      }
      if (url.pathname === "/api/abstract") {
        if (request.method !== "GET") return jsonResponse({ error: "method not allowed" }, 405);
        return handleAbstract(request, ctx);
      }
      if (url.pathname === "/api/translate") {
        if (request.method !== "POST") return jsonResponse({ error: "method not allowed" }, 405);
        return handleTranslate(request, env);
      }
      return jsonResponse({ error: "not found" }, 404);
    }
    return env.ASSETS.fetch(request);
  },
};
