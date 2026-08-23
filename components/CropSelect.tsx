'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CROP_ENTRY_OPTIONS,
  PERENNIAL_ENTRY_GROUPS,
  produceEntryOption,
  loadCustomCropNames,
  saveCustomCropName,
} from '@/lib/crop-entry';

interface CropSelectProps {
  value: string;
  onChange: (crop: string, cropKey: string | null) => void;
  ariaLabel?: string;
  rememberedCrops?: string[];
}

export default function CropSelect({ value, onChange, ariaLabel = 'Crop', rememberedCrops = [] }: CropSelectProps) {
  const [customNames, setCustomNames] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => setCustomNames(loadCustomCropNames()), []);

  const savedNames = useMemo(() => {
    const seen = new Set<string>();
    return [...customNames, ...rememberedCrops].filter((name) => {
      const key = name.trim().toLocaleLowerCase('en-ZA');
      if (!key || seen.has(key) || produceEntryOption(name)) return false;
      seen.add(key);
      return true;
    });
  }, [customNames, rememberedCrops]);

  const selected = useMemo(() => {
    const catalogue = produceEntryOption(value);
    if (catalogue) return `catalogue:${catalogue.key}`;
    const customIndex = savedNames.findIndex(
      (name) => name.toLocaleLowerCase('en-ZA') === value.trim().toLocaleLowerCase('en-ZA'),
    );
    return customIndex >= 0 ? `custom:${customIndex}` : '';
  }, [savedNames, value]);

  function choose(next: string) {
    if (next === '__add__') {
      setAdding(true);
      setNewName('');
      onChange('', null);
      return;
    }
    setAdding(false);
    if (next.startsWith('catalogue:')) {
      const key = next.slice('catalogue:'.length);
      const crop = CROP_ENTRY_OPTIONS.find((option) => option.key === key)
        ?? PERENNIAL_ENTRY_GROUPS.flatMap((entry) => entry.options).find((option) => option.key === key);
      if (crop) onChange(crop.label, crop.key);
      return;
    }
    if (next.startsWith('custom:')) {
      const name = savedNames[Number(next.slice('custom:'.length))];
      if (name) onChange(name, null);
      return;
    }
    onChange('', null);
  }

  function addCrop() {
    const saved = saveCustomCropName(newName);
    if (!saved) return;
    const catalogue = produceEntryOption(saved);
    const names = loadCustomCropNames();
    setCustomNames(names);
    setAdding(false);
    setNewName('');
    onChange(catalogue?.label ?? saved, catalogue?.key ?? null);
  }

  return (
    <div className="space-y-2">
      <select
        aria-label={ariaLabel}
        value={adding ? '__add__' : selected}
        onChange={(event) => choose(event.target.value)}
        className="dark-input w-full rounded-lg px-3 py-2 text-sm font-display outline-none"
        style={{ background: '#FFFEFA', border: '1px solid #E2D8C4', color: '#20190F' }}
      >
        <option value="">Choose a crop</option>
        <optgroup label="Crop list">
          {CROP_ENTRY_OPTIONS.map((crop) => (
            <option key={crop.key} value={`catalogue:${crop.key}`}>{crop.label}</option>
          ))}
        </optgroup>
        {/* The orchard and the food forest. Before this a farmer could draw twelve avocado trees on
            the design map and had no way to record a single avocado — the only route was to type the
            name, which spelt it differently every time. These sit under the annual crops because
            that is the order of a working day, not because they matter less. */}
        {PERENNIAL_ENTRY_GROUPS.map((entry) => (
          <optgroup key={entry.group} label={entry.label}>
            {entry.options.map((produce) => (
              <option key={produce.key} value={`catalogue:${produce.key}`}>{produce.label}</option>
            ))}
          </optgroup>
        ))}
        {savedNames.length > 0 && (
          <optgroup label="Crops you added">
            {savedNames.map((name, index) => (
              <option key={name.toLocaleLowerCase('en-ZA')} value={`custom:${index}`}>{name}</option>
            ))}
          </optgroup>
        )}
        <option value="__add__">＋ Add another crop…</option>
      </select>

      {adding && (
        <div className="flex gap-2">
          <input
            autoFocus
            aria-label="New crop name"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addCrop();
              }
            }}
            placeholder="Type the crop name"
            className="dark-input flex-1 min-w-0 rounded-lg px-3 py-2 text-sm font-display outline-none"
            style={{ background: '#FFFEFA', border: '1px solid #E2D8C4', color: '#20190F' }}
          />
          <button
            type="button"
            onClick={addCrop}
            disabled={!newName.trim()}
            className="rounded-lg px-3 py-2 text-xs font-display font-semibold"
            style={{
              background: newName.trim() ? '#1F4D2B' : '#E2D8C4',
              border: 'none', color: newName.trim() ? '#fff' : '#8C7A62',
              cursor: newName.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            Save crop
          </button>
        </div>
      )}
    </div>
  );
}
