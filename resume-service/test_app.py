import io
import unittest
from unittest.mock import patch

from app import app, extract_contact, extract_skills


class SkillExtractionTests(unittest.TestCase):
    def test_extracts_supported_skills_without_substring_false_positives(self):
        skills = extract_skills("JavaScript, GitHub, SQL and Machine Learning")
        self.assertIn("JavaScript", skills)
        self.assertIn("GitHub", skills)
        self.assertIn("SQL", skills)
        self.assertIn("Machine Learning", skills)
        self.assertNotIn("Java", skills)
        self.assertNotIn("Git", skills)

    def test_extracts_name_and_email(self):
        self.assertEqual(
            extract_contact("Jordan Lee\njordan@example.com\nPython developer"),
            ("Jordan Lee", "jordan@example.com"),
        )


class ResumeEndpointTests(unittest.TestCase):
    def setUp(self):
        app.config["TESTING"] = True
        self.client = app.test_client()

    def test_rejects_missing_or_non_pdf_uploads(self):
        self.assertEqual(self.client.post("/analyze").status_code, 400)
        response = self.client.post(
            "/analyze",
            data={"resume": (io.BytesIO(b"not a pdf"), "resume.pdf")},
            content_type="multipart/form-data",
        )
        self.assertEqual(response.status_code, 400)

    def test_returns_a_clear_error_for_malformed_pdf(self):
        response = self.client.post(
            "/analyze",
            data={"resume": (io.BytesIO(b"%PDF-1.4 malformed"), "resume.pdf")},
            content_type="multipart/form-data",
        )
        self.assertEqual(response.status_code, 422)
        self.assertIn("Unable to read this PDF", response.get_json()["error"])

    def test_rejects_resumes_larger_than_five_megabytes(self):
        response = self.client.post(
            "/analyze",
            data={"resume": (io.BytesIO(b"%PDF-" + b"x" * (5 * 1024 * 1024)), "resume.pdf")},
            content_type="multipart/form-data",
        )
        self.assertEqual(response.status_code, 413)

    @patch("app.extract_text", return_value="Jordan Lee\njordan@example.com\nPython and Team Collaboration")
    def test_returns_profile_and_skill_categories(self, extract_text_mock):
        response = self.client.post(
            "/analyze",
            data={"resume": (io.BytesIO(b"%PDF-1.4 test"), "resume.pdf")},
            content_type="multipart/form-data",
        )
        payload = response.get_json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["name"], "Jordan Lee")
        self.assertEqual(payload["email"], "jordan@example.com")
        self.assertEqual(payload["technical_skills"], ["Python"])
        self.assertEqual(payload["soft_skills"], ["Team Collaboration"])
        extract_text_mock.assert_called_once()


if __name__ == "__main__":
    unittest.main()
