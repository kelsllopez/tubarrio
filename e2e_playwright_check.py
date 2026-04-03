import json

from playwright.sync_api import sync_playwright


def main() -> int:
    url = "http://127.0.0.1:8000/"
    console: list[dict[str, str]] = []
    pageerrors: list[str] = []
    internal: list[str] = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(
            geolocation={"latitude": -33.4489, "longitude": -70.6693},
            permissions=["geolocation"],
        )
        page = ctx.new_page()

        page.on("console", lambda msg: console.append({"type": msg.type, "text": msg.text}))
        page.on("pageerror", lambda err: pageerrors.append(str(err)))

        page.goto(url, wait_until="domcontentloaded", timeout=30_000)
        page.wait_for_selector("#map", timeout=30_000)
        page.wait_for_timeout(1500)

        tiles = page.evaluate(
            "() => ({ tiles: document.querySelectorAll('.leaflet-tile').length, loaded: document.querySelectorAll('.leaflet-tile-loaded').length })"
        )
        markers_initial = page.evaluate("() => document.querySelectorAll('.leaflet-marker-icon').length")

        # open a marker (popup/modal) if any
        if markers_initial > 0:
            try:
                # In headless runs the marker can be technically visible but outside viewport.
                # This click is "best effort" and should not be treated as a page console error.
                page.evaluate(
                    "() => { const el = document.querySelector('.leaflet-marker-icon'); if(el) el.scrollIntoView({block:'center', inline:'center'}); }"
                )
                page.click(".leaflet-marker-icon", timeout=5000)
                page.wait_for_timeout(500)
            except Exception as e:  # noqa: BLE001
                internal.append(f"marker click failed (headless limitation): {e}")

        # filter: comida
        try:
            page.click("text=Comida", timeout=5000)
            page.wait_for_timeout(800)
        except Exception as e:  # noqa: BLE001
            console.append({"type": "warning", "text": f"filter Comida click failed: {e}"})

        markers_after_filter = page.evaluate("() => document.querySelectorAll('.leaflet-marker-icon').length")

        # search
        list_before_search = page.evaluate("() => document.querySelectorAll('#panelList .neg').length")
        try:
            page.fill("#searchInput", "a")
            page.wait_for_timeout(600)
        except Exception as e:  # noqa: BLE001
            console.append({"type": "warning", "text": f"search fill failed: {e}"})
        list_after_search = page.evaluate("() => document.querySelectorAll('#panelList .neg').length")
        try:
            page.click("#openPanelBtn", timeout=3000)
            page.wait_for_timeout(300)
        except Exception:
            pass

        # GPS
        try:
            page.click("#gpsBtn", timeout=5000)
            page.wait_for_timeout(1200)
        except Exception as e:  # noqa: BLE001
            console.append({"type": "warning", "text": f"gps click failed: {e}"})

        # allow polling/refresh to run
        page.wait_for_timeout(2200)
        markers_after_wait = page.evaluate("() => document.querySelectorAll('.leaflet-marker-icon').length")
        list_after_gps = page.evaluate("() => document.querySelectorAll('#panelList .neg').length")

        out = {
            "url": url,
            "tiles": tiles,
            "markers_initial": markers_initial,
            "markers_after_filter": markers_after_filter,
            "markers_after_wait": markers_after_wait,
            "list_before_search": list_before_search,
            "list_after_search": list_after_search,
            "list_after_gps": list_after_gps,
            "pageerrors": pageerrors,
            "console": console,
            "internal_warnings": internal,
        }
        print(json.dumps(out, ensure_ascii=False, indent=2))

        ctx.close()
        browser.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

