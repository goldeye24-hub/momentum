#!/usr/bin/env python3
"""Update the static Momentum Insights official-news section from official RSS.
Uses stdlib only; source article titles and dates are preserved; never fabricates news
or client performance. Github Action writes to the preview branch only until merged.
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
from html import escape, unescape
from pathlib import Path
from urllib.parse import urlparse, urljoin
from urllib.request import Request, urlopen
import json
import re
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "insights" / "index.html"
DATA = ROOT / "insights" / "official-news.json"
SOURCES = [
    ("Google Ads", "google", "https://blog.google/products/ads-commerce/rss/", ("blog.google",)),
    ("Google 검색센터", "seo", "https://developers.google.com/search/blog/feed.xml", ("developers.google.com",)),
    ("Meta for Business", "sns", "https://www.facebook.com/business/news/rss/", ("facebook.com", "www.facebook.com", "about.fb.com")),
]
TOPICS = ("ads", "advertising", "campaign", "business", "commerce", "marketing",
          "search", "seo", "ranking", "search console", "shopping", "reels",
          "instagram", "creator", "content", "measurement", "conversion",
          "budget", "bidding", "performance max", "demand gen",
          "AI Max", "google ads", "social media", "generative ai")
BAD_TOPICS = ("ai glasses", "eyewear", "headset", "data center", "ray-ban", "meta quest", "ray ban")
START = "<!-- NEWS_ITEMS_START -->"
END = "<!-- NEWS_ITEMS_END -->"
MAX_AGE = timedelta(days=120)
ATOM = "{http://www.w3.org/2005/Atom}"
DATE_FMT = "%Y-%m-%d"

def child_text(node, *names):
    for name in names:
        element = node.find(name)
        if element is not None and element.text:
            return " ".join(element.text.split())
    return ""

def get_link(item, base):
    link = item.find("link")
    if link is not None:
        value = (link.text or "").strip() or link.attrib.get("href", "").strip()
        if value:
            return urljoin(base, value)
    for link in item.findall(ATOM + "link"):
        if link.attrib.get("rel", "alternate") == "alternate":
            return urljoin(base, link.attrib.get("href", ""))
    return ""

def parse_date(value):
    if not value:
        return None
    try:
        value = value.strip()
        if re.match(r"^\d{4}-", value):
            date = datetime.fromisoformat(value.replace("Z", "+00:00"))
        else:
            date = parsedate_to_datetime(value)
        return date.replace(tzinfo=timezone.utc) if date.tzinfo is None else date.astimezone(timezone.utc)
    except (TypeError, ValueError, OverflowError):
        return None

def appropriate(title, category):
    text = title.lower()
    if any(term in text for term in BAD_TOPICS):
        return False
    if category == "seo":
        return True
    return any(term.lower() in text for term in TOPICS)

def safe_url(url, domains):
    parsed = urlparse(url)
    hostname = (parsed.hostname or "").lower()
    if parsed.scheme != "https" or not hostname:
        return False
    return any(hostname == host or hostname.endswith("." + host) for host in domains)

def pull(source, now):
    label, category, address, domains = source
    req = Request(address, headers={"User-Agent": "MomentumMarketingInsights/1.0 (+official-feed-aggregation)",
                                   "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml"})
    with urlopen(req, timeout=18) as response:
        raw = response.read(2_000_001)
    if len(raw) > 2_000_000:
        raise ValueError("feed too large")
    root = ET.fromstring(raw)
    nodes = root.findall("./channel/item") if root.tag.lower().endswith("rss") else root.findall(ATOM + "entry")
    results = []
    for item in nodes:
        title = unescape(child_text(item, "title", ATOM+"title"))
        date = parse_date(child_text(item, "pubDate", "{http://purl.org/dc/elements/1.1/}date", ATOM+"published", ATOM+"updated"))
        url = get_link(item, address)
        if not title or len(title) > 230 or not date or not safe_url(url, domains):
            continue
        if date > now + timedelta(days=1) or (now - date) > MAX_AGE or not appropriate(title, category):
            continue
        results.append({"title":title,"date":date.strftime(DATE_FMT),"url":url,
                        "source":label,"category":category})
    print(f"{label}: {len(results)} relevant official entries")
    return results

def card(item):
    title, date, label = (escape(item[k], quote=True) for k in ("title", "date", "source"))
    url, category = escape(item["url"], quote=True), escape(item["category"], quote=True)
    return (f'<article class="news" data-category="{category}">'
            f'<div class="news-source">{label} · 공식 발표 <time datetime="{date}">{date}</time></div>'
            f'<h3>{title}</h3><p>플랫폼 공식 발표입니다. 세부 내용과 적용 대상·일정은 원문에서 확인하세요.</p>'
            f'<a class="source-link" href="{url}" target="_blank" rel="noopener noreferrer">'
            f'원문 확인하기 <span aria-hidden="true">↗</span></a></article>')

def main():
    page = PAGE.read_text("utf-8")
    if START not in page or END not in page:
        raise RuntimeError("Missing news update markers")
    now = datetime.now(timezone.utc)
    collected = []
    for source in SOURCES:
        try:
            collected.extend(pull(source, now))
        except Exception as exc:
            print(f"SKIP {source[0]}: {exc.__class__.__name__}: {exc}", file=sys.stderr)
    if not collected:
        print("No verified feed items. Existing news unchanged.")
        return 0
    seen = set()
    items = []
    for entry in sorted(collected, key=lambda e:(e["date"], e["source"], e["url"]), reverse=True):
        canonical = (entry["url"].split("?")[0].rstrip("/"), entry["title"].casefold())
        if canonical in seen:
            continue
        seen.add(canonical)
        items.append(entry)
        if len(items) >= 18:
            break
    if len(items) < 1:
        return 0
    news = "\n".join(card(item) for item in items)
    before, rest = page.split(START, 1)
    old, after = rest.split(END, 1)
    updated = before + START + "\n" + news + "\n" + END + after
    if updated != page:
        PAGE.write_text(updated, "utf-8")
    serialized = json.dumps({"verifiedAtUTC":now.isoformat(timespec="seconds"),
                             "sourceCount":len({i["source"] for i in items}),"items":items},
                            ensure_ascii=False, indent=2) + "\n"
    # Avoid redeploying daily without a new headline: recorded verification time is not published.
    existing = None
    if DATA.exists():
        try:
            existing = json.loads(DATA.read_text("utf-8"))
        except (ValueError, OSError):
            pass
    if not existing or existing.get("items") != items:
        DATA.write_text(serialized,"utf-8")
    print(f"Rendered {len(items)} official items. No auto-generated article summaries.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
