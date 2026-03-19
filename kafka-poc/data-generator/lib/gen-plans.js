'use strict';

const {
  weightedPick,
  randomPick,
  randomInt,
  randomFloat,
  genUUID,
  batchInsert,
  streamInsert,
  isoDate,
  dateStr,
  STATE_DISTRIBUTION,
  STATE_TO_MARKET,
} = require('./helpers');

// ── Constants ──

const MARKETS = [
  'Arizona', 'California', 'Capitol', 'Florida', 'Georgia/Gulf States',
  'Great Lakes', 'Heartland', 'Keystone', 'Mid South', 'Midlands',
  'Minnesota', 'Mountain', 'New England', 'New Jersey', 'New York',
  'Northwest', 'Ohio/Kentucky', 'PDP', 'South Central', 'St. Louis',
];

const MARKET_TO_STATES = {};
for (const [state, market] of Object.entries(STATE_TO_MARKET)) {
  if (!MARKET_TO_STATES[market]) MARKET_TO_STATES[market] = [];
  if (!MARKET_TO_STATES[market].includes(state)) MARKET_TO_STATES[market].push(state);
}
// Add St. Louis mapping
MARKET_TO_STATES['St. Louis'] = ['MO', 'IL'];
// PDP is national
MARKET_TO_STATES['PDP'] = Object.keys(STATE_TO_MARKET);

const PLAN_TYPE_PRODUCT = [
  { planType: 'PPO',        product: 'MAPD', weight: 39 },
  { planType: 'HMO',        product: 'MAPD', weight: 14 },
  { planType: 'POS',        product: 'MAPD', weight: 14 },
  { planType: 'DSNP',       product: 'MAPD', weight: 11 },
  { planType: 'CSNP',       product: 'MAPD', weight: 7 },
  { planType: 'PDP',        product: 'PDP',  weight: 5 },
  { planType: 'PPO',        product: 'MA',   weight: 4 },
  { planType: 'DSNP(HIDE)', product: 'MAPD', weight: 4 },
  { planType: 'POS',        product: 'MA',   weight: 1 },
  { planType: 'HMO',        product: 'MA',   weight: 1 },
];

const PLAN_ORIGIN_WEIGHTS = [
  { value: 'AET',   weight: 95 },
  { value: 'SSI',   weight: 4 },
  { value: 'JV-AH', weight: 1 },
];

const PLAN_STATUS_WEIGHTS = [
  { value: 'Renewal',  weight: 85 },
  { value: 'New Plan', weight: 15 },
];

const STAR_RATING_WEIGHTS = [
  { value: '3',   weight: 17 },
  { value: '3.5', weight: 41 },
  { value: '4',   weight: 32 },
  { value: '4.5', weight: 5 },
  { value: null,   weight: 5 },
];

const TIER_WEIGHTS = [
  { value: 'Signature', weight: 30 },
  { value: 'Enhanced',  weight: 25 },
  { value: 'Value',     weight: 20 },
  { value: 'Premier',   weight: 15 },
  { value: 'Advantra',   weight: 5 },
  { value: 'Basic',      weight: 5 },
];

const LEGAL_ENTITY_AET = [
  { value: 'AETNA LIFE INSURANCE COMPANY',   weight: 40 },
  { value: 'AETNA HEALTH INC. ({state})',     weight: 30 },
  { value: 'AETNA BETTER HEALTH OF {state}',  weight: 15 },
  { value: 'COVENTRY HEALTH CARE',             weight: 10 },
  { value: 'ALLINA HEALTH AETNA MEDICARE',     weight: 5 },
];

// Year distribution (raw counts before scaling)
const YEAR_RAW = [
  { year: 2026, count: 679 },
  { year: 2025, count: 726 },
  { year: 2024, count: 843 },
  { year: 2023, count: 748 },
];
const YEAR_RAW_TOTAL = YEAR_RAW.reduce((s, y) => s + y.count, 0);

// ── Helpers ──

function genPhone() {
  return `${randomInt(201, 999)}${randomInt(200, 999)}${String(randomInt(0, 9999)).padStart(4, '0')}`;
}

function genPremium(min, max, zeroPercent) {
  if (Math.random() * 100 < zeroPercent) return '0';
  return randomFloat(min + 1, max, 1).toString();
}

function genMOOP() {
  const moops = [0, 1500, 2500, 3400, 4500, 5000, 5500, 5900, 6700, 7550, 8300, 9250];
  return '$' + randomPick(moops).toLocaleString();
}

function generateContractNumbers() {
  const contracts = [];
  // ~160 H-prefix (MA/MAPD) and ~40 S-prefix (PDP)
  const hSet = new Set();
  while (hSet.size < 160) hSet.add('H' + String(randomInt(1000, 9999)));
  const sSet = new Set();
  while (sSet.size < 40) sSet.add('S' + String(randomInt(1000, 9999)));
  contracts.push(...hSet, ...sSet);
  return contracts;
}

function genDateInYear(year) {
  const maxMonth = year === 2026 ? 2 : 11;
  const month = randomInt(0, maxMonth);
  const day = randomInt(1, 28);
  return new Date(Date.UTC(year, month, day, randomInt(7, 20), randomInt(0, 59), randomInt(0, 59)));
}

function getLegalEntity(origin, state) {
  if (origin === 'SSI') return 'SILVERSCRIPT INSURANCE COMPANY';
  if (origin === 'JV-AH') return 'ALLINA HEALTH AETNA MEDICARE';
  const template = weightedPick(LEGAL_ENTITY_AET);
  return template.replace(/\{state\}/g, state || 'UNKNOWN');
}

function getPlanName(planType, product, origin) {
  if (product === 'PDP' || origin === 'SSI') {
    return Math.random() < 0.5 ? 'SilverScript Choice' : 'SilverScript Plus';
  }
  const tier = weightedPick(TIER_WEIGHTS);
  return `Aetna Medicare ${tier} (${planType})`;
}

// ── 1. generatePlans ──

async function generatePlans(db, scale) {
  const totalCount = Math.ceil(5000 * scale);
  const collection = db.collection('Plans');

  // Pre-generate contract numbers
  const allContracts = generateContractNumbers();
  const hContracts = allContracts.filter(c => c.startsWith('H'));
  const sContracts = allContracts.filter(c => c.startsWith('S'));

  // Assign star ratings per contract
  const contractStarRatings = {};
  for (const cn of allContracts) {
    contractStarRatings[cn] = weightedPick(STAR_RATING_WEIGHTS);
  }

  // Calculate per-year counts
  const yearCounts = YEAR_RAW.map(y => ({
    year: y.year,
    count: Math.round((y.count / YEAR_RAW_TOTAL) * totalCount),
  }));
  // Adjust last bucket so total matches
  const allocated = yearCounts.reduce((s, y) => s + y.count, 0);
  yearCounts[0].count += totalCount - allocated;

  const plans = [];
  let pbpCounter = 1;

  for (const { year, count } of yearCounts) {
    for (let i = 0; i < count; i++) {
      // Pick plan type / product
      const tp = weightedPick(PLAN_TYPE_PRODUCT.map(t => ({
        value: { planType: t.planType, product: t.product },
        weight: t.weight,
      })));
      const { planType, product } = tp;

      // Pick origin
      const origin = weightedPick(PLAN_ORIGIN_WEIGHTS);

      // Contract number
      const isPDP = product === 'PDP';
      const contractNum = isPDP
        ? randomPick(sContracts)
        : randomPick(hContracts);

      // PBP
      const pbp = String(randomInt(1, 99)).padStart(3, '0');

      // CP
      const cp = Math.random() < 0.02 ? '1' : null;

      // Market
      const market = isPDP ? 'PDP' : randomPick(MARKETS.filter(m => m !== 'PDP'));

      // State for legal entity
      const marketStates = MARKET_TO_STATES[market] || [];
      const state = marketStates.length > 0 ? randomPick(marketStates) : 'NY';

      // Plan status
      const planStatus = weightedPick(PLAN_STATUS_WEIGHTS);

      // Legal entity
      const legalEntity = getLegalEntity(origin, state);

      // Plan name
      const planName = getPlanName(planType, product, origin);

      // Star rating by contract
      const starRating = contractStarRatings[contractNum];

      // Dates
      const insertDate = genDateInYear(year);
      const updateDate = new Date(insertDate.getTime() + randomInt(1, 180) * 86400000);

      plans.push({
        PK_PlanID: genUUID(),
        Contract_Year: year,
        Contract_Number: contractNum,
        PBP: pbp,
        CP: cp,
        Plan_Origin: origin,
        Plan_Name: planName,
        Product: product,
        Plan_Type: planType,
        Commissionable: 'Y',
        Plan_Status: planStatus,
        Market: market,
        Legal_Entity: legalEntity,
        Marketing_Name: planName,
        Insert_DTS: isoDate(insertDate),
        Update_DTS: isoDate(updateDate),
        Insert_User_ID: 'ETL_LOAD',
        UPDATE_User_ID: 'ETL_LOAD',
        IsDeleted: false,
        StarRating: starRating,
      });
    }
  }

  await batchInsert(collection, plans);
  console.log(`  Plans: ${plans.length.toLocaleString()} generated`);
  return plans;
}

// ── 2. generatePlanBenefits ──

async function generatePlanBenefits(db, plans, scale) {
  const collection = db.collection('PlanBenefits');
  const benefitCount = Math.ceil(plans.length * 1.2);
  const docs = [];

  for (let i = 0; i < benefitCount; i++) {
    const plan = plans[i % plans.length];
    const segmentID = i < plans.length ? '1' : '2';

    docs.push({
      PK_KeyBenefitID: genUUID(),
      FK_PlanID: plan.PK_PlanID,
      SegmentID: segmentID,
      PlanNameText: plan.Plan_Name,
      PlanName: `${plan.Plan_Name} ${plan.Contract_Number}-${plan.PBP}`,
      DrugPremium: genPremium(0, 50, 60),
      DrugDeductible: weightedPick([
        { value: '0',    weight: 40 },
        { value: '$505', weight: 30 },
        { value: '$545', weight: 20 },
        { value: '$480', weight: 10 },
      ]),
      ICLLimit: randomPick(['$2,000', '$4,130', '$5,030']),
      MedicalPremium: genPremium(0, 200, 65),
      IN_MOOP: genMOOP(),
      Only_Combined_MOOP: Math.random() < 0.3 ? genMOOP() : null,
      MedicalDeductible: weightedPick([
        { value: '0',    weight: 80 },
        { value: '$250', weight: 10 },
        { value: '$500', weight: 10 },
      ]),
      OON_MedDeductible: null,
      FormularyID: randomInt(10000, 99999).toString(),
      CombinedMOOP: genMOOP(),
      LimitedNetwork: 'No',
      VisitorTravelerProgram: Math.random() < 0.3 ? 'Yes' : 'No',
      PartBPremiumReduction: Math.random() < 0.1 ? '$50.00' : null,
      PCP: weightedPick([
        { value: '$0',  weight: 80 },
        { value: '$5',  weight: 10 },
        { value: '$10', weight: 5 },
        { value: '$20', weight: 5 },
      ]),
      Specialist: weightedPick([
        { value: '$0',  weight: 30 },
        { value: '$35', weight: 30 },
        { value: '$40', weight: 20 },
        { value: '$45', weight: 20 },
      ]),
      InpatientHospital: randomPick(['$0-$350/day', '$295/day', '$0', '$250/day']),
      ER: randomPick(['$90', '$120', '$0']),
      Ambulance: randomPick(['$250', '$275', '$0']),
      AmbulatorySurgicalCenter: randomPick(['$0', '$250']),
      HomeHealthCare: '$0',
      DME: randomPick(['20%', '$0']),
      DiabeticMonitoringSupplies: '$0',
      LabServices: randomPick(['$0', '$5']),
      DiagnosticProcedures: randomPick(['$0', '$25']),
      Imaging: '$0-$350',
      PreventiveBenefits: '$0',
      AnnualPhysical: '$0',
      Fitness: Math.random() < 0.85 ? 'SilverSneakers or similar' : null,
      AlternativeTherapies: Math.random() < 0.3 ? 'Acupuncture: $5-$40' : null,
      Meals: Math.random() < 0.4 ? '28 meals after inpatient stay' : null,
      Transportation: Math.random() < 0.5 ? '24 one-way trips' : null,
      OTC: Math.random() < 0.9 ? '$50-$200/quarter' : null,
      DentalCoverage: randomPick(['Preventive + Comprehensive', 'Preventive Only']),
      EyewearCoverage: Math.random() < 0.85 ? '$0-$200 allowance' : null,
      HearingAidCoverage: Math.random() < 0.75 ? '$500-$3,000 allowance' : null,
      DentalProviderDirectoryLink: null,
      RxMOOP: genMOOP(),
      AdditionalGapCoverage: randomPick(['Yes', 'No']),
      SNF: '$0/day 1-20, $194.50/day 21-100',
      OutpatientMentalHealth: '$0-$40',
      ChiropracticRoutineServices: Math.random() < 0.7 ? '$20-$40' : null,
      OSB1: Math.random() < 0.1 ? 'Optional Supplemental Plan 1' : null,
      OSB2: null,
      OSB3: null,
      OSB4: null,
      AdditionalTelehealthServices: Math.random() < 0.6 ? '$0' : null,
      TherapeuticMassage: null,
      VBIDLIS: null,
      HRA: null,
      CustomerServiceHours: 'Oct 1-Mar 31: 8am-8pm 7 days; Apr 1-Sep 30: 8am-8pm M-F',
      PlanPhone: '1-800-' + genPhone().substring(3),
      PhysicianSearchURL: null,
      PlanType: plan.Plan_Type,
      SubType: plan.Product,
      MarketingName: plan.Plan_Name,
      WebsiteURL: 'https://www.aetnamedicare.com',
      PlanTTY: '711',
      MedicalDeductiblePlanCard: null,
      AcupunctureRoutineServices: Math.random() < 0.3 ? '$20-$50' : null,
      PaymentCard: Math.random() < 0.15 ? '$500-$2,000/year' : null,
      // Boolean flags
      hasDental: Math.random() < 0.95,
      hasEyewear: Math.random() < 0.85,
      hasHearingAid: Math.random() < 0.75,
      hasOTC: Math.random() < 0.9,
      hasTelehealth: Math.random() < 0.6,
      'has0$Premium': Math.random() < 0.65,
      'has0$PCP': Math.random() < 0.8,
      hasLabServices: Math.random() < 0.95,
      hasMeals: Math.random() < 0.4,
      hasVisitorTravelerProgram: Math.random() < 0.3,
      hasAcupuncture: Math.random() < 0.3,
      hasChiropractic: Math.random() < 0.7,
      hasPartBPremiumRed: Math.random() < 0.1,
      hasFitness: Math.random() < 0.85,
      hasWorldWideUrgentEmergentCare: Math.random() < 0.5,
      hasPaymentCard: Math.random() < 0.15,
    });
  }

  await batchInsert(collection, docs);
  console.log(`  PlanBenefits: ${docs.length.toLocaleString()} generated`);
}

// ── 3. generatePlanZipMapping ──

async function generatePlanZipMapping(db, plans, countyZipMap, scale) {
  const collection = db.collection('PlanZipMapping');
  const totalCount = Math.ceil(500000 * scale);

  // Build a lookup: market → array of { state, county, zip }
  const marketZips = {};
  for (const market of MARKETS) {
    marketZips[market] = [];
  }

  // countyZipMap is expected to be an array or map of { state, county, zip } entries
  // Build from the countyZipMap (array of objects or Map)
  const entries = Array.isArray(countyZipMap) ? countyZipMap : [...countyZipMap];
  for (const entry of entries) {
    const st = entry.state || entry.State;
    const market = STATE_TO_MARKET[st];
    if (market && marketZips[market]) {
      marketZips[market].push(entry);
    }
    // PDP is national — all zips
    if (marketZips['PDP']) {
      marketZips['PDP'].push(entry);
    }
  }

  // Fallback: if a market has no zips, fill with random entries
  for (const market of MARKETS) {
    if (marketZips[market].length === 0) {
      marketZips[market] = entries.length > 0
        ? entries.slice(0, Math.min(50, entries.length))
        : [{ state: 'NY', county: 'New York', zip: '10001' }];
    }
  }

  // Calculate zips per plan (approximately totalCount / plans.length)
  const zipsPerPlan = Math.max(1, Math.floor(totalCount / plans.length));
  let generated = 0;

  await streamInsert(collection, (index) => {
    // Determine which plan this record belongs to
    const planIndex = Math.floor(index / zipsPerPlan) % plans.length;
    const plan = plans[planIndex];

    const available = marketZips[plan.Market] || marketZips['PDP'];
    const entry = randomPick(available);

    const state = entry.state || entry.State || 'NY';
    const county = entry.county || entry.County || 'Unknown';
    const zip = entry.zip || entry.Zip || '00000';

    return {
      PK_Plan_CZID: genUUID(),
      State: state,
      County: county,
      Zip: zip,
      Multi_County_Zip: Math.random() < 0.05 ? 'Y' : 'N',
      Insert_DTS: plan.Insert_DTS,
      Update_DTS: plan.Update_DTS,
      Insert_User_ID: 'ETL_LOAD',
      UPDATE_User_ID: 'ETL_LOAD',
      IsDeleted: false,
      FK_PlanID: plan.PK_PlanID,
    };
  }, totalCount);

  console.log(`  PlanZipMapping: ${totalCount.toLocaleString()} generated`);
}

module.exports = {
  generatePlans,
  generatePlanBenefits,
  generatePlanZipMapping,
};
