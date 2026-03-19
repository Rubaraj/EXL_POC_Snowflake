const { faker } = require('@faker-js/faker');
const {
  weightedPick, randomPick, randomInt, randomFloat,
  genUUID, genMBI, genPhone, genVerificationCode,
  genSeasonalDate, genDateAfter, genMedicareDOB, genPartDates,
  batchInsert, isoDate, dateStr,
  STATE_DISTRIBUTION, STATE_TO_MARKET,
} = require('./helpers');

// ── Lead status distribution ──
const LEAD_STATUS_DIST = [
  { value: 1, weight: 62 },    // New
  { value: 7, weight: 27 },    // App Submitted
  { value: 3, weight: 4 },     // SOA Created
  { value: 6, weight: 3.3 },   // eKit Sent
  { value: 8, weight: 1.6 },   // App Sent for Sig
  { value: 11, weight: 0.7 },  // App Saved
  { value: 4, weight: 0.6 },   // SOA Approved
  { value: 2, weight: 0.4 },   // Call Back
  { value: 5, weight: 0.2 },   // Not Interested
  { value: 10, weight: 0.1 },  // Do Not Contact
  { value: 9, weight: 0.1 },   // Duplicate
];

const LEAD_SOURCE_DIST = [
  { value: 'MemberDirect', weight: 43 },
  { value: 'PURL', weight: 33 },
  { value: 'FTVT', weight: 13 },
  { value: null, weight: 7 },
  { value: 'Agent Connect', weight: 1 },
  { value: 'Self Generated', weight: 1 },
  { value: 'MCIX', weight: 0.6 },
  { value: 'Referral', weight: 0.7 },
  { value: 'Event', weight: 0.7 },
];

const GENDER_DIST = [
  { value: 'M', weight: 62 },
  { value: 'F', weight: 18 },
  { value: null, weight: 20 },
];

const ETHNICITY_VALUES = [null, 'Hispanic or Latino', 'Not Hispanic or Latino'];
const RACE_VALUES = [null, 'White', 'Black or African American', 'Asian', 'American Indian', 'Other'];

/**
 * Generate Leads collection with cascade-ready metadata
 * Returns { leads, leadsByStatus } where leadsByStatus groups leads by their status
 */
async function generateLeads(db, users, countyZipMap, scale = 1) {
  const count = Math.ceil(100000 * scale);
  console.log(`\nGenerating ${count.toLocaleString()} Leads...`);

  const collection = db.collection('Leads');
  const leads = [];
  const leadsByStatus = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [], 9: [], 10: [], 11: [] };

  // Pre-compute state zip arrays for fast lookup
  const stateKeys = Array.from(countyZipMap.keys());

  for (let i = 0; i < count; i++) {
    const state = weightedPick(STATE_DISTRIBUTION);
    const stateZips = countyZipMap.get(state) || countyZipMap.get(stateKeys[0]);
    const geo = randomPick(stateZips);

    const status = weightedPick(LEAD_STATUS_DIST);
    const agent = randomPick(users);
    const gender = weightedPick(GENDER_DIST);
    const createdDate = genSeasonalDate();
    const dob = genMedicareDOB(createdDate);
    const { partADate, partBDate } = genPartDates(dob);

    const lead = {
      Pk_LeadID: genUUID(),
      FirstName: faker.person.firstName(gender === 'M' ? 'male' : gender === 'F' ? 'female' : undefined),
      LastName: faker.person.lastName(),
      Address1: faker.location.streetAddress(),
      Address2: Math.random() < 0.15 ? faker.location.secondaryAddress() : null,
      City: faker.location.city(),
      State: state,
      County: geo.county,
      ZipCode: geo.zip,
      DOB: dateStr(dob),
      Gender: gender,
      Phone: genPhone(),
      Email: Math.random() < 0.7 ? faker.internet.email() : null,
      LeadSource: weightedPick(LEAD_SOURCE_DIST),
      LeadStatus: status,
      PermissionToContact: Math.random() < 0.85,
      MedicareNumber: genMBI(),
      PartA_Eff_Date: dateStr(partADate),
      PartB_Eff_Date: dateStr(partBDate),
      FIPS: geo.fips,
      IsExistingAetnaMember: Math.random() < 0.15,
      Created_Date: isoDate(createdDate),
      Updated_Date: isoDate(genDateAfter(createdDate, 0, 30)),
      Created_By: agent.NPN_Pk,
      Updated_By: agent.NPN_Pk,
      IsDeleted: false,
      OfflineLeadID: null,
      LisSubsidy: Math.random() < 0.08 ? 'Y' : 'N',
      MedicaidNumber: Math.random() < 0.05 ? String(randomInt(100000000, 999999999)) : null,
      PlanType: weightedPick([
        { value: 'MAPD', weight: 94 },
        { value: 'PDP', weight: 3.5 },
        { value: 'MA', weight: 1.7 },
        { value: null, weight: 0.8 },
      ]),
      CallBackNumber: Math.random() < 0.3 ? genPhone() : null,
      Ethnicity: randomPick(ETHNICITY_VALUES),
      Race: randomPick(RACE_VALUES),
      IsMobileNumber: Math.random() < 0.65,
      IsTobacco: Math.random() < 0.12,
      source: weightedPick([
        { value: 'FTVT', weight: 70 },
        { value: 'ThinkAgent', weight: 20 },
        { value: null, weight: 10 },
      ]),
      CreatedUserTypeID: agent.UserTypeID,
      // Internal metadata for cascade generation (not stored in DB)
      _agentNPN: agent.NPN_Pk,
      _agentFirst: agent.First_name,
      _agentLast: agent.Last_name,
      _createdDate: createdDate,
    };

    leads.push(lead);
    if (leadsByStatus[status]) {
      leadsByStatus[status].push(lead);
    }
  }

  // Strip internal metadata before insert
  const dbDocs = leads.map(l => {
    const doc = { ...l };
    delete doc._agentNPN;
    delete doc._agentFirst;
    delete doc._agentLast;
    delete doc._createdDate;
    return doc;
  });

  await batchInsert(collection, dbDocs);
  return { leads, leadsByStatus };
}

/**
 * Generate SOA records based on lead cascade rules
 * Lead statuses 3,4,6,7,8 require SOA records
 */
async function generateSOA(db, leads, leadsByStatus, scale = 1) {
  const targetCount = Math.ceil(60000 * scale);
  console.log(`\nGenerating ${targetCount.toLocaleString()} SOA records...`);

  const collection = db.collection('SOA');
  const docs = [];
  const soaByLead = new Map(); // LeadID -> SOA doc (for cascade)

  // First: mandatory SOA records for leads with status 3,4,6,7 (status 8,11 may or may not have SOA)
  const mandatoryStatuses = [3, 4, 6, 7];
  const optionalStatuses = [8, 11];

  for (const status of mandatoryStatuses) {
    const statusLeads = leadsByStatus[status] || [];
    for (const lead of statusLeads) {
      const soaStatus = (status === 3) ? 1 : 2; // status 3 = pending, rest = approved
      const doc = createSOADoc(lead, soaStatus);
      docs.push(doc);
      soaByLead.set(lead.Pk_LeadID, doc);
    }
  }

  // Optional: some status 8 and 11 leads have SOA
  for (const status of optionalStatuses) {
    const statusLeads = leadsByStatus[status] || [];
    for (const lead of statusLeads) {
      if (Math.random() < 0.7) {
        const doc = createSOADoc(lead, 2);
        docs.push(doc);
        soaByLead.set(lead.Pk_LeadID, doc);
      }
    }
  }

  // Fill remaining with SOA records for status 1/2 leads (agents created SOA but lead didn't progress)
  const fillLeads = [...(leadsByStatus[1] || []), ...(leadsByStatus[2] || [])];
  let fillIdx = 0;
  while (docs.length < targetCount && fillIdx < fillLeads.length) {
    const lead = fillLeads[fillIdx++];
    const soaStatus = weightedPick([
      { value: 1, weight: 94 },
      { value: 2, weight: 5.3 },
      { value: 3, weight: 0.7 },
    ]);
    const doc = createSOADoc(lead, soaStatus);
    docs.push(doc);
    soaByLead.set(lead.Pk_LeadID, doc);
  }

  // If still need more, create additional SOA for random leads
  while (docs.length < targetCount) {
    const lead = randomPick(leads);
    if (!soaByLead.has(lead.Pk_LeadID)) {
      const doc = createSOADoc(lead, 1);
      docs.push(doc);
      soaByLead.set(lead.Pk_LeadID, doc);
    }
  }

  await batchInsert(collection, docs.slice(0, targetCount));
  return soaByLead;
}

function createSOADoc(lead, soaStatus) {
  const soaCreated = genDateAfter(lead._createdDate, 0, 7);
  const signDate = soaStatus === 2 ? genDateAfter(soaCreated, 0, 3) : null;

  return {
    SOAID_Pk_Id: genUUID(),
    LeadID: lead.Pk_LeadID,
    FirstName: lead.FirstName,
    LastName: lead.LastName,
    Phone: lead.Phone,
    Email: lead.Email,
    Address: lead.Address1,
    City: lead.City,
    State: lead.State,
    County: lead.County,
    ZipCode: lead.ZipCode,
    InitialMethodOfContact: weightedPick([
      { value: 'Phone', weight: 60 },
      { value: 'Email', weight: 25 },
      { value: 'In-Person', weight: 10 },
      { value: 'Online', weight: 5 },
    ]),
    PlansToPresent: weightedPick([
      { value: 'MAPD', weight: 80 },
      { value: 'MAPD,PDP', weight: 10 },
      { value: 'MA,MAPD', weight: 5 },
      { value: 'PDP', weight: 5 },
    ]),
    ReasonForNotSigningBeforeMeeting: null,
    AgentSignature: `${lead._agentFirst} ${lead._agentLast}`,
    RequestedMeetingDate: isoDate(genDateAfter(soaCreated, 0, 5)),
    BeneficiarySignature: signDate ? `${lead.FirstName} ${lead.LastName}` : null,
    BeneficiarySignatureDate: signDate ? isoDate(signDate) : null,
    BeneRepresentativeName: null,
    RelationshipWithBene: null,
    CommunicationMethod: weightedPick([
      { value: '1', weight: 93 },   // Email
      { value: '0', weight: 2.6 },
      { value: '2', weight: 2.4 },  // Phone
      { value: '3', weight: 1.7 },  // Both
    ]),
    SOA_Status: soaStatus,
    IsDeleted: false,
    Created_Date: isoDate(soaCreated),
    Created_By: lead._agentNPN,
    Updated_Date: isoDate(signDate || soaCreated),
    SOA_Created_Date: isoDate(soaCreated),
    Initials: `${lead.FirstName[0]}${lead.LastName[0]}`,
    AgentPhone: genPhone(),
    MeetingType: weightedPick([
      { value: 'homevisit', weight: 93 },
      { value: 'telephonic', weight: 5.2 },
      { value: 'other', weight: 1.1 },
      { value: 'retail', weight: 0.9 },
    ]),
    MeetingTime: `${randomInt(8, 17)}:${String(randomInt(0, 59)).padStart(2, '0')}`,
    SOASentCounter: weightedPick([
      { value: 1, weight: 80 },
      { value: 2, weight: 15 },
      { value: 3, weight: 5 },
    ]),
    BeneficiaryAddress1: lead.Address1,
    BeneficiaryAddress2: lead.Address2,
    BeneficiaryCity: lead.City,
    BeneficiaryState: lead.State,
    BeneficiaryCounty: lead.County,
    BeneficiaryZipCode: lead.ZipCode,
    IsF2F: weightedPick([
      { value: true, weight: 93 },
      { value: false, weight: 7 },
    ]),
    VerificationCode: genVerificationCode(),
    CreatedUserTypeID: lead.CreatedUserTypeID,
    // Internal: track SOA creation date for cascade
    _soaCreatedDate: soaCreated,
  };
}

/**
 * Generate EKit records
 * Lead statuses 6,7 require EKit records
 */
async function generateEKit(db, leads, leadsByStatus, soaByLead, plans, scale = 1) {
  const targetCount = Math.ceil(40000 * scale);
  console.log(`\nGenerating ${targetCount.toLocaleString()} EKit records...`);

  const collection = db.collection('EKit');
  const docs = [];
  const ekitByLead = new Map();

  // Mandatory: leads with status 6 (eKit Sent) MUST have an EKit
  const status6Leads = leadsByStatus[6] || [];
  for (const lead of status6Leads) {
    const plan = randomPick(plans);
    const soa = soaByLead.get(lead.Pk_LeadID);
    const baseDate = soa ? soa._soaCreatedDate : lead._createdDate;
    const doc = createEKitDoc(lead, plan, baseDate);
    docs.push(doc);
    ekitByLead.set(lead.Pk_LeadID, doc);
  }

  // Many status 7 leads also have EKit (but not all — some went direct)
  const status7Leads = leadsByStatus[7] || [];
  for (const lead of status7Leads) {
    if (Math.random() < 0.6) {
      const plan = randomPick(plans);
      const soa = soaByLead.get(lead.Pk_LeadID);
      const baseDate = soa ? soa._soaCreatedDate : lead._createdDate;
      const doc = createEKitDoc(lead, plan, baseDate);
      docs.push(doc);
      ekitByLead.set(lead.Pk_LeadID, doc);
    }
  }

  // Fill remaining with EKit for other leads
  const fillLeads = [...(leadsByStatus[1] || []), ...(leadsByStatus[4] || [])];
  let fillIdx = 0;
  while (docs.length < targetCount && fillIdx < fillLeads.length) {
    const lead = fillLeads[fillIdx++];
    const plan = randomPick(plans);
    const soa = soaByLead.get(lead.Pk_LeadID);
    const baseDate = soa ? soa._soaCreatedDate : lead._createdDate;
    const doc = createEKitDoc(lead, plan, baseDate);
    docs.push(doc);
    ekitByLead.set(lead.Pk_LeadID, doc);
  }

  await batchInsert(collection, docs.slice(0, targetCount));
  return ekitByLead;
}

function createEKitDoc(lead, plan, baseDate) {
  const ekitDate = genDateAfter(baseDate, 1, 14);
  return {
    EKIT_Pk_Id: genUUID(),
    LeadID_Fk_Id: lead.Pk_LeadID,
    PlanID_Fk_Id: plan.PK_PlanID,
    Document_Fk_Id: null,
    IsActive: true,
    IsDeleted: false,
    Created_Date: isoDate(ekitDate),
    Created_By: lead._agentNPN,
    Updated_Date: isoDate(ekitDate),
    Updated_By: lead._agentNPN,
    VerificationCode: genVerificationCode(),
    Contract_Year: plan.Contract_Year,
    Contract_Number: plan.Contract_Number,
    PBP: plan.PBP,
    AgentMessage: Math.random() < 0.3
      ? 'Please review the plan details and let me know if you have questions.'
      : null,
    CommunicationPref: weightedPick([
      { value: 'Email', weight: 85 },
      { value: 'SMS', weight: 10 },
      { value: 'Both', weight: 5 },
    ]),
    PlanID: plan.PK_PlanID,
    PlanName: plan.Plan_Name,
    Email: lead.Email,
    PhoneNumber: lead.Phone,
    EKITSentCounter: weightedPick([
      { value: 1, weight: 85 },
      { value: 2, weight: 12 },
      { value: 3, weight: 3 },
    ]),
    Premium: '0',
    AgentPhone: genPhone(),
    LisSubsidy: lead.LisSubsidy,
    StateChannelProductID: null,
    PlanType: plan.Product || 'MAPD',
    PaymentFrequency: 'MonthlyPremium',
    SubmittedUserTypeId: lead.CreatedUserTypeID,
    source: weightedPick([
      { value: 'FTVT', weight: 70 },
      { value: null, weight: 30 },
    ]),
    IsMultipleEkit: false,
    EkitRCCFileName: null,
    EKIT_PDF: null,
    FTVTDepartmentId: null,
    _ekitDate: ekitDate, // internal for cascade
  };
}

/**
 * Generate LeadProviders
 */
async function generateLeadProviders(db, leads, scale = 1) {
  const count = Math.ceil(30000 * scale);
  console.log(`\nGenerating ${count.toLocaleString()} LeadProviders...`);

  const collection = db.collection('LeadProviders');

  const SPECIALITY_DIST = [
    { value: 'PCP', weight: 25 },
    { value: 'Medical Center', weight: 7 },
    { value: 'Other', weight: 4 },
    { value: 'Urgent Care', weight: 4 },
    { value: 'Facility', weight: 3 },
    { value: 'Nurse Practitioner', weight: 2.5 },
    { value: 'Physical Therapy', weight: 2 },
    { value: 'Hospital', weight: 2 },
    { value: 'Cardiology', weight: 2 },
    { value: 'Surgery', weight: 1.4 },
    { value: 'Physician Assistant', weight: 1.4 },
    { value: 'Orthopedics', weight: 1.1 },
    { value: 'Lab', weight: 1.1 },
    { value: 'Hospice', weight: 1 },
    { value: 'Chiropractic', weight: 1 },
    { value: 'Podiatry', weight: 0.8 },
    { value: 'Walk-in Clinic', weight: 0.8 },
    { value: 'OB-GYN', weight: 0.7 },
    { value: 'Ophthalmology', weight: 0.7 },
    { value: 'Gastroenterology', weight: 0.6 },
    { value: 'Dermatology', weight: 0.5 },
    { value: 'Endocrinology', weight: 0.4 },
    { value: 'Psychiatry', weight: 0.4 },
    { value: 'Pulmonology', weight: 0.3 },
    { value: 'Neurology', weight: 0.3 },
    { value: 'Oncology', weight: 0.3 },
    { value: 'Urology', weight: 0.3 },
    { value: 'Rheumatology', weight: 0.2 },
  ];

  const CREDENTIALS = ['MD', 'DO', 'MSN', 'PA-C', 'NP', 'DPM', 'DC', 'PhD', 'DDS'];

  const docs = [];
  for (let i = 0; i < count; i++) {
    const lead = randomPick(leads);
    const provFirst = faker.person.firstName();
    const provLast = faker.person.lastName();
    const provMiddle = faker.person.middleName()?.[0] || '';
    const credential = randomPick(CREDENTIALS);
    const speciality = weightedPick(SPECIALITY_DIST);
    const isGroup = Math.random() < 0.3;

    docs.push({
      LeadProvider_Pk_Id: genUUID(),
      LeadID_Fk_Id: lead.Pk_LeadID,
      Provider_Identification_Number: String(randomInt(100000000, 999999999)),
      Provider_Name: isGroup
        ? `${faker.company.name()} ${speciality} Group`
        : `${provLast}, ${provFirst} ${provMiddle}., ${credential}`,
      Service_Location_Building_Name: Math.random() < 0.3 ? `${faker.company.name()} Medical Center` : null,
      Service_Location_Street_1: faker.location.streetAddress(),
      Service_Location_City_Name: lead.City,
      Service_Location_Zip_Code: lead.ZipCode,
      Service_Location_County_Name: lead.County,
      Service_Location_State_Name: lead.State,
      NPI_Number: String(randomInt(1000000000, 9999999999)),
      Accepting_New_Patients_Indicator: Math.random() < 0.75 ? 'Y' : 'N',
      Cap_Id: null,
      Speciality: speciality,
      IsDeleted: false,
      ID: randomInt(1, 999999),
      Insr_Via_Provider_Name: null,
      High_Value_Provider: Math.random() < 0.2 ? 'Y' : 'N',
      Group_Ind: isGroup ? 'G' : 'I',
      AddressId: randomInt(1, 999999),
      Preferred_Provider: Math.random() < 0.15 ? 'Y' : 'N',
    });
  }

  await batchInsert(collection, docs);
}

module.exports = {
  generateLeads,
  generateSOA,
  generateEKit,
  generateLeadProviders,
};
