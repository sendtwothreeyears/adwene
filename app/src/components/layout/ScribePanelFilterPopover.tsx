import { useState, useEffect, useRef } from "react";
import { Calendar, ChevronRight, User, Check } from "lucide-react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import type { Patient } from "../../types";

export type DateFilter =
  | { type: "all" }
  | { type: "preset"; days: number }
  | { type: "custom"; start: Date; end: Date };

const DATE_PRESETS: { label: string; days: number }[] = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "Last 12 months", days: 365 },
];

interface Props {
  dateFilter: DateFilter;
  onDateFilterChange: (filter: DateFilter) => void;
  patients: Record<string, Patient>;
  patientFilter: Set<string>;
  onPatientFilterChange: (filter: Set<string>) => void;
  onClose: () => void;
}

export default function ScribePanelFilterPopover({
  dateFilter,
  onDateFilterChange,
  patients,
  patientFilter,
  onPatientFilterChange,
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [showDateMenu, setShowDateMenu] = useState(false);
  const [showPatientMenu, setShowPatientMenu] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [rangeStart, setRangeStart] = useState<Date | undefined>(
    dateFilter.type === "custom" ? dateFilter.start : undefined
  );
  const [rangeEnd, setRangeEnd] = useState<Date | undefined>(
    dateFilter.type === "custom" ? dateFilter.end : undefined
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const isDateActive = dateFilter.type !== "all";
  const isCustomActive = dateFilter.type === "custom";

  function handleDayClick(day: Date) {
    if (!rangeStart || (rangeStart && rangeEnd)) {
      // Start new range
      setRangeStart(day);
      setRangeEnd(undefined);
    } else {
      // Complete range
      const start = day < rangeStart ? day : rangeStart;
      const end = day < rangeStart ? rangeStart : day;
      setRangeStart(start);
      setRangeEnd(end);
      onDateFilterChange({ type: "custom", start, end });
      onClose();
    }
  }

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full z-50 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
    >
      {/* Date filter */}
      <div className="relative">
        <button
          onClick={() => {
            setShowDateMenu((v) => !v);
            setShowCalendar(false);
          }}
          className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-gray-50 ${
            isDateActive ? "text-gray-900 font-medium" : "text-gray-700"
          }`}
        >
          <Calendar className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Date</span>
          <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
        </button>

        {showDateMenu && (
          <div className="absolute left-full top-0 ml-1 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            {DATE_PRESETS.map((preset) => {
              const isActive =
                dateFilter.type === "preset" && dateFilter.days === preset.days;
              return (
                <button
                  key={preset.days}
                  onClick={() => {
                    if (isActive) {
                      onDateFilterChange({ type: "all" });
                    } else {
                      onDateFilterChange({ type: "preset", days: preset.days });
                    }
                    onClose();
                  }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-gray-50 ${
                    isActive ? "bg-primary/5 text-gray-900" : "text-gray-700"
                  }`}
                >
                  {preset.label}
                  {isActive && (
                    <span className="ml-auto text-xs">{"\u2713"}</span>
                  )}
                </button>
              );
            })}

            <div className="my-1 border-t border-gray-100" />

            <button
              onClick={() => setShowCalendar((v) => !v)}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-gray-50 ${
                isCustomActive ? "bg-primary/5 text-gray-900" : "text-gray-700"
              }`}
            >
              Custom date range
              {isCustomActive && (
                <span className="ml-auto text-xs">{"\u2713"}</span>
              )}
            </button>
          </div>
        )}

        {showDateMenu && showCalendar && (
          <div className="absolute left-full top-0 ml-[calc(11rem+0.25rem)] rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
            <DayPicker
              mode="range"
              numberOfMonths={2}
              selected={
                rangeStart
                  ? { from: rangeStart, to: rangeEnd }
                  : undefined
              }
              onDayClick={handleDayClick}
              disabled={{ after: new Date() }}
              classNames={{
                root: "text-sm",
                day: "h-8 w-8 text-center",
              }}
            />
          </div>
        )}
      </div>

      {/* Patient profile filter */}
      <div className="relative">
        <button
          onClick={() => {
            setShowPatientMenu((v) => !v);
            setShowDateMenu(false);
            setShowCalendar(false);
          }}
          className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-gray-50 ${
            patientFilter.size > 0
              ? "text-gray-900 font-medium"
              : "text-gray-700"
          }`}
        >
          <User className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Patient profile</span>
          <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
        </button>

        {showPatientMenu && (
          <div className="absolute left-full top-0 ml-1 max-h-64 w-52 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            {Object.values(patients).length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-400">
                No patients found
              </p>
            ) : (
              Object.values(patients)
                .sort((a, b) =>
                  `${a.firstName} ${a.lastName}`.localeCompare(
                    `${b.firstName} ${b.lastName}`
                  )
                )
                .map((patient) => {
                  const isSelected = patientFilter.has(patient.id);
                  return (
                    <button
                      key={patient.id}
                      onClick={() => {
                        const next = new Set(patientFilter);
                        if (isSelected) {
                          next.delete(patient.id);
                        } else {
                          next.add(patient.id);
                        }
                        onPatientFilterChange(next);
                      }}
                      className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-gray-50 ${
                        isSelected
                          ? "bg-primary/5 text-gray-900"
                          : "text-gray-700"
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          isSelected
                            ? "border-primary bg-primary text-white"
                            : "border-gray-300"
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </span>
                      {patient.firstName} {patient.lastName}
                    </button>
                  );
                })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
