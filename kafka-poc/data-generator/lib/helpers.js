const { v4: uuidv4 } = require('uuid');
const { faker } = require('@faker-js/faker');

// ── Weighted random selection ──
function weightedPick(options) {
  // options: [{ value, weight }] — weights are percentages (should sum ~100)
  const total = options.reduce((s, o) => s + o.weight, 0);
  let r = Math.random() * total;
  for (const opt of options) {
    r -= opt.weight;
    if (r <= 0) return opt.value;
  }
  return options[options.length - 1].value;
}

// Pick from array uniformly
function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Random int in [min, max]
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Random float in [min, max] with given decimal places
function randomFloat(min, max, decimals = 1) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

// ── UUID generator ──
function genUUID() {
  return uuidv4();
}

// ── MBI (Medicare Beneficiary Identifier) generator ──
// Format: [1-9][A-Z*][A-Z0-9*][0-9]-[A-Z*][A-Z0-9*][0-9]-[A-Z*][A-Z0-9*][0-9][0-9]
// * = excluding S, L, O, I, B, Z
const MBI_ALPHA = 'ACDEFGHJKMNPQRTUVWXY';
const MBI_ALPHANUM = 'ACDEFGHJKMNPQRTUVWXY0123456789';

function genMBI() {
  const c = (set) => set[Math.floor(Math.random() * set.length)];
  const d = () => String(Math.floor(Math.random() * 10));
  return `${randomInt(1, 9)}${c(MBI_ALPHA)}${c(MBI_ALPHANUM)}${d()}${c(MBI_ALPHA)}${c(MBI_ALPHANUM)}${d()}${c(MBI_ALPHA)}${c(MBI_ALPHANUM)}${d()}${d()}`;
}

// ── NPN generator (5-8 digit string) ──
function genNPN() {
  const len = randomInt(5, 8);
  let npn = String(randomInt(1, 9));
  for (let i = 1; i < len; i++) npn += String(randomInt(0, 9));
  return npn;
}

// ── Confirmation Number: T{YY}{MM}{7digits}{letter} ──
function genConfirmationNumber(date) {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  let digits = '';
  for (let i = 0; i < 7; i++) digits += String(randomInt(0, 9));
  const letter = String.fromCharCode(65 + randomInt(0, 25));
  return `T${yy}${mm}${digits}${letter}`;
}

// ── Verification Code: 9-digit numeric string ──
function genVerificationCode() {
  let code = '';
  for (let i = 0; i < 9; i++) code += String(randomInt(0, 9));
  return code;
}

// ── Phone number: 10-digit US ──
function genPhone() {
  return `${randomInt(201, 999)}${randomInt(200, 999)}${String(randomInt(0, 9999)).padStart(4, '0')}`;
}

// ── User ID pattern: {FirstInitial}{LastName}{3digits} ──
function genUserId(firstName, lastName) {
  return `${firstName[0]}${lastName}${randomInt(100, 9999)}`;
}

// ── Email patterns ──
function genAgentEmail(firstName, lastName) {
  if (Math.random() < 0.5) {
    return `${lastName[0].toLowerCase()}${firstName.toLowerCase()}@aetna.com`;
  }
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}@aetna.com`;
}

// ── Date generation with seasonal patterns ──
// Date range: Jan 2023 – Mar 2026
const DATE_START = new Date('2023-01-01T00:00:00Z');
const DATE_END = new Date('2026-03-31T23:59:59Z');

// YoY enrollment distribution weights by year
const YEAR_WEIGHTS = [
  { value: 2023, weight: 24.8 },  // ~30K baseline (30/121 = 24.8%)
  { value: 2024, weight: 28.5 },  // ~34.5K (+15%)
  { value: 2025, weight: 34.2 },  // ~41.4K (+20%)
  { value: 2026, weight: 12.5 },  // ~15K partial year
];

// Monthly weights within a year (AEP Oct-Dec = 60%, OEP Jan-Mar = 15%, SEP = 20%, IEP = 5%)
const MONTH_WEIGHTS = [
  { month: 0, weight: 6.0 },   // Jan (OEP)
  { month: 1, weight: 5.0 },   // Feb (OEP)
  { month: 2, weight: 4.0 },   // Mar (OEP)
  { month: 3, weight: 3.0 },   // Apr (SEP)
  { month: 4, weight: 2.5 },   // May (SEP)
  { month: 5, weight: 2.5 },   // Jun (SEP)
  { month: 6, weight: 2.5 },   // Jul (SEP)
  { month: 7, weight: 2.5 },   // Aug (SEP)
  { month: 8, weight: 3.0 },   // Sep (SEP/IEP ramp)
  { month: 9, weight: 15.0 },  // Oct (AEP start)
  { month: 10, weight: 30.0 }, // Nov (AEP peak)
  { month: 11, weight: 24.0 }, // Dec (AEP end)
];

function genSeasonalDate(yearOverride = null) {
  const year = yearOverride || weightedPick(YEAR_WEIGHTS);
  // For 2026, only Jan-Mar
  const availableMonths = year === 2026
    ? MONTH_WEIGHTS.filter(m => m.month <= 2)
    : MONTH_WEIGHTS;
  const month = weightedPick(availableMonths.map(m => ({ value: m.month, weight: m.weight })));
  const day = randomInt(1, 28); // Safe day range
  const hour = randomInt(7, 20);
  const min = randomInt(0, 59);
  const sec = randomInt(0, 59);
  return new Date(Date.UTC(year, month, day, hour, min, sec));
}

// Generate a date within a range
function genDateInRange(start, end) {
  const s = start.getTime();
  const e = end.getTime();
  return new Date(s + Math.random() * (e - s));
}

// Generate a date after a given date, within a max number of days
function genDateAfter(baseDate, minDays, maxDays) {
  const ms = baseDate.getTime();
  const offsetDays = minDays + Math.random() * (maxDays - minDays);
  return new Date(ms + offsetDays * 86400000);
}

// Generate effective date (1st of month, typically Jan 1 or following month)
function genEffectiveDate(enrollDate) {
  const month = enrollDate.getMonth();
  const year = enrollDate.getFullYear();
  // If enrolled Oct-Dec, effective Jan 1 next year; otherwise 1st of next month
  if (month >= 9) {
    return new Date(Date.UTC(year + 1, 0, 1));
  }
  return new Date(Date.UTC(year, month + 1, 1));
}

// ── DOB for Medicare eligible (65+) ──
function genMedicareDOB(referenceDate = new Date()) {
  const refYear = referenceDate.getFullYear();
  const birthYear = randomInt(refYear - 95, refYear - 65);
  const month = randomInt(0, 11);
  const day = randomInt(1, 28);
  return new Date(Date.UTC(birthYear, month, day));
}

// ── Part A/B effective dates (typically 1st of birth month when turning 65) ──
function genPartDates(dob) {
  const age65Year = dob.getFullYear() + 65;
  const partADate = new Date(Date.UTC(age65Year, dob.getMonth(), 1));
  // Part B may be same or slightly later
  const partBDate = Math.random() < 0.8
    ? partADate
    : new Date(Date.UTC(age65Year, dob.getMonth() + randomInt(0, 6), 1));
  return { partADate, partBDate };
}

// ── Batch insert helper ──
async function batchInsert(collection, docs, batchSize = 2000) {
  let inserted = 0;
  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = docs.slice(i, i + batchSize);
    await collection.insertMany(batch, { ordered: false });
    inserted += batch.length;
    if (inserted % 10000 === 0 || inserted === docs.length) {
      process.stdout.write(`  ... ${inserted.toLocaleString()} / ${docs.length.toLocaleString()}\r`);
    }
  }
  console.log(`  Inserted ${inserted.toLocaleString()} documents`);
}

// Streaming batch insert for very large collections (generates on-the-fly)
async function streamInsert(collection, generatorFn, totalCount, batchSize = 2000) {
  let inserted = 0;
  while (inserted < totalCount) {
    const remaining = totalCount - inserted;
    const currentBatch = Math.min(batchSize, remaining);
    const docs = [];
    for (let i = 0; i < currentBatch; i++) {
      docs.push(generatorFn(inserted + i));
    }
    await collection.insertMany(docs, { ordered: false });
    inserted += currentBatch;
    if (inserted % 10000 === 0 || inserted === totalCount) {
      process.stdout.write(`  ... ${inserted.toLocaleString()} / ${totalCount.toLocaleString()}\r`);
    }
  }
  console.log(`  Inserted ${inserted.toLocaleString()} documents`);
}

// ── Election type for enrollment dates ──
function getElectionType(date) {
  const month = date.getMonth();
  if (month >= 9 && month <= 11) return 'E'; // AEP → initial enrollment
  if (month >= 0 && month <= 2) return 'M';  // OEP
  return weightedPick([
    { value: 'S', weight: 55 },  // SEP
    { value: 'I', weight: 18 },  // IEP
    { value: 'F', weight: 10 },  // MRD
    { value: 'A', weight: 10 },  // AEP late
    { value: 'E', weight: 7 },   // New to Medicare
  ]);
}

// ── US State data for geographic distribution ──
const STATE_DISTRIBUTION = [
  { value: 'NY', weight: 22.5 },
  { value: 'KY', weight: 16.1 },
  { value: 'FL', weight: 10.8 },
  { value: 'AR', weight: 4.8 },
  { value: 'AL', weight: 3.4 },
  { value: 'PA', weight: 2.2 },
  { value: 'GA', weight: 2.0 },
  { value: 'AZ', weight: 1.8 },
  { value: 'TX', weight: 1.8 },
  { value: 'CT', weight: 1.7 },
  { value: 'NJ', weight: 1.6 },
  { value: 'CA', weight: 1.5 },
  { value: 'OH', weight: 1.4 },
  { value: 'VA', weight: 1.3 },
  { value: 'IL', weight: 1.2 },
  { value: 'MN', weight: 1.1 },
  { value: 'MI', weight: 1.0 },
  { value: 'IN', weight: 0.9 },
  { value: 'MO', weight: 0.8 },
  { value: 'WA', weight: 0.8 },
  { value: 'MA', weight: 0.7 },
  { value: 'MD', weight: 0.7 },
  { value: 'NC', weight: 0.7 },
  { value: 'TN', weight: 0.6 },
  { value: 'LA', weight: 0.5 },
  { value: 'SC', weight: 0.5 },
  { value: 'WI', weight: 0.5 },
  { value: 'CO', weight: 0.4 },
  { value: 'OK', weight: 0.4 },
  { value: 'OR', weight: 0.3 },
];

// Map states to markets
const STATE_TO_MARKET = {
  AZ: 'Arizona', CA: 'California', CO: 'Mountain', CT: 'New England',
  FL: 'Florida', GA: 'Georgia/Gulf States', IL: 'Great Lakes', IN: 'Great Lakes',
  KY: 'Ohio/Kentucky', LA: 'South Central', MA: 'New England', MD: 'Capitol',
  MI: 'Great Lakes', MN: 'Minnesota', MO: 'Heartland', NC: 'Georgia/Gulf States',
  NJ: 'New Jersey', NY: 'New York', OH: 'Ohio/Kentucky', OK: 'South Central',
  OR: 'Northwest', PA: 'Keystone', SC: 'Georgia/Gulf States', TN: 'Mid South',
  TX: 'South Central', VA: 'Capitol', WA: 'Northwest', WI: 'Midlands',
  AL: 'Georgia/Gulf States', AR: 'Mid South', IN: 'Great Lakes',
};

// Format date as ISO string
function isoDate(d) {
  return d.toISOString();
}

// Format date as YYYY-MM-DD
function dateStr(d) {
  return d.toISOString().split('T')[0];
}

module.exports = {
  weightedPick,
  randomPick,
  randomInt,
  randomFloat,
  genUUID,
  genMBI,
  genNPN,
  genConfirmationNumber,
  genVerificationCode,
  genPhone,
  genUserId,
  genAgentEmail,
  genSeasonalDate,
  genDateInRange,
  genDateAfter,
  genEffectiveDate,
  genMedicareDOB,
  genPartDates,
  getElectionType,
  batchInsert,
  streamInsert,
  isoDate,
  dateStr,
  YEAR_WEIGHTS,
  MONTH_WEIGHTS,
  STATE_DISTRIBUTION,
  STATE_TO_MARKET,
};
