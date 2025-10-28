// src/components/DataInput.jsx
import React, { useEffect, useRef, useState, useTransition } from 'react';
import { Upload } from 'lucide-react';

export default function DataInput({
  onDataSubmit,
  initialPlayers = [],
}) {
  const [rawText, setRawText] = useState('');
  const [players, setPlayers] = useState(initialPlayers);
  const [isPending, startTransition] = useTransition();
  const timer = useRef(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      startTransition(() => {
        setPlayers(parsePlayers(rawText, initialPlayers));
      });
    }, 250);
    return () => clearTimeout(timer.current);
  }, [rawText]);

  const handleContinue = () => {
    // Only pass players; the pairing screen will compute suggestions/quality/badges
    onDataSubmit(players, []);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white border rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Upload className="w-4 h-4" />
          <h3 className="font-semibold">Paste registration data</h3>
        </div>
        <textarea
          className="w-full h-40 p-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          placeholder="Paste CSV/TSV with headers here…"
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
        />
        <div className="text-xs text-neutral-500 mt-2">
          Tip: include “Attendee First Name”, “Attendee Last Name”, and “Name of partner/partners - full name”.
        </div>
      </div>

      <div className="bg-white border rounded-lg p-4 mb-6 text-sm text-neutral-700">
        Players detected: <b>{players.length}</b>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleContinue}
          className="px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          disabled={players.length === 0}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */

const normalizeName = (n) => (n || '').trim().toLowerCase().replace(/\s+/g, ' ');
const guessSkill = (bracket) => {
  const m = /(\d+(?:\.\d+)?)/.exec(bracket || '');
  if (!m) return 3.0;
  const v = parseFloat(m[1]);
  return Number.isNaN(v) ? 3.0 : v;
};

function parsePlayers(text, fallback) {
  if (!text?.trim()) return fallback;

  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(/\t|,/).map((h) => h.trim().toLowerCase());
  const find = (label) => header.findIndex((h) => h.includes(label));

  const firstIdx = find('attendee first name');
  const lastIdx  = find('attendee last name');
  const partnerIdx = find('partner');
  const skillIdx = find('i am registered');

  const out = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(/\t|,/);
    let name = cols[0]?.trim();
    if (firstIdx >= 0 && lastIdx >= 0) {
      name = `${(cols[firstIdx] || '').trim()} ${(cols[lastIdx] || '').trim()}`.trim();
    }
    if (!name) continue;

    const partnerField = partnerIdx >= 0 ? (cols[partnerIdx] || '').trim() : '';
    const skillBracket = skillIdx >= 0 ? (cols[skillIdx] || '').trim() : '';

    out.push({
      id: `p_${i}_${Math.random().toString(36).slice(2)}`,
      name,
      gender: '',
      skillBracket,
      skillRating: guessSkill(skillBracket),
      _partnerText: partnerField, // keep raw for pairing screen
    });
  }
  return out;
}
