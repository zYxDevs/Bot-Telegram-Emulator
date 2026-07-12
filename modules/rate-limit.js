// =============================================================================
//  modules/rate-limit.js — rate limiter per-user (cooldown antar-pesan + window
//  cap) + prune idle. Di-extract dari bot.js (refactor). State (3 Map) + konstanta
//  PINDAH ke sini (category C stateful self-contained).
//  ⚠️ checkRate di-copy VERBATIM KECUALI 1 baris di-wire:
//     ADMIN_IDS.has(String(userId)) -> isAdmin(userId)
//  karena ADMIN_IDS di-REASSIGN saat /reloadenv (inject Set by-ref bakal stale),
//  jadi inject isAdmin callback. Behavior identik (userId udah dicek non-null di atas).
//  pruneIdle di-pindah dari GC (verbatim) krn nyentuh state rate ini — GC manggil.
// =============================================================================

let isAdmin = () => false;   // injected via init() dari bot.js (baca ADMIN_IDS terkini)

const RATE_COOLDOWN_MS = 5 * 1000;          // minimal 5s antar pesan
const RATE_MAX = 20;                        // dan/atau maks 20 pesan
const RATE_WINDOW_MS = 60 * 1000;           // per 60s
const RATE_WARN_COOLDOWN_MS = 5 * 60 * 1000;

const rateLog = new Map();
const rateLastAt = new Map();
const rateWarnedAt = new Map();

function checkRate(userId) {
    if (userId == null) return { ok: true };
    if (isAdmin(userId)) return { ok: true };
    const now = Date.now();

    // (1) Cooldown antar pesan — minimal 5 detik
    const last = rateLastAt.get(userId) || 0;
    const sinceLast = now - last;
    if (sinceLast < RATE_COOLDOWN_MS) {
        const lastWarn = rateWarnedAt.get(userId) || 0;
        const warn = now - lastWarn > RATE_WARN_COOLDOWN_MS;
        if (warn) rateWarnedAt.set(userId, now);
        return { ok: false, reason: 'cooldown', waitSec: Math.ceil((RATE_COOLDOWN_MS - sinceLast) / 1000), warn };
    }

    // (2) Window cap — maks 20 pesan / 60s
    const arr = (rateLog.get(userId) || []).filter((t) => now - t < RATE_WINDOW_MS);
    if (arr.length >= RATE_MAX) {
        rateLog.set(userId, arr);
        const lastWarn = rateWarnedAt.get(userId) || 0;
        const warn = now - lastWarn > RATE_WARN_COOLDOWN_MS;
        if (warn) rateWarnedAt.set(userId, now);
        return { ok: false, reason: 'window', warn };
    }

    arr.push(now);
    rateLog.set(userId, arr);
    rateLastAt.set(userId, now);
    return { ok: true };
}


// Prune entry rate user idle > idleMs. Dipindah dari GC (verbatim) krn nyentuh
// state rate di modul ini. GC manggil rateLimit.pruneIdle(now). Return jumlah di-prune.
function pruneIdle(now, idleMs = 10 * 60 * 1000) {
    let n = 0;
    for (const [uid, t] of rateLastAt) {
        if (now - t > idleMs) {
            rateLastAt.delete(uid);
            rateLog.delete(uid);
            rateWarnedAt.delete(uid);
            n++;
        }
    }
    return n;
}

function init(deps) {
    if (deps && deps.isAdmin) isAdmin = deps.isAdmin;
}

module.exports = { init, checkRate, pruneIdle, RATE_COOLDOWN_MS, RATE_MAX, RATE_WINDOW_MS };
