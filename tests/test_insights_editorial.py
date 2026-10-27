"""Offline guardrail checks for Momentum content collection.

Run with: python -m unittest discover -s tests -p test_insights_editorial.py
"""
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from scripts import prepare_editorial_candidates as editorial
from scripts import update_marketing_news as news


class EditorialCadenceTests(unittest.TestCase):
    def test_approved_plan_and_review_only(self):
        rows = editorial.planned_rows(editorial.PLAN.read_text("utf-8"))
        self.assertGreaterEqual(len(rows), 30)
        candidates = editorial.briefs("2026-10-27")
        self.assertGreaterEqual(len(candidates), 1)
        self.assertLessEqual(len(candidates), 2)
        for item in candidates:
            self.assertFalse(item["publicationAuthorized"])
            self.assertFalse(item["sourcesVerified"])
            self.assertFalse(item["articleWritten"])
            self.assertEqual(item["status"], "editorial_review_required")

    def test_only_approved_three_cities_generate_research_briefs(self):
        self.assertEqual(editorial.briefs("2026-11-01"), [])  # prior plan: Ulsan
        self.assertGreaterEqual(len(editorial.briefs("2026-11-02")), 1)  # Gimhae
        self.assertEqual(editorial.MAX_DAILY, 3)

    def test_approved_industries_are_exactly_105(self):
        selected = editorial.approved_industries()
        self.assertEqual(len(selected), 105)
        for name in ["웨딩홀", "TV 설치·벽걸이 TV", "보청기·안경원",
                     "홈페이지 제작", "온라인 쇼핑몰·스마트스토어"]:
            self.assertIn(name, selected)
        for unselected in ["치과", "피부과", "내과·건강검진센터",
                           "자동차광택·디테일링", "웨딩플래너"]:
            self.assertNotIn(unselected, selected)

    def test_candidate_plans_exclude_unselected_industries(self):
        # Legacy dated plan may mention unauthorized industries; no new publication candidate.
        for date in ["2026-11-11", "2026-11-15", "2026-11-24"]:
            self.assertEqual(editorial.briefs(date), [])
        self.assertEqual(editorial.briefs("2026-11-07")[0]["industry"], "국밥·해장국")
        self.assertEqual(editorial.briefs("2026-11-23")[0]["industry"], "세무사·회계사")

    def test_homepage_necessity_review_is_explicit_and_not_a_presumption(self):
        row = editorial.briefs("2026-10-29")[0]
        self.assertEqual(row["industry"], "입주청소")
        self.assertFalse(row["publicationAuthorized"])
        self.assertTrue(row["websiteDecision"]["noBlanketWebsiteRequirement"])
        self.assertIn("homepage_build_guide", row["websiteDecision"]["options"])

    def test_no_automatic_backfill_when_no_date_planned(self):
        self.assertEqual(editorial.briefs("2027-01-01"), [])


class NewsFrequencyTests(unittest.TestCase):
    def fake_item(self):
        return {
            "title": "Verified search update",
            "date": "2026-10-27",
            "source": "Google 검색센터",
            "category": "seo",
            "url": "https://developers.google.com/search/blog/test-official-item",
        }

    def test_at_most_one_news_item_per_kst_day(self):
        with TemporaryDirectory() as folder:
            base = Path(folder)
            page = base / "index.html"
            state = base / "official-news.json"
            original = "<main>Existing approved editorial</main>\n<!-- NEWS_ITEMS_START -->old placeholder<!-- NEWS_ITEMS_END -->"
            page.write_text(original, "utf-8")
            with patch.object(news, "PAGE", page), \
                 patch.object(news, "DATA", state), \
                 patch.object(news, "SOURCES", [("Google Search", "seo", "https://developers.google.com/search/blog/feed.xml", ("developers.google.com",))]), \
                 patch.object(news, "pull", lambda source, now: [self.fake_item()]):
                self.assertEqual(news.main(), 0)
                first = page.read_text("utf-8")
                data = json.loads(state.read_text("utf-8"))
                self.assertEqual(len(data["items"]), 1)
                self.assertEqual(first.count("Verified search update"), 1)
                self.assertIn("Existing approved editorial", first)
                self.assertEqual(news.main(), 0)
                self.assertEqual(page.read_text("utf-8"), first)
                self.assertEqual(len(json.loads(state.read_text("utf-8"))["items"]), 1)

    def test_no_news_does_not_rewrite_published_page(self):
        with TemporaryDirectory() as folder:
            base = Path(folder)
            page = base / "index.html"
            state = base / "official-news.json"
            original = "<main>Keep this unchanged</main><!-- NEWS_ITEMS_START -->approved<!-- NEWS_ITEMS_END -->"
            page.write_text(original, "utf-8")
            with patch.object(news, "PAGE", page), \
                 patch.object(news, "DATA", state), \
                 patch.object(news, "SOURCES", []):
                self.assertEqual(news.main(), 0)
                self.assertEqual(page.read_text("utf-8"), original)
                self.assertFalse(state.exists())


if __name__ == "__main__":
    unittest.main()
