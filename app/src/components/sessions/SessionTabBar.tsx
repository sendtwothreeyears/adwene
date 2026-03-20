export type SessionTab = "context" | "transcription" | "note";

interface SessionTabBarProps {
  activeTab: SessionTab;
  onTabChange: (tab: SessionTab) => void;
}

const tabs: { id: SessionTab; label: string; icon: string }[] = [
  { id: "context", label: "Context", icon: "/icons/context.svg" },
  { id: "transcription", label: "Transcription", icon: "/icons/transcription.svg" },
  { id: "note", label: "Note", icon: "/icons/note.svg" },
];

function Separator() {
  return <div className="mx-2 my-auto h-6 w-px shrink-0 bg-border" />;
}

export default function SessionTabBar({
  activeTab,
  onTabChange,
}: SessionTabBarProps) {
  return (
    <div className="flex items-center py-2">
      {tabs.map((tab, i) => {
        const isActive = activeTab === tab.id;
        return (
          <div key={tab.id} className="flex items-center">
            {i > 0 && <Separator />}
            <button
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-base font-medium transition-colors ${
                isActive
                  ? "border-border bg-white text-gray-900"
                  : "border-transparent text-gray-500 hover:border-border"
              }`}
            >
              <img
                src={tab.icon}
                alt=""
                className={`h-5 w-5 ${isActive ? "" : "brightness-0 opacity-50"}`}
              />
              {tab.label}
            </button>
          </div>
        );
      })}
    </div>
  );
}
