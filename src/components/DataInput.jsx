import React, { useState } from 'react';
import { Upload, Users, Plus, Trash2, CheckCircle } from 'lucide-react';

const HEADER_ALIASES = {
  firstName: ["attendee first name","first name","given name","fname"],
  lastName:  ["attendee last name","last name","surname","lname"],
  partner:   ["name of partner/partners - full name","partner","preferred partner","partner name"],
  skill:     ["i am registered to play in a tournament at this level:","i am registered to play in a tournament at this level","skill","skill bracket","dupr"],
  gender:    ["gender","sex","male/female","m/f","player gender"]
};

const norm = (s) => (s || "").toString().trim().toLowerCase();

const detectDelimiter = (text) => {
  const firstLine = (text.split(/\r?\n/)[0] || "");
  return firstLine.includes("\t") ? "\t" : ",";
};

const indexByHeader = (headers) => {
  const map = { firstName: -1, lastName: -1, partner: -1, skill: -1, gender: -1 };
  const h = headers.map(norm);
  for (const key of Object.keys(HEADER_ALIASES)) {
    for (let i = 0; i < h.length; i++) {
      if (HEADER_ALIASES[key].includes(h[i])) { map[key] = i; break; }
    }
  }
  return map;
};

const parseExportOrSimpleList = (text, skillBrackets, convertBracketToRating) => {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const lines = trimmed.split(/\r?\n/).filter(l => norm(l).length > 0);

  // Fallback: "Name - Skill" OR "Name, Skill"
  const looksSimple = lines.every(l => / - |,/.test(l)) && !trimmed.toLowerCase().includes("attendee first name");
  if (looksSimple) {
    const simple = [];
    lines.forEach((l, idx) => {
      const parts = l.includes(" - ") ? l.split(" - ") : l.split(",");
      const name = (parts[0] || "").trim();
      const bracket = (parts[1] || "").trim();
      if (name && skillBrackets.includes(bracket)) {
        simple.push({
          id: crypto.randomUUID(),
          name,
          skillBracket: bracket,
          skillRating: convertBracketToRating(bracket),
          gender: "",
          lockedPartner: null,
          preferredPartner: null,
        });
      }
    });
    return simple;
  }

  // CSV/TSV with headers
  const delim = detectDelimiter(trimmed);
  const header = lines[0].split(delim).map(s => s.replace(/^\ufeff/, "")); // strip BOM
  const idx = indexByHeader(header);

  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delim);
    if (cols.length === 1) continue;

    const first = idx.firstName >= 0 ? (cols[idx.firstName] || "").trim() : "";
    const last  = idx.lastName  >= 0 ? (cols[idx.lastName]  || "").trim() : "";
    const partnerRaw   = idx.partner >= 0 ? (cols[idx.partner] || "").trim() : "";
    const skillBracket = idx.skill   >= 0 ? (cols[idx.skill]   || "").trim() : "";
    const genderRaw    = idx.gender  >= 0 ? (cols[idx.gender]  || "").trim() : "";

    const name = [first, last].filter(Boolean).join(" ").trim();
    if (!name) continue;
    if (skillBracket && !skillBrackets.includes(skillBracket)) continue; // strict accept only known brackets

    // Normalize gender values
    const normalizedGender = normalizeGender(genderRaw);

    const finalBracket = skillBracket || "3.0-3.49";
    out.push({
      id: crypto.randomUUID(),
      name,
      skillBracket: finalBracket,
      skillRating: convertBracketToRating(finalBracket),
      gender: normalizedGender,
      lockedPartner: null,
      preferredPartner: partnerRaw || null,
    });
  }
  return out;
};

const normalizeGender = (genderRaw) => {
  if (!genderRaw) return "";
  const normalized = genderRaw.toLowerCase().trim();
  if (["male", "m", "man"].includes(normalized)) return "male";
  if (["female", "f", "woman"].includes(normalized)) return "female";
  return "";
};

function DataInput({ onDataSubmit, initialPlayers = [], initialPreConfirmedPairs = [] }) {
  // Internal state management
  const [processingStep, setProcessingStep] = useState(initialPlayers.length > 0 ? 'pairs' : 'input');
  const [inputMethod, setInputMethod] = useState('paste');
  const [pasteData, setPasteData] = useState('');
  const [players, setPlayers] = useState(initialPlayers);
  const [detectedPairs, setDetectedPairs] = useState(initialPreConfirmedPairs);
  const skillBrackets = [
    '2.0-2.49', '2.5-2.99', '3.0-3.49', '3.5-3.99', 
    '4.0-4.49', '4.5-4.99', '5.0-5.49', '5.5+'
  ];

  const convertBracketToRating = (bracket) => {
    const bracketMap = {
      '2.0-2.49': 2.25,
      '2.5-2.99': 2.75,
      '3.0-3.49': 3.25,
      '3.5-3.99': 3.75,
      '4.0-4.49': 4.25,
      '4.5-4.99': 4.75,
      '5.0-5.49': 5.25,
      '5.5+': 5.75
    };
    return bracketMap[bracket] || 3.0;
  };

  const handlePasteSubmit = () => {
    if (!pasteData.trim()) return;
    const parsed = parseExportOrSimpleList(pasteData, skillBrackets, convertBracketToRating);
    if (parsed.length === 0) return;
    setPlayers(parsed);
    setPasteData("");
    processPartnerMatchingWithPlayers(parsed);
  };

  const updatePlayerGender = (playerId, gender) => {
    setPlayers(prev => prev.map(player => 
      player.id === playerId ? { ...player, gender } : player
    ));
  };

  const addManualPlayer = () => {
    const newPlayer = {
      id: crypto.randomUUID(),
      name: '',
      skillBracket: '3.0-3.49',
      skillRating: 3.25,
      gender: '',
      lockedPartner: null,
      preferredPartner: null
    };
    setPlayers(prev => [...prev, newPlayer]);
  };

  const updateManualPlayer = (playerId, field, value) => {
    setPlayers(prev => prev.map(player => {
      if (player.id === playerId) {
        const updated = { ...player, [field]: value };
        if (field === 'skillBracket') {
          updated.skillRating = convertBracketToRating(value);
        }
        return updated;
      }
      return player;
    }));
  };

  const removePlayer = (playerId) => {
    setPlayers(prev => prev.filter(player => player.id !== playerId));
  };

  const processPartnerMatching = () => {
    const pairs = [];
    const paired = new Set();

    players.forEach(p1 => {
      if (paired.has(p1.id) || !p1.preferredPartner) return;
      
      const p2 = players.find(p => 
        !paired.has(p.id) && 
        p.id !== p1.id &&
        matchesName(p.name, p1.preferredPartner)
      );

      if (p2) {
        const isMutual = p2.preferredPartner && matchesName(p1.name, p2.preferredPartner);
        pairs.push({
          id: crypto.randomUUID(),
          player1: p1,
          player2: p2,
          mutual: isMutual,
          confidence: isMutual ? 'high' : 'medium',
          confirmed: false
        });
        paired.add(p1.id);
        paired.add(p2.id);
      }
    });

    setDetectedPairs(pairs);
    // Check if all players have gender assigned
    const playersWithoutGender = players.filter(p => !p.gender);
    if (playersWithoutGender.length > 0) {
      setProcessingStep('gender');
    } else {
      setProcessingStep('pairs');
    }
  };

  const processPartnerMatchingWithPlayers = (playerList) => {
    const pairs = [];
    const paired = new Set();

    playerList.forEach(p1 => {
      if (paired.has(p1.id) || !p1.preferredPartner) return;
      
      const p2 = playerList.find(p => 
        !paired.has(p.id) && 
        p.id !== p1.id &&
        matchesName(p.name, p1.preferredPartner)
      );

      if (p2) {
        const isMutual = p2.preferredPartner && matchesName(p1.name, p2.preferredPartner);
        pairs.push({
          id: crypto.randomUUID(),
          player1: p1,
          player2: p2,
          mutual: isMutual,
          confidence: isMutual ? 'high' : 'medium',
          confirmed: false
        });
        paired.add(p1.id);
        paired.add(p2.id);
      }
    });

    setDetectedPairs(pairs);
    // Check if all players have gender assigned
    const playersWithoutGender = playerList.filter(p => !p.gender);
    if (playersWithoutGender.length > 0) {
      setProcessingStep('gender');
    } else {
      setProcessingStep('pairs');
    }
  };
  const matchesName = (fullName, searchName) => {
    if (!searchName) return false;
    const nicknames = {
      gregory: ['greg'],
      michael: ['mike'],
      elizabeth: ['liz', 'beth', 'lizzy'],
      katherine: ['kate', 'kat', 'kathy'],
      william: ['will', 'bill', 'billy'],
      robert: ['rob', 'bob', 'bobby'],
      alexander: ['alex'],
      alexandra: ['alex'],
    };

    const norm = (s) => (s || '').toLowerCase().trim();
    const full = norm(fullName);
    const search = norm(searchName);

    const [fullFirst, ...rest] = full.split(' ').filter(Boolean);
    const fullLast = rest.length > 0 ? rest[rest.length - 1] : '';

    const searchParts = search.split(' ').filter(Boolean);
    const searchFirst = searchParts[0] || '';
    const searchLast = searchParts.length > 1 ? searchParts[searchParts.length - 1] : '';

    // Require last-name match if the search includes a last name
    if (searchLast && fullLast && searchLast !== fullLast) return false;

    // Exact match or substring match
    if (full.includes(search) || search.includes(full)) return true;

    // Nickname tolerant first-name match when last name matches
    const canon = (name) => {
      const list = nicknames[name] || [];
      return new Set([name, ...list]);
    };

    const firstSet = canon(fullFirst);
    if (searchLast && fullLast === searchLast) {
      if (firstSet.has(searchFirst)) return true;
      // also allow if searchFirst is a nickname of fullFirst
      for (const [formal, alts] of Object.entries(nicknames)) {
        if (formal === fullFirst && alts.includes(searchFirst)) return true;
      }
    }

    return false;
  };

  const confirmPair = (pairId) => {
    setDetectedPairs(prev => prev.map(pair => 
      pair.id === pairId ? { ...pair, confirmed: true } : pair
    ));
  };

  const rejectPair = (pairId) => {
    setDetectedPairs(prev => prev.filter(pair => pair.id !== pairId));
  };

  const proceedToTournament = () => {
    const updatedPlayers = players.map(player => {
      const pair = detectedPairs.find(p => 
        p.confirmed && (p.player1.id === player.id || p.player2.id === player.id)
      );
      
      if (pair) {
        const partnerId = pair.player1.id === player.id ? pair.player2.id : pair.player1.id;
        return { ...player, lockedPartner: partnerId };
      }
      return player;
    });
    
    const confirmedPairs = detectedPairs.filter(p => p.confirmed);
    onDataSubmit(updatedPlayers, confirmedPairs);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-neutral-900 mb-4">Player Registration Data</h2>
        
        {processingStep === 'input' && (
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setInputMethod('paste')}
                className={`px-4 py-2 rounded-lg transition-colors ${inputMethod === 'paste' ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'}`}
              >
                Paste Data
              </button>
              <button
                onClick={() => setInputMethod('manual')}
                className={`px-4 py-2 rounded-lg transition-colors ${inputMethod === 'manual' ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'}`}
              >
                Manual Entry
              </button>
            </div>

            {inputMethod === 'paste' && (
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Paste Registration Data (CSV/TSV export or Name - Skill Bracket)
                </label>
                <p className="text-sm text-neutral-600 mb-2">
                  Supports: Full CSV/TSV export with headers or simple "Name - Skill Bracket" format
                </p>
                <textarea
                  value={pasteData}
                  onChange={(e) => setPasteData(e.target.value)}
                  placeholder="Full export (paste directly from spreadsheet) or:&#10;John Smith - 3.5-3.99&#10;Jane Doe - 4.0-4.49&#10;Mike Johnson - 3.0-3.49"
                  className="w-full h-40 p-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <button
                  onClick={handlePasteSubmit}
                  className="mt-4 bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Process Data
                </button>
              </div>
            )}

            {inputMethod === 'manual' && (
              <div>
                <div className="space-y-3">
                  {players.map((player) => (
                    <div key={player.id} className="grid grid-cols-12 gap-3 items-center p-3 bg-neutral-50 rounded-lg">
                      <div className="col-span-4">
                        <input
                          type="text"
                          value={player.name}
                          onChange={(e) => updateManualPlayer(player.id, 'name', e.target.value)}
                          placeholder="Player Name"
                          className="w-full p-2 border border-neutral-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                      <div className="col-span-3">
                        <select
                          value={player.skillBracket}
                          onChange={(e) => updateManualPlayer(player.id, 'skillBracket', e.target.value)}
                          className="w-full p-2 border border-neutral-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        >
                          {skillBrackets.map(bracket => (
                            <option key={bracket} value={bracket}>{bracket}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <select
                          value={player.gender}
                          onChange={(e) => updateManualPlayer(player.id, 'gender', e.target.value)}
                          className="w-full p-2 border border-neutral-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        >
                          <option value="">Gender</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <span className="text-sm text-neutral-600">
                          DUPR: {player.skillRating}
                        </span>
                      </div>
                      <div className="col-span-1">
                        <button
                          onClick={() => removePlayer(player.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-4 mt-4">
                  <button
                    onClick={addManualPlayer}
                    className="flex items-center gap-2 px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Player
                  </button>
                  
                  {players.length > 0 && (
                    <button
                      onClick={processPartnerMatching}
                      className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      Process Partner Matching
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Gender Assignment Step */}
        {processingStep === 'gender' && (
          <div className="space-y-6">
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
              <h3 className="font-medium text-primary-800 mb-2">Complete Missing Gender Information</h3>
              <p className="text-sm text-primary-700">
                Some players are missing gender information. Please assign genders to complete the setup.
              </p>
            </div>

            <div className="space-y-3">
              {players.filter(player => !player.gender).map((player) => (
                <div key={player.id} className="grid grid-cols-12 gap-3 items-center p-3 bg-neutral-50 rounded-lg">
                  <div className="col-span-5">
                    <span className="font-medium text-neutral-900">{player.name}</span>
                    <span className="text-sm text-neutral-600 ml-2">({player.skillBracket})</span>
                  </div>
                  <div className="col-span-4">
                    <select
                      value={player.gender}
                      onChange={(e) => updatePlayerGender(player.id, e.target.value)}
                      className="w-full p-2 border border-neutral-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="">Select Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>
                  <div className="col-span-3 flex items-center justify-end">
                    <button
                      onClick={() => removePlayer(player.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center">
              <div className="text-sm text-neutral-600">
                Missing Gender: {players.filter(p => !p.gender).length} players
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setProcessingStep('input')}
                  className="px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 transition-colors"
                >
                  Back to Input
                </button>
                <button
                  onClick={() => setProcessingStep('pairs')}
                  disabled={players.filter(p => !p.gender).length > 0}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors"
                >
                  Review Partner Pairs
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pair Review Step */}
        {processingStep === 'pairs' && (
          <div className="space-y-6">
            <div className="bg-success-50 border border-success-200 rounded-lg p-4">
              <h3 className="font-medium text-success-800 mb-2">Review Detected Partner Pairs</h3>
              <p className="text-sm text-success-700">
                Confirm or reject the automatically detected partner preferences.
              </p>
            </div>

            <div className="space-y-4">
              {detectedPairs.map((pair) => (
                <div key={pair.id} className={`p-4 border-2 rounded-lg ${
                  pair.confidence === 'high' ? 'border-success-200 bg-success-50' : 'border-warning-200 bg-warning-50'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-neutral-900">
                          {pair.player1.name} & {pair.player2.name}
                        </span>
                        {pair.mutual ? (
                          <span className="px-2 py-1 bg-success-100 text-success-700 text-xs rounded-full">
                            Mutual
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-warning-100 text-warning-700 text-xs rounded-full">
                            One-way
                          </span>
                        )}
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          pair.confidence === 'high' ? 'bg-success-100 text-success-700' : 'bg-warning-100 text-warning-700'
                        }`}>
                          {pair.confidence} confidence
                        </span>
                      </div>
                      <div className="text-sm text-neutral-600">
                        Skill: {pair.player1.skillBracket} | 
                        Genders: {pair.player1.gender} & {pair.player2.gender}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!pair.confirmed && (
                        <>
                          <button
                            onClick={() => confirmPair(pair.id)}
                            className="px-3 py-1 bg-success-600 text-white rounded hover:bg-success-700 transition-colors"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => rejectPair(pair.id)}
                            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {pair.confirmed && (
                        <CheckCircle className="w-6 h-6 text-success-600" />
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {detectedPairs.length === 0 && (
                <div className="text-center py-8 text-neutral-500">
                  No partner preferences detected in the registration data.
                </div>
              )}
            </div>

            <div className="flex justify-between items-center">
              <div className="text-sm text-neutral-600">
                Confirmed Pairs: {detectedPairs.filter(p => p.confirmed).length} | 
                Singles: {players.length - (detectedPairs.filter(p => p.confirmed).length * 2)}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setProcessingStep('gender')}
                  className="px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 transition-colors"
                >
                  Back to Gender Assignment
                </button>
                <button
                  onClick={proceedToTournament}
                  className="px-6 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 transition-colors"
                >
                  Continue to Manual Pairing
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DataInput;
