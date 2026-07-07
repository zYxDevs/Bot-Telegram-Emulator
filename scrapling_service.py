#!/usr/bin/env python3
"""
COPUX scrapling web-fetch microservice.

Localhost-only (127.0.0.1) HTTP service yang dipanggil bot.js webFetch buat
nembus anti-bot/Cloudflare lewat Scrapling. Bot.js TETEP yang jadi otoritas
SSRF (resolve + pin IP + reject private) SEBELUM manggil service ini — service
cuma defense-in-depth: re-reject private IP sendiri biar ga ada single point.

Kontrak: POST /fetch {"url": "...", "ip": "1.2.3.4"} -> {"ok", "status", "text"}
- Ga pernah echo error internal (cuma {"ok": false, "status": 0}) — anti SSRF-probe leak.
- Output di-truncate biar match webFetch MAX.
Run: /root/.venv/bin/python scrapling_service.py
"""
import asyncio
import ipaddress
import re
import urllib.parse
import httpx
import random

from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route

HOST = "127.0.0.1"
PORT = 8765
MAX_CHARS = 7000
FETCH_TIMEOUT_MS = 25000
MAX_CONCURRENT = 3

_sem = asyncio.Semaphore(MAX_CONCURRENT)

def _is_blocked_ip(addr: str) -> bool:
    try:
        ip = ipaddress.ip_address(addr)
    except ValueError:
        return True
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    )

def _extract_text(page) -> str:
    try:
        txt = page.get_all_text(ignore_tags=("script", "style"))
        if txt:
            return txt
    except Exception:
        pass
    try:
        body = page.body
        if body:
            return re.sub(r"<[^>]+>", " ", body)
    except Exception:
        pass
    return ""

async def fetch(request):
    try:
        data = await request.json()
    except Exception:
        return JSONResponse({"ok": False, "status": 0})

    url = (data or {}).get("url")
    if not isinstance(url, str) or not url.lower().startswith("https://"):
        return JSONResponse({"ok": False, "status": 0})

    ip = (data or {}).get("ip")
    if isinstance(ip, str) and ip and _is_blocked_ip(ip):
        return JSONResponse({"ok": False, "status": 0})

    try:
        from scrapling.fetchers import StealthyFetcher
        import anyio

        def _blocking_fetch():
            return StealthyFetcher.fetch(
                url,
                headless=True,
                network_idle=False,
                timeout=FETCH_TIMEOUT_MS,
            )

        async with _sem:
            page = await anyio.to_thread.run_sync(_blocking_fetch)
        status = getattr(page, "status", 0) or 0
        text = _extract_text(page)
        text = re.sub(r"\n{3,}", "\n\n", re.sub(r"[ \t]+", " ", text)).strip()
        if len(text) > MAX_CHARS:
            text = text[:MAX_CHARS] + "\n...[dipotong]"
        return JSONResponse({"ok": True, "status": int(status), "text": text})
    except Exception:
        return JSONResponse({"ok": False, "status": 0})

async def health(request):
    return JSONResponse({"ok": True})

async def fetch_dlc_name_metadata(client: httpx.AsyncClient, dlc_id: int) -> tuple[str, str]:
    dlc_str = str(dlc_id)
    try:
        res = await client.get(f"https://store.steampowered.com/api/appdetails?appids={dlc_str}")
        if res.status_code == 200:
            data = res.json()
            if data and data.get(dlc_str, {}).get("success"):
                raw_name = data[dlc_str]["data"].get("name", f"DLC_Unknown_Asset_{dlc_str}")
                return (dlc_str, raw_name)
    except Exception:
        pass
    return (dlc_str, f"DLC_Unknown_Asset_{dlc_str}")

async def create_asset_mapping(request):
    try:
        data = await request.json()
    except Exception:
        return JSONResponse({"ok": False, "error": "Integritas format payload JSON ditolak."})

    appid = str(data.get("appid", "")).strip()
    if not appid.isdigit():
        return JSONResponse({"ok": False, "error": "Parameter 'appid' I/O tidak valid atau bukan merupakan angka metrik numerik utuh."})

    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            res = await client.get(f"https://store.steampowered.com/api/appdetails?appids={appid}")
            if res.status_code != 200:
                return JSONResponse({"ok": False, "error": f"Kegagalan HTTP {res.status_code}: Repositori publik menolak koneksi transmisi."})
            
            api_data = res.json()
            if not api_data or not api_data.get(appid, {}).get("success"):
                return JSONResponse({"ok": False, "error": "Akses metadata diblokir, atau repositori data untuk ID tersebut tidak eksis."})

            app_data = api_data[appid].get("data", {})
            dlcs = app_data.get("dlc", [])
            
            if not dlcs:
                return JSONResponse({"ok": False, "error": "Tidak terdeteksi adanya pemetaan struktur sub-elemen (DLC) untuk arsitektur aplikasi tersebut."})

            dlcs_limited = dlcs[:15]
            tasks = [fetch_dlc_name_metadata(client, d_id) for d_id in dlcs_limited]
            results = await asyncio.gather(*tasks)

            ini_lines = [
                "[steam]",
                f"appid = {appid}",
                "unlockall = true",
                "orgapi = steam_api_o.dll",
                "orgapi64 = steam_api64_o.dll",
                "extraprotection = false",
                "forceappid = false",
                "",
                "[dlc]"
            ]
            
            for d_id, d_name in results:
                safe_dlc_name = d_name.replace('\n', ' ').replace('\r', '').strip()
                ini_lines.append(f"{d_id} = {safe_dlc_name}")

            if len(dlcs) > 15:
                ini_lines.append(f"; ... [Dipotong: Sisa {len(dlcs)-15} entri lainnya digugurkan demi efisiensi I/O transmisi Telegram]")

            return JSONResponse({
                "ok": True,
                "content": "\n".join(ini_lines)
            })
    except httpx.RequestError as exc:
        return JSONResponse({"ok": False, "error": f"Latensi Sistem Jaringan: {str(exc)}"})
    except Exception as exc:
        return JSONResponse({"ok": False, "error": f"Gangguan Eksekusi Node Internal: {str(exc)}"})

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0"
]

TARGETS = [
    {"name": "SteamRIP", "url": "https://steamrip.com/?s={query}"},
    {"name": "SteamGG", "url": "https://steamgg.net/?s={query}"},
    {"name": "GameBounty", "url": "https://gamebounty.net/?s={query}"},
    {"name": "AnkerGames", "url": "https://ankergames.net/?s={query}"},
    {"name": "UnionCrax", "url": "https://unioncrax.com/?s={query}"}
]

async def _fetch_target(client: httpx.AsyncClient, target: dict, query: str):
    url = target["url"].format(query=urllib.parse.quote(query))
    headers = {"User-Agent": random.choice(USER_AGENTS)}
    
    try:
        res = await client.get(url, headers=headers, follow_redirects=True)
        if res.status_code != 200:
            return target["name"], []
            
        html = res.text
        
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, 'html.parser')
        
        # Tokenisasi query untuk relevancy check
        query_words = [w.lower() for w in query.split() if len(w) > 2]
        if not query_words:
            query_words = [query.lower()]
            
        clean_results = []
        for a in soup.find_all('a'):
            href = a.get('href', '').strip()
            if not href or href.startswith('#') or href.startswith('javascript'):
                continue
                
            title = (a.get('title') or a.text).strip()
            title = re.sub(r'<[^>]+>', '', title).strip()
            if not title:
                continue
                
            # Filter generic links
            href_lower = href.lower()
            if any(x in href_lower for x in ['login', 'register', 'password', 'setting', 'contact', 'about', 'faq', 'term']):
                continue
                
            # Relevancy check: Pastikan judul mengandung kata dari query
            title_lower = title.lower()
            is_relevant = any(w in title_lower for w in query_words)
            if not is_relevant:
                continue
                
            # Make absolute URL (mengatasi relative link SteamRIP)
            base_url = target["url"].split('?')[0]
            absolute_link = urllib.parse.urljoin(base_url, href)
                
            if not any(x['link'] == absolute_link for x in clean_results):
                clean_results.append({"title": title, "link": absolute_link})
                
            if len(clean_results) >= 2:
                break
                
        return target["name"], clean_results
    except Exception as exc:
        return target["name"], []

async def hunt_game_handler(request):
    try:
        data = await request.json()
    except Exception:
        return JSONResponse({"ok": False, "error": "Integritas format payload JSON ditolak."})

    raw_query = str(data.get("query", "")).strip()
    query = re.sub(r'[^\w\s\-\.]', ' ', raw_query).strip()
    if not query:
        return JSONResponse({"ok": False, "error": "Parameter 'query' I/O tidak valid."})

    try:
        async with httpx.AsyncClient(verify=False, timeout=25.0) as client:
            tasks = [_fetch_target(client, t, query) for t in TARGETS]
            results_tuples = await asyncio.gather(*tasks)
            
        grouped = {k: v for k, v in results_tuples if v}
        
        if not grouped:
            return JSONResponse({"ok": True, "content": "❌ Matriks data tidak ditemukan di parameter domain indeks Pre-installed FMHY."})
            
        lines = []
        lines.append("🗃️ [PRE-INSTALLED / PORTABLE DIRECT PLAY INDEX]")
        lines.append("══════════════════════════════════════")
        lines.append(f"🔍 Pencarian Agregasi: `{query}`\n")
        
        for name, items in grouped.items():
            lines.append(f"📦 *{name}*")
            for item in items:
                lines.append(f"🎮 {item['title']}")
                lines.append(f"🔗 {item['link']}\n")
                
        final_content = "\n".join(lines).strip()
        return JSONResponse({"ok": True, "content": final_content})
    except Exception as exc:
        return JSONResponse({"ok": False, "error": f"Gangguan Eksekusi Node Internal: {str(exc)}"})

route_hunt_game = Route("/api/v1/hunt-game", hunt_game_handler, methods=["POST"])

app = Starlette(
    routes=[
        Route("/fetch", fetch, methods=["POST"]),
        Route("/api/v1/asset-mapping", create_asset_mapping, methods=["POST"]),
        route_hunt_game,
        Route("/health", health, methods=["GET"]),
    ]
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=HOST, port=PORT, log_level="warning")
