export type SessionTab = "context" | "transcription" | "note";

interface SessionTabBarProps {
  activeTab: SessionTab;
  onTabChange: (tab: SessionTab) => void;
}

const tabs: { id: SessionTab; label: string }[] = [
  { id: "context", label: "Context" },
  { id: "transcription", label: "Transcription" },
  { id: "note", label: "Note" },
];

export default function SessionTabBar({
  activeTab,
  onTabChange,
}: SessionTabBarProps) {
  return (
    <div className="flex gap-1 border-b border-gray-200">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === tab.id
              ? "border-b-2 border-primary text-primary"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
