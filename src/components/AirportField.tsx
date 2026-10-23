import { useEffect, useId, useState } from 'react';
import { loadPlaces, searchPlaces, type Place } from '../lib/reports/places';
import { FIELD, FOCUS_RING, LABEL, TAP_TARGET } from '../styles/constants';

// A 3-letter airport or city code, found by typing a city or airport name.
// Typing a code directly works too, including one not in the list.

const describe = ([code, name, city]: Place) => (name ? `${city} · ${name}` : `${city} · all airports`) + ` (${code})`;
const codeIn = (text: string) => text.match(/\(([A-Z]{3})\)$/)?.[1] ?? (/^[A-Za-z]{3}$/.test(text.trim()) ? text.trim().toUpperCase() : '');

interface AirportFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
}

export function AirportField({ id, label, value, onChange, placeholder = 'City or airport code' }: AirportFieldProps) {
  const listId = useId();
  const [text, setText] = useState(value);
  const [places, setPlaces] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let live = true;
    loadPlaces().then((p) => live && setPlaces(p), () => {});
    return () => {
      live = false;
    };
  }, []);

  const suggestions = open ? searchPlaces(places, text) : [];
  const shown = open && suggestions.length > 0;
  // A typed code like "SAN" is taken as is, so say which place it means.
  const typedCode = value && !text.endsWith(`(${value})`) ? places.find(([c]) => c === value) : undefined;

  const choose = (place: Place) => {
    setText(describe(place));
    onChange(place[0]);
    setOpen(false);
  };

  return (
    <div className="relative">
      <label htmlFor={id} className={`mb-1.5 block ${LABEL}`}>
        {label}
      </label>
      <input
        id={id}
        role="combobox"
        aria-expanded={shown}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={shown ? `${listId}-${active}` : undefined}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(codeIn(e.target.value));
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (!shown) return;
          if (e.key === 'ArrowDown') setActive((i) => Math.min(i + 1, suggestions.length - 1));
          else if (e.key === 'ArrowUp') setActive((i) => Math.max(i - 1, 0));
          else if (e.key === 'Enter') choose(suggestions[active]);
          else if (e.key === 'Escape') setOpen(false);
          else return;
          e.preventDefault();
        }}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className={`${FIELD} ${TAP_TARGET} ${FOCUS_RING}`}
      />
      {value && !shown && !text.endsWith(`(${value})`) && (
        <p className="mt-1.5 text-xs text-navy-950/55">
          {typedCode ? describe(typedCode) : `${value}: not in our list, but any 3-letter code works`}
        </p>
      )}
      {shown && (
        <ul id={listId} role="listbox" className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-navy/15 bg-white py-1 shadow-lg">
          {suggestions.map((place, i) => (
            <li
              key={place[0]}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // Before the input's blur, so the choice registers.
              onMouseDown={(e) => {
                e.preventDefault();
                choose(place);
              }}
              className={`cursor-pointer px-3 py-2 text-sm ${i === active ? 'bg-navy/10' : ''}`}
            >
              <span className="font-mono text-navy-950">{place[0]}</span>{' '}
              <span className="text-navy-950/70">
                {place[2]}
                {place[1] ? ` · ${place[1]}` : ' · all airports'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
