import { useState } from "react";
import SettingsTabBar, { type SettingsTab } from "./SettingsTabBar";
import NoteSettingsPane from "./NoteSettingsPane";

import AccountSettingsPane from "./AccountSettingsPane";
import AudioSettingsPane from "./AudioSettingsPane";

export default function SettingsView() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("note");

  return (
    <div className="flex h-full flex-col">
      <h1 className="mb-4 text-2xl font-bold text-gray-900 font-gtsuper">
        Settings
      </h1>
      <SettingsTabBar activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="mt-6 flex-1 overflow-y-auto scrollbar-hide">
        {activeTab === "note" && <NoteSettingsPane />}
        {activeTab === "account" && <AccountSettingsPane />}
        {activeTab === "audio" && <AudioSettingsPane />}
      </div>
    </div>
  );
}
