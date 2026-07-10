// =============================================================================
//  modules/web-tools.js — WEB TOOLS (search Serper->Tavily->DDG + web_fetch)
//  Di-extract dari bot.js (refactor monolith). Fungsi di-copy VERBATIM (baris
//  1058-1344 bot.js lama). Dependency yang tetap tinggal di bot.js (dipakai
//  modul lain juga) di-inject lewat init(deps) di bawah.
//  ⚠️ SSRF guard (_isBlockedAddr / _resolveSafeUrl) pindah UTUH — JANGAN ubah
//     logic tanpa security-review (private-IP + DNS-rebinding protection).
// =============================================================================

const axios = require('axios');
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

// --- deps di-inject dari bot.js via init() (dipanggil sekali saat boot).
//     Bare-name refs di fungsi hasil-copy resolve ke module-scope let ini.
//     Default = sama persis default bot.js (belt-and-suspenders kalau init telat). ---
let acquireGenericSlot = async () => {};
let releaseGenericSlot = () => {};
let recordError = () => {};
let SCRAPLING_FETCH_URL = 'http://127.0.0.1:8765/fetch';
let SCRAPLING_TIMEOUT_MS = 28000;
let FIRECRAWL_API_KEY = '';
let FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v2/scrape';
let FIRECRAWL_TIMEOUT_MS = 45000;
let FIRECRAWL_MAX_AGE_MS = 60 * 60 * 1000;
let MAX_FETCH_BYTES = 4 * 1024 * 1024;

// ===================== VERBATIM dari bot.js 1058-1344 ========================
function htmlToText(html) {
    if (!html) return '';
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\s*>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#0?39;|&#x27;/gi, "'")
        .replace(/[ \t]+/g, ' ')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

const withTimeout = (promise, ms) => {
    let timer;
    const timeout = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('Timeout')), ms); });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

async function serperSearch(query) {
    const res = await withTimeout(axios.post('https://google.serper.dev/search',
        { q: query, num: 6 },
        { headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' }, timeout: 15000 }
    ), 15500);
    const items = (res.data && res.data.organic) || [];
    if (!items.length) return null;
    return items.slice(0, 6).map((r, i) =>
        `${i + 1}. ${r.title}\n   ${r.link}\n   ${(r.snippet || '').slice(0, 160)}`
    ).join('\n');
}

async function tavilySearch(query) {
    const res = await withTimeout(axios.post('https://api.tavily.com/search',
        { api_key: process.env.TAVILY_API_KEY, query, max_results: 6, search_depth: 'basic' },
        { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
    ), 15500);
    const items = (res.data && res.data.results) || [];
    if (!items.length) return null;
    return items.slice(0, 6).map((r, i) =>
        `${i + 1}. ${r.title}\n   ${r.url}\n   ${(r.content || '').slice(0, 160)}`
    ).join('\n');
}

async function ddgSearch(query) {
    const res = await withTimeout(axios.get('https://html.duckduckgo.com/html/', {
        params: { q: query },
        headers: { 'User-Agent': UA },
        timeout: 15000,
        maxContentLength: 5 * 1024 * 1024,
        responseType: 'text',
        transformResponse: (x) => x,
        validateStatus: () => true
    }), 15500);
    if (res.status === 202 || /anomaly|unusual traffic/i.test(res.data || '')) return null;
    const out = [];
    const re = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    while ((m = re.exec(res.data)) && out.length < 6) {
        let url = m[1];
        const uddg = url.match(/[?&]uddg=([^&]+)/);
        if (uddg) { try { url = decodeURIComponent(uddg[1]); } catch (e) {} }
        if (url.startsWith('//')) url = 'https:' + url;
        out.push(`${out.length + 1}. ${htmlToText(m[2]).replace(/\s+/g, ' ').trim()}\n   ${url}`);
    }
    return out.length ? out.join('\n') : null;
}

// Fallback berlapis: Serper -> Tavily -> DuckDuckGo.
async function webSearch(query) {
    await acquireGenericSlot('search');
    try {
        const providers = [
            ['Serper', () => process.env.SERPER_API_KEY ? serperSearch(query) : null],
            ['Tavily', () => process.env.TAVILY_API_KEY ? tavilySearch(query) : null],
            ['DuckDuckGo', () => ddgSearch(query)]
        ];
        for (const [name, fn] of providers) {
            try {
                const r = await fn();
                if (r) { console.log(`🔍 search via ${name}`); return r; }
            } catch (e) {
                recordError(`search-${name}`, e);
                console.error(`search ${name} gagal: ${e.message}`);
            }
        }
        return 'web_search lagi ga tersedia (semua search engine nge-throttle/limit). JANGAN ulang web_search dan JANGAN karang URL. Kalau sudah ada URL valid dari user/history/tool result, baru pakai web_fetch ke URL itu. Kalau belum ada URL, jawab dari KB/pengetahuan yang ada dengan confidence rendah dan minta user kirim link/log kalau butuh verifikasi.';
    } finally {
        releaseGenericSlot('search');
    }
}

// SSRF guard: blokir loopback, link-local (cloud metadata 169.254.169.254),
// dan RFC-1918 private ranges. Resolve hostname via DNS dulu, terus PIN IP yang aman
// itu ke axios via custom lookup — kalau ga di-pin, attacker bisa flip DNS record
// antara validasi & connect (DNS rebinding / TOCTOU bypass).
const _dnsLookup = require('dns').promises.lookup;
const _https = require('https');
const _BLOCKED_NETS_V4 = [
    /^127\./,
    /^10\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^169\.254\./,
    /^0\./,                                       // 0.0.0.0/8 "this-network" (route ke localhost di Linux)
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,   // CGNAT 100.64.0.0/10
];
const _BLOCKED_NETS_V6 = [/^::1$/, /^::$/, /^fc/i, /^fd/i, /^fe[89ab]/i, /^fe[cdef]/i];  // ::1 loopback, :: unspecified, fc/fd ULA, fe80::/10 link-local, fec0::/10 site-local
function _isBlockedAddr(address, family) {
    // IPv4-mapped IPv6 (::ffff:a.b.c.d): di VPS dual-stack ini route ke embedded v4
    // target (termasuk loopback/metadata 169.254). Eval embedded v4 pakai blocklist v4
    // — public-mapped (::ffff:8.8.8.8) tetap lolos, private/loopback-mapped diblok.
    // Dua bentuk: dotted (dari resolusi AAAA) & hex ::ffff:HHHH:HHHH (WHATWG URL
    // normalize literal [::ffff:1.2.3.4] jadi hex). ffff optional = cover juga
    // deprecated IPv4-compatible ::a.b.c.d (fail-safe; range ::/96 reserved).
    if (family === 6) {
        let m = /^::(?:ffff:)?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(address);
        if (m) return _BLOCKED_NETS_V4.some((r) => r.test(m[1]));
        m = /^::(?:ffff:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(address);
        if (m) {
            const hi = parseInt(m[1], 16), lo = parseInt(m[2], 16);
            const v4 = `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
            return _BLOCKED_NETS_V4.some((r) => r.test(v4));
        }
    }
    const blocked = family === 4 ? _BLOCKED_NETS_V4 : _BLOCKED_NETS_V6;
    return blocked.some((r) => r.test(address));
}
// Resolve URL ke single IP yang aman. Return { ok, ip, family } atau { ok:false }.
// Pick record pertama yang lolos blocklist; kalau ada record private, tolak total
// (lebih aman drop-all daripada race). https-only.
async function _resolveSafeUrl(rawUrl) {
    let parsed;
    try { parsed = new URL(rawUrl); } catch { return { ok: false }; }
    if (parsed.protocol !== 'https:') return { ok: false };
    const host = parsed.hostname.replace(/^\[|\]$/g, '');
    let addrs;
    try { addrs = await _dnsLookup(host, { all: true }); } catch { return { ok: false }; }
    if (!addrs.length) return { ok: false };
    if (addrs.some(({ address, family }) => _isBlockedAddr(address, family))) return { ok: false };
    const first = addrs[0];
    return { ok: true, ip: first.address, family: first.family };
}

const MAX_REDIRECT_HOPS = 3;   // cap redirect chain biar ga jadi DoS vector

// Coba scrapling microservice (anti-bot/Cloudflare) DULU. SSRF guard (_resolveSafeUrl)
// WAJIB lolos sebelum URL dioper — scrapling/playwright resolve DNS sendiri, jadi tanpa
// gate ini IP-pinning ke-bypass. Return string hasil, atau null (caller fallback axios).
async function tryScraplingFetch(rawUrl) {
    if (!SCRAPLING_FETCH_URL) return null;
    const safe = await _resolveSafeUrl(rawUrl);
    if (!safe.ok) return null;   // bukan https publik / IP internal → jangan oper ke scrapling
    try {
        const r = await axios.post(SCRAPLING_FETCH_URL,
            { url: rawUrl, ip: safe.ip },
            { timeout: SCRAPLING_TIMEOUT_MS, validateStatus: () => true });
        const d = r.data;
        if (!d || !d.ok || typeof d.text !== 'string') return null;
        let text = d.text.replace(/\n{3,}/g, '\n\n').trim();
        const MAX = 7000;
        if (text.length > MAX) text = text.slice(0, MAX) + '\n...[dipotong, terlalu panjang]';
        const status = d.status || 0;
        if (status >= 400) {
            return `[HTTP ${status}] ${rawUrl}\nPindah sumber lain, JANGAN retry URL ini.\n\n${text.slice(0, 600) || '(body kosong)'}`;
        }
        return text || null;   // kosong → biar axios fallback coba
    } catch (e) {
        // service mati/timeout → fallback axios. JANGAN echo detail.
        return null;
    }
}

// Firecrawl dipakai sebagai fallback berbayar/credit-based setelah fetch lokal gagal.
// Tetap gate lewat _resolveSafeUrl supaya URL private/internal tidak pernah dikirim ke pihak ketiga.
async function tryFirecrawlFetch(rawUrl) {
    if (!FIRECRAWL_API_KEY) return null;
    const safe = await _resolveSafeUrl(rawUrl);
    if (!safe.ok) return null;
    try {
        const r = await axios.post(FIRECRAWL_API_URL, {
            url: rawUrl,
            formats: ['markdown'],
            onlyMainContent: true,
            maxAge: FIRECRAWL_MAX_AGE_MS,
            timeout: FIRECRAWL_TIMEOUT_MS
        }, {
            headers: {
                Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: FIRECRAWL_TIMEOUT_MS + 5000,
            maxContentLength: MAX_FETCH_BYTES,
            validateStatus: () => true
        });
        const d = r.data || {};
        const metadata = (d.data && d.data.metadata) || {};
        const status = metadata.statusCode || r.status || 0;
        let text = (d.data && (d.data.markdown || d.data.html || d.data.rawHtml)) || '';
        if (typeof text !== 'string') text = JSON.stringify(text);
        if (/^\s*</.test(text)) text = htmlToText(text);
        text = text.replace(/\n{3,}/g, '\n\n').trim();
        const MAX = 7000;
        if (text.length > MAX) text = text.slice(0, MAX) + '\n...[dipotong, terlalu panjang]';
        if (!d.success || status >= 400) {
            if (text) {
                return `[Firecrawl HTTP ${status || r.status}] ${rawUrl}\nPindah sumber lain, JANGAN retry URL ini.\n\n${text.slice(0, 600)}`;
            }
            return null;
        }
        if (!text) return null;
        console.log('🔥 web_fetch via Firecrawl');
        return text;
    } catch (e) {
        console.error('Firecrawl fetch gagal:', e.code || e.message);
        return null;
    }
}

async function webFetch(url) {
    await acquireGenericSlot('fetch');
    try {
        // Scrapling dulu (lebih jago nembus anti-bot). Gagal/mati → fallback axios di bawah.
        const viaScrapling = await tryScraplingFetch(url);
        if (viaScrapling) return viaScrapling;
        let currentUrl = url;
        let res = null;
        for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
            const safe = await _resolveSafeUrl(currentUrl);
            if (!safe.ok) {
                return 'web_fetch: URL ditolak (harus HTTPS publik, bukan IP internal/private).';
            }
            // Pin IP — custom lookup biar TLS connect ke IP yg udah divalidasi, bukan
            // re-resolve dari DNS (DNS rebinding mitigation). servername tetep dari
            // hostname asli buat SNI/cert verification.
            const pinnedAgent = new _https.Agent({
                // Node 20+ nyalain autoSelectFamily default → connect manggil lookup
                // dengan { all: true } dan NGAREP balikan array. Kalau cuma balikin
                // (ip, family) gaya lama → ERR_INVALID_IP_ADDRESS (web_fetch mati total).
                // Handle dua-duanya; tetep pin ke 1 IP tervalidasi (anti DNS-rebinding).
                lookup: (_host, opts, cb) => (opts && opts.all)
                    ? cb(null, [{ address: safe.ip, family: safe.family }])
                    : cb(null, safe.ip, safe.family),
                keepAlive: false
            });
            res = await axios.get(currentUrl, {
                headers: { 'User-Agent': UA },
                timeout: 20000,
                maxContentLength: MAX_FETCH_BYTES,
                maxRedirects: 0,           // manual hop loop di atas, bukan axios
                responseType: 'text',
                transformResponse: (x) => x,
                validateStatus: () => true,
                httpsAgent: pinnedAgent
            });
            // 3xx? validasi target redirect ulang sebelum hop.
            if (res.status >= 300 && res.status < 400 && res.headers.location) {
                if (hop === MAX_REDIRECT_HOPS) {
                    return 'web_fetch: kebanyakan redirect (max 3).';
                }
                try {
                    currentUrl = new URL(res.headers.location, currentUrl).toString();
                } catch {
                    return 'web_fetch: redirect target invalid.';
                }
                continue;
            }
            break;
        }
        const status = res.status;
        const ct = (res.headers['content-type'] || '').toLowerCase();
        let text = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
        if (ct.includes('html') || /^\s*</.test(text)) text = htmlToText(text);
        text = text.replace(/\n{3,}/g, '\n\n').trim();
        const MAX = 7000;
        if (text.length > MAX) text = text.slice(0, MAX) + '\n...[dipotong, terlalu panjang]';
        if (status >= 400) {
            const viaFirecrawl = await tryFirecrawlFetch(currentUrl);
            if (viaFirecrawl) return viaFirecrawl;
            return `[HTTP ${status}] ${currentUrl}\nPindah sumber lain, JANGAN retry URL ini.\n\n${text.slice(0, 600) || '(body kosong)'}`;
        }
        if (!text) {
            const viaFirecrawl = await tryFirecrawlFetch(currentUrl);
            if (viaFirecrawl) return viaFirecrawl;
        }
        return text || '(halaman kosong)';
    } catch (e) {
        // JANGAN echo e.message — bisa leak IP:port/host (SSRF probe confirmation).
        recordError('web_fetch', e);
        console.error('webFetch error:', e.code || e.message);
        const viaFirecrawl = await tryFirecrawlFetch(url);
        if (viaFirecrawl) return viaFirecrawl;
        return 'web_fetch gagal: gagal ambil URL (timeout/network/dns).';
    } finally {
        releaseGenericSlot('fetch');
    }
}

// ============================ dep injection =================================
// Dipanggil SEKALI dari bot.js saat boot, sebelum request masuk. Nyuntik fungsi
// + config yang tetap tinggal di bot.js (SCRAPLING_FETCH_URL dipakai juga di
// health-check bot.js, dsb). undefined-guard biar ga nimpa default jadi undefined.
function init(deps) {
    deps = deps || {};
    if (deps.acquireGenericSlot) acquireGenericSlot = deps.acquireGenericSlot;
    if (deps.releaseGenericSlot) releaseGenericSlot = deps.releaseGenericSlot;
    if (deps.recordError) recordError = deps.recordError;
    if (deps.SCRAPLING_FETCH_URL !== undefined) SCRAPLING_FETCH_URL = deps.SCRAPLING_FETCH_URL;
    if (deps.SCRAPLING_TIMEOUT_MS !== undefined) SCRAPLING_TIMEOUT_MS = deps.SCRAPLING_TIMEOUT_MS;
    if (deps.FIRECRAWL_API_KEY !== undefined) FIRECRAWL_API_KEY = deps.FIRECRAWL_API_KEY;
    if (deps.FIRECRAWL_API_URL !== undefined) FIRECRAWL_API_URL = deps.FIRECRAWL_API_URL;
    if (deps.FIRECRAWL_TIMEOUT_MS !== undefined) FIRECRAWL_TIMEOUT_MS = deps.FIRECRAWL_TIMEOUT_MS;
    if (deps.FIRECRAWL_MAX_AGE_MS !== undefined) FIRECRAWL_MAX_AGE_MS = deps.FIRECRAWL_MAX_AGE_MS;
    if (deps.MAX_FETCH_BYTES !== undefined) MAX_FETCH_BYTES = deps.MAX_FETCH_BYTES;
}

module.exports = {
    init,
    webSearch,
    webFetch,
    // SSRF guard di-export buat caller eksternal (_isAllowedVideoUrl di bot.js)
    // + smoke-test. Logika identik sama versi in-line lama.
    _resolveSafeUrl,
    _isBlockedAddr,
    htmlToText,
};
