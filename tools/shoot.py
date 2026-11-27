"""Play-test GIBLET'S GREAT ESCAPE in headless Chromium: load each ?shot= scene,
collect console/page errors, wait for __shotReady, screenshot to the given out dir.
Run with PYTHONPATH=/home/hatch/.local/lib/python3.12/site-packages.
Usage: python3 tools/shoot.py <outdir> [name-substring] [--port 8080]"""
import json
import os
import sys

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = json.load(open(os.path.join(ROOT, "shots.json")))
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/giblet-shots"
ONLY = sys.argv[2] if len(sys.argv) > 2 and not sys.argv[2].startswith("--") else ""
PORT = 8080
for a in sys.argv[1:]:
    if a.startswith("--port="):
        PORT = int(a.split("=", 1)[1])

BASE = f"http://localhost:{PORT}"
os.makedirs(OUT, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(args=[
        "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
        "--disable-gpu-sandbox", "--no-sandbox",
    ])
    for shot in SHOTS:
        if ONLY and ONLY not in shot["name"]:
            continue
        page = browser.new_page(viewport={"width": 1280, "height": 720})
        errors = []
        page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type in ("error", "warning") else None)
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        page.on("requestfailed", lambda r: errors.append(f"reqfail: {r.url} {r.failure}"))
        url = BASE + "/" + shot["query"]
        page.goto(url, wait_until="load")
        try:
            page.wait_for_function("window.__shotReady === true", timeout=30000)
        except Exception as e:
            errors.append(f"TIMEOUT waiting __shotReady: {e}")
        page.wait_for_timeout(400)
        state = page.evaluate("""() => {
            if (window.__shotState) return window.__shotState;
            const w = window.__world;
            if (!w) return {noWorld: true, shotReady: window.__shotReady};
            return {screen: w.screen, score: w.score, lives: w.lives,
                    dist: w.distanceM.toFixed(0), dash: w.dash.toFixed(2),
                    farmerGap: w.farmerGap.toFixed(0), over: w.over};
        }""")
        print(f"== {shot['name']} {shot['query']} -> {json.dumps(state)}")
        for e in errors:
            print(f"   ERR {e}")
        page.screenshot(path=f"{OUT}/{shot['name']}", type="jpeg", quality=82)
        page.close()
    browser.close()
print("done")
