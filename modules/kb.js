// =============================================================================
//  modules/kb.js — KB retrieval subsystem (di-extract dari bot.js, refactor monolith)
//  Substring lookup (kbLookup) + semantic (kbSemanticSearch) + RAG bridge
//  (kbRagSearch/ensureKbRagIndex/reindexKbNow). Fungsi di-copy VERBATIM.
//  State KB_CACHE/KB_RAG_INDEX PINDAH ke sini (dulu di bot.js).
//  ⚠️ Path (KB_DIR, KB_RAG_INDEX_FILE) di-INJECT resolved dari bot.js via init() —
//     JANGAN recompute pakai __dirname (di modul __dirname=modules/, path bakal salah).
//     KB_DIR tetap didefinisi di bot.js juga (dipakai ADDFIX/community.md).
// =============================================================================

const fs = require('fs');
const path = require('path');
const kbRag = require('./kb-rag');

// --- injected via init() dari bot.js (dipanggil sekali saat boot) ---
let KB_DIR = null;              // resolved abs path (path.join(DATA_DIR,'kb'))
let KB_RAG_INDEX_FILE = null;   // resolved abs path
let recordError = () => {};

// --- state (pindah dari bot.js; KB-only) ---
let KB_CACHE = null;            // [{ file, sections: [{ header, body }] }]
let KB_RAG_INDEX = null;

// ===================== VERBATIM chunk1 (bot.js 1082-1147) ====================
function loadKB() {
    try {
        if (!fs.existsSync(KB_DIR)) { KB_CACHE = []; return; }
        const files = fs.readdirSync(KB_DIR).filter((f) => f.endsWith('.md')).sort();
        const out = [];
        for (const f of files) {
            const raw = fs.readFileSync(path.join(KB_DIR, f), 'utf8');
            // Split by ## header. Section "" = preamble sebelum header pertama.
            const parts = raw.split(/^## /m);
            const sections = [];
            // parts[0] = preamble (sebelum ## pertama)
            if (parts[0] && parts[0].trim()) {
                sections.push({ header: '(intro)', body: parts[0].trim() });
            }
            for (let i = 1; i < parts.length; i++) {
                const seg = parts[i];
                const nl = seg.indexOf('\n');
                const header = nl < 0 ? seg.trim() : seg.slice(0, nl).trim();
                const body = nl < 0 ? '' : seg.slice(nl + 1).trim();
                sections.push({ header, body });
            }
            out.push({ file: f, sections });
        }
        KB_CACHE = out;
    } catch (e) {
        console.error('KB load error:', e.message);
        KB_CACHE = [];
    }
}

function ensureKbRagIndex({ force = false } = {}) {
    const res = kbRag.ensureIndex(KB_DIR, KB_RAG_INDEX_FILE, { force });
    KB_RAG_INDEX = res.index;
    return res;
}

function loadKbRagIndex() {
    if (!KB_RAG_INDEX) {
        KB_RAG_INDEX = kbRag.loadIndex(KB_RAG_INDEX_FILE);
    }
    return KB_RAG_INDEX;
}

function kbRagStatusLine() {
    const index = loadKbRagIndex();
    return kbRag.statusLine(index);
}

function reindexKbNow() {
    const t0 = Date.now();
    KB_CACHE = null;
    loadKB();
    const { index, rebuilt } = ensureKbRagIndex({ force: true });
    const fileCount = Array.isArray(KB_CACHE) ? KB_CACHE.length : 0;
    const sectionCount = Array.isArray(KB_CACHE) ? KB_CACHE.reduce((s, f) => s + (f.sections?.length || 0), 0) : 0;
    return {
        ok: true,
        rebuilt,
        ms: Date.now() - t0,
        fileCount,
        sectionCount,
        chunkCount: index.chunkCount,
        builtAt: index.builtAt,
        indexFile: KB_RAG_INDEX_FILE
    };
}

// ===================== VERBATIM chunk2 (bot.js 1226-1347) ====================
// Confidence tag priority — lower number = higher priority = surfaced FIRST.
// VERIFIED (community-tested) menang dari REVEALED PREFERENCE (community signal)
// yang menang dari THEORETICAL (interpolasi spec, belum ke-bench).
// Section tanpa tag = netral (priority tengah, biar ga tenggelam tapi ga ngalahin VERIFIED).
function _confidencePriority(text) {
    const t = (text || '').toUpperCase();
    if (t.includes('[VERIFIED')) return 0;
    if (t.includes('[REVEALED PREFERENCE') || t.includes('[REVEALED PREF')) return 1;
    if (t.includes('[THEORETICAL')) return 3;
    return 2; // untagged netral
}

function kbLookup(topic) {
    if (KB_CACHE == null) loadKB();
    const q = String(topic || '').toLowerCase().trim();
    if (!q) return 'kb_lookup: topic kosong. Kasih kata kunci spesifik.';

    const hits = [];
    for (const file of KB_CACHE) {
        for (const sec of file.sections) {
            // Include filename in haystack — bikin topic kayak "box64-fex-presets"
            // match file box64-fex-presets-ground-truth.md tanpa kudu tambahin
            // keyword anchor di body file.
            const hay = (file.file + '\n' + sec.header + '\n' + sec.body).toLowerCase();
            // Match kalau semua kata di topic ada di section (AND search).
            const words = q.split(/\s+/).filter(Boolean);
            const allMatch = words.every((w) => hay.includes(w));
            if (allMatch) {
                hits.push({ file: file.file, header: sec.header, body: sec.body });
            }
        }
    }
    if (!hits.length) {
        return `kb_lookup: ga ada entry cocok buat "${topic}". Fallback ke web_search.`;
    }
    // SORT by confidence tag BEFORE truncation — jangan ngandelin urutan
    // alfabetis file (evolution-2026.md duluan dari per-game.md = THEORETICAL
    // bisa hog budget sebelum [VERIFIED] surface). Stable sort: tie-break tetep
    // urutan asli (alfabetis file → urutan section di file itu).
    hits.sort((a, b) => {
        const pa = _confidencePriority(a.header + '\n' + a.body);
        const pb = _confidencePriority(b.header + '\n' + b.body);
        return pa - pb;
    });

    // Limit total ~3KB biar context ga overflow. Hits udah ke-prioritize di atas,
    // jadi yang ke-potong = THEORETICAL/netral terakhir, bukan [VERIFIED].
    const MAX = 3200;
    let out = `# KB hits buat "${topic}" (${hits.length} entry, di-sort by confidence: VERIFIED → REVEALED PREF → netral → THEORETICAL)\n`;
    for (const h of hits) {
        const block = `\n## ${h.header}  \n_(file: ${h.file})_\n${h.body}\n`;
        if (out.length + block.length > MAX) {
            out += `\n_…dipotong (${hits.length - hits.indexOf(h)} entry lagi, prioritas lebih rendah). Persempit topic biar dapet detail.`;
            break;
        }
        out += block;
    }
    return out;
}

function _kbTokens(s) {
    const stop = new Set(['yang', 'dan', 'atau', 'buat', 'untuk', 'dengan', 'kalau', 'pake', 'pakai', 'bisa', 'apa', 'gimana', 'kenapa', 'driver', 'versi']);
    return String(s || '').toLowerCase()
        .replace(/[^a-z0-9.+_-]+/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 2 && !stop.has(w));
}

function kbSemanticSearch(query) {
    if (KB_CACHE == null) loadKB();
    const qTokens = _kbTokens(query);
    if (!qTokens.length) return 'kb_search: query kosong.';
    const qSet = new Set(qTokens);
    const scores = [];
    for (const file of KB_CACHE || []) {
        for (const sec of file.sections) {
            const text = `${file.file}\n${sec.header}\n${sec.body}`;
            const tokens = _kbTokens(text);
            if (!tokens.length) continue;
            const freq = new Map();
            for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1);
            let score = 0;
            for (const qt of qSet) {
                if (freq.has(qt)) score += 2 + Math.min(3, freq.get(qt));
                // fuzzy prefix kecil buat "mediatek"/"mtk", "vkd3d"/"dx12" tetap butuh exact di KB
                for (const tk of freq.keys()) {
                    if (tk !== qt && (tk.startsWith(qt) || qt.startsWith(tk)) && Math.min(tk.length, qt.length) >= 4) {
                        score += 0.5;
                    }
                }
            }
            if (/mali|mtk|mediatek|driver|dx12|vkd3d|dxvk/.test(String(query).toLowerCase())
                && /mtk-mali-modern|gpu-rules|vkd3d|evolution/.test(file.file)) score += 2;
            if (score > 0) scores.push({ score, file: file.file, header: sec.header, body: sec.body });
        }
    }
    scores.sort((a, b) => b.score - a.score || _confidencePriority(a.header + a.body) - _confidencePriority(b.header + b.body));
    const top = scores.slice(0, 6);
    if (!top.length) return `kb_search: ga ada section relevan buat "${query}".`;
    let out = `# KB semantic hits buat "${query}"\n`;
    for (const h of top) {
        let body = h.body.replace(/\s+/g, ' ').trim();
        if (body.length > 650) body = body.slice(0, 650) + ' ...';
        out += `\n## ${h.header}\n_(file: ${h.file}, score: ${h.score.toFixed(1)})_\n${body}\n`;
    }
    return out;
}

function kbRagSearch(query, topK = 8) {
    const q = String(query || '').trim();
    if (!q) return 'kb_rag_search: query kosong.';
    let res;
    try {
        res = ensureKbRagIndex({ force: false });
    } catch (e) {
        recordError('kb-rag-index', e);
        return `kb_rag_search gagal build/load index: ${String(e.message || e).slice(0, 160)}`;
    }
    const limit = Math.min(12, Math.max(1, parseInt(topK || '8', 10)));
    const hits = kbRag.searchIndex(res.index, q, { topK: limit });
    return kbRag.formatResults(q, hits, res.index);
}

// ============================ dep injection =================================
// Dipanggil SEKALI dari bot.js saat boot. KB_DIR & KB_RAG_INDEX_FILE = path
// resolved (bot.js pakai __dirname); JANGAN dihitung ulang di modul.
function init(deps) {
    deps = deps || {};
    if (deps.KB_DIR !== undefined) KB_DIR = deps.KB_DIR;
    if (deps.KB_RAG_INDEX_FILE !== undefined) KB_RAG_INDEX_FILE = deps.KB_RAG_INDEX_FILE;
    if (deps.recordError) recordError = deps.recordError;
}

module.exports = {
    init,
    loadKB,
    kbLookup,
    kbSemanticSearch,
    kbRagSearch,
    ensureKbRagIndex,
    loadKbRagIndex,
    kbRagStatusLine,
    reindexKbNow,
};
