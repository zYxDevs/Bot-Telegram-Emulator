// =============================================================================
//  modules/llm-parse.js — parsing output LLM mentah (di-extract dari bot.js).
//  stripThink: buang <think>/<function>/<tool_call> noise sebelum kirim ke user.
//  parseTextToolCalls: tangkap tool-call yg dibalikin sbg TEKS inline (bukan
//    field structured), whitelist tool COPUX. Dua-duanya PURE (input->output,
//    no state, no dep) — ga perlu init(). ⚠️ parseTextToolCalls = agentic-tool-path.
// =============================================================================

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
    const known = new Set(['kb_lookup', 'kb_search', 'kb_rag_search', 'web_search', 'web_fetch']);
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

module.exports = { stripThink, parseTextToolCalls };
