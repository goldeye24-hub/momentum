#!/usr/bin/env python3
"""Select 0-3 fact-check/research briefs per KST day from the approved topic plan.

This program NEVER creates public HTML, sitemap entries, indexable URLs, or
fictional marketing news. The output is a short-lived GitHub Actions artifact.
A separate editorial review is required to publish an original article.
"""
from __future__ import annotations

import argparse
from datetime import datetime
from difflib import SequenceMatcher
from html import unescape
import json
from pathlib import Path
import re
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
PLAN = ROOT / "docs" / "insights-30day-editorial-plan-20261026.md"
PUBLISHED = ROOT / "insights" / "guides"
KST = ZoneInfo("Asia/Seoul")
MAX_DAILY = 3
# Research-brief filter only. Auto-publication is separately performed by the ChatGPT task.
TARGET_CITIES = ("부산", "양산", "김해")
HEADERS = (
    "date", "regionAndCategory", "keywordCandidate", "industry",
    "questionAndAngle", "originalReaderValue", "relatedServices",
)


def planned_rows(text: str):
    """Only actual dated rows of the 30-day editorial schedule qualify."""
    result = []
    for line in text.splitlines():
        if not re.match(r"^\|\s*20\d{2}-\d{2}-\d{2}\s*\|", line):
            continue
        columns = [part.strip() for part in line.strip().strip("|").split("|")]
        if len(columns) != len(HEADERS):
            continue
        row = dict(zip(HEADERS, columns))
        try:
            datetime.strptime(row["date"], "%Y-%m-%d")
        except ValueError:
            continue
        if all(row.get(key) for key in HEADERS):
            result.append(row)
    return result


def published_headings():
    """For editorial warning only; absence of a match does not prove uniqueness."""
    titles = []
    for file in PUBLISHED.glob("*/index.html"):
        html = file.read_text("utf-8")
        match = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.I | re.S)
        if not match:
            match = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)
        if match:
            text = unescape(re.sub(r"<[^>]*>", " ", match.group(1)))
            titles.append({"path": "/" + str(file.parent.relative_to(ROOT)) + "/",
                           "title": re.sub(r"\s+", " ", text).strip()})
    return titles


def potential_overlaps(keyword: str, published: list):
    normalized = re.sub(r"\s+", " ", keyword).strip()
    tokens = [x for x in normalized.split(" ") if len(x) >= 2
              and x not in {"마케팅", "홍보", "광고", "홈페이지", "제작"}]
    matches = []
    for doc in published:
        title = doc["title"]
        shared = [token for token in tokens if token in title]
        similarity = SequenceMatcher(None, normalized.replace(" ", ""),
                                     title.replace(" ", "")).ratio()
        # This is a warning, not an automated duplicate verdict.
        if (len(shared) >= 2 or (tokens and len(shared) == len(tokens)
                                 and similarity >= 0.38)
                or similarity >= 0.62):
            matches.append({"existingPath": doc["path"], "existingTitle": title,
                            "overlappingTerms": shared, "similarity": round(similarity, 2)})
    return sorted(matches, key=lambda x: x["similarity"], reverse=True)[:3]


def briefs(day: str, max_items: int = MAX_DAILY):
    if max_items < 1 or max_items > MAX_DAILY:
        raise ValueError("Daily limit must be between 1 and 3")
    schedule = planned_rows(PLAN.read_text("utf-8"))
    selected = [row for row in schedule if row["date"] == day and any(city in row["regionAndCategory"] for city in TARGET_CITIES)][:max_items]
    previous = published_headings()
    result = []
    for row in selected:
        possible = potential_overlaps(row["keywordCandidate"], previous)
        result.append({
            **row,
            "status": "editorial_review_required",
            "possibleExistingCoverage": possible,
            "requirements": [
                "Confirm the searcher's actual problem and that the guide fits a marketing agency",
                "Find verifiable primary sources; record URL and checked date",
                "Provide an original check-list, example workflow, comparison or decision rule",
                "Verify local facts; NEVER change only a city name on a prior page",
                "Do not fabricate statistics, client results, testimonials or expert credentials",
                "Regulated industries require up-to-date legal/platform review",
                "Publish only after approval, with a unique canonical, title, H1 and appropriate internal links",
            ],
            "publicationAuthorized": False,
            "sourcesVerified": False,
            "articleWritten": False,
        })
    return result


def markdown_report(day, candidates):
    lines = [
        f"# 모멘텀마케팅 실무 자료 검토 대기 — {day}",
        "",
        "> 비공개 조사 후보입니다. 사이트 게시 및 검색 색인은 자동 실행되지 않습니다.",
        f"> 오늘 후보 {len(candidates)}개 (최대 3개). 중복되면 기존 페이지 보강으로 대체합니다.",
        "",
    ]
    if not candidates:
        lines += ["이 날짜에 편성된 후보가 없습니다. 억지로 생성하지 않습니다.", ""]
    for index, item in enumerate(candidates, 1):
        lines += [
            f"## {index}. {item['keywordCandidate']}",
            f"- 대상: {item['regionAndCategory']} / {item['industry']}",
            f"- 핵심 질문: {item['questionAndAngle']}",
            f"- 고유한 독자 가치: {item['originalReaderValue']}",
            f"- 연계 서비스: {item['relatedServices']}",
            f"- 공개 상태: 검토 필요 / 미작성 / 미게시",
        ]
        if item["possibleExistingCoverage"]:
            lines += ["- **주의: 유사한 기존 글이 있습니다. 중복 여부를 먼저 판단하세요.**"]
            for x in item["possibleExistingCoverage"]:
                lines.append(f"  - {x['existingPath']} — {x['existingTitle']}")
        lines += ["- 필수 검수: 실제 근거와 출처 / 고유한 정보 / 정확한 지역 특성 / 과장·중복 점검", ""]
    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", default=datetime.now(KST).date().isoformat())
    parser.add_argument("--max", type=int, default=MAX_DAILY, choices=[1, 2, 3])
    parser.add_argument("--out", default="artifacts/editorial-review")
    args = parser.parse_args()
    datetime.strptime(args.date, "%Y-%m-%d")
    candidates = briefs(args.date, args.max)
    output = Path(args.out)
    output.mkdir(parents=True, exist_ok=True)
    payload = {
        "dateKST": args.date,
        "dailyMaximum": MAX_DAILY,
        "count": len(candidates),
        "status": "NOT_PUBLISHED_REVIEW_REQUIRED",
        "source": "docs/insights-30day-editorial-plan-20261026.md",
        "candidates": candidates,
    }
    (output / f"{args.date}.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", "utf-8")
    (output / f"{args.date}.md").write_text(
        markdown_report(args.date, candidates), "utf-8")
    print(f"Prepared {len(candidates)} editorial brief(s). No public pages or sitemap changes.")


if __name__ == "__main__":
    main()
