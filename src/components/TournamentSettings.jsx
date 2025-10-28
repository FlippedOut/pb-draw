// src/components/TournamentSettings.jsx
import React from 'react';

export default function TournamentSettings({ settings, setSettings }) {
  const onNum = (e) => {
    const { name, value } = e.target;
    const v = Math.max(0, Number(value || 0));
    setSettings((s) => ({ ...s, [name]: v }));
  };

  return (
    <div className="bg-white border rounded-lg p-4 mb-6">
      <h3 className="text-lg font-semibold text-neutral-900 mb-3">Tournament Settings</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label className="flex items-center gap-3">
          <span className="w-36 text-sm text-neutral-700">Courts</span>
          <input
            type="number"
            name="courts"
            min={0}
            value={settings.courts}
            onChange={onNum}
            className="w-28 px-3 py-2 border rounded"
          />
        </label>

        <label className="flex items-center gap-3">
          <span className="w-36 text-sm text-neutral-700">Start Court</span>
          <input
            type="number"
            name="startCourt"
            min={1}
            value={settings.startCourt}
            onChange={onNum}
            className="w-28 px-3 py-2 border rounded"
          />
        </label>

        <label className="flex items-center gap-3">
          <span className="w-36 text-sm text-neutral-700">Rounds</span>
          <input
            type="number"
            name="rounds"
            min={1}
            value={settings.rounds}
            onChange={onNum}
            className="w-28 px-3 py-2 border rounded"
          />
        </label>
      </div>

      <p className="mt-3 text-sm text-neutral-600">
        Defaults: <b>Courts 11</b>, <b>Start Court 1</b>, <b>Rounds 8</b>. You can change these any time before generating the draw.
      </p>
    </div>
  );
}
