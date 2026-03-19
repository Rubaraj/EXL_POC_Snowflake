const { faker } = require('@faker-js/faker');
const {
  weightedPick, randomPick, randomInt, randomFloat,
  genUUID, genMBI, genPhone, genConfirmationNumber, genVerificationCode,
  genSeasonalDate, genDateAfter, genEffectiveDate,
  batchInsert, streamInsert, isoDate, dateStr,
  YEAR_WEIGHTS, STATE_TO_MARKET,
} = require('./helpers');

// ── Agent volume distribution (Pareto) ──
// Top 5% → 40%, Next 15% → 30%, Middle 30% → 20%, Bottom 50% → 10%
function buildAgentWeights(users) {
  const sorted = [...users].sort(() => Math.random() - 0.5); // shuffle
  const n = sorted.length;
  const weights = new Map();

  const top5 = Math.ceil(n * 0.05);
  const next15 = Math.ceil(n * 0.15);
  const mid30 = Math.ceil(n * 0.30);

  for (let i = 0; i < n; i++) {
    let w;
    if (i < top5) w = 40 / top5;
    else if (i < top5 + next15) w = 30 / next15;
    else if (i < top5 + next15 + mid30) w = 20 / mid30;
    else w = 10 / (n - top5 - next15 - mid30);
    weights.set(sorted[i].NPN_Pk, { user: sorted[i], weight: w });
  }
  return weights;
}

function pickWeightedAgent(agentWeights) {
  const entries = Array.from(agentWeights.values());
  return weightedPick(entries.map(e => ({ value: e.user, weight: e.weight })));
}

// ── EnrollmentStore status distribution ──
const ENROLL_STATUS_DIST = [
  { value: 'Submitted', weight: 93.6 },
  { value: 'New', weight: 2.8 },
  { value: 'Expired', weight: 2.4 },
  { value: 'Saved', weight: 1.1 },
  { value: 'Deleted', weight: 0.06 },
  { value: 'Awaiting Signature', weight: 0.04 },
  { value: 'Cancelled', weight: 0.03 },
];

const PLAN_TYPE_DIST = [
  { value: 'MAPD', weight: 93.7 },
  { value: 'PDP', weight: 3.5 },
  { value: 'MA', weight: 1.7 },
  { value: 'PD', weight: 1.1 },
];

const BRAND_DIST = [
  { value: 'Aetna Medicare', weight: 97.9 },
  { value: 'AET', weight: 0.8 },
  { value: 'Aetna Better Health of NJ', weight: 0.3 },
  { value: 'Aetna Better Health of VA', weight: 0.3 },
  { value: 'SilverScript', weight: 0.5 },
  { value: 'Coventry', weight: 0.2 },
];

const SEP_CODE_DIST = [
  { value: 'NEW', weight: 88 },
  { value: 'LPI', weight: 4 },
  { value: 'AEP', weight: 3 },
  { value: 'MRD', weight: 1 },
  { value: 'ICE', weight: 0.7 },
  { value: 'OEP', weight: 1 },
  { value: 'MOV', weight: 0.5 },
  { value: 'MCD', weight: 0.3 },
  { value: 'DEP', weight: 0.5 },
  { value: 'LEC', weight: 0.3 },
  { value: 'IEP', weight: 0.4 },
  { value: 'LT2', weight: 0.2 },
  { value: 'RET', weight: 0.1 },
];

const ENROLLMENT_SOURCE_DIST = [
  { value: 'FTVT', weight: 96 },
  { value: 'ThinkAgentURL_net', weight: 3 },
  { value: 'CustomerCare', weight: 1 },
];

const MEDIA_TYPE_DIST = [
  { value: 'Online', weight: 75 },
  { value: 'Paper', weight: 15 },
  { value: 'Phone', weight: 10 },
];

/**
 * Generate EnrollmentStore — the main 229-field enrollment table
 * Uses cascade rules: status 7 leads get Submitted enrollments, etc.
 */
async function generateEnrollmentStore(db, leads, leadsByStatus, users, plans, planZipIndex, soaByLead, ekitByLead, scale = 1) {
  const count = Math.ceil(150000 * scale);
  console.log(`\nGenerating ${count.toLocaleString()} EnrollmentStore records...`);

  const collection = db.collection('EnrollmentStore');
  const agentWeights = buildAgentWeights(users);
  const enrollmentStoreRecords = [];

  // Phase 1: Cascade-required enrollments from leads with status 7, 8, 11
  const cascadeMap = [
    { status: 7, enrollStatus: 'Submitted' },
    { status: 8, enrollStatus: 'Awaiting Signature' },
    { status: 11, enrollStatus: 'Saved' },
  ];

  for (const { status, enrollStatus } of cascadeMap) {
    const statusLeads = leadsByStatus[status] || [];
    for (const lead of statusLeads) {
      if (enrollmentStoreRecords.length >= count) break;
      const plan = findPlanForLead(lead, plans, planZipIndex);
      const doc = createEnrollmentStoreDoc(lead, plan, enrollStatus, soaByLead, ekitByLead);
      enrollmentStoreRecords.push(doc);
    }
  }

  // Phase 2: Fill remaining with seasonal distribution
  while (enrollmentStoreRecords.length < count) {
    const lead = randomPick(leads);
    const agent = pickWeightedAgent(agentWeights);
    const plan = randomPick(plans);
    const enrollStatus = weightedPick(ENROLL_STATUS_DIST);
    const createdDate = genSeasonalDate();

    const doc = createEnrollmentStoreDocFreeform(lead, agent, plan, enrollStatus, createdDate);
    enrollmentStoreRecords.push(doc);
  }

  await batchInsert(collection, enrollmentStoreRecords.slice(0, count));
  return enrollmentStoreRecords;
}

function findPlanForLead(lead, plans, planZipIndex) {
  // Try to find a plan available in the lead's state
  if (planZipIndex && planZipIndex.has(lead.State)) {
    const statePlans = planZipIndex.get(lead.State);
    if (statePlans.length > 0) return randomPick(statePlans);
  }
  return randomPick(plans);
}

function createEnrollmentStoreDoc(lead, plan, enrollStatus, soaByLead, ekitByLead) {
  const soa = soaByLead ? soaByLead.get(lead.Pk_LeadID) : null;
  const ekit = ekitByLead ? ekitByLead.get(lead.Pk_LeadID) : null;

  // Chronological: lead -> SOA -> EKit -> enrollment
  let baseDate = lead._createdDate;
  if (soa && soa._soaCreatedDate) baseDate = soa._soaCreatedDate;
  if (ekit && ekit._ekitDate) baseDate = ekit._ekitDate;
  const createdDate = genDateAfter(baseDate, 1, 30);

  return buildEnrollStoreDoc(lead, lead._agentNPN, lead._agentFirst, lead._agentLast,
    plan, enrollStatus, createdDate);
}

function createEnrollmentStoreDocFreeform(lead, agent, plan, enrollStatus, createdDate) {
  return buildEnrollStoreDoc(lead, agent.NPN_Pk, agent.First_name, agent.Last_name,
    plan, enrollStatus, createdDate);
}

function buildEnrollStoreDoc(lead, agentNPN, agentFirst, agentLast, plan, enrollStatus, createdDate) {
  const confNumber = enrollStatus === 'Submitted' ? genConfirmationNumber(createdDate) : null;
  const effectiveDate = genEffectiveDate(createdDate);
  const planType = weightedPick(PLAN_TYPE_DIST);
  const planYear = createdDate.getFullYear() + (createdDate.getMonth() >= 9 ? 1 : 0);
  const electionType = weightedPick([
    { value: 'E', weight: 87.8 },
    { value: 'S', weight: 5.5 },
    { value: 'A', weight: 2.9 },
    { value: 'I', weight: 1.8 },
    { value: 'F', weight: 1.0 },
  ]);

  return {
    Enroll_PK_ID: genUUID(),
    LeadID_Fk: lead.Pk_LeadID,
    Premium: weightedPick([
      { value: '0', weight: 65 },
      { value: String(randomFloat(1, 50, 2)), weight: 20 },
      { value: String(randomFloat(50, 200, 2)), weight: 15 },
    ]),
    ContractNumber: plan.Contract_Number,
    PBP: plan.PBP,
    PlanType: planType,
    BrandName: weightedPick(BRAND_DIST),
    PlanYear: planYear,
    EnrollStatus: enrollStatus,
    MemberOrAgentEnroll: weightedPick([
      { value: 'A', weight: 81 },
      { value: 'M', weight: 19 },
    ]),
    OnlineOrEnroll: weightedPick([
      { value: 'Online', weight: 99 },
      { value: 'Offline', weight: 1 },
    ]),
    EnrollmentSource: weightedPick(ENROLLMENT_SOURCE_DIST),
    // Consumer info
    CnInfFirstName: lead.FirstName,
    CnInfLastName: lead.LastName,
    CnInfMiddleInitial: lead.FirstName[0] || null,
    CnInfGender: lead.Gender,
    CnInfDOB: lead.DOB,
    CnInfAddr1: lead.Address1,
    CnInfAddr2: lead.Address2,
    CnInfcity: lead.City,
    CnInfstate: lead.State,
    CnInfcounty: lead.County,
    CnInfzipCode: lead.ZipCode,
    CnInfPrimaryPhoneNumber: lead.Phone,
    CnInfEmailAddress: lead.Email,
    CnfInfMedicareNumber: lead.MedicareNumber,
    CnfInfPartAEffDate: lead.PartA_Eff_Date,
    CnfInfPartBEffDate: lead.PartB_Eff_Date,
    // Election
    ElectionType: electionType,
    SEPReasonCode: weightedPick(SEP_CODE_DIST),
    EPRequestEffectiveDate: dateStr(effectiveDate),
    EPIsAEP: createdDate.getMonth() >= 9 || createdDate.getMonth() <= 0,
    // Agent info
    Created_By: agentNPN,
    Created_Date: isoDate(createdDate),
    Updated_Date: isoDate(genDateAfter(createdDate, 0, 5)),
    AgentFirstName: agentFirst,
    AgentLastName: agentLast,
    AgentNPN: agentNPN,
    // Verification
    VerificationCode: genVerificationCode(),
    ConfNumber: confNumber,
    // Demographics
    Ethnicity: lead.Ethnicity,
    Race: lead.Race,
    // SOA
    SOA: Math.random() < 0.85 ? 'Y' : 'N',
    MediaType: weightedPick(MEDIA_TYPE_DIST),
    isTAConversion: Math.random() < 0.05,
    // Payment
    PmntInfInvoiceOrEFTOrSSAOrRRB: weightedPick([
      { value: 'SSA', weight: 60 },
      { value: 'Invoice', weight: 25 },
      { value: 'EFT', weight: 10 },
      { value: 'RRB', weight: 5 },
    ]),
    // Other info
    OthrInfIsMedicaidEnroll: Math.random() < 0.05 ? 'Y' : 'N',
    OthrInfMedicaidNumber: lead.MedicaidNumber,
    OthrInfIsLTC: Math.random() < 0.02 ? 'Y' : 'N',
    OthrInfOthrLang: weightedPick([
      { value: null, weight: 85 },
      { value: 'Spanish', weight: 10 },
      { value: 'Chinese', weight: 2 },
      { value: 'Korean', weight: 1 },
      { value: 'Vietnamese', weight: 1 },
      { value: 'Russian', weight: 1 },
    ]),
    // Signatures
    AgentSignature: enrollStatus === 'Submitted' ? `${agentFirst} ${agentLast}` : null,
    MemberSignature: enrollStatus === 'Submitted' ? `${lead.FirstName} ${lead.LastName}` : null,
    MemberSignatureDate: enrollStatus === 'Submitted' ? isoDate(createdDate) : null,
    // Flags
    IsDeleted: false,
    DoesWork: Math.random() < 0.1 ? 'Y' : 'N',
    DoesSpouseWork: Math.random() < 0.08 ? 'Y' : 'N',
    // Plan details
    PlanName: plan.Plan_Name,
    PlanID: plan.PK_PlanID,
    Market: plan.Market || STATE_TO_MARKET[lead.State] || 'Unknown',
    // Remaining ~170 fields as null (dashboard-relevant ones are populated above)
    MailingAddr1: null, MailingAddr2: null, MailingCity: null, MailingState: null,
    MailingZip: null, MailingCounty: null,
    PCP_ID: null, PCP_Name: null, PCP_Phone: null, PCP_Address: null,
    EmergencyContactName: null, EmergencyContactPhone: null,
    PowerOfAttorneyName: null, PowerOfAttorneyPhone: null,
    ESRD: 'N',
    HospiceElection: 'N',
    IsNursingHome: 'N',
    SbtAgentSignDate: enrollStatus === 'Submitted' ? isoDate(createdDate) : null,
    SbtMemberSignDate: enrollStatus === 'Submitted' ? isoDate(createdDate) : null,
    SubmittedDate: enrollStatus === 'Submitted' ? isoDate(createdDate) : null,
    SourceApplication: weightedPick([
      { value: 'Think Agent', weight: 62.6 },
      { value: null, weight: 20.8 },
      { value: 'MISOC', weight: 4 },
      { value: 'Flowtivity', weight: 3.5 },
      { value: 'Partner', weight: 2.4 },
      { value: 'Sunfire', weight: 1.9 },
      { value: 'DRX', weight: 1.2 },
      { value: 'ThinkAgent', weight: 0.9 },
      { value: 'Ascend', weight: 0.7 },
    ]),
  };
}

/**
 * Generate Enrollments (CMS confirmation records)
 * ~4% of submitted EnrollmentStore get a matching Enrollments record
 * ~3000 match EnrollmentStore, ~2000 are external
 */
async function generateEnrollments(db, enrollmentStoreRecords, users, scale = 1) {
  const count = Math.ceil(5000 * scale);
  const matchCount = Math.ceil(3000 * scale);
  console.log(`\nGenerating ${count.toLocaleString()} Enrollments (CMS confirmations)...`);

  const collection = db.collection('Enrollments');
  const docs = [];

  // Phase 1: Matching records from submitted EnrollmentStore
  const submitted = enrollmentStoreRecords.filter(e => e.EnrollStatus === 'Submitted' && e.ConfNumber);
  const shuffled = submitted.sort(() => Math.random() - 0.5);

  for (let i = 0; i < Math.min(matchCount, shuffled.length); i++) {
    const es = shuffled[i];
    const createdDate = new Date(es.Created_Date);
    const enrollDate = genDateAfter(createdDate, 0, 0.01); // seconds after

    docs.push({
      Enrollment_Pk_Id: genUUID(),
      ConfirmationNumber: es.ConfNumber,
      EffectiveDate: es.EPRequestEffectiveDate,
      Agent_APP_USERID: es.AgentNPN,
      AgentNPN: es.AgentNPN,
      AgentFirstName: es.AgentFirstName,
      AgentLastName: es.AgentLastName,
      SourceApplication: 'Think Agent',
      Created_Date: isoDate(enrollDate),
      SFDCID: null,
      Contract_Number: es.ContractNumber,
      PBP: es.PBP,
      Plan_Name: es.PlanName,
      Election_Period: es.ElectionType === 'E' ? 'AEP' : es.ElectionType === 'M' ? 'OEP' : 'SEP',
      First_Name: es.CnInfFirstName,
      Middle_Initial: es.CnInfMiddleInitial,
      Last_Name: es.CnInfLastName,
      Gender: es.CnInfGender,
      DOB: es.CnInfDOB,
      Phone: es.CnInfPrimaryPhoneNumber,
      Email: es.CnInfEmailAddress,
      Primary_Address1: es.CnInfAddr1,
      Primary_Address2: es.CnInfAddr2,
      Primary_City: es.CnInfcity,
      Primary_State: es.CnInfstate,
      Primary_Zip: es.CnInfzipCode,
      Primary_County: es.CnInfcounty,
      PCP_ID: null,
      Provider_First_Name: null,
      Provider_Last_Name: null,
      Provider_Address: null,
      Provider_City: null,
      Provider_State: null,
      Provider_Zip: null,
      Medicare_Number: es.CnfInfMedicareNumber,
      Nursing_Home: 'N',
      Is_Medicaid: es.OthrInfIsMedicaidEnroll,
      Enroll_Type: weightedPick([
        { value: 'PPO', weight: 35 },
        { value: 'DSNP', weight: 27 },
        { value: 'POS', weight: 12 },
        { value: 'HMO', weight: 10 },
        { value: 'CSNP', weight: 6 },
        { value: 'MAPD', weight: 3 },
        { value: 'DSNP(HIDE)', weight: 3 },
        { value: 'PDP', weight: 4 },
      ]),
      Initiated_Through: 'ThinkAgent',
      VBE_Requested_Date: null,
      Date_Of_Enrollment: dateStr(enrollDate),
      Enrollment_Agent_NPN: es.AgentNPN,
    });
  }

  // Phase 2: External-source enrollments (no matching EnrollmentStore)
  const externalCount = count - docs.length;
  for (let i = 0; i < externalCount; i++) {
    const agent = randomPick(users);
    const createdDate = genSeasonalDate();
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();

    docs.push({
      Enrollment_Pk_Id: genUUID(),
      ConfirmationNumber: genConfirmationNumber(createdDate),
      EffectiveDate: dateStr(genEffectiveDate(createdDate)),
      Agent_APP_USERID: agent.NPN_Pk,
      AgentNPN: agent.NPN_Pk,
      AgentFirstName: agent.First_name,
      AgentLastName: agent.Last_name,
      SourceApplication: weightedPick([
        { value: null, weight: 50 },
        { value: 'MISOC', weight: 20 },
        { value: 'DRX', weight: 12 },
        { value: 'Sunfire', weight: 10 },
        { value: 'Partner', weight: 8 },
      ]),
      Created_Date: isoDate(createdDate),
      SFDCID: null,
      Contract_Number: `H${randomInt(1000, 9999)}`,
      PBP: String(randomInt(1, 99)).padStart(3, '0'),
      Plan_Name: `Aetna Medicare ${randomPick(['Signature', 'Enhanced', 'Value'])} (PPO)`,
      Election_Period: randomPick(['AEP', 'OEP', 'SEP']),
      First_Name: firstName,
      Middle_Initial: faker.person.middleName()?.[0] || null,
      Last_Name: lastName,
      Gender: randomPick(['M', 'F']),
      DOB: dateStr(new Date(Date.UTC(randomInt(1930, 1960), randomInt(0, 11), randomInt(1, 28)))),
      Phone: genPhone(),
      Email: faker.internet.email(),
      Primary_Address1: faker.location.streetAddress(),
      Primary_Address2: null,
      Primary_City: faker.location.city(),
      Primary_State: randomPick(['NY', 'FL', 'CA', 'TX', 'PA', 'AZ', 'KY']),
      Primary_Zip: faker.location.zipCode('#####'),
      Primary_County: faker.location.county(),
      PCP_ID: null,
      Provider_First_Name: null,
      Provider_Last_Name: null,
      Provider_Address: null,
      Provider_City: null,
      Provider_State: null,
      Provider_Zip: null,
      Medicare_Number: genMBI(),
      Nursing_Home: 'N',
      Is_Medicaid: 'N',
      Enroll_Type: weightedPick([
        { value: 'PPO', weight: 35 },
        { value: 'DSNP', weight: 27 },
        { value: 'POS', weight: 12 },
        { value: 'HMO', weight: 10 },
        { value: 'CSNP', weight: 6 },
        { value: 'MAPD', weight: 3 },
        { value: 'PDP', weight: 7 },
      ]),
      Initiated_Through: randomPick(['MISOC', 'DRX', 'Sunfire', 'Partner']),
      VBE_Requested_Date: null,
      Date_Of_Enrollment: dateStr(createdDate),
      Enrollment_Agent_NPN: agent.NPN_Pk,
    });
  }

  await batchInsert(collection, docs);
  return docs;
}

/**
 * Generate EnrollmentPortfolioStore (Medigap/ANC enrollments)
 */
async function generateEnrollmentPortfolioStore(db, leads, users, scale = 1) {
  const count = Math.ceil(40000 * scale);
  console.log(`\nGenerating ${count.toLocaleString()} EnrollmentPortfolioStore records...`);

  const collection = db.collection('EnrollmentPortfolioStore');

  const PRODUCT_DIST = [
    { value: { name: 'Medicare Supplement', type: 'MEDSUP' }, weight: 26 },
    { value: { name: 'Hospital Indemnity Flex', type: 'ANC' }, weight: 17 },
    { value: { name: 'Final Expense', type: 'ANC' }, weight: 11 },
    { value: { name: 'Recovery Care', type: 'ANC' }, weight: 7 },
    { value: { name: 'Dental Vision Hearing', type: 'ANC' }, weight: 7 },
    { value: { name: 'Protection Series FE', type: 'ANC' }, weight: 6 },
    { value: { name: 'Cancer Insurance', type: 'ANC' }, weight: 5 },
    { value: { name: 'DVH Plus', type: 'ANC' }, weight: 5 },
    { value: { name: 'Heart Attack/Stroke', type: 'ANC' }, weight: 4 },
    { value: { name: 'DVH Flex', type: 'ANC' }, weight: 4 },
    { value: { name: 'Home Care Plus', type: 'ANC' }, weight: 4 },
    { value: { name: 'Hospital Indemnity', type: 'ANC' }, weight: 2 },
    { value: { name: 'Accident Insurance', type: 'ANC' }, weight: 1 },
    { value: { name: 'Critical Illness', type: 'ANC' }, weight: 1 },
  ];

  const COMPANY_DIST = [
    { value: 'CLI', weight: 71 },
    { value: 'ACC', weight: 13 },
    { value: 'AHLC', weight: 9 },
    { value: 'AHIC', weight: 6 },
    { value: 'ANIC', weight: 1 },
  ];

  const STATUS_DIST = [
    { value: 'Submitted', weight: 66 },
    { value: 'Saved', weight: 25 },
    { value: 'Awaiting Signature', weight: 5 },
    { value: 'Awaiting Agent signature', weight: 3 },
    { value: 'Cancelled', weight: 1 },
  ];

  const SOURCE_DIST = [
    { value: 'add-portfolio', weight: 93 },
    { value: 'Ekit', weight: 4 },
    { value: 'PURLFlow', weight: 1.4 },
    { value: 'FTVT', weight: 0.5 },
    { value: null, weight: 1.1 },
  ];

  const docs = [];
  for (let i = 0; i < count; i++) {
    const lead = randomPick(leads);
    const agent = randomPick(users);
    const product = weightedPick(PRODUCT_DIST);
    const planType = product.type === 'MEDSUP' ? 'MEDSUP' : 'ANC';
    const createdDate = genSeasonalDate();
    const enrollStatus = weightedPick(STATUS_DIST);
    const premium = planType === 'MEDSUP'
      ? randomFloat(20, 300, 2)
      : randomFloat(5, 80, 2);

    docs.push({
      EnrollPortId_PK: genUUID(),
      LeadID_Fk: lead.Pk_LeadID,
      PlanType: planType,
      RequestEffectiveDate: dateStr(genEffectiveDate(createdDate)),
      PaymentMode: weightedPick([
        { value: 'Monthly', weight: 70 },
        { value: 'Quarterly', weight: 15 },
        { value: 'Semi-Annual', weight: 10 },
        { value: 'Annual', weight: 5 },
      ]),
      ModalPremium: premium,
      ApplicantName: `${lead.FirstName} ${lead.LastName}`,
      ApplicantFirstName: lead.FirstName,
      ApplicantLastName: lead.LastName,
      ApplicantPhoneNum: lead.Phone,
      ApplicantGender: lead.Gender,
      ApplicantDOB: lead.DOB,
      ApplicantZipCode: lead.ZipCode,
      ApplicantState: lead.State,
      ApplicantCity: lead.City,
      ApplicantCounty: lead.County,
      ApplicantAddress1: lead.Address1,
      ApplicantAddress2: lead.Address2,
      ApplicantMedicareNum: lead.MedicareNumber,
      MedicareEffectivePartA: lead.PartA_Eff_Date,
      MedicareEffectivePartB: lead.PartB_Eff_Date,
      ApplicationType: weightedPick([
        { value: 'New', weight: 80 },
        { value: 'Replacement', weight: 20 },
      ]),
      EnrollStatus: enrollStatus,
      PlanName: `${product.name} Plan`,
      ProductName: product.name,
      CompanyCode: weightedPick(COMPANY_DIST),
      SourceOfEnrollment: weightedPick(SOURCE_DIST),
      SbtApplicantSignDate: enrollStatus === 'Submitted' ? isoDate(createdDate) : null,
      SbtAgentSignDate: enrollStatus === 'Submitted' ? isoDate(createdDate) : null,
      CreatedBy: agent.NPN_Pk,
      CreatedDate: isoDate(createdDate),
      UpdatedDate: isoDate(genDateAfter(createdDate, 0, 5)),
      UpdatedBy: agent.NPN_Pk,
      IsDeleted: false,
      AgentNPN: agent.NPN_Pk,
      AgentFirstName: agent.First_name,
      AgentLastName: agent.Last_name,
      // Additional fields (less critical for dashboards)
      BeneficiaryName: null,
      BeneficiaryRelationship: null,
      BeneficiaryDOB: null,
      BankName: null,
      AccountNumber: null,
      RoutingNumber: null,
      PaymentMethod: weightedPick([
        { value: 'EFT', weight: 60 },
        { value: 'DirectBill', weight: 30 },
        { value: 'CreditCard', weight: 10 },
      ]),
      SignatureType: enrollStatus === 'Submitted' ? 'Electronic' : null,
      VerificationCode: genVerificationCode(),
      Market: STATE_TO_MARKET[lead.State] || 'Unknown',
    });
  }

  await batchInsert(collection, docs);
  return docs;
}

module.exports = {
  generateEnrollmentStore,
  generateEnrollments,
  generateEnrollmentPortfolioStore,
};
