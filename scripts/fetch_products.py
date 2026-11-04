"""Snapshot Varilumi products that support the switch-dimming functions shown in the simulator.

Writes public/data/products.json grouped by fixture type, with which demo functions each product supports.
Run again any time to refresh prices / products:
  python3 scripts/fetch_products.py
"""
import html
import json
import os
import re
import urllib.request

API = "https://varilumi.com/wp-json/wc/store/v1/products?per_page=100&page={}"
FIXTURES = {24: "recessed", 27: "track", 25: "ceiling"}       # 崁燈 / 軌道燈 / 吸頂燈
EXCLUDE = re.compile(r"遙控|WiFi|0 ?/ ?1-10V|植物|彩色|軌道-1公尺|對接頭|吸頂小軌道|組|入")
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "data", "products.json")


def fetch_all():
    items, page = [], 1
    while True:
        with urllib.request.urlopen(API.format(page), timeout=30) as r:
            batch = json.load(r)
        if not batch:
            return items
        items += batch
        page += 1


def www(url):
    return url.replace("://varilumi.com", "://www.varilumi.com")


def main():
    out = {"recessed": [], "track": [], "ceiling": []}
    for p in fetch_all():
        name = html.unescape(p["name"])
        cats = {c["id"] for c in p["categories"]}
        fixture = next((FIXTURES[c] for c in FIXTURES if c in cats), None)
        if not fixture or EXCLUDE.search(name) or 89 in cats:   # 89 = 軌道配件
            continue
        if "調光型" in name:
            dim_opts = {t["name"] for a in p["attributes"] if a["name"] == "調光功能" for t in a["terms"]}
            funcs = [f for f, label in (("four-step", "經典四段調光"), ("stepless", "經典無段調光")) if label in dim_opts or not dim_opts]
        elif "調色型" in name:
            funcs = ["tri-color-night"]
        else:
            continue
        if not funcs:
            continue
        pr = p["prices"]
        price = int(pr["price"]) // (10 ** pr.get("currency_minor_unit", 0)) if pr.get("price") else None
        img = p["images"][0] if p["images"] else None
        out[fixture].append({
            "id": p["id"],
            "name": re.sub(r"\s+", " ", name).strip(),
            "price": price,
            "image": www(img["thumbnail"]) if img else None,
            "link": www(p["permalink"]),
            "functions": funcs,
        })
    for k in out:
        out[k].sort(key=lambda x: (x["price"] or 0))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=1)
    print({k: len(v) for k, v in out.items()})


if __name__ == "__main__":
    main()
