"""Tests for the text extraction module."""

import os
import tempfile

import pytest

from sidecar.src.text_extraction import extract_text


class TestPlainTextExtraction:
    """Tests for plain text file extraction."""

    def test_extract_txt_file(self, tmp_path):
        f = tmp_path / "test.txt"
        f.write_text("Hello, world!\nSecond line.")
        result = extract_text(str(f))
        assert result == "Hello, world!\nSecond line."

    def test_extract_csv_file(self, tmp_path):
        f = tmp_path / "data.csv"
        f.write_text("name,age\nAlice,30\nBob,25")
        result = extract_text(str(f))
        assert "Alice,30" in result

    def test_extract_md_file(self, tmp_path):
        f = tmp_path / "notes.md"
        f.write_text("# Heading\n\nSome content.")
        result = extract_text(str(f))
        assert "# Heading" in result

    def test_extract_empty_file(self, tmp_path):
        f = tmp_path / "empty.txt"
        f.write_text("")
        result = extract_text(str(f))
        assert result == ""


class TestPdfExtraction:
    """Tests for PDF text extraction (requires pymupdf)."""

    @pytest.fixture
    def simple_pdf(self, tmp_path):
        """Create a simple PDF with text content using PyMuPDF."""
        try:
            import fitz
        except ImportError:
            pytest.skip("pymupdf not installed")

        pdf_path = tmp_path / "test.pdf"
        doc = fitz.open()
        page = doc.new_page()
        page.insert_text((72, 72), "Patient: John Doe\nAllergy: Penicillin")
        doc.save(str(pdf_path))
        doc.close()
        return str(pdf_path)

    def test_extract_pdf(self, simple_pdf):
        result = extract_text(simple_pdf)
        assert "John Doe" in result
        assert "Penicillin" in result

    def test_extract_pdf_returns_string(self, simple_pdf):
        result = extract_text(simple_pdf)
        assert isinstance(result, str)


class TestErrorHandling:
    """Tests for error conditions."""

    def test_file_not_found(self):
        with pytest.raises(FileNotFoundError):
            extract_text("/nonexistent/path/file.txt")

    def test_unsupported_extension(self, tmp_path):
        f = tmp_path / "image.png"
        f.write_bytes(b"\x89PNG")
        with pytest.raises(ValueError, match="Unsupported file type"):
            extract_text(str(f))

    def test_unsupported_extension_exe(self, tmp_path):
        f = tmp_path / "program.exe"
        f.write_bytes(b"MZ")
        with pytest.raises(ValueError, match="Unsupported file type"):
            extract_text(str(f))
