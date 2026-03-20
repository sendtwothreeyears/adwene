"""Text extraction from PDF and plain text files."""

import logging
import os

logger = logging.getLogger("kasamd-sidecar")

# Supported MIME types and their extraction method
PLAIN_TEXT_EXTENSIONS = {".txt", ".csv", ".md", ".text"}
PDF_EXTENSIONS = {".pdf"}
SUPPORTED_EXTENSIONS = PLAIN_TEXT_EXTENSIONS | PDF_EXTENSIONS


def extract_text(file_path: str) -> str:
    """Extract text content from a file.

    Supports PDF (via PyMuPDF) and plain text files (.txt, .csv, .md).
    Raises ValueError for unsupported file types.
    Raises FileNotFoundError if file doesn't exist.
    """
    if not os.path.isfile(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    ext = os.path.splitext(file_path)[1].lower()

    if ext in PLAIN_TEXT_EXTENSIONS:
        return _extract_plain_text(file_path)
    elif ext in PDF_EXTENSIONS:
        return _extract_pdf_text(file_path)
    else:
        raise ValueError(
            f"Unsupported file type: {ext}. "
            f"Supported: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
        )


def _extract_plain_text(file_path: str) -> str:
    """Read a plain text file."""
    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        return f.read()


def _extract_pdf_text(file_path: str) -> str:
    """Extract text from a PDF using PyMuPDF."""
    try:
        import fitz  # PyMuPDF
    except ImportError:
        raise RuntimeError(
            "PyMuPDF (pymupdf) is required for PDF extraction. "
            "Install with: pip install pymupdf"
        )

    pages = []
    try:
        doc = fitz.open(file_path)
        for page in doc:
            text = page.get_text()
            if text.strip():
                pages.append(text)
        doc.close()
    except Exception as exc:
        raise ValueError(f"Failed to extract text from PDF: {exc}") from exc

    return "\n".join(pages)
