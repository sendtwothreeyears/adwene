"""Quality gate for transcript version selection (KAS-280).

Compares the segment-concatenated transcript with the full-audio
re-transcription and selects the winner.  Runs in <10 ms.

Design decisions (from expert panel review):
- Do NOT use raw beam scores for comparison — the two passes use
  different beam widths (8 vs 100) making scores incomparable.
- Use edit distance as the primary signal.
- Full-audio wins by default (it has more LM context).
- Safety valve: if the refined text is empty or drastically shorter,
  fall back to segments.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class GateResult:
    """Result of the quality gate comparison."""

    selected: str          # "full_audio" or "segments"
    text: str              # the winning transcript text
    reason: str            # human-readable reason code
    edit_ratio: float      # word-level edit distance / max(word_count)


def select_transcript(
    segment_text: str,
    full_audio_text: str,
    edit_ratio_threshold: float = 0.05,
) -> GateResult:
    """Compare two transcript versions and pick the better one.

    Fast-path: if the two transcripts agree within *edit_ratio_threshold*
    (default 5% of words), accept full-audio (they're essentially the
    same, and full-audio had more LM context).

    Safety valve: if the full-audio text is empty or <50% the length of
    segment text, fall back to segments.

    Returns a `GateResult` with the selected text and reason.
    """
    seg_words = segment_text.split()
    full_words = full_audio_text.split()

    # Both empty — trivially agree
    if not seg_words and not full_words:
        return GateResult(
            selected="full_audio",
            text=full_audio_text,
            reason="agree",
            edit_ratio=0.0,
        )

    # Safety valve: full-audio produced nothing or drastically shorter
    if not full_words:
        return GateResult(
            selected="segments",
            text=segment_text,
            reason="safety_valve:empty_full_audio",
            edit_ratio=1.0,
        )

    if len(seg_words) > 0 and len(full_words) < len(seg_words) * 0.5:
        return GateResult(
            selected="segments",
            text=segment_text,
            reason="safety_valve:full_audio_too_short",
            edit_ratio=1.0,
        )

    # Compute word-level difference ratio.
    # For long transcripts (>200 words), use a fast bag-of-words
    # approximation instead of full edit distance to stay under 10ms.
    max_len = max(len(seg_words), len(full_words), 1)
    if max_len > 200:
        ratio = _fast_word_diff_ratio(seg_words, full_words)
    else:
        distance = _word_edit_distance(seg_words, full_words)
        ratio = distance / max_len

    # Fast-path: transcripts agree
    if ratio < edit_ratio_threshold:
        return GateResult(
            selected="full_audio",
            text=full_audio_text,
            reason="agree",
            edit_ratio=ratio,
        )

    # Transcripts differ — full-audio wins by default (more LM context)
    return GateResult(
        selected="full_audio",
        text=full_audio_text,
        reason="full_audio_wins",
        edit_ratio=ratio,
    )


def _fast_word_diff_ratio(a: list[str], b: list[str]) -> float:
    """Fast bag-of-words difference ratio for long transcripts.

    Counts words that appear in one transcript but not the other
    (using multiset difference).  This is O(n+m) instead of O(n*m).
    It overestimates similarity (word reordering looks identical) but
    is sufficient for the quality gate's fast-path check.
    """
    from collections import Counter

    ca, cb = Counter(a), Counter(b)
    # Symmetric difference: words in a not in b + words in b not in a
    diff = sum((ca - cb).values()) + sum((cb - ca).values())
    max_len = max(len(a), len(b), 1)
    return diff / max_len


def _word_edit_distance(a: list[str], b: list[str]) -> int:
    """Compute Levenshtein edit distance at the word level.

    O(n*m) but n and m are word counts (not characters), so this is
    fast for typical transcripts (<1000 words → <1ms).
    """
    n, m = len(a), len(b)
    # Optimisation: use single-row DP
    prev = list(range(m + 1))
    for i in range(1, n + 1):
        curr = [i] + [0] * m
        for j in range(1, m + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            curr[j] = min(
                curr[j - 1] + 1,       # insertion
                prev[j] + 1,           # deletion
                prev[j - 1] + cost,    # substitution
            )
        prev = curr
    return prev[m]
