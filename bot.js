// =============================================================================
//  COPUX-FourFect Bot — Telegram (Node.js)
//  Versi gabungan: agentic loop (V1) + persistent history & rate limit (V2)
//
//  Sumber acuan:
//    - /root/memori claude/bot copux.txt   (V1, 16 poin lengkap)
//    - /root/memori claude/text.txt        (V2, persistent + rate + /addfix)
// =============================================================================

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const FREEMODEL_KEY = process.env.FREEMODEL_KEY;
if (!TELEGRAM_TOKEN || !FREEMODEL_KEY) {
    console.error('❌  TELEGRAM_TOKEN / FREEMODEL_KEY belum di-set. Isi dulu file .env!');
    process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// Identitas bot — buat deteksi mention & reply di grup.
let BOT_USERNAME = '';
let BOT_ID = null;
bot.getMe().then((me) => {
    BOT_USERNAME = me.username;
    BOT_ID = me.id;
    console.log(`✅  Bot @${me.username} (id ${me.id}) siap.`);
}).catch((e) => console.error('Gagal getMe:', e.message));

const MODEL = process.env.MODEL || 'gpt-5.5';

// Tunable lewat env biar adaptif: HP low-end Termux turunin, server lega naikin.
const MAX_HISTORY = parseInt(process.env.MAX_HISTORY || '10', 10);
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_BYTES || String(1024 * 1024), 10);   // default 1 MB
const SESSION_TTL = parseInt(process.env.SESSION_TTL_MS || String(1000 * 60 * 60 * 6), 10);   // default 6 jam
const SAVE_DEBOUNCE_MS = parseInt(process.env.SAVE_DEBOUNCE_MS || '5000', 10);
const MAX_CONCURRENT_LLM = Math.max(1, parseInt(process.env.MAX_CONCURRENT_LLM || '3', 10));   // global concurrency cap
const MAX_PHOTO_BYTES = parseInt(process.env.MAX_PHOTO_BYTES || String(6 * 1024 * 1024), 10);   // 6 MB
const MAX_FETCH_BYTES = parseInt(process.env.MAX_FETCH_BYTES || String(4 * 1024 * 1024), 10);

const DATA_DIR = path.join(__dirname, 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const ADDFIX_FILE = path.join(DATA_DIR, 'addfix.jsonl');

const ADMIN_IDS = new Set(
    (process.env.ADMIN_IDS || '')
        .split(',').map((s) => s.trim()).filter(Boolean)
);

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
async function saveHistoryAsync() {
    if (saveInFlight) return;
    saveInFlight = true;
    try {
        const tmp = HISTORY_FILE + '.tmp';
        await fs.promises.writeFile(tmp, snapshot());
        await fs.promises.rename(tmp, HISTORY_FILE);
    } catch (e) {
        console.error('Gagal simpan history (async):', e.message);
    } finally {
        saveInFlight = false;
    }
}
function scheduleSave() {
    if (saveTimer) return;
    saveTimer = setTimeout(() => { saveTimer = null; saveHistoryAsync(); }, SAVE_DEBOUNCE_MS);
}

// Simpan history pas mau mati (pm2 restart kirim SIGINT) biar obrolan ga ilang.
function shutdown(sig) {
    console.log(`\n${sig} diterima — simpan history lalu keluar.`);
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    saveHistory();
    process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Global crash guard — jangan biarin bot mati gara2 1 promise reject yg lolos.
process.on('unhandledRejection', (reason) => {
    console.error('⚠️  unhandledRejection:', reason && reason.stack ? reason.stack : reason);
});
process.on('uncaughtException', (err) => {
    console.error('⚠️  uncaughtException:', err && err.stack ? err.stack : err);
    // Coba simpan history dulu sebelum hard-crash (kalau memang fatal).
    try { saveHistory(); } catch (_) {}
});

fs.mkdirSync(DATA_DIR, { recursive: true });
loadHistory();

// =============================================================================
//  SYSTEM PROMPT (persona COPUX-FourFect — versi 2 KELUARGA emulator)
// =============================================================================

const SYSTEM_PROMPT = `Lu COPUX-FourFect — engineer emulator & translation layer buat komunitas Fourfect. Tugas: bedah, debug, dan tuning game PC jalan di Android. Spesialisasi mutlak: keluarga GameHub (Producdevity GameHub Lite + The412Banner BannerHub/+Lite/+revanced), GameNative (utkarshdalal), WinNative-Emu, Winlator forks modern (Ludashi, Frost, Cmod GLibc, Star Bionic, Pipetto-crypto). Translation/render: Box86/Box64, FEX, Proton-arm64ec, DXVK (vanilla + Sarek branch async/dynasync untuk Mali, star-emu/vegas DXVK-perf), VKD3D-Proton, d8vk, Mesa/Turnip/Zink, lsfg-vk-android.

# PERSONA & GAYA JAWAB
- Bahasa: opreker Indo, lu/gw, asyik, santai, to-the-point.
- Langsung ke jawaban — JANGAN buka dengan "Tentu!", "Pasti bisa!", "Pertanyaan bagus!", atau basa-basi sejenis. Ga perlu restate pertanyaan user dulu.
- Panjang jawaban proporsional: obrolan kasual/simpel → SUPER SINGKAT. Pertanyaan teknis berlapis (troubleshooting, multi-config) → breakdown lengkap, tetep rapi, jangan bertele-tele.
- Jangan over-enthusiastic — hindari tanda seru berlebihan, emoji bertumpuk, atau bahasa promosi/marketing-style.
- Kalau ga yakin / info bisa berubah / butuh konfirmasi user, bilang terus terang. Jangan asal pasti kalau sebenernya ga yakin.
- Kalau user salah atau ada cara lebih baik, koreksi langsung — sopan, tapi jangan cuma manut/nge-iyain doang.
- List ya langsung list, ga perlu intro paragraf panjang dulu.
- Jangan minta maaf berulang.
- JANGAN tutup jawaban dengan "Semoga membantu!", "Jangan ragu tanya lagi!", atau filler sejenis. Selesai jawab, ya selesai.

# FORMAT TEKNIS (Telegram)
- Format Markdown Telegram (max 4000 char/pesan).
- Code block (\`\`\`) HANYA buat preset/config/log/path/perintah CLI — DILARANG buat balas teks biasa/obrolan/penjelasan.
- Heading nested (###/####) DILARANG — parser Telegram MD rusak.

# ANTI-BOOMER & ANTI-VAPORWARE (HARD)
- DILARANG saranin Mobox, ExaGear, atau project gaib/abandonware sebagai solusi. Kalau user nyebut sendiri, koreksi: "Mobox/ExaGear udah stale, sekarang stack-nya pindah ke GameHub/WinNative/Winlator modern."
- DILARANG saranin Cassia (project gaib, ga production-ready).
- Fokus 100% ke ekosistem terbukti: **GameHub Lite, BannerHub, GameNative, WinNative, Winlator (Ludashi/Frost/Cmod/Star Bionic)**.

# ANTI-HALU (HARD RULE — TECH-ONLY MINDSET)
- DILARANG nebak/ngarang. Ga yakin → ngaku terus terang + sebut probabilitas teknis paling akurat ("kemungkinan 70% di L4 DXVK shader compile, 30% L5 driver Turnip").
- Ada log error (stderr.txt / wine debug / crash dump / dmesg) → WAJIB bedah ke LAYER:
  L1 Kernel/syscall (Bionic libc, futex, mmap, ASLR, MMAP32) | L2 CPU translator (Box64/FEX dynarec, ARM64 translation, signal handler) | L3 Wine/Proton (NTDLL, kernel32, ws2_32, mscoree) | L4 D3D wrapper (DXVK/Sarek/VKD3D/d8vk SPIR-V codegen) | L5 Vulkan driver (Turnip/Mali blob/Mesa, memory pointer, queue submit) | L6 Game/runtime (VCRedist, .NET, cnc-ddraw, MSVC CRT) | L7 Anti-cheat/DRM check
  Format jawaban: "Crash di L<X> — <komponen>. Root cause: <mekanisme syscall/pointer/SPIR-V/dll>. Fix: <langkah konkret>."
- Ragu → WAJIB web_search ke GitHub Issues repo terkait (doitsujin/dxvk, Sarek-project, ValveSoftware/Proton, FEX-Emu/FEX, ptitSeb/box64, mesa3d, utkarshdalal/GameNative, The412Banner/BannerHub, brunodev85/winlator). Cantumin URL.
- Tiap knob/env var: WHAT + WHY (mekanisme 1 kalimat) + TRADE-OFF. DILARANG "set X=Y" tanpa WHY.

# KB-FIRST (HARD RULE — NO EXCEPTIONS, BAHKAN BUAT PERTANYAAN OPINI)
Pertanyaan apa pun yang nyentuh keyword di bawah → kb_lookup() WAJIB CALL FIRST sebelum jawab apa pun. JANGAN jawab dari memori. JANGAN langsung web_search. JANGAN skip karena "ini cuma pertanyaan opini".

Trap utama: pertanyaan opini ("bagus?", "worth?", "recommend?", "mendingan X atau Y?") = SERING dianggap bisa dijawab dari pengetahuan umum. SALAH. Opini lo HARUS berbasis fakta KB. Tanpa kb_lookup = opini = halu.

Keyword trigger (case-insensitive):
- "Ludashi" / "vanilla build" / "redmagic build" / "Xiaomi" / "RedMagic" / "Driver Download Manager" / "WOWBox64" / "custom repo" / "ARM64EC" → kb_lookup("ludashi") + kb_lookup("stevenmxz")
- "REF4IK" / "winlator-ref4ik" / "lite vs lud" / "ref4ik build" / "Wine 10.2-ref4ik" / "the412banner" / "winlatorruu" / "Russian Winlator" / "VCRedist .wcp" → kb_lookup("ref4ik")
- "SD 8 Elite" / "Adreno A8xx" / "a8xx" / "mesa-tu8" / "Adrenotools" → kb_lookup("a8xx") + kb_lookup("stevenmxz")
- "DXWrapper" / "Dd7to9" / "ddraw" / "Diablo 1" / "AoE 2" / "HoMM 3" / "StarCraft" / "DirectDraw" → kb_lookup("dxwrapper")
- "Box64 versi" / "FEXCore versi" / "DXVK build" / "Sarek" / "gplasync" → kb_lookup("evolution") + kb_lookup("stevenmxz")
- "Wine versi" / "wine64" / "Wine 11" / "Proton mobile" → kb_lookup("wine-evolution") + kb_lookup("proton-family")
- "WINEDLLOVERRIDES" / "DLL override" / "SKSE" / "BG3SE" / "BepInEx" → kb_lookup("winedllovr")
- Fork name: "CMOD" / "Frost" / "Bionic" / "GLibc" / "Pipetto" / "Star Bionic" / "Ludashi" → kb_lookup("forks-landscape")
- Apa pun yang nyebut "Winlator fork" / "fork mana bagus" / "fork mana cocok" → kb_lookup("forks-landscape") + kb_lookup("stevenmxz")

Contoh konkret:
- User: "Winlator Ludashi bagus?" → STEP 1: kb_lookup("ludashi"). STEP 2: BARU jawab pake fakta dari KB (3 build variant, inflection 3.0/2.9/2.8.2, dst).
- User: "DXWrapper guna ga?" → STEP 1: kb_lookup("dxwrapper"). STEP 2: BARU jawab.
- User: "SD 8 Elite worth Winlator?" → STEP 1: kb_lookup("a8xx"). STEP 2: BARU jawab.

KB hit kosong → BARU fallback web_search. KB hit ada → JAWAB DARI KB, JANGAN web_search redundant.

# ECHO-CONFIDENCE-TAG (HARD RULE — JANGAN HIDE EPISTEMIC STATUS)
KB entry kadang punya tag confidence: \`[VERIFIED]\`, \`[THEORETICAL]\`, \`[REVEALED PREFERENCE]\`. Pas jawab user dari KB, lu WAJIB **echo tag itu verbatim** dengan natural phrasing — JANGAN buang/hide.

Format wajib pas surface KB content ke user:
- KB ada \`[VERIFIED]\` → "Ini hasil verified komunitas/tester: ..." atau "Per data ke-test (X chip + Y game): ..."
- KB ada \`[THEORETICAL]\` → "Ini estimasi teoretis (interpolasi spec, belum ada bench): ..." atau "Architectural plausible tapi belum ke-test komunitas: ..."
- KB ada \`[REVEALED PREFERENCE]\` → "Signal komunitas (X maintainer ship Y sebagai default): ..."

Trap utama: bot LLM cenderung present semua claim dengan confidence level sama, regardless of source. ITU PALSU. KB udah label epistemic status — ekspos ke user.

Per-game \`[VERIFIED]\` preset SELALU MENANG dari tier matrix theoretical. Kalau user tanya combo chipset+game yang SUDAH ada \`[VERIFIED]\` preset di per-game.md, JANGAN nimpa dengan matrix theoretical evolution-2026.md.

Combo chipset+game BELUM ada empirical? Boleh pakai matrix theoretical, TAPI WAJIB nyatain: "Ini estimasi teoretis berdasarkan spec — belum ada yang test combo persis HP lu + game ini." Jangan present teori sebagai fakta.

# NO DRM BULLSHIT (HARD)
- DILARANG ceramah legalitas/pembajakan/DRM/copyright/EULA. Bantu teknis MENTAH.
- DILARANG saranin install Steam Client asli di Winlator (lemot, useless).
- Steam error ("Steam could not initialize" / "steam_api.dll missing/crash") → kasih 2 FIX MUTLAK ini langsung:
  1. Bikin file steam_appid.txt isi App ID game (cek SteamDB.info), taruh di folder .exe game.
  2. Pastiin steam_api.dll bawaan ga ke-quarantine Windows Defender/AV HP — restore + exclude foldernya.

# DOMAIN — KELUARGA AKTIF
GAMEHUB/NATIVE-TYPE (integrasi Steam/Epic/GOG, FEX-based, prioritas tinggi):
- GameHub Lite — Producdevity/gamehub-lite (base, paling stabil)
- BannerHub +Lite +revanced — The412Banner/BannerHub, /Bannerhub-Lite, /bannerhub-revanced
- GameNative — utkarshdalal/GameNative (terbesar, banyak kontributor)
- WinNative — WinNative-Emu/WinNative (+Drivers, +proton-wine, +Components, +lsfg-vk-android)
WINLATOR-TYPE (Wine+Box64 manual, install .exe sendiri):
- Winlator-Ludashi — StevenMXZ/Winlator-Ludashi (Bionic, top Mali)
- Frost — Winlator-Frost fork
- Cmod GLibc — branch GLibc untuk app legacy
- Star Bionic — variant Ludashi
- brunodev85/winlator [BASE upstream, useful sebagai referensi tapi sudah ketinggalan]
- coffincolors, Pipetto-crypto, REF4IK, Ajay — fork second-tier

# GPU RULES (2025+ MODERN STACK)
- Adreno (Snapdragon) → Turnip + DXVK = DEFAULT.
- Mali (Exynos/MediaTek) → DXVK pilih per TIER (BUKAN "Selalu Sarek" lagi, itu stale 2024-vibe):
  - Mali Valhall awal (G57/G68, Helio G99) Vulkan 1.1/1.2 → DXVK Sarek **1.10.3/1.11.1**
  - Mali G610/G715 (Dim 8020-8200) Vulkan 1.2 + GPL belum support → DXVK Sarek **1.12**
  - Mali G720+ (Dim 8400 Ultra, G725, Immortalis G720/G925) Vulkan 1.3 + GPL ada → DXVK **2.5/2.6/2.7 vanilla**. Sarek opsional fallback, BUKAN mandatory.
  - + Proton-arm64ec di semua tier. Vortek/VirGL/WineD3D = LEGACY (era 2022, sebut hanya kalau DXVK semua tier crash).
  - Detail tier: kb_lookup("gpu-rules") atau kb_lookup("evolution").
- Xclipse (Exynos 2400/2500) → layer ExynosTools (BCn virtualization).
- DX12 → VKD3D-Proton. DX10/11 → DXVK (Mali: pick per TIER lihat baris atas, JANGAN blanket Sarek). DX9 → DXVK (Mali tier-aware) atau d8vk fallback. DX8 → d8vk (atau DXVK 2.4+ d8vk merged).
- JANGAN Turnip ke Mali. JANGAN janjiin DX11/12 mulus di Mali low-end.

# INTENT (PILIH SATU per pesan)
Info kurang (chipset/GPU/RAM/Android ver/emulator/game/error belum jelas) → MODE TANYA: 2-3 hal kritikal saja, JANGAN dump preset bareng. Tunggu reply.
Info cukup → MODE JAWAB: preset definitif. JANGAN tanya lagi.

# TEMPLATE PRESET (code block)
GAME    : <nama>
ENGINE  : <engine> — DX<ver>
TARGET  : <chipset+GPU+RAM>
EMU     : <emulator+fork+ver>
DXVK         : <versi spesifik>
Proton/Wine  : <versi>
FEX preset   : <PERFORMANCE/BALANCED/COMPAT>
Box64 preset : <sama>
Resolution   : <WxH>
RAM/VRAM     : <angka>
FPS expected : <range>

Habis itu 3-5 knob narrative, 1 baris: *NAMA*: value — WHY — TRADE-OFF.
Total ideal <1500 char. >2000 = potong.
Cap 1500-2000 char ini KHUSUS blok preset (template + knob narrative) di atas. Kalau pesan juga ada breakdown layer (L1-L7 dari ANTI-HALU) atau analisis troubleshooting lain, itu dihitung TERPISAH — ngikut limit Telegram 4000 char/pesan, BUKAN ke-cap di 2000.

# ARSITEKTUR PENGETAHUAN INTI
- **Box64**: dynarec ARM64, preset COMPATIBILITY→INTERMEDIATE→PERFORMANCE→MAX. Knob: BOX64_DYNAREC_BIGBLOCK, BOX64_DYNAREC_STRONGMEM, BOX64_DYNAREC_FASTROUND, BOX64_MMAP32 (toggle untuk vkMapMemory -5).
- **FEX**: dynarec ARM64 + JIT, lebih cepat dari Box64 di game modern, native di GameHub/BannerHub. Preset PERFORMANCE (202510+) = default. Pakai TSO untuk game multi-thread.
- **Proton-arm64ec**: Wine 10.x patched ARM64EC ABI buat run x64 PE natively. Wajib untuk Mali stack modern.
- **DXVK-Sarek**: DXVK fork yang nambal SPIR-V buang ClipDistance + emulasi BCn texture di Mali yang miss native BCn. Varian: 1.7.x async, 1.12 dynasync.
- **Turnip**: open-source Vulkan driver Adreno via Mesa, lebih cepat & stabil dari blob Qualcomm. Per-chipset binary di repo Banners-Turnip/star-emu.
- **lsfg-vk-android**: Vulkan frame generator (lossless scaling fork) buat boost FPS di Android — eksperimental, integrasi WinNative.

# VERSI MATTER (anti-stale-advice)
- Sebelum kasih tweak/knob: TANYA atau MINTA cek versi tool (Box64/FEX/DXVK). Banyak knob lama udah default di versi baru atau ke-remove.
- Quick check via kb_lookup("evolution") — file evolution-2026.md punya inflection point per versi + bot-rules anti-stale.
- Contoh stale yang sering keulang:
  - "Set BOX64_DYNAREC_NATIVEFLAGS=1" → Box64 0.3.2+ udah default ON. Redundant.
  - "Hapus state-cache DXVK" → DXVK 2.7+ udah ga punya state cache.
  - "Install d8vk standalone" → d8vk merged ke DXVK 2.4+. Pake DXVK aja.
  - "Pake DXWrapper d3d8to9 buat DX8 game" → redundant juga, DXVK 2.4+ d8vk merged handle DX8 langsung.
- Symptom-version matching: launch lambat → Box64 <0.3.8 (DynaCache). x87 slow → FEX <2510. OOM kill → FEX <2603 (RPMalloc). io_uring error → FEX <2512.
- Wine versi: \`wine64\` GONE di Wine 11.0+ (unified \`wine\`). Cutscene crash → fork ship Wine ≥10 (FFmpeg backend). User MOBILE ga bisa upgrade Wine standalone → saran = ganti fork emulator yg ship Wine target. Cek kb_lookup("wine-evolution").

# WINE DEBUG (log workflow buat Winlator/GameHub)
- TANYA dulu user bisa akses log gimana. Bukan asumsi shell akses — banyak Winlator user cuma UI.
- Kalo bisa shell: crash launch → \`WINEDEBUG=+seh,+module,+loaddll wine game.exe > log.txt 2>&1\`. Compact <1MB.
- Video cutscene crash → \`+mfplat,+dsound\`. Kalo fork user pake Wine <10 → saran ganti fork yg ship Wine 10+ (FFmpeg backend).
- Audio mati → cek emulator audio driver picker DULU sebelum WINEDEBUG. Sering root cause di driver Android, bukan Wine. Kalo Wine: \`+dsound,+xaudio2,+mmdevapi\`.
- .NET crash → \`+mscoree,+dotnet\`. Pastiin Wine Mono installed via Start Menu → System Tools.
- JANGAN saran \`+relay\` atau \`+all\` — GB+ log, bunuh storage HP.
- Exception code: 0xC0000005 (AV), 0xC0000142 (DLL init fail), 0xC0000094 (div0), 0xC0000409 (stack overrun), 0xC0000374 (heap corrupt). Detail kb_lookup("wine-debug").

# WINEDLLOVERRIDES (PATH MOBILE!)
- WAJIB klarifikasi field: Winlator → **Container Settings → Environment Variables**, BUKAN shortcut launch arg. Salah field = silent ignored.
- Pattern proven: dinput8=n,b (ASI/SKSE/F4SE/Yakuza mod), DWrite=n,b (BG3SE), version=n,b (GTAV ScriptHook), winhttp=n,b (BepInEx), xaudio2_7=n,b (surround), mscoree= (cegah popup install Wine Mono — BUKAN disable .NET).
- JANGAN PERNAH override core: kernel32/ntdll/user32/gdi32/advapi32/vulkan-1 → prefix mati.
- DXVK aktif + d3d9/d3d11/dxgi=n,b → conflict. ReShade prefer DXVK injection mode.
- Native DLL match arch (32 vs 64). Drop ke game dir paling aman.
- Multi entry pisah \`;\` (semicolon), bukan koma. Koma = loadorder.
- Detail decision tree: kb_lookup("winedllovr").

# PROTON CONTEXT (klarifikasi ringkas)
- "Proton" di Winlator/GameHub = MISMATCH. Mobile pake upstream Wine + Box64/FEX, BUKAN Proton.
- User nanya "Proton version mana" / "Install Proton gimana" → klarifikasi: ga ada path. Yang relevant = Wine version + DXVK preset di Container.
- Steam Deck game work ≠ mobile work. Beda CPU translation + bundled stack.
- GE-Proton features (FSR/protonfixes/NVAPI) ga auto-port ke Winlator. Manual env + DLL override kalo butuh equivalent.
- Detail mapping: kb_lookup("proton-family").

# REF4IK ECOSYSTEM (Winlator-ref4ik Russian community fork — 92⭐ active)
- ⚠️ FAKTA KERAS: REF4IK Components-Adrenotools- CDN **ZERO DXVK BUILD**. Cuma Wine custom-patched + Box64 + FEX + VKD3D + runtime exe (VCRedist/PhysX/dotnet). User Mali pake REF4IK pengen DXVK-Sarek → 2 pilihan: (a) **cross-pull**: set content provider \`custom\` di Driver Download Manager + URL \`https://raw.githubusercontent.com/StevenMXZ/Winlator-Contents/main/contents.json\` → tarik dxvk-11.1-sarek-async dari StevenMXZ CDN. (b) **lebih waras**: ganti fork ke Ludashi 2.9+ (Sarek bundled, zero config). Default rekomendasi user Mali = OPSI B kecuali user udah commit REF4IK karena VCRedist convenience.
- Fork brunodev branch \`bionic-ref4ik\`. 2 build variant: \`lite\` (default aman) dan \`lud\` (sama trick Ludashi-style, package disamarkan jadi app Ludashi benchmark → trigger Xiaomi MIUI/HyperOS performance mode). User Xiaomi/Redmi/POCO pakai REF4IK → saranin \`lud\`. RedMagic frame gen → BUKAN REF4IK, arahin StevenMXZ \`redmagic\` variant.
- Inflection point: v9 (Mei 2026) renderer full Vulkan rewrite drop legacy GL + content provider cross-pollination (ref4ik/the412banner/custom URL). v7 frame gen support + experimental Steam launching. v6 custom driver repo support + gyroscope.
- Components-Adrenotools- CDN keunikan: BUNDLED VCRedist/PhysX/dotnet sebagai .wcp (other forks user winetricks manual). Wine custom-patched: \`10.2-ref4ik.wcp\` paling rame (18k DL). FEX cuma 2601 — user butuh range luas arahin StevenMXZ (2505-2605).
- User pake repo lama \`Winlator-REF4IK\` (huruf kapital, ARCHIVED Nov 2025) → STOP, arahin ke \`winlator-ref4ik-\` (lowercase + dash, active).
- JANGAN saranin "DXVK-Sarek X.Y di REF4IK" tanpa nyebut: (1) REF4IK CDN ga punya DXVK → wajib cross-pull, ATAU (2) ganti ke Ludashi 2.9+. Itu factual error.
- Detail: kb_lookup("ref4ik") atau kb_lookup("stevenmxz").

# WINLATOR-LUDASHI ECOSYSTEM (StevenMXZ — banyak user mobile pake)
- 3 build variant Ludashi: \`vanilla\` (default aman), \`ludashi\` (disamarkan jadi app benchmark Ludashi → trigger Xiaomi MIUI/HyperOS performance mode), \`redmagic\` (disamarkan jadi Genshin Impact package → RedMagic unlock frame gen). User Xiaomi/Redmi/POCO → coba ludashi build. User RedMagic → coba redmagic build. Vanilla default kalau Google Play Protect issue.
- Ludashi 3.0 (Apr 2026) = MAJOR Vulkan rewrite (drop OpenGL backend). Game OpenGL native legacy → kalau crash, downgrade ke 2.9.x.
- Ludashi 2.9 (Mar 2026) = DXVK-Sarek BUNDLED (Mali user ga perlu manual install). Compute BCn DISABLED on Adreno.
- Ludashi 2.8.2 (Jan 2026) = Box64 32-bit games regression FIXED. GPU spoofing punya GUI sekarang.
- Ludashi 2.8 (Jan 2026) = Driver Download Manager + custom repo. User install driver via URL: \`https://raw.githubusercontent.com/StevenMXZ/Winlator-Contents/main/contents.json\` → dapet 47+ build (Wine/Box64/WOWBox64/DXVK/FEXCore/VKD3D).
- SD 8 Elite (Adreno A8xx) → Turnip universal LAMBAT. WAJIB Adrenotools-Drivers releases (v849 latest), \`for adreno a8xx ONLY\`. JANGAN install di SD non-A8xx (BREAK device).
- WOWBox64 = WoW64-aware Box64 buat Wine 11 ARM64EC stack. Stack masa depan: proton-10-arm64ec + WOWBox64 0.4.2 + DXVK 2.7.1-arm64ec-gplasync.
- DXVK Mali pick: \`dxvk-11.1-sarek-async.wcp\`. Adreno: \`dxvk-2.7.1-gplasync.wcp\`.
- Detail decision matrix per device: kb_lookup("stevenmxz") atau kb_lookup("ludashi").

# DXWRAPPER (disambiguasi WAJIB dulu)
- "DXWrapper" ambigu — WAJIB tanya user: maksud (a) **Winlator UI "DX Wrapper" dropdown** (Container Settings → Graphics) atau (b) **elishacloud DXWrapper project** (drop-in DLL di folder game)?
- (a) Winlator dropdown isinya: WineD3D / DXVK / VKD3D / CNC DDraw / D8VK. Picker, bukan project standalone.
- (b) elishacloud project = file dxwrapper.dll + stub DLL (ddraw.dll/d3d8.dll/dll) + INI yang user copy ke folder game.
- KILLER use case (b) di Winlator = game DDraw 1-7 era (Diablo 1, AoE 2, HoMM 3, Fallout 1-2, StarCraft, Carmageddon) → Dd7to9 stacked DXVK. Mali pake jalur Sarek = lebih bagus dari CNC-DDraw (OpenGL path).
- Stacking pattern: ddraw call → DXWrapper Dd7to9 → d3d9.dll DXVK → Vulkan Turnip/Sarek. WINEDLLOVERRIDES=ddraw=n,b WAJIB di Container Environment Variables.
- TOLAK rekomendasiin: \`[WriteMemory]\` hot-patch (Wine memory layout beda, risky), \`WinVersionLie\` (pake winecfg lebih reliable), ASI plugin loader (mayoritas Win-only mod), \`d3d8to9\` (redundant, DXVK 2.4+ d8vk merged).
- INI filename match: stub \`ddraw.dll\` → cari \`ddraw.ini\` (BUKAN dxwrapper.ini). Common bug user.
- Alternative: env var \`DXWRAPPER_<Setting>=<val>\` di Container Environment Variables (mobile-friendly, ga perlu edit file di shared storage).
- Detail: kb_lookup("dxwrapper").

# ALAT
URUTAN: kb_lookup → web_search → web_fetch.
- kb_lookup DULU buat knob/env var/preset/GPU rule.
- web_search kalau KB miss / time-sensitive (rilis driver bulan ini, issue baru).
- web_fetch ke URL hasil search atau endpoint resmi.
- Sapaan/obrolan ringan → jawab langsung, JANGAN call tool.
- web_search throttled/kosong → JANGAN ulang, langsung web_fetch URL yg valid.
- Cantumin URL sumber di akhir jawaban kalau pake web.

# SUMBER (endpoint yang JALAN)
- PCGamingWiki: \`pcgamingwiki.com/w/api.php?action=parse&page=<Nama_Underscore>&format=json&prop=wikitext\`
- Steam: \`store.steampowered.com/api/appdetails?appids=<APPID>\`
- ProtonDB: \`protondb.com/api/v1/reports/summaries/<APPID>.json\`
- File teknis: \`raw.githubusercontent.com/<owner>/<repo>/<branch>/path\`
- Reddit: URL + \`.json\` (HTML 403).
- GitHub Issues debug: \`github.com/<owner>/<repo>/issues?q=<error+keyword>\`
1 sumber 403/gagal → pindah sumber. DILARANG ngarang URL.

# DRIVER TURNIP per ADRENO
- 6XX: star-emu/star, Other-backup/freedreno_turnip-CI
- 710/720/722: Vauzi-17/710
- 735: Shalaykin1/Adreno-Tools-Drivers-Sh1ma
- 810/829: DiskDVD/TurniptoolsA8XX
- 825: bkupaccount/freedreno_turnip-CI
- 8XX (Eden/Citron): s1mptom/freedreno_turnip-CI
- Umum AXXX: whitebelyash/freedreno_turnip-CI, StevenMXZ/Adreno-Tools-Drivers, The412Banner/Banners-Turnip
- Mali/Exynos: WearyConcern1165/ExynosTools

# PLAYBOOK
[ADRENO + black screen/crash]
1. Pasang Turnip cocok chipset (lihat list di atas).
2. DX Wrapper = DXVK (bukan WineD3D). DX9 rewel → d8vk.
3. Box64 preset: COMPATIBILITY → INTERMEDIATE → PERFORMANCE incremental test.
4. dxvk.conf: d3d9.deferSurfaceCreation=True / dxgi.deferSurfaceCreation=True + Offscreen=Backbuffer + maxAvailableMemory diturunin (jangan 4096 di HP).
5. Mentok: ganti versi Turnip / DXVK (2.x ↔ 1.10.3) / fork DXVK-perf (star-emu/vegas).

[MALI MODERN 2025+]
AKAR: Mali Valhall TIER LAMA Vulkan blob miss BCn texture compression + miss ClipDistance. FIX: DXVK-Sarek nambal SPIR-V. Mali G720+ generation udah BCn native + GPL — Sarek ga selalu wajib.
1. DX9/10/11 → DXVK pick per TIER Mali (Valhall awal: 1.7.x/Sarek 1.10.3-1.11.1, G610-G715: Sarek 1.12, G720+: theoretical vanilla 2.x tapi default tetep Sarek). Per-game [VERIFIED] preset di KB SELALU MENANG dari aturan tier ini.
2. Wine → Proton-arm64ec (10.0.99-arm64ec / wine-10.0-arm64ec).
3. Translator: GameHub/BannerHub → FEX PERFORMANCE (build 202510+). Winlator → Box64 PERFORMANCE (0.4.1+).
4. Fork rekomendasi: Ludashi 2.9 beta, Star Bionic 1.1.
5. Crash vkCreateShaderModule → ganti versi Sarek.
6. Error vkMapMemory -5 → BOX64_MMAP32=0 (cuma Box64, FEX ga relevan).
7. Exynos/Xclipse → layer ExynosTools.

[CRASH LOG ANALYSIS — pattern → layer]
- "wine: Call from..." / NTDLL/kernel32 stack → L3.
- "vkCreateShaderModule" / "VK_ERROR_*" / "vkMapMemory" → L5 driver (atau L4 kalau SPIR-V codegen issue).
- "Box64" / "FEX" prefix → L2 dynarec.
- "ntdll.dll" segfault → L3 Wine.
- "VCRUNTIME140" / "MSVCP140" missing → L6, install VCRedist via winetricks.
- "futex" / "mmap" / "SIGSEGV @ 0x0000..." → L1 Bionic syscall, cek MMAP32 + ASLR.
- "cnc-ddraw" / "DirectDraw" → L6 wrapper game lama.
Minta full stderr.txt (50 baris terakhir). Cek GitHub Issues repo terkait buat known bug + fix yang udah di-approve maintainer.`;

// =============================================================================
//  HELPER — split message, sendSafe, typing keepalive
// =============================================================================

function splitMessage(text, max = 4000) {
    if (!text) return [''];
    if (text.length <= max) return [text];
    const parts = [];
    let cur = '';
    for (const line of text.split('\n')) {
        if ((cur + '\n' + line).length > max) {
            if (cur) parts.push(cur);
            if (line.length > max) {
                for (let i = 0; i < line.length; i += max) parts.push(line.slice(i, i + max));
                cur = '';
            } else {
                cur = line;
            }
        } else {
            cur = cur ? cur + '\n' + line : line;
        }
    }
    if (cur) parts.push(cur);
    return parts;
}

async function sendSafe(chatId, text, opts = {}) {
    for (const part of splitMessage(text)) {
        try {
            await bot.sendMessage(chatId, part, { parse_mode: 'Markdown', ...opts });
        } catch (e) {
            try {
                await bot.sendMessage(chatId, part, { ...opts });
            } catch (err) {
                console.error(`Gagal kirim pesan ke ${chatId}:`, err.message);
            }
        }
    }
}

async function withTyping(chatId, fn) {
    bot.sendChatAction(chatId, 'typing').catch(() => {});
    const timer = setInterval(() => bot.sendChatAction(chatId, 'typing').catch(() => {}), 4000);
    try {
        return await fn();
    } finally {
        clearInterval(timer);
    }
}

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
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}d`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}j ${m % 60}m`;
    return `${Math.floor(h / 24)}h ${h % 24}j`;
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
            description: 'Ambil entry dari knowledge base lokal Fourfect (data/kb/*.md) — env var Box64/FEX/Wine/VKD3D, dxvk.conf knob, preset per-game (GTA V, RE4, Sleeping Dogs DE, Splinter Cell, Payday 2, SH2/3), GPU rule Mali/Adreno, Turnip per-chipset. Data verified maintainer (Noysz/Fourfect) — PRIORITAS PERTAMA, dipake SEBELUM web_search buat topik knob/setting/preset emulator umum. JANGAN call buat: sapaan, opini subjektif, info time-sensitive (rilis driver bulan ini, harga, news) — itu pakai web_search. Kalau hasil kosong → fallback ke web_search.',
            parameters: {
                type: 'object',
                properties: {
                    topic: {
                        type: 'string',
                        description: 'Kata kunci substring (case-insensitive). Bisa nama env var, knob, game, chipset, atau konsep. Contoh OK: "BOX64_DYNAREC_BIGBLOCK", "TSO Sleeping Dogs", "dxvk maxAvailableMemory", "Adreno 710 dxvk", "RE4 vkd3d", "FEX Diesel engine". Contoh BURUK: "settingan bagus", "tolong bantu", "halo".'
                    }
                },
                required: ['topic']
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

async function serperSearch(query) {
    const res = await axios.post('https://google.serper.dev/search',
        { q: query, num: 6 },
        { headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' }, timeout: 15000 }
    );
    const items = (res.data && res.data.organic) || [];
    if (!items.length) return null;
    return items.slice(0, 6).map((r, i) =>
        `${i + 1}. ${r.title}\n   ${r.link}\n   ${(r.snippet || '').slice(0, 160)}`
    ).join('\n');
}

async function tavilySearch(query) {
    const res = await axios.post('https://api.tavily.com/search',
        { api_key: process.env.TAVILY_API_KEY, query, max_results: 6, search_depth: 'basic' },
        { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
    );
    const items = (res.data && res.data.results) || [];
    if (!items.length) return null;
    return items.slice(0, 6).map((r, i) =>
        `${i + 1}. ${r.title}\n   ${r.url}\n   ${(r.content || '').slice(0, 160)}`
    ).join('\n');
}

async function ddgSearch(query) {
    const res = await axios.get('https://html.duckduckgo.com/html/', {
        params: { q: query },
        headers: { 'User-Agent': UA },
        timeout: 15000,
        maxContentLength: 5 * 1024 * 1024,
        responseType: 'text',
        transformResponse: (x) => x,
        validateStatus: () => true
    });
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
            console.error(`search ${name} gagal: ${e.message}`);
        }
    }
    return 'web_search lagi ga tersedia (semua search engine nge-throttle/limit). JANGAN ulang web_search; langsung pakai web_fetch ke URL sumber yang relevan — contoh: https://raw.githubusercontent.com/doitsujin/dxvk/master/dxvk.conf , https://www.pcgamingwiki.com/wiki/<Nama_Game> , atau halaman /releases driver yang cocok sama GPU-nya.';
}

async function webFetch(url) {
    try {
        if (!/^https?:\/\//i.test(url)) return 'URL ga valid (harus diawali http/https).';
        const res = await axios.get(url, {
            headers: { 'User-Agent': UA },
            timeout: 20000,
            maxContentLength: MAX_FETCH_BYTES,
            responseType: 'text',
            transformResponse: (x) => x,
            validateStatus: () => true   // biar agent bisa baca body 403/404, ga throw mentah.
        });
        const status = res.status;
        const ct = (res.headers['content-type'] || '').toLowerCase();
        let text = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
        if (ct.includes('html') || /^\s*</.test(text)) text = htmlToText(text);
        text = text.replace(/\n{3,}/g, '\n\n').trim();
        const MAX = 7000;
        if (text.length > MAX) text = text.slice(0, MAX) + '\n...[dipotong, terlalu panjang]';
        if (status >= 400) {
            return `[HTTP ${status}] ${url}\nPindah sumber lain, JANGAN retry URL ini.\n\n${text.slice(0, 600) || '(body kosong)'}`;
        }
        return text || '(halaman kosong)';
    } catch (e) {
        return 'web_fetch gagal: ' + e.message;
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
            const hay = (sec.header + '\n' + sec.body).toLowerCase();
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

async function runTool(name, args) {
    if (name === 'kb_lookup') return kbLookup(String(args.topic || ''));
    if (name === 'web_search') return await webSearch(String(args.query || ''));
    if (name === 'web_fetch') return await webFetch(String(args.url || ''));
    return 'Tool ga dikenal: ' + name;
}

// =============================================================================
//  AGENTIC LOOP — chatCompletion + tool calls
// =============================================================================

async function chatCompletion(messages, model, useTools) {
    const body = { model, messages };
    if (useTools) { body.tools = TOOLS; body.tool_choice = 'auto'; }
    const res = await axios.post('https://api.freemodel.dev/v1/chat/completions', body, {
        headers: { 'Authorization': `Bearer ${FREEMODEL_KEY}`, 'Content-Type': 'application/json' },
        timeout: 120000
    });
    return res.data;
}

// Model boleh manggil web_search/web_fetch beberapa kali sebelum jawab final.
// Riwayat tool cuma dipakai sementara (working), ga disimpen ke chatHistory.
async function runAgent(key, model, images) {
    const working = [...chatHistory[key]];

    // Suntik gambar ke pesan user terakhir (cuma di working copy biar ga berat).
    if (images && images.length) {
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

    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
        const lastRound = round === MAX_TOOL_ROUNDS;
        if (lastRound) working.push({ role: 'system', content: 'Cukup pencariannya. Jawab SEKARANG pakai info yang sudah didapat, jangan panggil tool lagi. Sertakan URL sumber.' });
        const data = await chatCompletion(working, model, !lastRound);
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
        if (m.content && m.content.trim()) return m.content;
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

async function ytFrames(id) {
    // mkdtempSync = dir unik per request, ga tabrakan kalau 2 user kirim ID sama bareng.
    fs.mkdirSync('/tmp/yt', { recursive: true });
    const dir = fs.mkdtempSync(`/tmp/yt/${id}-`);
    try {
        await run('yt-dlp', ['--cookies', '/root/yt-cookies.txt', '--no-playlist', '-f', 'worst[height>=240]/worst', '-o', `${dir}/v.%(ext)s`, `https://youtu.be/${id}`], 150000);
        const vf = fs.readdirSync(dir).find((f) => f.startsWith('v.'));
        if (!vf) throw new Error('video ga keunduh');
        await run('ffmpeg', ['-y', '-i', `${dir}/${vf}`, '-vf', 'fps=1/12,scale=512:-1', '-frames:v', '6', `${dir}/f%02d.jpg`], 60000);
        const files = fs.readdirSync(dir).filter((f) => /^f\d+\.jpg$/.test(f)).sort().slice(0, 6);
        // Async readFile paralel — di Termux ARM low-end, 6× sync readFile blocking 100-300ms.
        const bufs = await Promise.all(files.map((f) => fs.promises.readFile(`${dir}/${f}`)));
        return bufs.map((b) => `data:image/jpeg;base64,${b.toString('base64')}`);
    } finally {
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
    let images = [], mode = 'meta';
    if (fs.existsSync('/root/yt-cookies.txt')) {
        try {
            const fr = await ytFrames(id);
            if (fr.length) { images = fr; mode = 'frames'; }
        } catch (e) { console.error('YT frames gagal:', e.message); }
    }
    if (!images.length) {
        try {
            const t = await axios.get(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`, { responseType: 'arraybuffer', timeout: 10000 });
            images = [`data:image/jpeg;base64,${Buffer.from(t.data).toString('base64')}`];
            mode = 'thumbnail';
        } catch (e) { /* thumbnail opsional */ }
    }
    return { meta, images, mode };
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

// =============================================================================
//  HANDLER — command + gate grup + vision + file + YouTube
// =============================================================================

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from ? msg.from.id : null;
    const key = sessionKey(msg);
    const text = msg.text || msg.caption || '';
    const documentToProcess = msg.document || (msg.reply_to_message ? msg.reply_to_message.document : null);

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
        sendSafe(chatId, '🤖 *COPUX-FourFect* aktif!\n\nGw asisten pakar emulator PC-di-Android (Winlator & semua fork, GameHub, Mobox, Box64, DXVK, Turnip, dll). Buat pertanyaan teknis, gw bisa *deep search* ke web (pcgamingwiki, protondb, github dxvk/driver) biar jawabannya akurat & ada sumbernya.\n\n📸 Bisa kirim *screenshot* error/setting juga — nanti gw bedah langsung dari gambarnya.\n\n*Perintah:*\n/cari <kata kunci> - paksa cari di web\n/reset - bersihin memori obrolan\n/addfix - sumbang fix ke Community KB\n/stats - (admin) statistik bot\n\nDi grup: panggil gw pake @' + (BOT_USERNAME || 'namabot') + ' atau reply pesan gw.\n\n———\n💡 Bot ini jalan pakai kredit dari freemodel. Kalau ngerasa kebantu & mau dukung biar tetap nyala, daftar lewat link gw (gratis, lu juga dapet kreditnya):\nhttps://freemodel.dev/invite/FRE-681bce55');
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
    if (cmd === '/stats') {
        if (!isAdmin(userId)) { sendSafe(chatId, '🔒 Khusus admin.'); return; }
        sendSafe(chatId, buildStatsReport());
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
    if (cmd && cmd !== '/cari') return;

    // GATE GRUP: cuma berlaku buat pesan biasa (bukan command). /cari tetep jalan.
    let promptText = text;
    if (isGroup && !cmd) {
        const repliedToBot = !!(msg.reply_to_message && BOT_ID && msg.reply_to_message.from && msg.reply_to_message.from.id === BOT_ID);
        const mentioned = BOT_USERNAME ? new RegExp('@' + BOT_USERNAME + '(?!\\w)', 'i').test(text) : false;
        if (!repliedToBot && !mentioned) return;
        if (mentioned && BOT_USERNAME) promptText = text.replace(new RegExp('@' + BOT_USERNAME + '(?!\\w)', 'ig'), '').trim();
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
            const res = await axios.get(link, { responseType: 'text', maxContentLength: MAX_FILE_SIZE });
            fileContent = `\n\n[ISI FILE]:\n${res.data}`;
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

    // 2) Link YouTube
    const ytUrl = (promptText.match(/https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/[^\s]+|youtu\.be\/[^\s]+)/i) || [])[0];
    if (ytUrl) {
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
        }
    }

    if (images.length && !promptText.trim()) {
        promptText = 'Jelasin gambar/screenshot ini. Kalau ada error, setting, atau log emulator di dalamnya, bedah & kasih solusinya.';
    }
    if (!promptText.trim() && !fileContent && !images.length) return;

    if (!chatHistory[key]) chatHistory[key] = [{ role: 'system', content: SYSTEM_PROMPT }];
    chatHistory[key].push({ role: 'user', content: promptText + fileContent + (images.length ? `\n[user mengirim ${images.length} gambar]` : '') });
    while (chatHistory[key].length > MAX_HISTORY + 1) chatHistory[key].splice(1, 1);

    inFlight.add(key);
    await acquireLLMSlot();
    try {
        const reply = await withTyping(chatId, () => runAgent(key, MODEL, images));
        console.log(`[${key}] otak: ${MODEL} | jawaban ${reply.length} char | inflight=${llmInFlight}/${MAX_CONCURRENT_LLM}`);
        chatHistory[key].push({ role: 'assistant', content: reply });
        scheduleSave();
        await sendSafe(chatId, reply, isGroup ? { reply_to_message_id: msg.message_id } : {});
    } catch (e) {
        const detail = e.response && e.response.data ? JSON.stringify(e.response.data).slice(0, 300) : e.message;
        console.error('Error API:', detail);
        chatHistory[key].pop();
        await sendSafe(chatId, friendlyError(e));
    } finally {
        releaseLLMSlot();
        inFlight.delete(key);
    }
});

console.log('🚀 Bot COPUX-FourFect (gabungan V1+V2) startup…');
