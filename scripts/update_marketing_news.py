#!/usr/bin/env python3
"""Update the static Momentum Insights official-news section from official RSS.
Uses stdlib only; source article titles and dates are preserved; never fabricates news
or client performance. GitHub Actions may feature at most ONE fresh official item per Korea-local day.
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
MAX_AGE = timedelta(days=45)
MAX_VISIBLE = 12  # Source-link cards only; not indexable scraped article pages.
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
    """Feature at most one NEW, relevant official announcement on any KST date.

    The RSS headline links directly to the original source. This is not an
    automated republication of the original article or an SEO landing page.
    On feed failure / no new trustworthy source, leave the page unchanged.
    """
    page = PAGE.read_text("utf-8")
    if page.count(START) != 1 or page.count(END) != 1:
        raise RuntimeError("Expected exactly one official news update region")
    kst_today = datetime.now(timezone(timedelta(hours=9))).date().isoformat()
    previous = {}
    if DATA.exists():
        try:
            previous = json.loads(DATA.read_text("utf-8"))
        except (ValueError, OSError):
            print("News state unavailable; retain existing live headlines.", file=sys.stderr)
            return 0
    if previous.get("lastAddedKST") == kst_today:
        print("Daily news limit reached for " + kst_today)
        return 0

    history = previous.get("items", [])
    if not isinstance(history, list):
        print("Invalid existing news archive; do not overwrite.", file=sys.stderr)
        return 0
    seen_urls = {
        row.get("url", "").split("?")[0].rstrip("/").casefold()
        for row in history if isinstance(row, dict)
    }
    # Also guard against a curated news story already linked on the page.
    static_news = page.split(START, 1)[0]
    collected = []
    for source in SOURCES:
        try:
            collected.extend(pull(source, datetime.now(timezone.utc)))
        except Exception as exc:
            print(f"SKIP {source[0]}: {exc.__class__.__name__}: {exc}", file=sys.stderr)

    candidates = sorted(collected, key=lambda item: (item["date"], item["source"]), reverse=True)
    chosen = None
    for item in candidates:
        normalized = item["url"].split("?")[0].rstrip("/").casefold()
        if normalized in seen_urls:
            continue
        if escape(item["url"], quote=True) in static_news:
            continue
        chosen = dict(item, addedOnKST=kst_today)
        break
    if chosen is None:
        print("No new verified official announcements; do not publish a placeholder.")
        return 0

    items = [chosen] + [row for row in history if isinstance(row, dict)]
    items = items[:MAX_VISIBLE]
    before, remainder = page.split(START, 1)
    _, after = remainder.split(END, 1)
    updated = before + START + "\n" + "\n".join(card(item) for item in items) + "\n" + END + after
    DATA.parent.mkdir(parents=True, exist_ok=True)
    DATA.write_text(json.dumps({
        "lastAddedKST": kst_today,
        "items": items,
        "notes": "One official headline link per day maximum. Original analysis requires editorial approval.",
    }, ensure_ascii=False, indent=2) + "\n", "utf-8")
    if updated != page:
        PAGE.write_text(updated, "utf-8")
    print(f"Featured one new verified official announcement; {len(items)} source cards retained.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
