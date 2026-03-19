'use strict';

const { faker } = require('@faker-js/faker');
const {
  weightedPick,
  randomPick,
  randomInt,
  genUUID,
  genNPN,
  genPhone,
  genUserId,
  genAgentEmail,
  genDateInRange,
  genDateAfter,
  batchInsert,
  streamInsert,
  isoDate,
  STATE_DISTRIBUTION,
  STATE_TO_MARKET,
} = require('./helpers');

// ── Timezone weighted options ──
const TZ_OPTIONS = [
  { value: 'EST', weight: 98.9 },
  { value: 'CST', weight: 0.5 },
  { value: 'PST', weight: 0.3 },
  { value: 'MST', weight: 0.1 },
  { value: null, weight: 0.2 },
];

// ── UserTypeID weighted options ──
const USER_TYPE_OPTIONS = [
  { value: 1, weight: 43 },
  { value: 4, weight: 27 },
  { value: 2, weight: 20 },
  { value: 3, weight: 2.5 },
  { value: 5, weight: 2.5 },
  { value: 6, weight: 2.5 },
  { value: 8, weight: 2.5 },
];

// ── Date constants for Created_Date range ──
const CREATED_START = new Date('2022-01-01T00:00:00Z');
const CREATED_END = new Date('2025-12-31T23:59:59Z');

// ── State zip-code prefix ranges ──
const STATE_ZIP_PREFIXES = {
  NY: [100, 149], FL: [320, 349], KY: [400, 427], CA: [900, 961],
  TX: [750, 799], PA: [150, 196], AZ: [850, 865], GA: [300, 319],
  AL: [350, 369], AR: [716, 729], CT: [60, 69],   NJ: [70, 89],
  OH: [430, 459], VA: [220, 246], IL: [600, 629], MN: [550, 567],
  MI: [480, 499], IN: [460, 479], MO: [630, 658], WA: [980, 994],
  MA: [10, 27],   MD: [206, 219], NC: [270, 289], TN: [370, 385],
  LA: [700, 714], SC: [290, 299], WI: [530, 549], CO: [800, 816],
  OK: [730, 749], OR: [970, 979],
};

// ── State FIPS prefixes ──
const STATE_FIPS = {
  NY: '36', FL: '12', KY: '21', CA: '06', TX: '48', PA: '42', AZ: '04',
  GA: '13', AL: '01', AR: '05', CT: '09', NJ: '34', OH: '39', VA: '51',
  IL: '17', MN: '27', MI: '26', IN: '18', MO: '29', WA: '53', MA: '25',
  MD: '24', NC: '37', TN: '47', LA: '22', SC: '45', WI: '55', CO: '08',
  OK: '40', OR: '41',
};

// ── Known counties for key states ──
const STATE_COUNTIES = {
  NY: ['New York', 'Kings', 'Queens', 'Bronx', 'Richmond', 'Nassau', 'Suffolk', 'Westchester', 'Erie', 'Monroe', 'Albany', 'Onondaga', 'Dutchess', 'Rockland', 'Orange'],
  FL: ['Miami-Dade', 'Broward', 'Palm Beach', 'Hillsborough', 'Orange', 'Pinellas', 'Duval', 'Lee', 'Brevard', 'Volusia', 'Sarasota', 'Seminole', 'Polk', 'Manatee'],
  KY: ['Jefferson', 'Fayette', 'Kenton', 'Boone', 'Campbell', 'Warren', 'Hardin', 'Daviess', 'Madison', 'McCracken', 'Bullitt', 'Christian', 'Boyd'],
  CA: ['Los Angeles', 'San Diego', 'Orange', 'Riverside', 'San Bernardino', 'Santa Clara', 'Alameda', 'Sacramento', 'Contra Costa', 'Fresno', 'Ventura', 'San Francisco', 'San Mateo', 'Kern'],
  TX: ['Harris', 'Dallas', 'Tarrant', 'Bexar', 'Travis', 'Collin', 'Denton', 'El Paso', 'Hidalgo', 'Fort Bend', 'Williamson', 'Montgomery', 'Nueces'],
  PA: ['Philadelphia', 'Allegheny', 'Montgomery', 'Bucks', 'Delaware', 'Lancaster', 'Chester', 'York', 'Berks', 'Lehigh', 'Northampton', 'Dauphin', 'Luzerne'],
  AZ: ['Maricopa', 'Pima', 'Pinal', 'Yavapai', 'Mohave', 'Yuma', 'Coconino', 'Cochise', 'Navajo', 'Apache'],
  GA: ['Fulton', 'Gwinnett', 'Cobb', 'DeKalb', 'Chatham', 'Cherokee', 'Clayton', 'Henry', 'Forsyth', 'Richmond'],
  AL: ['Jefferson', 'Mobile', 'Madison', 'Baldwin', 'Tuscaloosa', 'Shelby', 'Montgomery', 'Lee', 'Morgan', 'Etowah'],
  AR: ['Pulaski', 'Benton', 'Washington', 'Sebastian', 'Faulkner', 'Saline', 'Craighead', 'Garland', 'White', 'Lonoke'],
  CT: ['Fairfield', 'Hartford', 'New Haven', 'Litchfield', 'Middlesex', 'New London', 'Tolland', 'Windham'],
  NJ: ['Bergen', 'Middlesex', 'Essex', 'Hudson', 'Monmouth', 'Ocean', 'Union', 'Passaic', 'Camden', 'Morris', 'Burlington'],
  OH: ['Franklin', 'Cuyahoga', 'Hamilton', 'Summit', 'Montgomery', 'Lucas', 'Butler', 'Stark', 'Warren', 'Lake'],
  VA: ['Fairfax', 'Prince William', 'Loudoun', 'Virginia Beach', 'Chesterfield', 'Henrico', 'Arlington', 'Norfolk', 'Richmond', 'Stafford'],
  IL: ['Cook', 'DuPage', 'Lake', 'Will', 'Kane', 'McHenry', 'Winnebago', 'St. Clair', 'Madison', 'Peoria'],
};

// ── Coordinate ranges by state ──
const STATE_COORDS = {
  NY: { lat: [40.5, 43.0], lng: [-74.3, -73.7] },
  FL: { lat: [25.5, 30.5], lng: [-82.5, -80.0] },
  KY: { lat: [36.5, 39.1], lng: [-86.8, -82.6] },
  CA: { lat: [32.5, 38.5], lng: [-122.5, -117.0] },
  TX: { lat: [26.0, 33.5], lng: [-100.0, -94.5] },
  PA: { lat: [39.7, 42.0], lng: [-80.5, -75.0] },
  AZ: { lat: [31.3, 36.5], lng: [-114.8, -109.0] },
  GA: { lat: [30.5, 35.0], lng: [-85.5, -80.8] },
  AL: { lat: [30.2, 35.0], lng: [-88.5, -85.0] },
  AR: { lat: [33.0, 36.5], lng: [-94.6, -89.6] },
  CT: { lat: [41.0, 42.1], lng: [-73.7, -71.8] },
  NJ: { lat: [39.0, 41.4], lng: [-75.6, -73.9] },
  OH: { lat: [38.4, 41.9], lng: [-84.8, -80.5] },
  VA: { lat: [36.5, 39.4], lng: [-83.7, -75.2] },
  IL: { lat: [37.0, 42.5], lng: [-91.5, -87.5] },
  MN: { lat: [43.5, 49.0], lng: [-97.2, -89.5] },
  MI: { lat: [41.7, 47.5], lng: [-90.4, -82.4] },
  IN: { lat: [37.8, 41.8], lng: [-88.1, -84.8] },
  MO: { lat: [36.0, 40.6], lng: [-95.8, -89.1] },
  WA: { lat: [45.5, 49.0], lng: [-124.7, -116.9] },
  MA: { lat: [41.2, 42.9], lng: [-73.5, -69.9] },
  MD: { lat: [38.0, 39.7], lng: [-79.5, -75.0] },
  NC: { lat: [33.8, 36.6], lng: [-84.3, -75.5] },
  TN: { lat: [35.0, 36.7], lng: [-90.3, -81.6] },
  LA: { lat: [29.0, 33.0], lng: [-94.0, -89.0] },
  SC: { lat: [32.0, 35.2], lng: [-83.4, -78.5] },
  WI: { lat: [42.5, 47.1], lng: [-92.9, -86.8] },
  CO: { lat: [37.0, 41.0], lng: [-109.0, -102.0] },
  OK: { lat: [33.6, 37.0], lng: [-100.0, -94.4] },
  OR: { lat: [42.0, 46.3], lng: [-124.6, -116.5] },
};

// ── 1. Generate Users ──
async function generateUsers(db, scale = 1) {
  const count = Math.ceil(2000 * scale);
  console.log(`Generating ${count.toLocaleString()} Users...`);

  const users = [];
  for (let i = 0; i < count; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const createdDate = genDateInRange(CREATED_START, CREATED_END);
    const updatedDate = Math.random() < 0.4
      ? genDateAfter(createdDate, 1, 365)
      : createdDate;

    users.push({
      NPN_Pk: genNPN(),
      First_name: firstName,
      Last_name: lastName,
      Email_Id: genAgentEmail(firstName, lastName),
      Time_Zone: weightedPick(TZ_OPTIONS),
      User_Status: Math.random() < 0.999,
      User_Access: true,
      Created_Date: isoDate(createdDate),
      Created_By: 'SYSTEM',
      Updated_Date: isoDate(updatedDate),
      Updated_By: 'SYSTEM',
      User_Id: genUserId(firstName, lastName),
      In_Process: false,
      ResendPin_Act_Ind: false,
      RoleUpdate_Ind: false,
      UserTypeID: weightedPick(USER_TYPE_OPTIONS),
      IsRegistered: true,
      Phone_number: genPhone(),
      IsPhone_consent: Math.random() < 0.7,
    });
  }

  await batchInsert(db.collection('Users'), users);
  return users;
}

// ── 2. Generate UserTypeMapping ──
async function generateUserTypeMapping(db, users, scale = 1) {
  const count = Math.ceil(2500 * scale);
  console.log(`Generating ${count.toLocaleString()} UserTypeMapping...`);

  const docs = [];
  for (let i = 0; i < count; i++) {
    const user = randomPick(users);
    // Some mappings use the user's own type; others get a different type
    const typeId = Math.random() < 0.7
      ? user.UserTypeID
      : weightedPick(USER_TYPE_OPTIONS);

    docs.push({
      UserTypeMappingId_Pk: genUUID(),
      NPN: user.NPN_Pk,
      UserTypeID: typeId,
      Is_Active: true,
      Created_Date: user.Created_Date,
      Created_By: 'SYSTEM',
      Updated_Date: user.Created_Date,
      Updated_By: 'SYSTEM',
    });
  }

  await batchInsert(db.collection('UserTypeMapping'), docs);
}

// ── 3. Generate BrokerProfiles ──
async function generateBrokerProfiles(db, users, scale = 1) {
  const count = Math.min(Math.ceil(600 * scale), users.length);
  console.log(`Generating ${count.toLocaleString()} BrokerProfiles...`);

  const subset = users.slice(0, count);
  const docs = subset.map((user) => {
    const stateCode = weightedPick(STATE_DISTRIBUTION);
    const hasMiddle = Math.random() < 0.3;
    const hasApt = Math.random() < 0.25;
    const hasLinkedIn = Math.random() < 0.4;

    return {
      NPN: user.NPN_Pk,
      BrokerFirstName: user.First_name,
      BrokerLastName: user.Last_name,
      BrokerMiddleName: hasMiddle ? faker.string.alpha({ length: 1, casing: 'upper' }) : null,
      County: faker.location.county(),
      BrokerAddressLine1: faker.location.streetAddress(),
      BrokerAddressLine2: hasApt ? faker.location.secondaryAddress() : null,
      BrokerAddressCity: faker.location.city(),
      BrokerAddressStateCd: stateCode,
      BrokerAddressZipCd: faker.location.zipCode('#####'),
      BrokerContactPhone: user.Phone_number,
      BrokerContactEmail: user.Email_Id,
      Disclaimer: 'I am a licensed insurance agent authorized to sell Aetna Medicare products.',
      IsApproved: true,
      AboutUs: 'As a dedicated Aetna Medicare agent, I help beneficiaries find the right Medicare plan for their needs and budget.',
      LinkedIn: hasLinkedIn
        ? `https://linkedin.com/in/${user.First_name.toLowerCase()}-${user.Last_name.toLowerCase()}`
        : null,
      Instagram: null,
      Facebook: null,
      mbr_AboutUs: null,
      ImageURL: null,
      StartTime: '09:00',
      EndTime: '17:00',
      NewImageURL: null,
      ShortURL: null,
      AgentStatusID: 1,
      IsProfileSharing: Math.random() < 0.6,
    };
  });

  await batchInsert(db.collection('BrokerProfiles'), docs);
}

// ── 4. Generate CountyZip ──
async function generateCountyZip(db, scale = 1) {
  const targetTotal = Math.max(100, Math.ceil(54169 * scale));
  console.log(`Generating ~${targetTotal.toLocaleString()} CountyZip records...`);

  // Build per-state targets proportional to STATE_DISTRIBUTION weights
  const totalWeight = STATE_DISTRIBUTION.reduce((s, d) => s + d.weight, 0);
  const stateTargets = {};
  for (const sd of STATE_DISTRIBUTION) {
    const raw = Math.round((sd.weight / totalWeight) * targetTotal);
    // Major states get at least 200, minor at least 50
    const minCount = sd.weight >= 5 ? Math.min(200, targetTotal) : Math.min(50, targetTotal);
    stateTargets[sd.value] = Math.max(minCount, raw);
  }

  const countyZipMap = new Map();
  const allDocs = [];

  for (const state of Object.keys(stateTargets)) {
    const count = stateTargets[state];
    const counties = STATE_COUNTIES[state] || generateGenericCounties(8);
    const fipsPrefix = STATE_FIPS[state] || '00';
    const zipRange = STATE_ZIP_PREFIXES[state] || [100, 999];
    const entries = [];

    // Build a county FIPS map (each county gets a 3-digit code)
    const countyFips = {};
    counties.forEach((c, idx) => {
      countyFips[c] = String(idx * 2 + 1).padStart(3, '0');
    });

    for (let i = 0; i < count; i++) {
      const county = counties[i % counties.length];
      const prefix = randomInt(zipRange[0], zipRange[1]);
      const suffix = String(randomInt(0, 99)).padStart(2, '0');
      const zip = String(prefix).padStart(3, '0') + suffix;
      const fips = fipsPrefix + countyFips[county];

      const doc = {
        State: state,
        Zip_Code: zip.padStart(5, '0'),
        County: county,
        county_fips: fips,
      };

      allDocs.push(doc);
      entries.push({ zip: doc.Zip_Code, county, fips });
    }

    countyZipMap.set(state, entries);
  }

  await batchInsert(db.collection('CountyZip'), allDocs);
  console.log(`  CountyZip total: ${allDocs.length.toLocaleString()} across ${countyZipMap.size} states`);
  return countyZipMap;
}

// Helper: generate generic county names for states without explicit list
function generateGenericCounties(count) {
  const names = [];
  for (let i = 0; i < count; i++) {
    names.push(faker.location.county());
  }
  return names;
}

// ── Timezone lookup by state ──
function tzForState(state) {
  const eastern = ['NY', 'FL', 'PA', 'GA', 'CT', 'NJ', 'OH', 'VA', 'NC', 'SC', 'MA', 'MD', 'MI', 'IN', 'KY', 'AL', 'TN', 'ME', 'NH', 'VT', 'RI', 'DE', 'WV'];
  const central = ['TX', 'IL', 'MN', 'MO', 'WI', 'LA', 'AR', 'OK', 'IA', 'KS', 'NE', 'ND', 'SD', 'MS'];
  const mountain = ['AZ', 'CO', 'MT', 'NM', 'UT', 'WY', 'ID'];
  // Default to Pacific for WA, OR, CA, etc.

  if (eastern.includes(state)) return { id: 1, name: 'Eastern Standard Time', offset: 'UTC-05:00' };
  if (central.includes(state)) return { id: 2, name: 'Central Standard Time', offset: 'UTC-06:00' };
  if (mountain.includes(state)) return { id: 3, name: 'Mountain Standard Time', offset: 'UTC-07:00' };
  return { id: 4, name: 'Pacific Standard Time', offset: 'UTC-08:00' };
}

// ── Market distribution for LocationMaster ──
const MARKET_DISTRIBUTION = [
  { value: 'California', weight: 39 },
  { value: 'Arizona', weight: 17 },
  { value: 'Northwest', weight: 10 },
  { value: 'Midlands', weight: 7 },
  { value: 'Florida', weight: 6 },
  { value: 'New York', weight: 5 },
  { value: 'Ohio/Kentucky', weight: 4 },
  { value: 'Great Lakes', weight: 3 },
  { value: 'New England', weight: 3 },
  { value: 'Georgia/Gulf States', weight: 2 },
  { value: 'Keystone', weight: 1.5 },
  { value: 'Capitol', weight: 1 },
  { value: 'South Central', weight: 0.8 },
  { value: 'Mid South', weight: 0.4 },
  { value: 'Heartland', weight: 0.3 },
];

// Reverse map: market -> list of states
const MARKET_TO_STATES = {};
for (const [state, market] of Object.entries(STATE_TO_MARKET)) {
  if (!MARKET_TO_STATES[market]) MARKET_TO_STATES[market] = [];
  if (!MARKET_TO_STATES[market].includes(state)) MARKET_TO_STATES[market].push(state);
}

// ── 5. Generate LocationMaster ──
async function generateLocationMaster(db, countyZipMap, scale = 1) {
  const count = Math.max(10, Math.ceil(10000 * scale));
  console.log(`Generating ${count.toLocaleString()} LocationMaster...`);

  const allStates = [...countyZipMap.keys()];
  const pharmacyNames = ['CVS PHARMACY', 'WALGREENS', 'RITE AID', 'WALMART PHARMACY', 'CVS PHARMACY'];
  const retailerNames = { 'CVS PHARMACY': 'CVS', 'WALGREENS': 'WALGREENS', 'RITE AID': 'RITE AID', 'WALMART PHARMACY': 'WALMART' };
  const createdBase = new Date('2022-01-01T00:00:00Z');
  const createdEndLoc = new Date('2022-12-31T23:59:59Z');

  const docs = [];
  for (let i = 0; i < count; i++) {
    // Pick market first, then a state in that market
    const market = weightedPick(MARKET_DISTRIBUTION);
    const marketStates = MARKET_TO_STATES[market] || allStates;
    // Filter to states we have zip data for
    const validStates = marketStates.filter((s) => countyZipMap.has(s));
    const state = validStates.length > 0 ? randomPick(validStates) : randomPick(allStates);

    const stateEntries = countyZipMap.get(state);
    const entry = randomPick(stateEntries);
    const coords = STATE_COORDS[state] || { lat: [35.0, 40.0], lng: [-90.0, -80.0] };
    const lat = parseFloat((Math.random() * (coords.lat[1] - coords.lat[0]) + coords.lat[0]).toFixed(6));
    const lng = parseFloat((Math.random() * (coords.lng[1] - coords.lng[0]) + coords.lng[0]).toFixed(6));
    const tz = tzForState(state);
    const pharmacy = randomPick(pharmacyNames);
    const createdDate = genDateInRange(createdBase, createdEndLoc);
    const updatedDate = Math.random() < 0.3
      ? genDateAfter(createdDate, 30, 730)
      : createdDate;

    docs.push({
      LocationMaster_Pk: i + 1,
      NCPDP_ID: randomInt(1000000, 9999999),
      ZIP: entry.zip,
      Latitude: lat,
      Longitude: lng,
      Location_Status: true,
      TZ_ID: tz.id,
      TZ_Name: tz.name,
      TZ_Offset: tz.offset,
      Pharmacy: pharmacy,
      Retailer: retailerNames[pharmacy] || 'CVS',
      Phone: genPhone(),
      CanDoEvent: Math.random() < 0.85,
      Address1: faker.location.streetAddress(),
      City: faker.location.city(),
      County: entry.county,
      StoreState: state,
      Market: STATE_TO_MARKET[state] || market,
      TerritoryId: randomInt(1, 50),
      TerritoryName: `${STATE_TO_MARKET[state] || market} Territory`,
      Created_Date: isoDate(createdDate),
      Created_By: 'SYSTEM',
      Updated_Date: isoDate(updatedDate),
      Updated_By: 'SYSTEM',
    });
  }

  await batchInsert(db.collection('LocationMaster'), docs);
  return docs;
}

module.exports = {
  generateUsers,
  generateUserTypeMapping,
  generateBrokerProfiles,
  generateCountyZip,
  generateLocationMaster,
};
