import { useRef, useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";

export interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  onSearch?: (query: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}

export default function TagInput({
  tags,
  onChange,
  suggestions = [],
  onSearch,
  placeholder = "Add tag…",
  readOnly = false,
}: TagInputProps) {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter suggestions that aren't already selected
  const filtered = suggestions.filter(
    (s) => !tags.includes(s) && s.toLowerCase().includes(input.toLowerCase())
  );

  useEffect(() => {
    setHighlightIdx(-1);
  }, [input, filtered.length]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const commitTag = useCallback(
    (raw: string) => {
      const name = raw.trim().toLowerCase();
      if (!name || tags.includes(name)) return;
      onChange([...tags, name]);
      setInput("");
      setShowSuggestions(false);
      onSearch?.("");
    },
    [tags, onChange, onSearch]
  );

  const removeTag = useCallback(
    (tag: string) => {
      onChange(tags.filter((t) => t !== tag));
    },
    [tags, onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Tab" || e.key === "Enter") {
      if (highlightIdx >= 0 && highlightIdx < filtered.length) {
        e.preventDefault();
        commitTag(filtered[highlightIdx]);
      } else if (input.trim()) {
        e.preventDefault();
        commitTag(input);
      }
      // If input is empty, let Tab do default focus behavior
      return;
    }

    if (e.key === "Backspace" && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((prev) => Math.min(prev + 1, filtered.length - 1));
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((prev) => Math.max(prev - 1, -1));
      return;
    }

    if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);
    setShowSuggestions(val.length > 0);
    onSearch?.(val);
  };

  if (readOnly) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {tags.length === 0 && (
          <span className="text-xs text-gray-400 italic">No tags</span>
        )}
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700"
          >
            {tag}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className="flex flex-wrap items-center gap-1.5 rounded-lg border border-gray-300 px-2 py-1.5 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring"
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag);
              }}
              className="ml-0.5 rounded-full p-0.5 hover:bg-gray-200"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (input.length > 0) setShowSuggestions(true);
          }}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="min-w-[80px] flex-1 border-none bg-transparent py-0.5 text-sm outline-none placeholder:text-gray-400"
        />
      </div>

      {showSuggestions && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-40 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {filtered.map((suggestion, idx) => (
            <li
              key={suggestion}
              onMouseDown={(e) => {
                e.preventDefault();
                commitTag(suggestion);
              }}
              onMouseEnter={() => setHighlightIdx(idx)}
              className={`cursor-pointer px-3 py-1.5 text-sm ${
                idx === highlightIdx
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
