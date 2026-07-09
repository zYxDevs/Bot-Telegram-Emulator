// =============================================================================
//  COPUX-FourFect Bot — Telegram (Node.js)
//  Versi gabungan: agentic loop (V1) + persistent history & rate limit (V2)
//
//  Sumber acuan:
//    - /root/memori claude/bot copux.txt   (V1, 16 poin lengkap)
//    - /root/memori claude/text.txt        (V2, persistent + rate + /addfix)
// =============================================================================

const dotenv = require('dotenv');
dotenv.config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const http = require('http');
const os = require('os');
const crypto = require('crypto');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const FREEMODEL_KEY = process.env.FREEMODEL_KEY;
const TOKENROUTER_KEY = process.env.TOKENROUTER_KEY;
const COPUX_API_URL = process.env.COPUX_API_URL || 'https://api.freemodel.dev/v1/chat/completions';
const COPUX_API_KEY = process.env.COPUX_API_KEY || FREEMODEL_KEY;
if (!TELEGRAM_TOKEN || !FREEMODEL_KEY || !TOKENROUTER_KEY) {
    console.error('❌  TELEGRAM_TOKEN / FREEMODEL_KEY / TOKENROUTER_KEY belum di-set. Isi dulu file .env!');
    process.exit(1);
}

const TELEGRAM_MODE = (process.env.TELEGRAM_MODE || (process.env.TELEGRAM_WEBHOOK_URL ? 'webhook' : 'polling')).toLowerCase();
const TELEGRAM_WEBHOOK_URL = process.env.TELEGRAM_WEBHOOK_URL || '';
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || crypto.randomBytes(12).toString('hex');
const WEBHOOK_PATH = process.env.TELEGRAM_WEBHOOK_PATH || `/telegram-webhook/${WEBHOOK_SECRET}`;
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: TELEGRAM_MODE !== 'webhook' });
const { setBotInstance, splitMessage, sendSafe, withTyping, escapeSafeMd } = require("./modules/telegram-utils");
setBotInstance(bot);
if (TELEGRAM_MODE !== 'webhook') {
    bot.deleteWebHook({ drop_pending_updates: false }).catch((e) => {
        console.error('Gagal delete webhook lama:', e.message);
    });
}

// Identitas bot — buat deteksi mention & reply di grup.
let BOT_USERNAME = '';
let BOT_ID = null;
bot.getMe().then((me) => {
    BOT_USERNAME = me.username;
    BOT_ID = me.id;
    console.log(`✅  Bot @${me.username} (id ${me.id}) siap.`);
    
    // Konfigurasi otomatis menu komando Telegram
    const publicCommands = [
        { command: 'start', description: 'Memulai sesi bot' },
        { command: 'hunting', description: 'Pencarian Repack/Portable game index' },
        { command: 'cari', description: 'Web-dorking pencarian mendalam' },
        { command: 'dlc', description: 'Generate Steam DLC mapping overrides' },
        { command: 'addfix', description: 'Ajukan saran update Knowledge Base' },
        { command: 'reset', description: 'Hapus konteks ingatan percakapan' }
    ];
    const adminCommands = [
        ...publicCommands,
        { command: 'status', description: 'Status VPS, PM2, disk, LLM, queue' },
        { command: 'stats', description: 'Tampilkan metrik sistem internal' },
        { command: 'llmstatus', description: 'Status routing LLM aktif' },
        { command: 'llmroute', description: 'Ganti model/route LLM runtime' },
        { command: 'llmtest', description: 'Tes latency semua provider LLM' },
        { command: 'reloadenv', description: 'Reload .env tanpa SSH' },
        { command: 'backup', description: 'Jalankan backup COPUX sekarang' },
        { command: 'reloadkb', description: 'Muat ulang data Knowledge Base' },
        { command: 'promotefix', description: 'Review dan push antrean addfix' },
        { command: 'profile', description: 'Lihat/set profil user' }
    ];

    bot.setMyCommands(publicCommands, { scope: { type: 'default' } })
        .then(() => console.log('✅ Menu komando publik terdaftar.'))
        .catch(e => console.error('Gagal set komando publik:', e.message));

    ADMIN_IDS.forEach(adminId => {
        if (adminId) {
            bot.setMyCommands(adminCommands, { scope: { type: 'chat', chat_id: adminId } })
                .catch(e => console.error(`Gagal set komando admin (${adminId}):`, e.message));
        }
    });
}).catch((e) => console.error('Gagal getMe:', e.message));

bot.on('polling_error', (e) => {
    const msg = String((e && e.message) || e || '')
        .replace(/bot\d+:[A-Za-z0-9_-]+/g, 'bot[REDACTED]')
        .replace(/\s+/g, ' ')
        .slice(0, 180);
    recordError('polling', msg);
    console.error(`polling_error: ${e && e.code ? e.code : 'ERR'} ${msg}`);
});

// Provider routing: runtime-mutable supaya admin bisa /llmroute dan /reloadenv tanpa SSH.
const DIRECT_FREEMODEL_URL = 'https://api.freemodel.dev/v1/chat/completions';
const RUNTIME_STATE_FILE = path.join(__dirname, 'data', 'runtime-state.json');
let runtimeState = {};
let VISION_MODEL = 'gpt-5.5';
let TEXT_MODEL = 'gpt-5.5';
let ACTIVE_LLM_ROUTE = '';
let ACTIVE_COPUX_API_URL = COPUX_API_URL;
let ACTIVE_COPUX_API_KEY = COPUX_API_KEY;
let LLM_FALLBACK_URLS = [];
let LLM_FALLBACK_MODELS = [];
let LLM_FALLBACK_KEYS = [];

function parseCsvEnv(v) {
    return String(v || '').split(',').map((s) => s.trim()).filter(Boolean);
}
function loadRuntimeState() {
    try {
        if (fs.existsSync(RUNTIME_STATE_FILE)) runtimeState = JSON.parse(fs.readFileSync(RUNTIME_STATE_FILE, 'utf8'));
    } catch (e) {
        runtimeState = {};
    }
}
function saveRuntimeState() {
    try {
        fs.mkdirSync(path.dirname(RUNTIME_STATE_FILE), { recursive: true });
        const tmp = RUNTIME_STATE_FILE + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(runtimeState, null, 2));
        fs.renameSync(tmp, RUNTIME_STATE_FILE);
    } catch (e) {
        console.error('Gagal simpan runtime-state:', e.message);
    }
}
function reloadRuntimeEnv() {
    dotenv.config({ override: true });
    ACTIVE_COPUX_API_URL = process.env.COPUX_API_URL || COPUX_API_URL || DIRECT_FREEMODEL_URL;
    ACTIVE_COPUX_API_KEY = process.env.COPUX_API_KEY || COPUX_API_KEY || FREEMODEL_KEY;
    const routeOverride = runtimeState.llmRoute || process.env.LLM_ROUTE || '';
    ACTIVE_LLM_ROUTE = routeOverride;
    TEXT_MODEL = routeOverride || process.env.TEXT_MODEL || 'gpt-5.5';
    VISION_MODEL = routeOverride || process.env.VISION_MODEL || TEXT_MODEL || 'gpt-5.5';
    LLM_FALLBACK_URLS = parseCsvEnv(process.env.LLM_FALLBACK_URLS);
    LLM_FALLBACK_MODELS = parseCsvEnv(process.env.LLM_FALLBACK_MODELS);
    LLM_FALLBACK_KEYS = parseCsvEnv(process.env.LLM_FALLBACK_KEYS);
}
loadRuntimeState();
reloadRuntimeEnv();

// Tunable lewat env biar adaptif: HP low-end Termux turunin, server lega naikin.
const MAX_HISTORY = parseInt(process.env.MAX_HISTORY || '10', 10);
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_BYTES || String(1024 * 1024), 10);   // default 1 MB
const SESSION_TTL = parseInt(process.env.SESSION_TTL_MS || String(1000 * 60 * 60 * 6), 10);   // default 6 jam
const SAVE_DEBOUNCE_MS = parseInt(process.env.SAVE_DEBOUNCE_MS || '5000', 10);
const MAX_CONCURRENT_LLM = Math.max(1, parseInt(process.env.MAX_CONCURRENT_LLM || '3', 10));   // global concurrency cap
const MAX_PHOTO_BYTES = parseInt(process.env.MAX_PHOTO_BYTES || String(2 * 1024 * 1024), 10);   // 2 MB (3 concurrent × base64 = ~8 MB; jangan OOM Termux)
const MAX_FETCH_BYTES = parseInt(process.env.MAX_FETCH_BYTES || String(4 * 1024 * 1024), 10);

// === VIDEO "nonton" (frame + transcript audio) ===
// Telegram Bot API getFile cap ~20MB, jadi MAX_VIDEO_BYTES jangan di atas itu.
const MAX_VIDEO_BYTES = parseInt(process.env.MAX_VIDEO_BYTES || String(20 * 1024 * 1024), 10);
const MAX_AUDIO_SEC = parseInt(process.env.MAX_AUDIO_SEC || '180', 10);            // cap durasi transcribe = bound OOM/runtime
const YTDLP_TIMEOUT_MS = parseInt(process.env.YTDLP_TIMEOUT_MS || '120000', 10);
const WHISPER_TIMEOUT_MS = parseInt(process.env.WHISPER_TIMEOUT_MS || '180000', 10);
const WHISPER_BIN = process.env.WHISPER_BIN || '/root/whisper.cpp/build/bin/whisper-cli';
const WHISPER_MODEL = process.env.WHISPER_MODEL || '/root/whisper.cpp/models/ggml-base.bin';
const MAX_TRANSCRIPT_CHARS = parseInt(process.env.MAX_TRANSCRIPT_CHARS || '4000', 10);
// Semaphore kecil: cap kerja ffmpeg/whisper paralel biar 3 video bareng ga peg CPU Termux.
const MAX_CONCURRENT_VIDEO = Math.max(1, parseInt(process.env.MAX_CONCURRENT_VIDEO || '1', 10));
// Scrapling microservice (anti-bot web_fetch). Kosongin SCRAPLING_FETCH_URL buat disable.
const SCRAPLING_FETCH_URL = process.env.SCRAPLING_FETCH_URL || 'http://127.0.0.1:8765/fetch';
const SCRAPLING_TIMEOUT_MS = parseInt(process.env.SCRAPLING_TIMEOUT_MS || '28000', 10);
// Firecrawl fallback buat web_fetch saat direct fetch kena anti-bot/JS-heavy page.
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY || '';
const FIRECRAWL_API_URL = process.env.FIRECRAWL_API_URL || 'https://api.firecrawl.dev/v2/scrape';
const FIRECRAWL_TIMEOUT_MS = parseInt(process.env.FIRECRAWL_TIMEOUT_MS || '45000', 10);
const FIRECRAWL_MAX_AGE_MS = parseInt(process.env.FIRECRAWL_MAX_AGE_MS || String(60 * 60 * 1000), 10);
// Allowlist host video non-YT (selain ekstensi langsung). Konservatif — bukan "any URL".
const VIDEO_HOST_ALLOWLIST = (process.env.VIDEO_HOST_ALLOWLIST ||
    'tiktok.com,vt.tiktok.com,vm.tiktok.com,vimeo.com,streamable.com,twitter.com,x.com,instagram.com,reddit.com,v.redd.it')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

const DATA_DIR = path.join(__dirname, 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const ADDFIX_FILE = path.join(DATA_DIR, 'addfix.jsonl');

let ADMIN_IDS = new Set();
function reloadAdminIds() {
    ADMIN_IDS = new Set(parseCsvEnv(process.env.ADMIN_IDS));
}
reloadAdminIds();

// Rate limit per-user: cooldown antar pesan + cap window
const RATE_COOLDOWN_MS = 5 * 1000;          // minimal 5s antar pesan
const RATE_MAX = 20;                        // dan/atau maks 20 pesan
const RATE_WINDOW_MS = 60 * 1000;           // per 60s
const RATE_WARN_COOLDOWN_MS = 5 * 60 * 1000;
const rateLog = new Map();
const rateLastAt = new Map();
const rateWarnedAt = new Map();

const chatHistory = {};
const lastActive = {};

// Per-session in-flight lock — cegah 2 handler async push ke chatHistory[key] bareng
// (user kirim pesan beruntun saat LLM masih ngolah → race condition + double-cost).
const inFlight = new Set();

// Global LLM concurrency semaphore — adaptive: env MAX_CONCURRENT_LLM (default 3).
// Penting di Termux/ARM low-end: cegah 20 user bareng = 20 axios call → OOM.
let llmInFlight = 0;
const llmWaiters = [];
function acquireLLMSlot() {
    if (llmInFlight < MAX_CONCURRENT_LLM) {
        llmInFlight++;
        return Promise.resolve();
    }
    return new Promise((resolve) => llmWaiters.push(resolve));
}
function releaseLLMSlot() {
    if (llmWaiters.length) {
        const next = llmWaiters.shift();
        next();   // tetep counted, transfer slot
    } else {
        llmInFlight = Math.max(0, llmInFlight - 1);
    }
}

// Stats in-memory (reset tiap restart). Kunci pake userId krn lebih stabil dari chatId.
// Buffer 7d, otomatis di-prune di /stats.
const STATS_TTL = 7 * 24 * 60 * 60 * 1000;
const userStats = new Map(); // userId -> { name, firstSeen, lastSeen, count, lastChatType, lastChatId }
const msgLog = []; // [{ ts, userId }] — buat hitung unique per window
const BOT_START_TS = Date.now();

const LAST_ERRORS = [];
const LLM_EVENTS = [];
const PROFILE_FILE = path.join(DATA_DIR, 'user-profiles.json');
const BACKUP_SCRIPT = path.join(__dirname, 'scripts', 'backup.js');
const AUTO_BACKUP_ENABLED = String(process.env.AUTO_BACKUP_ENABLED || '1') !== '0';
const BACKUP_INTERVAL_MS = parseInt(process.env.BACKUP_INTERVAL_MS || String(24 * 60 * 60 * 1000), 10);
const SELF_HEAL_ENABLED = String(process.env.SELF_HEAL_ENABLED || '1') !== '0';
const SELF_HEAL_INTERVAL_MS = parseInt(process.env.SELF_HEAL_INTERVAL_MS || '60000', 10);
const SELF_HEAL_FAIL_THRESHOLD = Math.max(1, parseInt(process.env.SELF_HEAL_FAIL_THRESHOLD || '3', 10));
const ADMIN_WEB_HOST = process.env.ADMIN_WEB_HOST || '127.0.0.1';
const ADMIN_WEB_PORT = parseInt(process.env.ADMIN_WEB_PORT || '8787', 10);
const ADMIN_WEB_TOKEN = process.env.ADMIN_WEB_TOKEN || '';
const MAX_CONCURRENT_WEB_FETCH = Math.max(1, parseInt(process.env.MAX_CONCURRENT_WEB_FETCH || '2', 10));
const MAX_CONCURRENT_SEARCH = Math.max(1, parseInt(process.env.MAX_CONCURRENT_SEARCH || '2', 10));
let webFetchInFlight = 0;
let webSearchInFlight = 0;
const webFetchWaiters = [];
const webSearchWaiters = [];
let lastBackupResult = null;
let selfHealState = { primaryFails: 0, scraplingFails: 0, lastAction: '' };
let userProfiles = {};

function execFileAsync(file, args, opts = {}) {
    return new Promise((resolve, reject) => {
        execFile(file, args, { timeout: 30000, maxBuffer: 4 * 1024 * 1024, ...opts }, (err, stdout, stderr) => {
            if (err) {
                err.stdout = stdout;
                err.stderr = stderr;
                reject(err);
            } else {
                resolve({ stdout: String(stdout || ''), stderr: String(stderr || '') });
            }
        });
    });
}

function redactSecret(s) {
    return String(s || '')
        .replace(/bot\d+:[A-Za-z0-9_-]+/g, 'bot[REDACTED]')
        .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
        .replace(/(token|key|secret|password)["'=:\s]+[A-Za-z0-9._:/+-]+/gi, '$1=[REDACTED]');
}

function recordError(source, err) {
    const msg = redactSecret(err && err.stack ? err.stack : (err && err.message ? err.message : err));
    LAST_ERRORS.push({ ts: Date.now(), source, msg: msg.slice(0, 500) });
    while (LAST_ERRORS.length > 25) LAST_ERRORS.shift();
}

function isRecoverableTelegramRejection(err) {
    const code = err && err.code ? String(err.code) : '';
    const body = err && err.response && err.response.body ? err.response.body : {};
    const description = String(body.description || (err && err.message) || '');
    return code === 'ETELEGRAM'
        && Number(body.error_code || 0) === 400
        && /can't parse entities|message is not modified/i.test(description);
}

function recordLlmEvent(event) {
    LLM_EVENTS.push({ ts: Date.now(), ...event });
    while (LLM_EVENTS.length > 30) LLM_EVENTS.shift();
}

const alertCooldown = new Map();
function notifyAdmins(text, key = 'generic', cooldownMs = 60000) {
    const now = Date.now();
    const prev = alertCooldown.get(key) || 0;
    if (now - prev < cooldownMs) return;
    alertCooldown.set(key, now);
    for (const adminId of ADMIN_IDS) {
        bot.sendMessage(adminId, text, { disable_web_page_preview: true }).catch((e) => {
            console.error('Gagal kirim admin alert:', e.message);
        });
    }
}

function acquireGenericSlot(kind) {
    const max = kind === 'search' ? MAX_CONCURRENT_SEARCH : MAX_CONCURRENT_WEB_FETCH;
    const waiters = kind === 'search' ? webSearchWaiters : webFetchWaiters;
    if (kind === 'search') {
        if (webSearchInFlight < max) { webSearchInFlight++; return Promise.resolve(); }
    } else if (webFetchInFlight < max) {
        webFetchInFlight++;
        return Promise.resolve();
    }
    return new Promise((resolve) => waiters.push(resolve));
}
function releaseGenericSlot(kind) {
    const waiters = kind === 'search' ? webSearchWaiters : webFetchWaiters;
    if (waiters.length) {
        waiters.shift()();
        return;
    }
    if (kind === 'search') webSearchInFlight = Math.max(0, webSearchInFlight - 1);
    else webFetchInFlight = Math.max(0, webFetchInFlight - 1);
}

function loadProfiles() {
    try {
        if (fs.existsSync(PROFILE_FILE)) userProfiles = JSON.parse(fs.readFileSync(PROFILE_FILE, 'utf8'));
    } catch (e) {
        userProfiles = {};
    }
}
function saveProfiles() {
    try {
        const tmp = PROFILE_FILE + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(userProfiles, null, 2));
        fs.renameSync(tmp, PROFILE_FILE);
    } catch (e) {
        console.error('Gagal simpan profile:', e.message);
    }
}
function updateUserProfile(userId, fields) {
    if (!userId) return;
    const id = String(userId);
    const rec = userProfiles[id] || { createdAt: Date.now(), updatedAt: Date.now() };
    Object.assign(rec, fields, { updatedAt: Date.now() });
    userProfiles[id] = rec;
    saveProfiles();
}
function observeProfileFromText(userId, text) {
    if (!userId || !text) return;
    const rec = {};
    const chip = String(text).match(/\b(Snapdragon\s+[0-9A-Za-z+ ]+|SD\s*[0-9][0-9A-Za-z+ ]+|Dimensity\s+[0-9A-Za-z+ ]+|Helio\s+G?\d+[A-Za-z ]*)\b/i);
    const gpu = String(text).match(/\b(Adreno\s+\d+|Mali-[A-Z]\d+\s*MC\d+|Mali-[A-Z]\d+|Immortalis-[A-Z]\d+|PowerVR\s+\S+|IMG\s+\S+)\b/i);
    const emu = String(text).match(/\b(GameHub(?: Lite)?|GameNative|WinNative|Winlator(?:\s+(?:Ludashi|Frost|CMOD|Cmod|Bionic|REF4IK))?|BannerHub|Bannerlator)\b/i);
    if (chip) rec.chipset = chip[1].replace(/\s+/g, ' ').trim();
    if (gpu) rec.gpu = gpu[1].replace(/\s+/g, ' ').trim();
    if (emu) rec.emulator = emu[1].replace(/\s+/g, ' ').trim();
    if (Object.keys(rec).length) updateUserProfile(userId, rec);
}
function profileContext(userId) {
    const p = userProfiles[String(userId || '')];
    if (!p) return '';
    const bits = [];
    if (p.device) bits.push(`device=${p.device}`);
    if (p.chipset) bits.push(`chipset=${p.chipset}`);
    if (p.gpu) bits.push(`gpu=${p.gpu}`);
    if (p.emulator) bits.push(`emulator=${p.emulator}`);
    if (p.style) bits.push(`style=${p.style}`);
    return bits.length ? `[USER_PROFILE ${bits.join(' ')}]\n` : '';
}

function currentProviders(hasImage = false) {
    const defaultModel = hasImage ? VISION_MODEL : TEXT_MODEL;
    const providers = [
        { name: 'primary', url: ACTIVE_COPUX_API_URL, key: ACTIVE_COPUX_API_KEY, model: defaultModel },
        ...LLM_FALLBACK_URLS.map((url, i) => ({
            name: `fallback-${i + 1}`,
            url,
            key: LLM_FALLBACK_KEYS[i] || ACTIVE_COPUX_API_KEY || FREEMODEL_KEY,
            model: LLM_FALLBACK_MODELS[i] || defaultModel
        }))
    ];
    if (!providers.some((p) => p.url === DIRECT_FREEMODEL_URL)) {
        providers.push({ name: 'freemodel-direct', url: DIRECT_FREEMODEL_URL, key: FREEMODEL_KEY, model: defaultModel });
    }
    return providers;
}

function providerLabel(p) {
    let host = p.url;
    try { host = new URL(p.url).host; } catch {}
    return `${p.name}:${p.model}@${host}`;
}

async function testLlmProvider(p, timeoutMs = 20000) {
    const t0 = Date.now();
    try {
        const res = await axios.post(p.url, {
            model: p.model,
            messages: [
                { role: 'system', content: 'Reply exactly: pong' },
                { role: 'user', content: 'ping' }
            ]
        }, {
            headers: { Authorization: `Bearer ${p.key}`, 'Content-Type': 'application/json' },
            timeout: timeoutMs,
            validateStatus: () => true
        });
        const ms = Date.now() - t0;
        const ok = res.status >= 200 && res.status < 300;
        return { ok, ms, status: res.status, text: ok ? ((res.data?.choices?.[0]?.message?.content || '').slice(0, 80)) : '' };
    } catch (e) {
        return { ok: false, ms: Date.now() - t0, status: e.code || e.message, text: '' };
    }
}

async function buildLlmTestReport() {
    const rows = [];
    for (const p of currentProviders(false)) {
        const r = await testLlmProvider(p);
        rows.push(`${r.ok ? '✅' : '❌'} ${providerLabel(p)} — ${r.status}, ${r.ms}ms${r.text ? `, "${r.text}"` : ''}`);
    }
    return `🧠 *LLM Test*\n${rows.join('\n')}`;
}

function buildLlmStatusReport() {
    const providers = currentProviders(false).map((p, i) => `${i + 1}. ${providerLabel(p)}`).join('\n');
    const last = LLM_EVENTS.slice(-5).map((e) => {
        const age = fmtDuration(Date.now() - e.ts);
        return `• ${age} lalu: ${e.message || `${e.from || '?'} → ${e.to || '?'}`}`;
    }).join('\n') || 'belum ada event';
    return [
        '🧠 *LLM Router*',
        `Route override: *${ACTIVE_LLM_ROUTE || '(env/default)'}*`,
        `Text model: *${TEXT_MODEL}*`,
        `Vision model: *${VISION_MODEL}*`,
        `Primary URL: \`${ACTIVE_COPUX_API_URL}\``,
        '',
        '*Provider chain:*',
        providers,
        '',
        '*Event terakhir:*',
        last
    ].join('\n');
}

async function pm2Snapshot() {
    try {
        const { stdout } = await execFileAsync('pm2', ['jlist'], { timeout: 8000 });
        const arr = JSON.parse(stdout);
        return arr.map((p) => ({
            name: p.name,
            status: p.pm2_env?.status,
            pid: p.pid,
            uptime: p.pm2_env?.pm_uptime ? fmtDuration(Date.now() - p.pm2_env.pm_uptime) : '0d',
            restarts: p.pm2_env?.restart_time || 0,
            mem: p.monit?.memory || 0,
            cpu: p.monit?.cpu || 0
        }));
    } catch (e) {
        return [];
    }
}

async function diskLine() {
    try {
        const { stdout } = await execFileAsync('df', ['-h', __dirname], { timeout: 8000 });
        const lines = stdout.trim().split('\n');
        return lines[1] || 'df unavailable';
    } catch {
        return 'df unavailable';
    }
}

function queueReport() {
    return [
        `LLM: ${llmInFlight}/${MAX_CONCURRENT_LLM}, wait ${llmWaiters.length}`,
        `Video: ${videoInFlight}/${MAX_CONCURRENT_VIDEO}, wait ${videoWaiters.length}`,
        `web_fetch: ${webFetchInFlight}/${MAX_CONCURRENT_WEB_FETCH}, wait ${webFetchWaiters.length}`,
        `web_search: ${webSearchInFlight}/${MAX_CONCURRENT_SEARCH}, wait ${webSearchWaiters.length}`
    ].join('\n');
}

async function buildStatusReport({ testLlm = true } = {}) {
    const mem = process.memoryUsage();
    const sysMemUsed = os.totalmem() - os.freemem();
    const pm2 = await pm2Snapshot();
    const services = pm2.length
        ? pm2.map((p) => `${p.status === 'online' ? '✅' : '❌'} ${p.name}: ${p.status}, pid ${p.pid || 0}, up ${p.uptime}, rss ${Math.round(p.mem / 1024 / 1024)}MB, ↺${p.restarts}`).join('\n')
        : 'pm2 unavailable';
    let llmLine = 'skip';
    if (testLlm) {
        const r = await testLlmProvider(currentProviders(false)[0], 15000);
        llmLine = `${r.ok ? '✅' : '❌'} primary ${r.status}, ${r.ms}ms`;
    }
    const lastErr = LAST_ERRORS.length ? LAST_ERRORS[LAST_ERRORS.length - 1] : null;
    return [
        '🩺 *COPUX Status*',
        `Bot uptime: *${fmtDuration(Date.now() - BOT_START_TS)}*`,
        `Node: *${process.version}* · PID: \`${process.pid}\``,
        `Process RAM: *${Math.round(mem.rss / 1024 / 1024)}MB*`,
        `System RAM: *${Math.round(sysMemUsed / 1024 / 1024)}MB/${Math.round(os.totalmem() / 1024 / 1024)}MB*`,
        `Disk: \`${await diskLine()}\``,
        '',
        '*PM2:*',
        services,
        '',
        '*LLM:*',
        `Route: *${ACTIVE_LLM_ROUTE || TEXT_MODEL}*`,
        `Latency: ${llmLine}`,
        '',
        '*Queue:*',
        queueReport(),
        '',
        `Backup terakhir: ${backupStatusLine()}`,
        `Error terakhir: ${lastErr ? `${fmtDuration(Date.now() - lastErr.ts)} lalu [${lastErr.source}] ${lastErr.msg.slice(0, 160)}` : 'kosong'}`
    ].join('\n');
}

function latestBackupOnDisk() {
    try {
        const backupDir = process.env.BACKUP_DIR || path.join(DATA_DIR, 'backups');
        if (!fs.existsSync(backupDir)) return null;
        const files = fs.readdirSync(backupDir)
            .filter((f) => /^copux-backup-.*\.tar\.gz(?:\.enc)?$/.test(f))
            .map((f) => {
                const file = path.join(backupDir, f);
                const st = fs.statSync(file);
                return { file, mtimeMs: st.mtimeMs };
            })
            .sort((a, b) => b.mtimeMs - a.mtimeMs);
        return files[0] || null;
    } catch (e) {
        recordError('backup-status', e);
        return null;
    }
}

function backupStatusLine() {
    if (lastBackupResult) {
        return `${lastBackupResult.ok ? '✅' : '❌'} ${lastBackupResult.when} ${lastBackupResult.path || lastBackupResult.error || ''}`;
    }
    const latest = latestBackupOnDisk();
    if (!latest) return 'belum ada';
    return `✅ ${new Date(latest.mtimeMs).toISOString()} ${latest.file}`;
}

async function runBackupNow(reason = 'manual') {
    const t0 = Date.now();
    try {
        const { stdout } = await execFileAsync('node', [BACKUP_SCRIPT, reason], { timeout: 10 * 60 * 1000, maxBuffer: 8 * 1024 * 1024 });
        const line = stdout.trim().split('\n').pop() || '';
        lastBackupResult = { ok: true, when: new Date().toISOString(), path: line, ms: Date.now() - t0 };
        return lastBackupResult;
    } catch (e) {
        lastBackupResult = { ok: false, when: new Date().toISOString(), error: (e.stderr || e.message || '').slice(0, 200), ms: Date.now() - t0 };
        recordError('backup', lastBackupResult.error);
        return lastBackupResult;
    }
}

async function selfHealTick() {
    if (!SELF_HEAL_ENABLED) return;
    try {
        const primary = currentProviders(false)[0];
        const r = await testLlmProvider(primary, 12000);
        if (!r.ok) selfHealState.primaryFails++;
        else selfHealState.primaryFails = 0;
        if (selfHealState.primaryFails >= SELF_HEAL_FAIL_THRESHOLD && /127\.0\.0\.1|localhost/.test(primary.url)) {
            selfHealState.lastAction = `restart 9router ${new Date().toISOString()}`;
            notifyAdmins(`🧯 Self-healing: primary LLM gagal ${selfHealState.primaryFails}x, restart 9router. Last: ${r.status}`, 'heal-9router', 5 * 60 * 1000);
            execFile('pm2', ['restart', '9router'], () => {});
            selfHealState.primaryFails = 0;
        }
    } catch (e) {
        recordError('self-heal-primary', e);
    }
    try {
        if (SCRAPLING_FETCH_URL) {
            const healthUrl = SCRAPLING_FETCH_URL.replace(/\/fetch$/, '/health');
            const res = await axios.get(healthUrl, { timeout: 5000, validateStatus: () => true });
            if (res.status >= 400) selfHealState.scraplingFails++;
            else selfHealState.scraplingFails = 0;
            if (selfHealState.scraplingFails >= SELF_HEAL_FAIL_THRESHOLD) {
                selfHealState.lastAction = `restart copux-scrapling ${new Date().toISOString()}`;
                notifyAdmins(`🧯 Self-healing: scrapling gagal ${selfHealState.scraplingFails}x, restart copux-scrapling.`, 'heal-scrapling', 5 * 60 * 1000);
                execFile('pm2', ['restart', 'copux-scrapling'], () => {});
                selfHealState.scraplingFails = 0;
            }
        }
    } catch (e) {
        selfHealState.scraplingFails++;
    }
}

// =============================================================================
//  PERSISTENCE — load saat boot, save atomic + debounce
// =============================================================================

function loadHistory() {
    try {
        if (!fs.existsSync(HISTORY_FILE)) return;
        const raw = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
        const now = Date.now();
        let n = 0;
        for (const k in raw) {
            const rec = raw[k];
            if (!rec || !Array.isArray(rec.history)) continue;
            if (now - (rec.lastActive || 0) > SESSION_TTL) continue;
            chatHistory[k] = rec.history;
            lastActive[k] = rec.lastActive || now;
            n++;
        }
        console.log(`💾 history di-load: ${n} sesi dari disk`);
    } catch (e) {
        console.error('Gagal load history.json (mulai fresh):', e.message);
    }
}

let saveTimer = null;
function snapshot() {
    const out = {};
    for (const k in chatHistory) {
        out[k] = { history: chatHistory[k], lastActive: lastActive[k] || Date.now() };
    }
    return JSON.stringify(out);
}
// Atomic write: tulis tmp dulu lalu rename — anti-korup kalau crash di tengah.
// Sync version dipake cuma di shutdown handler (SIGINT/SIGTERM) — di hot path
// pake saveHistoryAsync biar event loop ga blocking.
function saveHistory() {
    try {
        const tmp = HISTORY_FILE + '.tmp';
        fs.writeFileSync(tmp, snapshot());
        fs.renameSync(tmp, HISTORY_FILE);
    } catch (e) {
        console.error('Gagal simpan history (sync):', e.message);
    }
}
let saveInFlight = false;
let saveInFlightPromise = null;   // ref ke promise berjalan; dipakai shutdown buat await beneran (bukan polling boolean).
let pendingSave = false;
async function saveHistoryAsync() {
    if (saveInFlight) {
        pendingSave = true;
        return saveInFlightPromise;
    }
    saveInFlight = true;
    pendingSave = false;
    const work = (async () => {
        try {
            const tmp = HISTORY_FILE + '.tmp';
            await fs.promises.writeFile(tmp, snapshot());
            await fs.promises.rename(tmp, HISTORY_FILE);
        } catch (e) {
            console.error('Gagal simpan history (async):', e.message);
        } finally {
            saveInFlight = false;
            saveInFlightPromise = null;
            if (pendingSave) {
                scheduleSave();
            }
        }
    })();
    saveInFlightPromise = work;
    return work;
}
function scheduleSave() {
    if (saveTimer) return;
    saveTimer = setTimeout(() => { saveTimer = null; saveHistoryAsync(); }, SAVE_DEBOUNCE_MS);
}

// Simpan history pas mau mati (pm2 restart kirim SIGINT) biar obrolan ga ilang.
async function shutdown(sig) {
    console.log(`\n${sig} diterima — simpan history lalu keluar.`);
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    // Anti race: kalau async save lagi jalan, jangan ngerebut tmp file (atomic rename pun bisa
    // ngehapus data terbaru kalau process exit sebelum write selesai). Await promise-nya
    // langsung, capped 5s biar PM2 ga lama bunuh kita.
    if (saveInFlightPromise) {
        console.log('Async save in-flight, await up to 5s...');
        try {
            await Promise.race([
                saveInFlightPromise,
                new Promise((r) => setTimeout(r, 5000))
            ]);
        } catch { /* ignore — exit anyway */ }
    } else {
        saveHistory();
    }
    process.exit(0);
}
process.on('SIGINT', () => { shutdown('SIGINT'); });
process.on('SIGTERM', () => { shutdown('SIGTERM'); });

// Global crash guard — jangan biarin bot mati gara2 1 promise reject yg lolos.
process.on('unhandledRejection', (reason) => {
    if (isRecoverableTelegramRejection(reason)) {
        recordError('telegram-recoverable', reason);
        console.error('⚠️  Telegram recoverable rejection:', reason && reason.message ? reason.message : reason);
        return;
    }
    console.error('⚠️  unhandledRejection:', reason && reason.stack ? reason.stack : reason);
    try { saveHistory(); } catch (_) {}
    process.exit(1);
});
process.on('uncaughtException', (err) => {
    console.error('⚠️  uncaughtException:', err && err.stack ? err.stack : err);
    // Coba simpan history dulu sebelum hard-crash (kalau memang fatal).
    try { saveHistory(); } catch (_) {}
    process.exit(1);
});

fs.mkdirSync(DATA_DIR, { recursive: true });
loadHistory();
loadProfiles();

// =============================================================================
//  SYSTEM PROMPT (persona COPUX-FourFect — versi 2 KELUARGA emulator)
// =============================================================================

const SYSTEM_PROMPT = require("./config/system-prompt.js");

// =============================================================================
//  HELPER — split message, sendSafe, typing keepalive
// =============================================================================




// =============================================================================
//  HELPER — session key, rate limit, friendly error, admin, display name
// =============================================================================

// Privat = chatId; grup = chatId:userId (biar memori antar-user di grup ga nyampur).
function sessionKey(msg) {
    const chatId = msg.chat.id;
    const t = msg.chat.type;
    if (t === 'group' || t === 'supergroup') return `${chatId}:${msg.from ? msg.from.id : 'anon'}`;
    return String(chatId);
}

function checkRate(userId) {
    if (userId == null) return { ok: true };
    if (ADMIN_IDS.has(String(userId))) return { ok: true };
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

function friendlyError(e) {
    const status = e.response && e.response.status;
    let body = '';
    try { body = typeof (e.response && e.response.data) === 'string' ? e.response.data : JSON.stringify((e.response && e.response.data) || ''); } catch (_) {}
    if (/usage limit reached/i.test(body)) {
        const m = body.match(/reset[^"]*?on ([^"._}]+)/i);
        const when = m ? m[1].trim() : null;
        return `🪫 Kuota AI lagi abis bro${when ? `, reset sekitar *${when}*` : ''}. Coba lagi nanti ya.`;
    }
    if (e.code === 'ECONNABORTED') return '⏱️ Kelamaan mikir / server lemot. Coba pertanyaan yang lebih singkat, atau ulangi bentar lagi.';
    if (status === 429) return '🚦 Server lagi rame (kena rate limit). Tunggu sebentar terus coba lagi ya.';
    if (status >= 500) return '🛠️ Server AI-nya lagi ngadat (5xx). Coba lagi beberapa saat lagi.';
    return 'Jalur ke server lagi ngadet bro, coba lagi nanti.';
}

function isAdmin(userId) { return userId != null && ADMIN_IDS.has(String(userId)); }
function displayName(from) {
    if (!from) return 'Anonim';
    const nm = [from.first_name, from.last_name].filter(Boolean).join(' ');
    return nm || (from.username ? '@' + from.username : 'Anonim');
}

function fmtDuration(ms) {
    const s = Math.max(0, Math.floor(Number(ms || 0) / 1000));
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}j ${m % 60}m`;
    return `${Math.floor(h / 24)}hari ${h % 24}j`;
}

function buildStatsReport() {
    const now = Date.now();
    const windows = [
        { label: '1m',  ms: 60 * 1000 },
        { label: '10m', ms: 10 * 60 * 1000 },
        { label: '1j',  ms: 60 * 60 * 1000 },
        { label: '24j', ms: 24 * 60 * 60 * 1000 }
    ];
    const lines = ['📊 *Statistik Bot* (sejak restart terakhir)\n'];
    lines.push(`⏱ Uptime: *${fmtDuration(now - BOT_START_TS)}*`);
    lines.push(`👥 Total user kenal: *${userStats.size}*`);
    lines.push(`💬 Total pesan: *${msgLog.length}* (7 hari terakhir)\n`);

    lines.push('*Aktif per window:*');
    for (const w of windows) {
        const cutoff = now - w.ms;
        const users = new Set();
        let msgs = 0;
        for (let i = msgLog.length - 1; i >= 0; i--) {
            if (msgLog[i].ts < cutoff) break;
            users.add(msgLog[i].userId);
            msgs++;
        }
        lines.push(`• ${w.label.padEnd(4)}: *${users.size}* user, *${msgs}* msg`);
    }

    // Top 5 user paling sering
    const top = [...userStats.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5);
    if (top.length) {
        lines.push('\n*Top 5 user:*');
        top.forEach(([uid, r], i) => {
            const ago = fmtDuration(now - r.lastSeen);
            lines.push(`${i + 1}. ${r.name} \`(${uid})\` — *${r.count}* msg, last ${ago} lalu`);
        });
    }

    // 5 user paling baru aktif
    const recent = [...userStats.entries()]
        .sort((a, b) => b[1].lastSeen - a[1].lastSeen)
        .slice(0, 5);
    if (recent.length) {
        lines.push('\n*Last seen:*');
        recent.forEach(([uid, r]) => {
            const ago = fmtDuration(now - r.lastSeen);
            const tag = r.lastChatType === 'private' ? '🔒' : '👥';
            lines.push(`${tag} ${r.name} — ${ago} lalu (${r.count} msg)`);
        });
    }

    return lines.join('\n');
}

// =============================================================================
//  ADDFIX — Community Knowledge Base
// =============================================================================

const ADDFIX_INFO = `📢 *BANTU BANGUN OTAK BOT — SHARE FIX LU!* 🧠

Bot ini punya *Community Knowledge Base* — kumpulan solusi REAL dari pengalaman member, bukan cuma teori web. Pas ada yg nanya "error X di HP Y", bot kasih fix yg UDAH TERBUKTI work dari kalian. 🔥

🙋 *Cara nyumbang:* ketik /addfix lalu isi format ini (boleh 1 pesan, multi-baris):

\`/addfix\`
\`HP/Chipset : Poco X5, Snapdragon 695, Adreno 619\`
\`Emulator   : Winlator Cmod 10\`
\`Game/App   : GTA SA\`
\`Problem    : black screen pas loading\`
\`FIX        : ganti DXVK ke 1.10.3 + Box64 preset COMPATIBILITY\`

⚠️ *Catatan:*
- Yg dibutuhin fix yg BENERAN lu coba & berhasil, bukan tebakan.
- Semua kiriman di-filter & diverifikasi admin dulu sebelum masuk bot.
- Fix yg kepake, nama lu dicantumin sebagai kontributor. 🙌

Bebas mau share atau nggak — yg banyak nyumbang = bot makin sakti buat kita semua! 🚀`;

function saveAddfix(entry) {
    try {
        fs.appendFileSync(ADDFIX_FILE, JSON.stringify(entry) + '\n');
    } catch (e) {
        console.error('Gagal simpan addfix:', e.message);
    }
}

// =============================================================================
//  WEB TOOLS — search (Serper -> Tavily -> DDG) + fetch
// =============================================================================

const MAX_TOOL_ROUNDS = 4;
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

const TOOLS = [
    {
        type: 'function',
        function: {
            name: 'kb_lookup',
            description: 'Ambil entry dari knowledge base lokal Fourfect (data/kb/*.md) — env var Box64/FEX/Wine/VKD3D, dxvk.conf knob, preset per-game (GTA V, RE4, Sleeping Dogs DE, Splinter Cell, Payday 2, SH2/3), GPU rule Mali/Adreno, MTK/Mali driver gate v40/v50, Turnip per-chipset. Data verified maintainer (Noysz/Fourfect) — PRIORITAS PERTAMA, dipake SEBELUM web_search buat topik knob/setting/preset emulator umum. JANGAN call buat: sapaan, opini subjektif, info time-sensitive (rilis driver bulan ini, harga, news) — itu pakai web_search. Kalau hasil kosong → fallback ke web_search.',
            parameters: {
                type: 'object',
                properties: {
                    topic: {
                        type: 'string',
                        description: 'Kata kunci substring (case-insensitive). Bisa nama env var, knob, game, chipset, atau konsep. Contoh OK: "BOX64_DYNAREC_BIGBLOCK", "TSO Sleeping Dogs", "dxvk maxAvailableMemory", "Adreno 710 dxvk", "MTK Mali driver v50", "Vulkan 1.3.303", "RE4 vkd3d", "FEX Diesel engine". Contoh BURUK: "settingan bagus", "tolong bantu", "halo".'
                    }
                },
                required: ['topic']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'kb_search',
            description: 'Semantic-ish search lokal di seluruh Knowledge Base Fourfect. Pakai ini saat keyword user tidak persis match nama file/section, atau pertanyaan emulator panjang butuh recall lintas KB. Return top section relevan dengan skor. Untuk exact topic/env var tetap pakai kb_lookup dulu.',
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Query natural language. Contoh: "MTK Mali driver baru bisa DX12", "GTA V Helio G99 dxvk ringan", "Box64 preset Unity crash".'
                    }
                },
                required: ['query']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'web_search',
            description: 'Cari sumber/link buat pertanyaan TEKNIS spesifik: param dxvk.conf, env var (BOX64_*/DXVK_*/MESA_*), error/crash game tertentu, kompatibilitas game, driver per-GPU (Turnip/Adreno/Mali), versi rilis emulator. JANGAN call buat: sapaan, opini/rekomendasi subjektif ("emulator terbaik"), pertanyaan umum yg bisa dijawab dari pengetahuan domain. Return: daftar judul+URL. Wajib dipanggil SEBELUM web_fetch kalau URL belum diketahui dari hasil search/system prompt.',
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Query bahasa Inggris, spesifik & padat. Sertakan: nama game/emulator + chipset/GPU + gejala error. Contoh OK: "GTA V Winlator Adreno 740 black screen dxvk", "Box64 BOX64_DYNAREC_BIGBLOCK GameNative". Contoh BURUK: "emulator bagus", "halo".'
                    }
                },
                required: ['query']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'web_fetch',
            description: 'Ambil isi teks 1 URL HTTPS buat baca detail (dxvk.conf, release notes, thread reddit, PCGW wikitext). HANYA call kalau URL valid: (a) hasil web_search, (b) endpoint resmi dari system prompt — raw.githubusercontent.com/{owner}/{repo}/{branch}/path, pcgamingwiki.com/w/api.php?action=parse&page=<Name>&format=json&prop=wikitext, reddit.com/r/<sub>/comments/<id>/<slug>.json, store.steampowered.com/api/appdetails?appids=<id>, protondb.com/api/v1/reports/summaries/<id>.json, github.com/<owner>/<repo>/releases. JANGAN call URL hasil tebakan/karangan, halaman /wiki/ PCGW (sering 403), atau HTML reddit (pakai .json). Kalau 403/404 → JANGAN retry URL sama; web_search dulu.',
            parameters: {
                type: 'object',
                properties: {
                    url: {
                        type: 'string',
                        description: 'URL lengkap http(s)://. Wajib URL valid (hasil search atau format resmi di description). Bukan placeholder, bukan URL halaman /wiki/ PCGW, bukan HTML reddit (tambah .json).'
                    }
                },
                required: ['url']
            }
        }
    }
];

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
    /^0\.0\.0\.0$/,
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,   // CGNAT 100.64.0.0/10
];
const _BLOCKED_NETS_V6 = [/^::1$/, /^fc/i, /^fd/i, /^fe80:/i];
function _isBlockedAddr(address, family) {
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

// =============================================================================
//  KB LOOKUP — baca dari data/kb/*.md, substring match
// =============================================================================

const KB_DIR = path.join(DATA_DIR, 'kb');
let KB_CACHE = null; // [{ file, sections: [{ header, body }] }]

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

// =============================================================================
//  PROMOTEFIX — fix write-only addfix: baca addfix.jsonl → community.md → kb_lookup
// =============================================================================

const COMMUNITY_KB = path.join(KB_DIR, 'community.md');

const PROMOTE_MAX = 500;   // cap entry per promote — cegah memory spike / event-loop freeze (sec F4).
let promoteInFlight = false;   // lock anti dua /promotefix all barengan (dup section).

function readAddfix() {
    try {
        if (!fs.existsSync(ADDFIX_FILE)) return [];
        return fs.readFileSync(ADDFIX_FILE, 'utf8')
            .split('\n').filter(Boolean)
            .map((l) => { try { return JSON.parse(l); } catch (e) { return null; } })
            .filter(Boolean)
            .slice(0, PROMOTE_MAX);
    } catch (e) {
        console.error('Gagal baca addfix:', e.message);
        return [];
    }
}

// Sanitasi konten user sebelum masuk KB yg di-feed LLM. Tangkis 3 vektor injeksi:
//  1. [META] role-spoof (sama kayak guard handler).
//  2. confidence tag palsu ([VERIFIED] dst) — user ga boleh naikin priority sort.
//  3. markdown heading / hr — cegah body ke-split jadi section baru tanpa label di loadKB.
function sanitizeKbBody(s) {
    return String(s || '')
        .replace(/\[META(?:\s[^\]]*)?\]/gi, '[meta-filtered]')
        .replace(/\[(VERIFIED|REVEALED\s*PREF(?:ERENCE)?|THEORETICAL)[^\]]*\]/gi, '(tag-filtered)')
        .replace(/^\s*#+\s*/gm, '')          // strip heading '#','##',...
        .replace(/^\s*-{3,}\s*$/gm, '')        // strip '---' hr (pemisah section visual)
        .slice(0, 2000);
}

// Tulis entry addfix ke community.md. User-content disanitasi (strip [META] anti-spoof,
// sama kayak guard di handler) + di-cap [REVEALED PREFERENCE] biar kb_lookup ga
// nyamain bobotnya sama ground-truth maintainer.
function promoteAddfix(entries) {
    fs.mkdirSync(KB_DIR, { recursive: true });   // guard: kb/ mungkin belum ada di fresh install.
    let block = '';
    for (const e of entries) {
        const name = sanitizeKbBody(e.name || 'anon').replace(/\s+/g, ' ').slice(0, 40);
        const body = sanitizeKbBody(e.content || '');
        const date = new Date(e.ts || Date.now()).toISOString().slice(0, 10);
        block += `\n## [COMMUNITY] kontribusi ${name} (${date})\n`
            + `[REVEALED PREFERENCE] report real member via /addfix — bukan ground-truth maintainer, verifikasi sebelum jadiin patokan mutlak.\n`
            + `${body}\n`;
    }
    const header = fs.existsSync(COMMUNITY_KB)
        ? ''
        : '# Community Fixes\n_Kontribusi member via /addfix, di-promote admin. Confidence: [REVEALED PREFERENCE] — real-world report, bukan maintainer ground-truth._\n';
    fs.appendFileSync(COMMUNITY_KB, header + block);
}

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

async function runTool(name, args) {
    if (name === 'kb_lookup') return kbLookup(String(args.topic || ''));
    if (name === 'kb_search') return kbSemanticSearch(String(args.query || ''));
    if (name === 'web_search') return await webSearch(String(args.query || ''));
    if (name === 'web_fetch') return await webFetch(String(args.url || ''));
    return 'Tool ga dikenal: ' + name;
}

// =============================================================================
//  AGENTIC LOOP — chatCompletion + tool calls
// =============================================================================

async function chatCompletion(messages, useTools, hasImage) {
    const providers = currentProviders(hasImage);

    let lastErr = null;
    let firstFail = null;
    for (let i = 0; i < providers.length; i++) {
        const cfg = providers[i];
        const body = { model: cfg.model, messages };
        if (useTools) { body.tools = TOOLS; body.tool_choice = 'auto'; }
        const t0 = Date.now();
        try {
            const res = await axios.post(cfg.url, body, {
                headers: { 'Authorization': `Bearer ${cfg.key}`, 'Content-Type': 'application/json' },
                timeout: 120000
            });
            const ms = Date.now() - t0;
            recordLlmEvent({ ok: true, provider: cfg.name, model: cfg.model, ms, message: `${cfg.name} ok ${ms}ms` });
            if (i > 0) {
                const from = firstFail ? `${firstFail.name} ${firstFail.reason}` : 'primary failed';
                const to = `${cfg.name}/${cfg.model}`;
                console.log(`LLM fallback active: ${cfg.name}`);
                recordLlmEvent({ ok: true, from, to, message: `${from} -> ${to}` });
                notifyAdmins(`🧠 *LLM fallback aktif*\n${from} → ${to}\nLatency: ${ms}ms`, `llm-fallback-${cfg.name}`, 60000);
            }
            return res.data;
        } catch (e) {
            lastErr = e;
            const status = e.response && e.response.status;
            const safeMsg = status ? `HTTP ${status}` : (e.code || e.message);
            if (!firstFail) firstFail = { name: cfg.name, reason: safeMsg };
            recordError(`llm-${cfg.name}`, safeMsg);
            recordLlmEvent({ ok: false, provider: cfg.name, model: cfg.model, ms: Date.now() - t0, message: `${cfg.name} gagal: ${safeMsg}` });
            console.error(`LLM provider ${cfg.name} gagal: ${safeMsg}`);
            if (i === providers.length - 1) throw lastErr;
        }
    }
    throw lastErr;
}

// MiniMax-M3 wraps reasoning in <think>...</think>. Strip before Telegram.
// freemodel/GPT-5.5 ga punya quirk ini, regex no-op kalau ga match.
// Sekalian buang sisa sintaks tool-call (kalau ada model copux-stack yg
// ngeluarin <function>/<tool_call> sebagai teks) biar GA PERNAH bocor ke user.
function stripThink(text) {
    return text
        .replace(/<think>[\s\S]*?<\/think>\s*/gi, '')
        .replace(/<function\b[\s\S]*?<\/function>\s*/gi, '')
        .replace(/<tool_call>[\s\S]*?<\/tool_call>\s*/gi, '')
        .trim();
}

// Sebagian model di copux-stack (stack multi-model) balikin tool-call sebagai
// TEKS inline, bukan field structured `m.tool_calls`. Format yang kelihat:
//   <function>name{json}</function>        (observed di prod)
//   <function=name>{json}</function>       (gaya Hermes)
//   <tool_call>{"name":..,"arguments":..}</tool_call>   (gaya Qwen)
// Tanpa parser ini, blok itu bocor mentah ke user DAN tool-nya ga pernah jalan.
// Cuma tool yg emang keregistrasi yg dieksekusi (whitelist) — sisanya diabaikan.
function parseTextToolCalls(text) {
    if (!text || text.indexOf('<') === -1) return [];
    const known = new Set(['kb_lookup', 'kb_search', 'web_search', 'web_fetch']);
    const calls = [];
    let mm;

    // 1) <function>name{json}</function>  atau  <function=name>{json}</function>
    const fnRe = /<function(?:=([a-z_]+))?>\s*([a-z_]+)?\s*(\{[\s\S]*?\})\s*<\/function>/gi;
    while ((mm = fnRe.exec(text)) !== null) {
        const name = (mm[1] || mm[2] || '').trim().toLowerCase();
        if (!known.has(name)) continue;
        try { calls.push({ name, args: JSON.parse(mm[3]) }); } catch (e) { /* malformed → skip */ }
    }

    // 2) <tool_call>{"name":..,"arguments":..}</tool_call>
    const tcRe = /<tool_call>\s*(\{[\s\S]*?\})\s*<\/tool_call>/gi;
    while ((mm = tcRe.exec(text)) !== null) {
        let obj;
        try { obj = JSON.parse(mm[1]); } catch (e) { continue; }
        const name = String(obj.name || '').trim().toLowerCase();
        if (!known.has(name)) continue;
        let args = obj.arguments || obj.args || {};
        if (typeof args === 'string') { try { args = JSON.parse(args); } catch (e) { args = {}; } }
        calls.push({ name, args });
    }
    return calls;
}

// Model boleh manggil web_search/web_fetch beberapa kali sebelum jawab final.
// Riwayat tool cuma dipakai sementara (working), ga disimpen ke chatHistory.
async function runAgent(key, images) {
    const working = [...chatHistory[key]];
    const hasImage = !!(images && images.length);

    // Suntik gambar ke pesan user terakhir (cuma di working copy biar ga berat).
    if (hasImage) {
        const last = working[working.length - 1];
        const txt = last && typeof last.content === 'string' ? last.content : 'Analisa gambar ini.';
        working[working.length - 1] = {
            role: 'user',
            content: [
                { type: 'text', text: txt },
                ...images.map((u) => ({ type: 'image_url', image_url: { url: u } }))
            ]
        };
    }

    // [EXPERIMENTAL — open investigation, belum di-commit] Recency anchor buat
    // context-bleeding: window 10-msg di-feed flat, topik lama (mis. MGS V) bisa
    // nyampur ke jawaban topik baru (L4D). A/B: bleed ringan 64%->9%, TAPI kasus
    // parah (jawab game salah) belum kerepro/teruji. Jangan declare "fixed".
    {
        const lastUser = [...working].reverse().find((m) => m.role === 'user');
        let focusTxt = '';
        if (lastUser) {
            focusTxt = typeof lastUser.content === 'string'
                ? lastUser.content
                : (Array.isArray(lastUser.content) ? ((lastUser.content.find((c) => c.type === 'text') || {}).text || '') : '');
            focusTxt = focusTxt.replace(/^\[META[^\]]*\]\s*/, '').replace(/\s+/g, ' ').replace(/"/g, "'").trim().slice(0, 200);
        }
        if (focusTxt) {
            working.push({ role: 'system', content: `[FOKUS] Pertanyaan user SAAT INI: "${focusTxt}". Jawab HANYA untuk ini. Topik/game dari pesan sebelumnya cuma konteks histori — JANGAN dibawa ke jawaban kecuali user eksplisit menyambungkannya.` });
        }
    }

    // Total budget agentic loop biar 1 user ga hold LLM slot 10+ menit.
    const AGENT_DEADLINE_MS = parseInt(process.env.AGENT_DEADLINE_MS || '180000', 10);   // 3 menit
    const deadline = Date.now() + AGENT_DEADLINE_MS;

    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
        if (Date.now() > deadline) {
            return '(agent timeout — pertanyaannya kompleks, persempit dulu biar gw bisa jawab lebih cepet)';
        }
        const lastRound = round === MAX_TOOL_ROUNDS;
        if (lastRound) working.push({ role: 'system', content: 'Cukup pencariannya. Jawab SEKARANG pakai info yang sudah didapat, jangan panggil tool lagi. Sertakan URL sumber.' });
        const data = await chatCompletion(working, !lastRound, hasImage);
        const m = data && data.choices && data.choices[0] && data.choices[0].message;
        if (!m) return '(server ga balikin jawaban, coba lagi)';
        if (!lastRound && m.tool_calls && m.tool_calls.length) {
            working.push(m);
            for (const call of m.tool_calls) {
                let args = {};
                try { args = JSON.parse(call.function.arguments || '{}'); } catch (e) {}
                const result = await runTool(call.function.name, args);
                console.log(`[${key}] 🔧 ${call.function.name}(${JSON.stringify(args).slice(0, 90)})`);
                working.push({ role: 'tool', tool_call_id: call.id, content: result });
            }
            continue;
        }
        // FALLBACK: sebagian model copux-stack balikin tool-call sebagai TEKS
        // inline (bukan m.tool_calls). Parse, jalanin tool-nya, jangan bocor.
        if (!lastRound && m.content) {
            const textCalls = parseTextToolCalls(m.content);
            if (textCalls.length) {
                let feedback = '';
                for (const call of textCalls) {
                    const result = await runTool(call.name, call.args || {});
                    console.log(`[${key}] 🔧(text) ${call.name}(${JSON.stringify(call.args || {}).slice(0, 90)})`);
                    feedback += `[hasil ${call.name}]\n${result}\n\n`;
                }
                working.push({ role: 'user', content: `${feedback}Pakai data di atas buat jawab pertanyaan user. Tulis jawaban final dalam teks biasa — JANGAN keluarin sintaks <function>/<tool_call>.` });
                continue;
            }
        }
        if (m.content && m.content.trim()) {
            const clean = stripThink(m.content);
            if (clean) return clean;
            // content cuma sisa sintaks tool yg ga keparse → jangan bocorin
            if (lastRound) return '(gw nyoba ngambil data tapi formatnya gagal — coba tanya ulang ya)';
            working.push({ role: 'user', content: 'Tulis jawaban final dalam teks biasa, tanpa sintaks tool.' });
            continue;
        }
        // Empty content di lastRound = exit fallback; ga ada gunanya nge-nudge lagi.
        if (lastRound) return '(model ngasih response kosong di round terakhir, coba kirim ulang)';
        working.push({ role: 'user', content: 'Tulis jawaban finalnya sekarang dalam teks ya.' });
    }
    return '(kebanyakan langkah pencarian, coba persempit pertanyaannya)';
}

// =============================================================================
//  YOUTUBE — frame via yt-dlp (kalau cookies ada), fallback thumbnail
// =============================================================================

function run(cmd, args, ms) {
    return new Promise((resolve, reject) => {
        execFile(cmd, args, { timeout: ms, maxBuffer: 12 * 1024 * 1024 }, (err) => err ? reject(err) : resolve());
    });
}

// ---- Video semaphore: cap kerja ffmpeg/whisper paralel (anti CPU-peg Termux) ----
let videoInFlight = 0;
const videoWaiters = [];
function acquireVideoSlot() {
    if (videoInFlight < MAX_CONCURRENT_VIDEO) { videoInFlight++; return Promise.resolve(); }
    return new Promise((resolve) => videoWaiters.push(resolve));
}
function releaseVideoSlot() {
    if (videoWaiters.length) videoWaiters.shift()();
    else videoInFlight = Math.max(0, videoInFlight - 1);
}

// Ekstrak 6 frame dari file video -> array data-URI jpg. Dipakai bareng YT + upload.
async function extractFrames(videoPath, dir) {
    await run('ffmpeg', ['-y', '-i', videoPath, '-vf', 'fps=1/12,scale=512:-1', '-frames:v', '6', `${dir}/f%02d.jpg`], 60000);
    const files = fs.readdirSync(dir).filter((f) => /^f\d+\.jpg$/.test(f)).sort().slice(0, 6);
    // Async readFile paralel — di Termux ARM low-end, 6× sync readFile blocking 100-300ms.
    const bufs = await Promise.all(files.map((f) => fs.promises.readFile(`${dir}/${f}`)));
    return bufs.map((b) => `data:image/jpeg;base64,${b.toString('base64')}`);
}

// Ekstrak audio -> whisper.cpp -> transcript string. Best-effort: '' kalau gagal /
// video bisu / whisper ga ada. NGGAK pernah throw ke caller (request tetep jalan).
async function extractAudioTranscript(videoPath, dir) {
    try {
        // Cek ada audio stream dulu (video bisu -> skip whisper, hemat CPU).
        // ffprobe nulis 'audio' ke stdout kalau ada; pakai execFile sync-ish via run+file.
        await run('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', '-o', `${dir}/probe.txt`, videoPath], 15000)
            .catch(() => {});
        let hasAudio = false;
        try {
            const probeData = await fs.promises.readFile(`${dir}/probe.txt`, 'utf8');
            hasAudio = /audio/.test(probeData);
        } catch {
            hasAudio = false;
        }
        // ffprobe -o ga universal; fallback: kalau probe.txt ga kebikin, coba transcribe aja.
        if (!fs.existsSync(`${dir}/probe.txt`)) hasAudio = true;
        if (!hasAudio) return '';

        const wav = `${dir}/a.wav`;
        await run('ffmpeg', ['-y', '-i', videoPath, '-vn', '-ac', '1', '-ar', '16000', '-t', String(MAX_AUDIO_SEC), wav], 60000);
        if (!fs.existsSync(wav)) return '';
        if (!fs.existsSync(WHISPER_BIN) || !fs.existsSync(WHISPER_MODEL)) return '';

        await run(WHISPER_BIN, ['-m', WHISPER_MODEL, '-f', wav, '-otxt', '-nt', '-l', 'auto', '-of', `${dir}/out`], WHISPER_TIMEOUT_MS);
        let txt = '';
        try { txt = await fs.promises.readFile(`${dir}/out.txt`, 'utf8'); } catch { txt = ''; }
        txt = txt.replace(/\s+/g, ' ').trim();
        if (txt.length > MAX_TRANSCRIPT_CHARS) txt = txt.slice(0, MAX_TRANSCRIPT_CHARS) + ' ...[dipotong]';
        return txt;
    } catch (e) {
        console.error('transcript gagal:', e.code || e.message);
        return '';
    }
}

// Orkestrator: file video lokal -> { images, transcript }. mkdtemp + rmSync finally.
// Frame & transcript independen — salah satu gagal, yang lain tetep balik.
async function processVideoFile(localPath) {
    fs.mkdirSync('/tmp/vid', { recursive: true });
    const dir = fs.mkdtempSync('/tmp/vid/v-');
    await acquireVideoSlot();
    try {
        let images = [];
        try { images = await extractFrames(localPath, dir); } catch (e) { console.error('frames gagal:', e.code || e.message); }
        const transcript = await extractAudioTranscript(localPath, dir);
        return { images, transcript };
    } finally {
        releaseVideoSlot();
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

// Validasi URL video non-YT: https-only + reject IP internal (reuse SSRF guard) +
// allowlist host / ekstensi video. Return true kalau aman diproses yt-dlp.
async function _isAllowedVideoUrl(rawUrl) {
    let u;
    try { u = new URL(rawUrl); } catch { return false; }
    if (u.protocol !== 'https:') return false;
    const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    const hostOk = VIDEO_HOST_ALLOWLIST.some((h) => host === h || host.endsWith('.' + h));
    const extOk = /\.(mp4|webm|mkv|mov)(\?|$)/i.test(u.pathname + u.search);
    if (!hostOk && !extOk) return false;
    // SSRF: pastiin host ga resolve ke IP internal (DNS-rebinding-aware reuse).
    const safe = await _resolveSafeUrl(rawUrl);
    return !!safe.ok;
}

// Download video non-YT via yt-dlp (sandboxed flags) -> processVideoFile.
// SSRF/abuse guard WAJIB lolos dulu. Return { images, transcript } atau null.
async function processVideoUrl(url) {
    if (!(await _isAllowedVideoUrl(url))) return null;
    fs.mkdirSync('/tmp/vid', { recursive: true });
    const dir = fs.mkdtempSync('/tmp/vid/u-');
    try {
        await run('yt-dlp', [
            '--no-playlist', '--no-exec', '--no-continue',
            '--max-filesize', '25M', '--match-filter', '!is_live',
            '-f', 'worst[height>=240]/worst',
            '-o', `${dir}/v.%(ext)s`, url
        ], YTDLP_TIMEOUT_MS);
        const vf = fs.readdirSync(dir).find((f) => f.startsWith('v.'));
        if (!vf) return null;
        return await processVideoFile(`${dir}/${vf}`);
    } catch (e) {
        console.error('video url gagal:', e.code || e.message);
        return null;
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

// YT: download worst-quality -> frame + transcript. Butuh cookies (kalau IP keblok,
// throw -> caller fallback thumbnail). Return { images, transcript }.
async function ytFrames(id) {
    // mkdtempSync = dir unik per request, ga tabrakan kalau 2 user kirim ID sama bareng.
    fs.mkdirSync('/tmp/yt', { recursive: true });
    // Sanitize id buat prefix mkdtemp (regex izinin '-', jangan sampe jadi awalan path aneh).
    const safeId = id.replace(/[^A-Za-z0-9_]/g, '_');
    const dir = fs.mkdtempSync(`/tmp/yt/${safeId}-`);
    await acquireVideoSlot();
    try {
        // --max-filesize + --match-filter '!is_live': cegah live-stream / video raksasa
        // nahan slot semaphore sampe timeout (DoS) + isi disk.
        await run('yt-dlp', ['--cookies', '/root/yt-cookies.txt', '--no-playlist', '--no-exec', '--max-filesize', '25M', '--match-filter', '!is_live', '-f', 'worst[height>=240]/worst', '-o', `${dir}/v.%(ext)s`, `https://youtu.be/${id}`], YTDLP_TIMEOUT_MS);
        const vf = fs.readdirSync(dir).find((f) => f.startsWith('v.'));
        if (!vf) throw new Error('video ga keunduh');
        const images = await extractFrames(`${dir}/${vf}`, dir);
        const transcript = await extractAudioTranscript(`${dir}/${vf}`, dir);
        return { images, transcript };
    } finally {
        releaseVideoSlot();
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

async function processYouTube(url) {
    const id = (url.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/)([A-Za-z0-9_-]{11})/) || [])[1];
    if (!id) return null;
    let meta = 'Video YouTube';
    try {
        const o = await axios.get(`https://www.youtube.com/oembed?url=https://youtu.be/${id}&format=json`, { timeout: 10000 });
        meta = `Judul: ${o.data.title}\nChannel: ${o.data.author_name}`;
    } catch (e) { /* metadata opsional */ }
    let images = [], mode = 'meta', transcript = '';
    if (fs.existsSync('/root/yt-cookies.txt')) {
        try {
            const fr = await ytFrames(id);
            if (fr.images.length) { images = fr.images; mode = 'frames'; transcript = fr.transcript || ''; }
        } catch (e) { console.error('YT frames gagal:', e.message); }
    }
    if (!images.length) {
        try {
            const t = await axios.get(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`, { responseType: 'arraybuffer', timeout: 10000 });
            images = [`data:image/jpeg;base64,${Buffer.from(t.data).toString('base64')}`];
            mode = 'thumbnail';
        } catch (e) { /* thumbnail opsional */ }
    }
    return { meta, images, mode, transcript };
}

// =============================================================================
//  GARBAGE COLLECTOR — hapus memori chat yang idle > 6 jam
// =============================================================================

setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    for (const id in lastActive) {
        if (now - lastActive[id] > SESSION_TTL) {
            delete chatHistory[id];
            delete lastActive[id];
            cleaned++;
        }
    }

    // Prune rate-limit maps — user yg ga aktif > 10 menit ga perlu di RAM (Termux/ARM).
    const RATE_IDLE = 10 * 60 * 1000;
    let rPruned = 0;
    for (const [uid, t] of rateLastAt) {
        if (now - t > RATE_IDLE) {
            rateLastAt.delete(uid);
            rateLog.delete(uid);
            rateWarnedAt.delete(uid);
            rPruned++;
        }
    }

    // Prune userStats — drop user yg lastSeen > STATS_TTL (7d).
    let sPruned = 0;
    for (const [uid, rec] of userStats) {
        if (now - rec.lastSeen > STATS_TTL) {
            userStats.delete(uid);
            sPruned++;
        }
    }

    if (cleaned || rPruned || sPruned) {
        console.log(`🧹 GC: sesi=${cleaned} rate=${rPruned} stats=${sPruned}`);
        if (cleaned) scheduleSave();
    }
}, 1000 * 60 * 30);

// Backup harian + self-healing ringan. Interval pertama diberi delay biar boot bot
// tidak langsung rebut resource saat PM2 baru start.
if (AUTO_BACKUP_ENABLED) {
    setInterval(() => {
        runBackupNow('scheduled').then((r) => {
            if (!r.ok) notifyAdmins(`❌ Backup COPUX gagal: ${r.error || 'unknown'}`, 'backup-fail', 60 * 60 * 1000);
        });
    }, BACKUP_INTERVAL_MS);
}
if (SELF_HEAL_ENABLED) {
    setInterval(selfHealTick, SELF_HEAL_INTERVAL_MS);
}

function readJsonBody(req, limit = 1024 * 1024) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        req.on('data', (c) => {
            size += c.length;
            if (size > limit) {
                reject(new Error('body too large'));
                req.destroy();
                return;
            }
            chunks.push(c);
        });
        req.on('end', () => {
            try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
            catch (e) { reject(e); }
        });
        req.on('error', reject);
    });
}

function sendHttp(res, status, body, type = 'text/plain; charset=utf-8') {
    res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
    res.end(body);
}

function webAuthed(req) {
    if (!ADMIN_WEB_TOKEN) return ADMIN_WEB_HOST === '127.0.0.1' || ADMIN_WEB_HOST === 'localhost';
    const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    return req.headers['x-admin-token'] === ADMIN_WEB_TOKEN || u.searchParams.get('token') === ADMIN_WEB_TOKEN;
}

async function tailFile(file, lines = 120) {
    try {
        const { stdout } = await execFileAsync('tail', ['-n', String(lines), file], { timeout: 8000, maxBuffer: 1024 * 1024 });
        return stdout;
    } catch (e) {
        return '';
    }
}

async function handleAdminHttp(req, res) {
    const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (TELEGRAM_MODE === 'webhook' && req.method === 'POST' && u.pathname === WEBHOOK_PATH) {
        try {
            const update = await readJsonBody(req);
            bot.processUpdate(update);
            sendHttp(res, 200, 'ok');
        } catch (e) {
            recordError('webhook', e);
            sendHttp(res, 400, 'bad request');
        }
        return;
    }

    if (u.pathname === '/health') {
        sendHttp(res, 200, JSON.stringify({ ok: true, mode: TELEGRAM_MODE }), 'application/json');
        return;
    }
    if (!webAuthed(req)) {
        sendHttp(res, 401, 'unauthorized');
        return;
    }
    try {
        if (u.pathname === '/' || u.pathname === '/panel') {
            const html = `<!doctype html><meta charset="utf-8"><title>COPUX Ops</title>
<style>body{font-family:system-ui,Arial,sans-serif;background:#111;color:#eee;margin:24px}pre{background:#1b1b1b;padding:16px;border-radius:8px;white-space:pre-wrap}button{margin:4px;padding:8px 10px}</style>
<h1>COPUX Ops Panel</h1>
<button onclick="load('/api/status')">status</button><button onclick="load('/api/llmtest')">llmtest</button><button onclick="load('/api/logs')">logs</button><button onclick="post('/api/reloadkb')">reload KB</button><button onclick="post('/api/backup')">backup</button>
<pre id="out">ready</pre>
<script>
async function load(p){out.textContent=await (await fetch(p+location.search)).text()}
async function post(p){out.textContent=await (await fetch(p+location.search,{method:'POST'})).text()}
</script>`;
            sendHttp(res, 200, html, 'text/html; charset=utf-8');
            return;
        }
        if (u.pathname === '/api/status') {
            sendHttp(res, 200, await buildStatusReport({ testLlm: false }));
            return;
        }
        if (u.pathname === '/api/queue') {
            sendHttp(res, 200, queueReport());
            return;
        }
        if (u.pathname === '/api/llmtest') {
            sendHttp(res, 200, await buildLlmTestReport());
            return;
        }
        if (u.pathname === '/api/logs') {
            const out = await tailFile('/root/.pm2/logs/copux-out.log', 80);
            const err = await tailFile('/root/.pm2/logs/copux-error.log', 80);
            sendHttp(res, 200, `--- out ---\n${out}\n--- error ---\n${err}`);
            return;
        }
        if (u.pathname === '/api/reloadkb' && req.method === 'POST') {
            KB_CACHE = null; loadKB();
            sendHttp(res, 200, 'KB reloaded');
            return;
        }
        if (u.pathname === '/api/backup' && req.method === 'POST') {
            const r = await runBackupNow('web');
            sendHttp(res, r.ok ? 200 : 500, JSON.stringify(r, null, 2), 'application/json');
            return;
        }
        sendHttp(res, 404, 'not found');
    } catch (e) {
        recordError('admin-http', e);
        sendHttp(res, 500, 'internal error');
    }
}

function startOpsHttpServer() {
    if (!ADMIN_WEB_PORT && TELEGRAM_MODE !== 'webhook') return;
    const port = ADMIN_WEB_PORT || parseInt(process.env.PORT || '8787', 10);
    const server = http.createServer((req, res) => { handleAdminHttp(req, res); });
    server.on('error', (e) => {
        recordError('ops-http', e);
        console.error('Ops HTTP gagal start:', e.message);
    });
    server.listen(port, ADMIN_WEB_HOST, () => {
        console.log(`🛠️ Ops HTTP listening http://${ADMIN_WEB_HOST}:${port} mode=${TELEGRAM_MODE}`);
    });
    if (TELEGRAM_MODE === 'webhook') {
        if (!TELEGRAM_WEBHOOK_URL) {
            console.error('TELEGRAM_MODE=webhook tapi TELEGRAM_WEBHOOK_URL kosong.');
            return;
        }
        const hookUrl = TELEGRAM_WEBHOOK_URL.replace(/\/$/, '') + WEBHOOK_PATH;
        bot.setWebHook(hookUrl)
            .then(() => console.log(`✅ Telegram webhook set: ${hookUrl}`))
            .catch((e) => {
                recordError('webhook-set', e);
                console.error('Gagal set webhook:', e.message);
            });
    }
}
startOpsHttpServer();

// =============================================================================
//  HANDLER — command + gate grup + vision + file + YouTube
// =============================================================================

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from ? msg.from.id : null;
    const key = sessionKey(msg);
    const text = msg.text || msg.caption || '';
    const rawDoc = msg.document || (msg.reply_to_message ? msg.reply_to_message.document : null);
    // Video doc (mime video/*) di-route ke pipeline video, BUKAN text-file reader.
    const isVideoDoc = !!(rawDoc && /^video\//i.test(rawDoc.mime_type || ''));
    const documentToProcess = isVideoDoc ? null : rawDoc;
    // Sumber video: msg.video / video_note / dokumen ber-mime video (juga dari reply).
    const videoToProcess = msg.video
        || msg.video_note
        || (msg.reply_to_message ? (msg.reply_to_message.video || msg.reply_to_message.video_note) : null)
        || (isVideoDoc ? rawDoc : null);

    lastActive[key] = Date.now();
    const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';

    // Per-session lock: kalau handler buat key ini lagi proses LLM, tolak pesan baru.
    // Ini cegah race condition push ke chatHistory + cost double.
    // Khusus untuk pesan yang akan dipanggilkan LLM — command (/start/reset/stats/addfix) tetep boleh.
    const cmdEarly = text.startsWith('/') ? text.split(/\s+/)[0].replace(/@.*/, '').toLowerCase() : '';
    const wouldCallLLM = !cmdEarly || cmdEarly === '/cari';
    if (wouldCallLLM && inFlight.has(key)) {
        bot.sendChatAction(chatId, 'typing').catch(() => {});
        return;   // silent drop — user lagi nunggu jawaban sebelumnya
    }

    // Normalisasi command (di grup bisa /reset@NamaBot)
    const cmd = text.startsWith('/') ? text.split(/\s+/)[0].replace(/@.*/, '').toLowerCase() : '';

    if (cmd === '/start') {
        chatHistory[key] = [{ role: 'system', content: SYSTEM_PROMPT }];
        scheduleSave();
        const mention = BOT_USERNAME ? '@' + BOT_USERNAME : 'bot';
        sendSafe(chatId,
            '🤖 *COPUX v2.1 Aktif*\n\n' +
            'Pakar emulator PC-di-Android (Winlator, GameHub, BannerHub) sekaligus game hunter tanpa sensor moralitas.\n\n' +
            '🛠️ *Spesialisasi:*\n' +
            '— *Emulator Tuning:* DXVK, VKD3D, Box64, FEXCore, Turnip, & Mali driver v40/v50.\n' +
            '— *Crack & DRM:* Bypass Steam DRM, Goldberg emu, & Winlator DLL Overrides.\n' +
            '— *Vision:* Kirim screenshot error/setting/log → gw bedah langsung.\n\n' +
            '*Command:*\n' +
            '/hunting `<judul>` — Cari link bajakan (pre-installed/portable) via web-dorking.\n' +
            '/cari `<kunci>` — Paksa deep-search info & troubleshoot di web.\n' +
            '/addfix — Sumbang fix atau trick emulator ke Community KB.\n' +
            '/reset — Bersihkan memori obrolan.\n\n' +
            `*Di grup:* mention ${mention} atau reply pesan gw.\n\n` +
            '———\n' +
            '💡 _Bot ini jalan pakai kredit dari freemodel. Daftar lewat link gw (gratis):_\n' +
            'https://freemodel.dev/invite/FRE-681bce55'
        );
        return;
    }
    if (cmd === '/reset') {
        chatHistory[key] = [{ role: 'system', content: SYSTEM_PROMPT }];
        scheduleSave();
        sendSafe(chatId, '🧹 Memori dibersihin, mulai dari awal.');
        return;
    }
    if (cmd === '/addfix') {
        const body = text.replace(/^\/addfix(@\S+)?\s*/i, '').trim();
        if (!body) { sendSafe(chatId, ADDFIX_INFO); return; }
        saveAddfix({
            ts: Date.now(),
            userId,
            name: displayName(msg.from),
            chatId,
            content: body
        });
        sendSafe(chatId, '✅ Fix lu udah masuk antrian review admin. Makasih kontribusinya bro! 🙌');
        return;
    }
    if (cmd === '/profile') {
        const body = text.replace(/^\/profile(@\S+)?\s*/i, '').trim();
        const id = String(userId || '');
        if (!body) {
            const p = userProfiles[id] || {};
            const lines = ['👤 *Profile lo*'];
            for (const k of ['device', 'chipset', 'gpu', 'emulator', 'style']) {
                lines.push(`${k}: ${p[k] ? `*${p[k]}*` : '-'}`);
            }
            lines.push('\nSet contoh: `/profile set chipset=Dimensity 8200 emulator=Ludashi style=singkat`');
            sendSafe(chatId, lines.join('\n'));
            return;
        }
        if (/^clear$/i.test(body)) {
            delete userProfiles[id];
            saveProfiles();
            sendSafe(chatId, '🧹 Profile lo dibersihin.');
            return;
        }
        const setBody = body.replace(/^set\s+/i, '');
        const fields = {};
        const re = /\b(device|chipset|gpu|emulator|style)=("[^"]+"|'[^']+'|[^=]+?)(?=\s+\b(?:device|chipset|gpu|emulator|style)=|$)/gi;
        let mm;
        while ((mm = re.exec(setBody)) !== null) {
            fields[mm[1].toLowerCase()] = mm[2].replace(/^['"]|['"]$/g, '').trim().slice(0, 80);
        }
        if (!Object.keys(fields).length) {
            sendSafe(chatId, 'Format: `/profile set chipset=... gpu=... emulator=... style=...` atau `/profile clear`');
            return;
        }
        updateUserProfile(userId, fields);
        sendSafe(chatId, '✅ Profile disimpan.');
        return;
    }
    if (cmd === '/status') {
        if (!isAdmin(userId)) { sendSafe(chatId, '🔒 Khusus admin.'); return; }
        sendSafe(chatId, await buildStatusReport({ testLlm: true }));
        return;
    }
    if (cmd === '/stats') {
        if (!isAdmin(userId)) { sendSafe(chatId, '🔒 Khusus admin.'); return; }
        sendSafe(chatId, buildStatsReport());
        return;
    }
    if (cmd === '/llmstatus') {
        if (!isAdmin(userId)) { sendSafe(chatId, '🔒 Khusus admin.'); return; }
        sendSafe(chatId, buildLlmStatusReport());
        return;
    }
    if (cmd === '/llmroute') {
        if (!isAdmin(userId)) { sendSafe(chatId, '🔒 Khusus admin.'); return; }
        const arg = text.replace(/^\/llmroute(@\S+)?\s*/i, '').trim();
        if (!arg) {
            sendSafe(chatId, 'Format: `/llmroute copux-stack` atau `/llmroute off`');
            return;
        }
        if (/^(off|default|env)$/i.test(arg)) {
            delete runtimeState.llmRoute;
        } else {
            runtimeState.llmRoute = arg.slice(0, 80);
        }
        saveRuntimeState();
        reloadRuntimeEnv();
        sendSafe(chatId, `✅ LLM route sekarang: *${ACTIVE_LLM_ROUTE || '(env/default)'}*\nText: *${TEXT_MODEL}*\nVision: *${VISION_MODEL}*`);
        return;
    }
    if (cmd === '/llmtest') {
        if (!isAdmin(userId)) { sendSafe(chatId, '🔒 Khusus admin.'); return; }
        sendSafe(chatId, await buildLlmTestReport());
        return;
    }
    if (cmd === '/reloadenv') {
        if (!isAdmin(userId)) { sendSafe(chatId, '🔒 Khusus admin.'); return; }
        reloadRuntimeEnv();
        reloadAdminIds();
        sendSafe(chatId, `♻️ .env reloaded.\nRoute: *${ACTIVE_LLM_ROUTE || '(env/default)'}*\nAdmin: *${ADMIN_IDS.size}*`);
        return;
    }
    if (cmd === '/backup') {
        if (!isAdmin(userId)) { sendSafe(chatId, '🔒 Khusus admin.'); return; }
        const r = await runBackupNow('telegram');
        sendSafe(chatId, r.ok ? `✅ Backup selesai: \`${r.path}\` (${r.ms}ms)` : `❌ Backup gagal: ${r.error || 'unknown'}`);
        return;
    }
    if (cmd === '/reloadkb') {
        if (!isAdmin(userId)) { sendSafe(chatId, '🔒 Khusus admin.'); return; }
        const t0 = Date.now();
        KB_CACHE = null;
        loadKB();
        const ms = Date.now() - t0;
        const fileCount = Array.isArray(KB_CACHE) ? KB_CACHE.length : 0;
        const sectionCount = Array.isArray(KB_CACHE) ? KB_CACHE.reduce((s, f) => s + (f.sections?.length || 0), 0) : 0;
        sendSafe(chatId, `♻️ KB reloaded: ${fileCount} file, ${sectionCount} section (${ms}ms).`);
        return;
    }
    if (cmd === '/promotefix') {
        if (!isAdmin(userId)) { sendSafe(chatId, '🔒 Khusus admin.'); return; }
        const pending = readAddfix();
        if (!pending.length) { sendSafe(chatId, '📭 Ga ada addfix pending.'); return; }
        const arg = text.replace(/^\/promotefix(@\S+)?\s*/i, '').trim().toLowerCase();
        if (arg !== 'all') {
            let prev = `📋 *${pending.length} addfix pending* (review dulu):\n\n`;
            pending.forEach((e, i) => {
                const full = String(e.content || '').replace(/\s+/g, ' ');
                const snip = full.slice(0, 80) + (full.length > 80 ? '…' : '');
                prev += `${i + 1}. *${e.name || 'anon'}* — ${snip}\n`;
            });
            prev += `\nKetik */promotefix all* buat masukin SEMUA ke community KB + reload.`;
            sendSafe(chatId, prev);
            return;
        }
        if (promoteInFlight) { sendSafe(chatId, '⏳ Promote lagi jalan, tunggu bentar.'); return; }
        promoteInFlight = true;
        try {
            // Re-check tepat sebelum tulis — cegah dua admin promote isi yg sama (dup section).
            if (!fs.existsSync(ADDFIX_FILE)) { sendSafe(chatId, '📭 Addfix udah ke-promote barusan.'); return; }
            promoteAddfix(pending);
            // Archive jsonl biar ga double-promote di run berikutnya.
            fs.renameSync(ADDFIX_FILE, ADDFIX_FILE.replace(/\.jsonl$/, `.promoted.${Date.now()}.jsonl`));
            KB_CACHE = null;
            loadKB();
            sendSafe(chatId, `✅ ${pending.length} fix di-promote ke *community.md* + KB reloaded. Sekarang kepake di kb_lookup.`);
        } catch (e) {
            console.error('promotefix gagal:', e.message);
            sendSafe(chatId, '⚠️ Gagal promote, cek log server.');
        } finally {
            promoteInFlight = false;
        }
        return;
    }
    
    if (cmd === '/dlc') {
        const appId = text.replace(/^\/dlc(@\S+)?\s*/i, '').trim();
        await handleDlcCommand(chatId, appId, bot);
        return;
    }
    
    if (cmd === '/hunting') {
        const query = text.replace(/^\/hunting(@\S+)?\s*/i, '').trim();
        if (!query) {
            return bot.sendMessage(chatId, "⚠️ *Format Sintaks Galat*\\. Anda wajib melampirkan judul game\\.\nContoh: `/hunting elden ring`", { parse_mode: 'MarkdownV2' });
        }
        
        // Validasi input string 'query' untuk memangkas karakter berbahaya (Anti-Injeksi/SSRF)
        const safeQuery = query.replace(/[^\w\s\-\.]/gi, ' ').replace(/\s+/g, ' ').trim();
        if (!safeQuery) {
            return bot.sendMessage(chatId, "⚠️ *Kueri Ditolak*\\. Harap gunakan karakter alfanumerik yang valid\\.", { parse_mode: 'MarkdownV2' });
        }
        
        try {
            bot.sendChatAction(chatId, 'typing').catch(() => {});
            const response = await axios.post('http://127.0.0.1:8765/api/v1/hunt-game', 
                { query: safeQuery }, 
                { timeout: 45000 }
            );
            
            if (response.data.ok && response.data.content) {
                // Fallback rendering: Coba kirim pakai Markdown (V1) yang lebih rileks
                // Kalau error, sendSafe otomatis bakal fallback ke plain text.
                return sendSafe(chatId, response.data.content, { disable_web_page_preview: true });
            } else {
                return bot.sendMessage(chatId, "❌ Matriks data tidak ditemukan di parameter domain indeks Pre\\-installed FMHY\\.", { parse_mode: 'MarkdownV2' });
            }
        } catch (error) {
            return bot.sendMessage(chatId, `❌ *Anomali Latensi Jaringan:*\nKoneksi inter\\-process TCP menuju microservice lokal ditolak atau kehabisan waktu terputus\\.\n\\(${escapeSafeMd(error.message)}\\)`, { parse_mode: 'MarkdownV2' });
        }
    }
    if (cmd && cmd !== '/cari') return;

    // GATE GRUP: cuma berlaku buat pesan biasa (bukan command). /cari tetep jalan.
    let promptText = text;
    if (isGroup && !cmd) {
        const repliedToBot = !!(msg.reply_to_message && BOT_ID && msg.reply_to_message.from && msg.reply_to_message.from.id === BOT_ID);
        const mentioned = BOT_USERNAME ? new RegExp('@' + BOT_USERNAME + '(?!\\w)', 'i').test(text) : false;
        if (!repliedToBot && !mentioned) return;
        if (mentioned && BOT_USERNAME) promptText = text.replace(new RegExp('@' + BOT_USERNAME + '(?!\\w)', 'ig'), '').trim();
    }

    // HARDCODED INTERCEPTION ROUTER: Bypass LLM Gateway untuk pencarian link game
    if (!cmd) {
        const huntingRegex = /(?:minta\s+link|bagi\s+link|cari\s+game|hunting|download\s+game|preinstalled)\s+(.+)/i;
        const matchHunting = promptText.match(huntingRegex);
        if (matchHunting && matchHunting[1]) {
            const query = matchHunting[1].trim();
            const safeQuery = query.replace(/[^\w\s\-\.]/gi, ' ').replace(/\s+/g, ' ').trim();
            if (safeQuery) {
                try {
                    bot.sendChatAction(chatId, 'typing').catch(() => {});
                    const response = await axios.post('http://127.0.0.1:8765/api/v1/hunt-game', 
                        { query: safeQuery }, 
                        { timeout: 45000 }
                    );
                    
                    if (response.data.ok && response.data.content) {
                        let sanitizedText = escapeSafeMd(response.data.content);
                        sanitizedText = sanitizedText.replace(/\\\*/g, '*').replace(/\\`/g, '`').replace(/\\_/, '_');
                        return bot.sendMessage(chatId, sanitizedText, { parse_mode: 'MarkdownV2', disable_web_page_preview: true });
                    } else {
                        return bot.sendMessage(chatId, "❌ Matriks data tidak ditemukan di parameter domain indeks Pre\\-installed FMHY\\.", { parse_mode: 'MarkdownV2' });
                    }
                } catch (error) {
                    return bot.sendMessage(chatId, `❌ *Anomali Latensi Jaringan:*\nKoneksi inter\\-process TCP menuju microservice lokal ditolak atau kehabisan waktu terputus\\.\n\\(${escapeSafeMd(error.message)}\\)`, { parse_mode: 'MarkdownV2' });
                }
                return; // Hentikan eksekusi agar tidak diteruskan ke LLM
            }
        }
    }

    // RATE LIMIT
    const rate = checkRate(userId);
    if (!rate.ok) {
        if (rate.warn) {
            if (rate.reason === 'cooldown') {
                sendSafe(chatId, `⏳ Santai bro, jeda *${RATE_COOLDOWN_MS / 1000} detik* antar pesan ya. Tunggu ~${rate.waitSec}s lagi.`);
            } else {
                sendSafe(chatId, `🚦 Slow down bro, lu udah *${RATE_MAX} pesan* dalam ${RATE_WINDOW_MS / 1000}s. Istirahat dulu ya.`);
            }
        }
        return;
    }

    // /cari = paksa deep search dulu sebelum jawab
    if (cmd === '/cari') {
        const q = text.replace(/^\/cari(@\S+)?\s*/i, '').trim();
        if (!q) { sendSafe(chatId, 'Format: */cari <kata kunci>*\nContoh: `/cari setting dxvk Elden Ring Adreno 730`'); return; }
        promptText = '[WAJIB pakai web_search lalu web_fetch sumbernya sebelum menjawab] ' + q;
    }

    // STATS — counted setelah filter grup+rate, jadi cuma user "beneran kirim ke bot"
    if (userId) {
        const now = Date.now();
        const rec = userStats.get(userId) || { name: '', firstSeen: now, lastSeen: now, count: 0, lastChatType: msg.chat.type, lastChatId: chatId };
        rec.name = displayName(msg.from) || rec.name;
        rec.lastSeen = now;
        rec.count++;
        rec.lastChatType = msg.chat.type;
        rec.lastChatId = chatId;
        userStats.set(userId, rec);
        msgLog.push({ ts: now, userId });
        // Prune log > 7d
        const cutoff = now - STATS_TTL;
        while (msgLog.length && msgLog[0].ts < cutoff) msgLog.shift();
    }

    bot.sendChatAction(chatId, 'typing').catch(() => {});

    // === FILE DOKUMEN ===
    let fileContent = '';
    if (documentToProcess) {
        if (documentToProcess.file_size && documentToProcess.file_size > MAX_FILE_SIZE) {
            sendSafe(chatId, '⚠️ Filenya kegedean (maks 1MB). Kirim yang lebih kecil ya.');
            return;
        }
        try {
            const link = await bot.getFileLink(documentToProcess.file_id);
            // arraybuffer + post-download check biar binary file (renamed .exe dst)
            // ga decode dulu ke UTF-8 jumbo string sebelum size check.
            const res = await axios.get(link, { responseType: 'arraybuffer', maxContentLength: MAX_FILE_SIZE });
            const buf = Buffer.from(res.data);
            if (buf.length > MAX_FILE_SIZE) {
                fileContent = '\n\n[File terlalu besar, ga diproses]';
            } else {
                // Cek kalau printable text (heuristik: 95%+ ASCII printable / whitespace).
                let printable = 0;
                for (let i = 0; i < buf.length; i++) {
                    const c = buf[i];
                    if (c === 9 || c === 10 || c === 13 || (c >= 32 && c <= 126)) printable++;
                }
                if (printable / Math.max(1, buf.length) < 0.9) {
                    fileContent = '\n\n[File binary, skip baca isi]';
                } else {
                    fileContent = `\n\n[ISI FILE]:\n${buf.toString('utf8')}`;
                }
            }
        } catch (err) {
            fileContent = '\n\n[Gagal baca file]';
        }
    }

    // === VISION: foto + frame YouTube ===
    const images = [];

    // 1) Foto / screenshot
    const photos = msg.photo || (msg.reply_to_message ? msg.reply_to_message.photo : null);
    if (photos && photos.length) {
        try {
            const big = photos[photos.length - 1];
            const link = await bot.getFileLink(big.file_id);
            const res = await axios.get(link, { responseType: 'arraybuffer', maxContentLength: MAX_PHOTO_BYTES });
            const buf = Buffer.from(res.data);
            // Telegram sering balikin 'application/octet-stream', deteksi dari magic bytes.
            let mime = res.headers['content-type'] || '';
            if (!/^image\//i.test(mime)) {
                if (buf[0] === 0xFF && buf[1] === 0xD8) mime = 'image/jpeg';
                else if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) mime = 'image/png';
                else if (buf.slice(0, 4).toString('latin1') === 'RIFF' && buf.slice(8, 12).toString('latin1') === 'WEBP') mime = 'image/webp';
                else if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) mime = 'image/gif';
                else mime = 'image/jpeg';
            }
            images.push(`data:${mime};base64,${buf.toString('base64')}`);
        } catch (err) {
            console.error('Gagal ambil foto:', err.message);
        }
    }

    // 2) Video upload Telegram (msg.video / video_note / dokumen video) — frame + transcript.
    //    Stream-to-disk (BUKAN arraybuffer) biar 20MB ×3 concurrent ga OOM Termux.
    if (videoToProcess) {
        if (videoToProcess.file_size && videoToProcess.file_size > MAX_VIDEO_BYTES) {
            sendSafe(chatId, `⚠️ Videonya kegedean (maks ${Math.round(MAX_VIDEO_BYTES / 1024 / 1024)}MB). Kirim yang lebih pendek/kecil ya.`);
            return;
        }
        fs.mkdirSync('/tmp/vid', { recursive: true });
        const dlDir = fs.mkdtempSync('/tmp/vid/dl-');
        const dlPath = `${dlDir}/in`;
        try {
            const link = await bot.getFileLink(videoToProcess.file_id);
            await withTyping(chatId, async () => {
                const res = await axios.get(link, { responseType: 'stream', maxContentLength: MAX_VIDEO_BYTES });
                await new Promise((resolve, reject) => {
                    const ws = fs.createWriteStream(dlPath);
                    // maxContentLength cuma cek header content-length; server bisa boong /
                    // ga kirim header. Counter manual = hard cap byte aktual (anti OOM/disk).
                    let received = 0;
                    res.data.on('data', (chunk) => {
                        received += chunk.length;
                        if (received > MAX_VIDEO_BYTES) {
                            res.data.destroy();
                            ws.destroy();
                            reject(new Error('video stream melebihi batas'));
                        }
                    });
                    res.data.pipe(ws);
                    res.data.on('error', reject);
                    ws.on('error', reject);
                    ws.on('finish', resolve);
                });
                const vid = await processVideoFile(dlPath);
                if (vid.images.length) {
                    images.push(...vid.images);
                    promptText += `\n\n[VIDEO USER]\n[Kamu dikasih ${vid.images.length} FRAME dari video yang user kirim. Analisa visualnya.]`;
                }
                if (vid.transcript) {
                    promptText += `\n\n[TRANSKRIP AUDIO VIDEO]\n${vid.transcript}\n[Hasil transcribe audio video user. Gabung sama frame visual buat jawab.]`;
                }
                if (!vid.images.length && !vid.transcript) {
                    promptText += '\n\n[VIDEO USER]\n[Video diterima tapi gagal diproses (frame & audio ga keambil). Jujur bilang ke user.]';
                }
            });
        } catch (err) {
            console.error('video upload gagal:', err.code || err.message);
            promptText += '\n\n[VIDEO USER]\n[Gagal proses video (kegedean/format/timeout). Jujur bilang ke user.]';
        } finally {
            fs.rmSync(dlDir, { recursive: true, force: true });
        }
    }

    // 3) Link YouTube — strip trailing punctuation supaya regex ga grab tanda baca
    let ytUrl = (promptText.match(/https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/[^\s]+|youtu\.be\/[^\s]+)/i) || [])[0];
    if (ytUrl) ytUrl = ytUrl.replace(/[.,;:!?)\]}"']+$/, '');
    if (ytUrl) {
        try {
            const yt = await withTyping(chatId, () => processYouTube(ytUrl));
            if (yt) {
                if (yt.images.length) {
                    images.push(...yt.images);
                    const seen = yt.mode === 'frames'
                        ? 'Kamu dikasih beberapa FRAME dari video ini. Analisa dari frame + judul.'
                        : 'Video aslinya TIDAK bisa diunduh (YouTube blokir IP server), jadi kamu HANYA dikasih THUMBNAIL + judul. Analisa seadanya, dan JUJUR bilang ini berdasar thumbnail+judul, bukan nonton videonya.';
                    promptText += `\n\n[KONTEN YOUTUBE]\n${yt.meta}\n[${seen}]`;
                } else {
                    promptText += `\n\n[KONTEN YOUTUBE]\n${yt.meta}\n[Thumbnail & video ga keambil; cuma judul yang ada. Jujur ke user soal keterbatasan ini.]`;
                }
                if (yt.transcript) {
                    promptText += `\n\n[TRANSKRIP AUDIO VIDEO]\n${yt.transcript}\n[Hasil transcribe audio video YouTube. Gabung sama frame visual buat jawab.]`;
                }
            }
        } catch (ytErr) {
            console.error('Gagal fetch YouTube:', ytErr.message);
            promptText += '\n\n[KONTEN YOUTUBE]\n[Gagal ambil info YouTube. Beritahu user ada masalah jaringan/limitasi.]';
        }
    }

    // 4) Link video non-YT (tiktok/vimeo/mp4/dll) — allowlist + SSRF guard di dalam.
    if (!ytUrl && !videoToProcess) {
        let vUrl = (promptText.match(/https:\/\/[^\s]+/i) || [])[0];
        if (vUrl) vUrl = vUrl.replace(/[.,;:!?)\]}"']+$/, '');
        if (vUrl && (await _isAllowedVideoUrl(vUrl))) {
            try {
                const vid = await withTyping(chatId, () => processVideoUrl(vUrl));
                if (vid && (vid.images.length || vid.transcript)) {
                    if (vid.images.length) {
                        images.push(...vid.images);
                        promptText += `\n\n[VIDEO LINK]\n[Kamu dikasih ${vid.images.length} FRAME dari video di link ini. Analisa visualnya.]`;
                    }
                    if (vid.transcript) {
                        promptText += `\n\n[TRANSKRIP AUDIO VIDEO]\n${vid.transcript}\n[Hasil transcribe audio video dari link. Gabung sama frame visual buat jawab.]`;
                    }
                }
            } catch (err) {
                console.error('Gagal fetch custom video URL:', err.message);
                promptText += '\n\n[VIDEO LINK]\n[Gagal ngambil video dari link. Beritahu user videonya ga bisa diakses.]';
            }
        }
    }

    if (images.length && !promptText.trim()) {
        promptText = 'Jelasin gambar/screenshot ini. Kalau ada error, setting, atau log emulator di dalamnya, bedah & kasih solusinya.';
    }
    if (!promptText.trim() && !fileContent && !images.length) return;

    if (!chatHistory[key]) chatHistory[key] = [{ role: 'system', content: SYSTEM_PROMPT }];
    // Anti META-tag spoofing: strip [META ...] block dari semua user-controlled
    // input sebelum di-concat di belakang server-controlled metaTag asli.
    const stripMeta = (s) => String(s || '').replace(/\[META(?:\s[^\]]*)?\]/gi, '[meta-filtered]');
    const safeName = stripMeta(displayName(msg.from) || 'anon').slice(0, 40);
    observeProfileFromText(userId, promptText);
    const metaTag = `[META role=${isAdmin(userId) ? 'owner' : 'user'} name=${safeName}]\n`;
    const safePromptText = stripMeta(promptText);
    const safeFileContent = stripMeta(fileContent);
    const userMsg = { role: 'user', content: metaTag + profileContext(userId) + safePromptText + safeFileContent + (images.length ? `\n[user mengirim ${images.length} gambar]` : '') };

    inFlight.add(key);
    let pushed = false;
    try {
        await acquireLLMSlot();
        // Push BARU setelah slot acquired — kalau acquire throw, history ga corrupt.
        chatHistory[key].push(userMsg);
        pushed = true;
        // Trim ke MAX_HISTORY pesan + system[0]. Single splice (bukan loop O(n²)),
        // mulai index 1 biar system prompt di [0] selalu kepertahanin.
        if (chatHistory[key].length > MAX_HISTORY + 1) {
            chatHistory[key].splice(1, chatHistory[key].length - (MAX_HISTORY + 1));
        }

        // ponytail: observability buat recency-anchor. Log 2 user-turn terakhir verbatim,
        // nol heuristik — reviewer yang nilai apakah jawaban bleed topik lama pas credit balik.
        {
            const uts = chatHistory[key].filter((m) => m.role === 'user' && typeof m.content === 'string');
            const clean = (s) => s.replace(/^\[META[^\]]*\]\s*/, '').replace(/\s+/g, ' ').slice(0, 60);
            const prevU = uts.length >= 2 ? clean(uts[uts.length - 2].content) : '(none)';
            const curU = uts.length ? clean(uts[uts.length - 1].content) : '(none)';
            console.log(`[${key}] recency | prev="${prevU}" → cur="${curU}"`);
        }

        const reply = await withTyping(chatId, () => runAgent(key, images));
        const route = images.length ? `freemodel/${VISION_MODEL}` : `freemodel/${TEXT_MODEL}`;
        console.log(`[${key}] otak: ${route} | jawaban ${reply.length} char | inflight=${llmInFlight}/${MAX_CONCURRENT_LLM}`);
        chatHistory[key].push({ role: 'assistant', content: reply });
        scheduleSave();
        await sendSafe(chatId, reply, isGroup ? { reply_to_message_id: msg.message_id } : {});
    } catch (e) {
        // JANGAN log response body — gateway kadang echo API key fragment di error.
        const detail = e.response ? `HTTP ${e.response.status} from LLM provider` : (e.code || e.message);
        console.error('Error API:', detail);
        if (pushed && chatHistory[key] && chatHistory[key].length) chatHistory[key].pop();
        await sendSafe(chatId, friendlyError(e));
    } finally {
        releaseLLMSlot();
        inFlight.delete(key);
    }
});

console.log('🚀 Bot COPUX-FourFect (gabungan V1+V2) startup…');


bot.on('document', async (msg) => {
    const doc = msg.document;
    if (!doc || !doc.file_name) return;
    
    const targetFiles = ['steam_emu.ini', 'Ali213.ini', 'HLM.ini', 'steam_appid.txt'];
    if (!targetFiles.includes(doc.file_name)) return;
    
    const chatId = msg.chat.id;
    try {
        bot.sendChatAction(chatId, 'typing').catch(() => {});
        const link = await bot.getFileLink(doc.file_id);
        const res = await axios.get(link, { responseType: 'text', maxContentLength: 1048576 });
        const content = res.data;
        
        const isGoldberg = doc.file_name === 'steam_appid.txt';
        const hasAppId = /AppId\s*=\s*\d+/i.test(content) || (isGoldberg && /^\d+$/m.test(content));
        const hasLanguage = /Language\s*=\s*\w+/i.test(content);
        
        let report = `✅ *Audit Verifikasi Integritas Lapisan Kompatibilitas untuk* \`${escapeSafeMd(doc.file_name)}\` *Selesai:*\n\n`;
        report += `\\- Kunci Parameter AppId: ${hasAppId ? 'Terdeteksi \\(Valid\\)' : '*KORUP / HILANG*'}\n`;
        
        if (!isGoldberg) {
            report += `\\- Kunci Parameter Language: ${hasLanguage ? 'Terdeteksi \\(Valid\\)' : '*HILANG \\(Beresiko tinggi memicu glitched text/font\\)*'}\n`;
        } else {
            report += `\\- Kunci Parameter Language: _\\(Bypass Otorisasi: Instrumen ini mengadopsi mekanisme ekstensi Goldberg txt\\)_\n`;
        }
        
        return bot.sendMessage(chatId, report, { parse_mode: 'MarkdownV2', reply_to_message_id: msg.message_id });
    } catch (e) {
        return bot.sendMessage(chatId, `❌ *Kesalahan Node Internal Fatal:* ${escapeSafeMd(e.message)}`, { parse_mode: 'MarkdownV2' });
    }
});

async function handleDlcCommand(chatId, appId, bot) {
    try {
        if (!appId || !/^\d+$/.test(appId)) {
            return bot.sendMessage(chatId, "⚠️ *Format Input Galat*\\. Argumen ID Aset dipersyaratkan harus bernilai metrik numerik utuh\\.\nContoh: `/dlc 230410`", { parse_mode: 'MarkdownV2' });
        }
        
        const response = await axios.post('http://127.0.0.1:8765/api/v1/asset-mapping', 
            { appid: appId }, 
            { timeout: 35000 }
        );
        
        if (response.data.ok) {
            const iniContent = response.data.content;
            return bot.sendMessage(chatId, 
                `Berikut adalah abstraksi matriks generator sub\\-aset \\(DLC\\) terkini untuk instrumen ID *${escapeSafeMd(appId)}*:\n\n\`\`\`ini\n${iniContent}\n\`\`\``, 
                { parse_mode: 'MarkdownV2' }
            );
        } else {
            return bot.sendMessage(chatId, `❌ *Resolusi Data Digagalkan Microservice:*\n${escapeSafeMd(response.data.error)}`, { parse_mode: 'MarkdownV2' });
        }
    } catch (error) {
        return bot.sendMessage(chatId, `❌ *Anomali Latensi Jaringan:*\nKoneksi inter\\-process TCP menuju microservice lokal ditolak atau kehabisan waktu terputus\\.\n\\(${escapeSafeMd(error.message)}\\)`, { parse_mode: 'MarkdownV2' });
    }
}

if (process.env.HARNESS_MODE) {
    module.exports = { chatHistory, runAgent, SYSTEM_PROMPT };
}
