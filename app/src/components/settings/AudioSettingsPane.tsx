import { useState } from "react";
import { getAudioGain, setAudioGain } from "../../lib/audioGain";

export default function AudioSettingsPane() {
  const [gain, setGain] = useState(() => getAudioGain());

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = parseFloat(e.target.value);
    setGain(value);
    setAudioGain(value);
  }

  return (
    <div className="max-w-lg">
      <h2 className="mb-1 text-lg font-semibold text-gray-900">
        Microphone Gain
      </h2>
      <p className="mb-4 text-sm text-gray-500">
        Boost microphone input level for louder environments.
      </p>

      <div className="flex items-center gap-4">
        <input
          type="range"
          min={1}
          max={3}
          step={0.1}
          value={gain}
          onChange={handleChange}
          className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-gray-200 accent-primary"
        />
        <span className="w-12 text-right text-sm font-medium text-gray-900">
          {gain.toFixed(1)}x
        </span>
      </div>

      <p className="mt-3 text-xs text-gray-400">
        Changes take effect on next recording.
      </p>
    </div>
  );
}
