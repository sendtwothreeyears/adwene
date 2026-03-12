interface AudioLevelProps {
  level: number; // 0–1
  visible: boolean;
}

export default function AudioLevel({ level, visible }: AudioLevelProps) {
  if (!visible) return null;

  return (
    <div className="flex h-6 w-24 items-center gap-0.5">
      {Array.from({ length: 12 }, (_, i) => {
        const threshold = (i + 1) / 12;
        const active = level >= threshold;
        return (
          <div
            key={i}
            className={`h-full flex-1 rounded-sm transition-colors duration-75 ${
              active
                ? threshold > 0.75
                  ? "bg-red-400"
                  : threshold > 0.5
                    ? "bg-yellow-400"
                    : "bg-green-400"
                : "bg-gray-200"
            }`}
          />
        );
      })}
    </div>
  );
}
