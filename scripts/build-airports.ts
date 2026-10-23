// Regenerates src/data/airports.json, the list the price report form searches
// so people can type "San Francisco" instead of knowing "SFO".
//
//   npm run build:airports
//
// Source: OurAirports (https://ourairports.com/data/), public domain. Kept:
// large and medium airports with scheduled service and an IATA code, plus the
// IATA codes for cities with several airports, which suit hotel reports.

import { writeFileSync } from 'node:fs';
import { parseCsv } from '../experiment/csv';

const SOURCE_URL = 'https://davidmegginson.github.io/ourairports-data/airports.csv';
const OUT = new URL('../src/data/airports.json', import.meta.url);

// IATA city codes: [code, city, country].
const CITY_CODES: [string, string, string][] = [
  ['BJS', 'Beijing', 'CN'],
  ['BUE', 'Buenos Aires', 'AR'],
  ['CHI', 'Chicago', 'US'],
  ['LON', 'London', 'GB'],
  ['MIL', 'Milan', 'IT'],
  ['NYC', 'New York', 'US'],
  ['OSA', 'Osaka', 'JP'],
  ['PAR', 'Paris', 'FR'],
  ['RIO', 'Rio de Janeiro', 'BR'],
  ['ROM', 'Rome', 'IT'],
  ['SAO', 'São Paulo', 'BR'],
  ['SEL', 'Seoul', 'KR'],
  ['STO', 'Stockholm', 'SE'],
  ['TYO', 'Tokyo', 'JP'],
  ['WAS', 'Washington', 'US'],
  ['YMQ', 'Montreal', 'CA'],
  ['YTO', 'Toronto', 'CA'],
];

const response = await fetch(SOURCE_URL);
if (!response.ok) throw new Error(`Download failed: ${response.status}`);
const rows = parseCsv(await response.text());

const airports = rows
  .filter((r) => /^[A-Z]{3}$/.test(r.iata_code) && r.scheduled_service === 'yes' && (r.type === 'large_airport' || r.type === 'medium_airport'))
  // Large airports first, so they lead the suggestions for a city.
  .sort((a, b) => Number(b.type === 'large_airport') - Number(a.type === 'large_airport') || a.iata_code.localeCompare(b.iata_code))
  .map((r) => [r.iata_code, r.name, r.municipality, r.iso_country]);

const airportCodes = new Set(airports.map(([code]) => code));
const clash = CITY_CODES.find(([code]) => airportCodes.has(code));
if (clash) throw new Error(`City code ${clash[0]} is also an airport code`);

const data = {
  source: 'OurAirports, public domain',
  source_url: 'https://ourairports.com/data/',
  retrieved_on: new Date().toISOString().slice(0, 10),
  // [code, name, city, country]; city codes have an empty name.
  places: [...CITY_CODES.map(([code, city, country]) => [code, '', city, country]), ...airports],
};
writeFileSync(OUT, JSON.stringify(data) + '\n');
console.log(`Wrote ${data.places.length} places (${CITY_CODES.length} city codes, ${airports.length} airports).`);
