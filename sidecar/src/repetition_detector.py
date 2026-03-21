"""Detect infinite repetition loops in LLM-generated text.

Uses 4-gram frequency analysis over a sliding window to catch when the
model gets stuck repeating the same phrase.  When a loop is detected,
``clean_text`` returns the output truncated at the last sentence boundary
before the repetition started (using pySBD for medical-abbreviation-safe
sentence splitting).
"""

from __future__ import annotations

from collections import Counter

from . import config


class RepetitionDetector:
    """Monitor text for n-gram repetition loops.

    Usage::

        detector = RepetitionDetector()
        for chunk in stream:
            detector.feed(chunk)
            if detector.is_looping:
                result = detector.clean_text
                break
    """

    def __init__(
        self,
        ngram_size: int | None = None,
        max_occurrences: int | None = None,
        window_words: int | None = None,
    ) -> None:
        self._ngram_size = ngram_size if ngram_size is not None else config.REPETITION_NGRAM_SIZE
        self._max_occurrences = max_occurrences if max_occurrences is not None else config.REPETITION_MAX_OCCURRENCES
        self._window_words = window_words if window_words is not None else config.REPETITION_WINDOW_WORDS

        self._text = ""
        self._is_looping = False
        self._repetition_char_pos: int | None = None

    # -- Public API -----------------------------------------------------------

    def feed(self, chunk: str) -> None:
        """Append a chunk of text and check for repetition."""
        if self._is_looping:
            return  # already triggered — stop processing

        self._text += chunk
        self._check()

    @property
    def is_looping(self) -> bool:
        return self._is_looping

    @property
    def full_text(self) -> str:
        return self._text

    @property
    def clean_text(self) -> str:
        """Return text truncated at the last sentence boundary before the
        repetition started.  Falls back to the raw cut position if pySBD
        is unavailable or finds no sentences.
        """
        if not self._is_looping or self._repetition_char_pos is None:
            return self._text

        # Text up to where the repetition begins
        candidate = self._text[: self._repetition_char_pos]

        # Find the last sentence boundary using pySBD
        try:
            import pysbd

            segmenter = pysbd.Segmenter(language="en", clean=False)
            sentences = segmenter.segment(candidate)
            if sentences:
                # Rejoin all complete sentences
                return "".join(sentences).rstrip()
        except Exception:
            pass

        # Fallback: trim to last period followed by whitespace
        last_period = candidate.rfind(". ")
        if last_period >= 0:
            return candidate[: last_period + 1]

        return candidate.rstrip()

    # -- Internal -------------------------------------------------------------

    def _check(self) -> None:
        words = self._text.split()
        n = self._ngram_size

        if len(words) < n:
            return

        # Only check the sliding window
        window_start = max(0, len(words) - self._window_words)
        window = words[window_start:]

        if len(window) < n:
            return

        # Count n-grams in the window
        ngram_counts: Counter[tuple[str, ...]] = Counter()
        for i in range(len(window) - n + 1):
            gram = tuple(w.lower() for w in window[i : i + n])
            ngram_counts[gram] += 1

        # Check if any n-gram exceeds the threshold
        for gram, count in ngram_counts.items():
            if count >= self._max_occurrences:
                self._is_looping = True
                # Find the character position of the second occurrence of
                # this n-gram (the first occurrence is legitimate; repetition
                # starts at the second).
                self._repetition_char_pos = self._find_second_occurrence(gram)
                return

    def _find_second_occurrence(self, gram: tuple[str, ...]) -> int:
        """Return the character offset in ``_text`` where *gram* appears
        for the second time."""
        text_lower = self._text.lower()
        pattern = " ".join(gram)

        first = text_lower.find(pattern)
        if first < 0:
            return len(self._text)

        second = text_lower.find(pattern, first + len(pattern))
        if second < 0:
            return len(self._text)

        return second
