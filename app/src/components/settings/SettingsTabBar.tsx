export type SettingsTab = "note" | "account" | "audio";

interface SettingsTabBarProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}

const tabs: { id: SettingsTab; label: string }[] = [
  { id: "note", label: "Note" },
  { id: "account", label: "Account" },
  { id: "audio", label: "Audio" },
];

export default function SettingsTabBar({
  activeTab,
  onTabChange,
}: SettingsTabBarProps) {
  return (
    <div className="flex gap-6 border-b border-border">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`relative pb-3 text-sm font-medium transition-colors ${
              isActive
                ? "text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        );
      })}
    </div>
  );
}
