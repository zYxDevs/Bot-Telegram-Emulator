let bot = null;

function setBotInstance(botInstance) {
    bot = botInstance;
}

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

function escapeSafeMd(text) {
    if (!text) return '';
    return text.toString().replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

module.exports = { setBotInstance, splitMessage, sendSafe, withTyping, escapeSafeMd };
