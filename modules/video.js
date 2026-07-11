// =============================================================================
//  modules/video.js — video/YouTube "nonton" pipeline (di-extract dari bot.js).
//  run (exec ffmpeg/ffprobe/whisper/yt-dlp), semaphore, extractFrames,
//  extractAudioTranscript, processVideoFile, _isAllowedVideoUrl (SSRF-gated),
//  processVideoUrl, ytFrames, processYouTube. Fungsi di-copy VERBATIM.
//  ⚠️ EXEC (child_process) + SSRF (_isAllowedVideoUrl -> webTools._resolveSafeUrl)
//     + network (axios oembed/thumbnail). Konstanta baca process.env langsung
//     (self-contained, identik bot.js). webTools di-require langsung (singleton,
//     di-init dari bot.js) — _isAllowedVideoUrl tetap verbatim, no init perlu.
// =============================================================================

const { execFile } = require('child_process');
const axios = require('axios');
const fs = require('fs');
const webTools = require('./web-tools');

const MAX_AUDIO_SEC = parseInt(process.env.MAX_AUDIO_SEC || '180', 10);            // cap durasi transcribe = bound OOM/runtime
const YTDLP_TIMEOUT_MS = parseInt(process.env.YTDLP_TIMEOUT_MS || '120000', 10);
const WHISPER_TIMEOUT_MS = parseInt(process.env.WHISPER_TIMEOUT_MS || '180000', 10);
const WHISPER_BIN = process.env.WHISPER_BIN || '/root/whisper.cpp/build/bin/whisper-cli';
const WHISPER_MODEL = process.env.WHISPER_MODEL || '/root/whisper.cpp/models/ggml-base.bin';
const MAX_TRANSCRIPT_CHARS = parseInt(process.env.MAX_TRANSCRIPT_CHARS || '4000', 10);
// Semaphore kecil: cap kerja ffmpeg/whisper paralel biar 3 video bareng ga peg CPU Termux.
const MAX_CONCURRENT_VIDEO = Math.max(1, parseInt(process.env.MAX_CONCURRENT_VIDEO || '1', 10));
// Allowlist host video non-YT (selain ekstensi langsung). Konservatif — bukan "any URL".
const VIDEO_HOST_ALLOWLIST = (process.env.VIDEO_HOST_ALLOWLIST ||
    'tiktok.com,vt.tiktok.com,vm.tiktok.com,vimeo.com,streamable.com,twitter.com,x.com,instagram.com,reddit.com,v.redd.it')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

// ===================== VERBATIM bot.js 1290-1457 ============================
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
    const safe = await webTools._resolveSafeUrl(rawUrl);
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


// Status semaphore video (dipakai buildStatusReport bot.js — dulu baca var langsung).
function statusLine() {
    return `Video: ${videoInFlight}/${MAX_CONCURRENT_VIDEO}, wait ${videoWaiters.length}`;
}

module.exports = { processVideoFile, processVideoUrl, processYouTube, _isAllowedVideoUrl, statusLine };
