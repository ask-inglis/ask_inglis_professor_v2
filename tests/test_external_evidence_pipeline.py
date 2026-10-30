"""Run: cd backend && python -m unittest discover -s ../../tests (adjust path).
Standard library tests use mocks; no external API credentials or network required.
"""
import unittest
from unittest.mock import patch
from app.services import external_evidence_pipeline as pipeline


class ExternalEvidenceTests(unittest.TestCase):
    def test_query_preserves_anatomical_relationship_terms(self):
        self.assertEqual(
            pipeline.anatomy_search_query("The biceps brachii is supplied by the musculocutaneous nerve."),
            "biceps brachii musculocutaneous nerve",
        )

    def test_licensed_academic_prioritized_and_wiki_supplementary(self):
        candidates = [
            {"provider": "PubMed", "title": "Metadata only", "identifier": "123"},
            {"provider": "Wikipedia (supplementary)", "title": "Biceps", "identifier": "Biceps", "relevance_score": 9},
            {"provider": "Europe PMC", "title": "Academic", "identifier": "PMC123", "relevance_score": 15},
        ]
        def fake_extract(candidate, *, query, limit):
            license_id = "CC BY 4.0" if candidate["provider"] == "Europe PMC" else "CC BY-SA 4.0"
            return {"passages": [{
                "passage_id": "EXT-" + candidate["identifier"],
                "title": candidate["title"], "url": "https://example.org/" + candidate["identifier"],
                "provider": candidate["provider"], "license": license_id,
                "evidence_text": "The biceps brachii muscle is innervated by the musculocutaneous nerve.",
            }]}
        with patch.object(pipeline, "search_external_references", return_value={"results": candidates, "provider_errors": {}}), \
             patch.object(pipeline, "extract_external_evidence", side_effect=fake_extract):
            result = pipeline.retrieve_external_evidence("The biceps brachii is supplied by the musculocutaneous nerve")
        self.assertEqual(result["academic_passages"], 1)
        self.assertEqual(result["wikipedia_passages"], 1)
        self.assertEqual(result["passages"][0]["title"], "Academic")
        self.assertEqual(len(result["passages"]), 2)

    def test_unlicensed_passage_excluded(self):
        with patch.object(pipeline, "search_external_references", return_value={"results": [
            {"provider": "Europe PMC", "identifier": "PMC321"}], "provider_errors": {}}), \
             patch.object(pipeline, "extract_external_evidence", return_value={"passages": [
                 {"passage_id": "EXT-1", "title": "Restricted", "url": "https://example.org/x",
                  "license": "All rights reserved", "evidence_text": "This has nerve anatomy."}]}):
            result = pipeline.retrieve_external_evidence("Radial nerve supplies biceps brachii")
        self.assertEqual(result["passages"], [])

    def test_incorrect_claim_must_not_be_autocorrected(self):
        # This test verifies that the evidence layer NEVER changes a professor
        # decision and never manufactures a 'Wrong' verdict. The model verdict
        # itself needs separate, live evaluation on curated incorrect claims.
        with patch.object(pipeline, "search_external_references", return_value={"results": [], "provider_errors": {}}):
            result = pipeline.retrieve_external_evidence("The radial nerve normally supplies the biceps brachii")
        self.assertEqual(result["passages"], [])
        self.assertNotIn("verdict", result)


if __name__ == "__main__":
    unittest.main()
