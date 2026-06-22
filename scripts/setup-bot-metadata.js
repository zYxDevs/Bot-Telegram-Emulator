#!/usr/bin/env node
/**
 * One-off: set bot name, descriptions, dan commands (private + group scope)
 * via Telegram Bot API.
 *
 * Jalan: node scripts/setup-bot-metadata.js
 * Aman di-run berkali-kali (idempotent).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const https = require('https');

const TOKEN = process.env.TELEGRAM_TOKEN;
if (!TOKEN) { console.error('TELEGRAM_TOKEN belum di-set di .env'); process.exit(1); }

const BOT_NAME = 'COPUX • Helper Emulator PC-Android';

const SHORT_DESC =
    'Asisten teknis emulator PC-di-Android: Winlator, GameHub, Box64, DXVK, Turnip. Kirim screenshot/error, gw bedah.';

const LONG_DESC =
`Asisten teknis emulator PC-di-Android.

Spesialis: Winlator (semua fork), GameHub, Mobox, Box64, FEXCore, DXVK, Turnip, Adreno tuning, preset per-game.

Kirim screenshot error/setting/log — bot bedah dari gambarnya. Buat pertanyaan teknis, bot deep-search ke web (pcgamingwiki, protondb, github driver) biar ada sumbernya.

Di grup: mention bot atau reply pesan bot.

/start • /cari • /addfix • /reset`;

// Private chat: full command list (no admin-only)
const COMMANDS_PRIVATE = [
    { command: 'start',  description: 'Intro & info bot' },
    { command: 'cari',   description: 'Paksa cari di web dulu sebelum jawab' },
    { command: 'addfix', description: 'Sumbang fix ke Community KB' },
    { command: 'reset',  description: 'Bersihin memori obrolan' },
];

// Group chat: skip /start (cuma noisy di grup); fokus ke yang relevan
const COMMANDS_GROUP = [
    { command: 'cari',   description: 'Paksa cari di web (mention bot dulu)' },
    { command: 'addfix', description: 'Sumbang fix ke Community KB' },
    { command: 'reset',  description: 'Reset memori bot di grup ini' },
];

function tgApi(method, payload) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(payload);
        const req = https.request({
            method: 'POST',
            hostname: 'api.telegram.org',
            path: `/bot${TOKEN}/${method}`,
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
            timeout: 15000
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.ok) resolve(parsed.result);
                    else reject(new Error(`${method}: ${parsed.description || data}`));
                } catch (e) { reject(new Error(`${method}: parse failed — ${data}`)); }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => req.destroy(new Error('timeout')));
        req.write(body);
        req.end();
    });
}

(async () => {
    const steps = [
        ['setMyName',             { name: BOT_NAME }],
        ['setMyShortDescription', { short_description: SHORT_DESC }],
        ['setMyDescription',      { description: LONG_DESC }],
        ['deleteMyCommands',      { scope: { type: 'default' } }],
        ['setMyCommands',         { commands: COMMANDS_PRIVATE, scope: { type: 'all_private_chats' } }],
        ['setMyCommands',         { commands: COMMANDS_GROUP,   scope: { type: 'all_group_chats' } }],
    ];

    for (const [method, payload] of steps) {
        try {
            await tgApi(method, payload);
            console.log(`✓ ${method}`);
        } catch (e) {
            console.error(`✗ ${method}: ${e.message}`);
            process.exitCode = 1;
        }
    }

    // Verify
    try {
        const me   = await tgApi('getMe', {});
        const desc = await tgApi('getMyDescription', {});
        const sd   = await tgApi('getMyShortDescription', {});
        const cpv  = await tgApi('getMyCommands', { scope: { type: 'all_private_chats' } });
        const cgp  = await tgApi('getMyCommands', { scope: { type: 'all_group_chats' } });
        console.log('\n=== VERIFY ===');
        console.log(`Bot: @${me.username} (id ${me.id}) — name: "${me.first_name}"`);
        console.log(`Short desc (${sd.short_description.length}/120): ${sd.short_description}`);
        console.log(`Long desc (${desc.description.length}/512):\n${desc.description}\n`);
        console.log(`Private commands (${cpv.length}):`);
        cpv.forEach((c) => console.log(`  /${c.command} — ${c.description}`));
        console.log(`Group commands (${cgp.length}):`);
        cgp.forEach((c) => console.log(`  /${c.command} — ${c.description}`));
    } catch (e) {
        console.error(`verify failed: ${e.message}`);
    }
})();
