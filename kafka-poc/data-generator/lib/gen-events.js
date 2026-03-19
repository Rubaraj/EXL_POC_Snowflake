const { faker } = require('@faker-js/faker');
const {
  weightedPick, randomPick, randomInt,
  genUUID, genPhone, genSeasonalDate, genDateAfter, genDateInRange,
  batchInsert, isoDate, dateStr,
  STATE_TO_MARKET,
} = require('./helpers');

// ── Event market distribution ──
const EVENT_MARKET_DIST = [
  { value: 'California', weight: 39 },
  { value: 'Arizona', weight: 17 },
  { value: 'Northwest', weight: 5 },
  { value: 'Mountain', weight: 5 },
  { value: 'Midlands', weight: 7 },
  { value: 'Florida', weight: 6 },
  { value: 'Great Lakes', weight: 4 },
  { value: 'Georgia/Gulf States', weight: 4 },
  { value: 'Capitol', weight: 3 },
  { value: 'New York', weight: 2 },
  { value: 'New Jersey', weight: 2 },
  { value: 'Keystone', weight: 1.5 },
  { value: 'New England', weight: 1.5 },
  { value: 'Ohio/Kentucky', weight: 1 },
  { value: 'Heartland', weight: 1 },
  { value: 'Mid South', weight: 0.5 },
  { value: 'South Central', weight: 0.5 },
];

const EVENT_STATUS_DIST = [
  { value: 'Scheduled', weight: 47 },
  { value: 'Completed Not Verified', weight: 40 },
  { value: 'Cancelled', weight: 11 },
  { value: 'Completed Verified', weight: 1 },
  { value: 'Pending Cancellation Approval', weight: 0.5 },
  { value: 'Completed Reported', weight: 0.03 },
];

const MARKET_TO_STATES = {
  'California': ['CA'],
  'Arizona': ['AZ'],
  'Northwest': ['WA', 'OR'],
  'Mountain': ['CO'],
  'Midlands': ['WI'],
  'Florida': ['FL'],
  'Great Lakes': ['IL', 'IN', 'MI'],
  'Georgia/Gulf States': ['GA', 'NC', 'SC', 'AL'],
  'Capitol': ['MD', 'VA'],
  'New York': ['NY'],
  'New Jersey': ['NJ'],
  'Keystone': ['PA'],
  'New England': ['CT', 'MA'],
  'Ohio/Kentucky': ['OH', 'KY'],
  'Heartland': ['MO'],
  'Mid South': ['TN', 'AR'],
  'South Central': ['TX', 'OK', 'LA'],
  'Minnesota': ['MN'],
  'St. Louis': ['MO'],
  'PDP': ['NY', 'FL', 'CA'],
};

/**
 * Generate Events
 */
async function generateEvents(db, users, locations, scale = 1) {
  const count = Math.ceil(15000 * scale);
  console.log(`\nGenerating ${count.toLocaleString()} Events...`);

  const collection = db.collection('Events');

  // Index locations by market for fast lookup
  const locationsByMarket = new Map();
  for (const loc of locations) {
    const market = loc.Market || 'Unknown';
    if (!locationsByMarket.has(market)) locationsByMarket.set(market, []);
    locationsByMarket.get(market).push(loc);
  }

  const docs = [];
  for (let i = 0; i < count; i++) {
    const market = weightedPick(EVENT_MARKET_DIST);
    const marketLocs = locationsByMarket.get(market) || locations;
    const location = randomPick(marketLocs);
    const agent = randomPick(users);
    const eventDate = genSeasonalDate();
    const status = weightedPick(EVENT_STATUS_DIST);

    // Event time: start 8AM-6PM, end 1-6 hours later
    const startHour = randomInt(8, 18);
    const durationHours = randomInt(1, 6);
    const endHour = Math.min(startHour + durationHours, 22);

    const isCompleted = status.startsWith('Completed');
    const leadCount = isCompleted ? randomInt(0, 15) : 0;
    const checkInCount = isCompleted ? randomInt(0, leadCount) : 0;

    docs.push({
      Event_Pk_Id: genUUID(),
      SF_Id: `a03WB00000${faker.string.alphanumeric(8)}`,
      Seminar_Id: `S-${String(randomInt(1000000, 9999999))}`,
      Retail_Event_ID: `E-${String(randomInt(100000, 999999))}`,
      Event_Name: `CVS Medicare Event - ${location.City || 'Store'} ${location.ZIP}`,
      Event_Category: Math.random() < 0.9999 ? 'Retail' : 'Seminar',
      Event_Status: status,
      Event_Date: dateStr(eventDate),
      Event_Start_Time: `${String(startHour).padStart(2, '0')}:00`,
      Event_End_Time: `${String(endHour).padStart(2, '0')}:00`,
      Venue_Name: 'CVS PHARMACY',
      Venue_Address1: location.Address1 || faker.location.streetAddress(),
      Venue_Address2: null,
      Venue_City: location.City || faker.location.city(),
      Venue_State: location.StoreState || randomPick(MARKET_TO_STATES[market] || ['NY']),
      Venue_Zip: location.ZIP,
      Venue_County: location.County || faker.location.county(),
      Market: market,
      Agent_NPN: agent.NPN_Pk,
      Agent_Name: `${agent.First_name} ${agent.Last_name}`,
      Agent_Email: agent.Email_Id,
      Agent_Phone: agent.Phone_number,
      LocationMaster_Pk: location.LocationMaster_Pk,
      NCPDP_ID: location.NCPDP_ID,
      Latitude: location.Latitude,
      Longitude: location.Longitude,
      Created_Date: isoDate(genDateAfter(eventDate, -30, -1)),
      Created_By: agent.NPN_Pk,
      Updated_Date: isoDate(eventDate),
      Updated_By: agent.NPN_Pk,
      IsDeleted: false,
      Cancellation_Reason: status === 'Cancelled'
        ? randomPick(['Weather', 'Low attendance expected', 'Agent unavailable', 'Store request', 'Scheduling conflict'])
        : null,
      Lead_Count_Summary: leadCount,
      CheckIn_Count: checkInCount,
      Notes: null,
      Is_Verified: status === 'Completed Verified',
      Verification_Date: status === 'Completed Verified' ? isoDate(genDateAfter(eventDate, 1, 7)) : null,
      Territory_Id: location.TerritoryId,
      Territory_Name: location.TerritoryName,
      // Additional event fields
      Event_Duration_Hours: durationHours,
      Is_Recurring: Math.random() < 0.3,
      Max_Capacity: randomInt(10, 50),
      Registration_Count: randomInt(0, 20),
    });
  }

  await batchInsert(collection, docs);
  return docs;
}

/**
 * Generate Notifications
 */
async function generateNotifications(db, users, events, scale = 1) {
  const count = Math.ceil(50000 * scale);
  console.log(`\nGenerating ${count.toLocaleString()} Notifications...`);

  const collection = db.collection('Notifications');

  const TYPE_DIST = [
    { value: 'REMINDER', weight: 86 },
    { value: 'INFO', weight: 9 },
    { value: 'ANNOUNCEMENT', weight: 4 },
    { value: 'NOLEAD', weight: 1 },
  ];

  const STATUS_DIST = [
    { value: 'UNREAD', weight: 93 },
    { value: 'READ', weight: 7 },
  ];

  const NAV_ICON_DIST = [
    { value: { nav: 'Event_Detail', icon: 'event' }, weight: 57 },
    { value: { nav: 'Event_Detail', icon: 'check-in' }, weight: 29 },
    { value: { nav: 'Calendar', icon: 'calendar' }, weight: 7 },
    { value: { nav: null, icon: 'notification' }, weight: 4 },
    { value: { nav: 'Leads', icon: 'lead' }, weight: 1 },
    { value: { nav: 'Calendar', icon: 'cancel' }, weight: 1 },
    { value: { nav: 'Dashboard', icon: 'dashboard' }, weight: 1 },
  ];

  const SUBJECT_PATTERNS = [
    (store, date) => `New Event Request || ${store} || ${date}`,
    (store, date) => `Event request || Approved || ${store} || ${date}`,
    (store, date) => `Event request || Rejected || ${store} || ${date}`,
    (store, date) => `Upcoming Event Reminder || ${store} || ${date}`,
    (store, date) => `Check-in Reminder || ${store} || ${date}`,
    (store, date) => `Event Completed || ${store} || ${date}`,
  ];

  const docs = [];
  for (let i = 0; i < count; i++) {
    const agent = randomPick(users);
    const notifType = weightedPick(TYPE_DIST);
    const navIcon = weightedPick(NAV_ICON_DIST);
    const sentDate = genSeasonalDate();
    const storeName = 'CVS PHARMACY';
    const dateFormatted = dateStr(sentDate);
    const subjectPattern = randomPick(SUBJECT_PATTERNS);

    docs.push({
      NotificationDetail_Id_Pk: genUUID(),
      Sent_Date: isoDate(sentDate),
      RecipientNPN: agent.NPN_Pk,
      Status: weightedPick(STATUS_DIST),
      IsDeleted: false,
      FCM_ID: null,
      FCM_Status: null,
      Detailed_Subject: subjectPattern(storeName, dateFormatted),
      Detailed_Body: `${storeName} at ${faker.location.streetAddress()}, ${faker.location.city()} on ${dateFormatted}. Please review and take appropriate action.`,
      Created_Date: isoDate(sentDate),
      Created_By: 'SYSTEM',
      Updated_Date: isoDate(sentDate),
      Updated_By: 'SYSTEM',
      Event_Code: navIcon.nav === 'Event_Detail' ? `EVT-${randomInt(10000, 99999)}` : null,
      Notification_Type: notifType,
      BatchID: `BATCH-${dateFormatted.replace(/-/g, '')}-${randomInt(1, 99)}`,
      NotificationSubCategory: notifType === 'REMINDER' ? 'Event' : null,
      IsManualRun: false,
      Element_Id: genUUID(),
      Element_Name: navIcon.nav || 'General',
      Navigation: navIcon.nav,
      Calendar_Date: navIcon.nav === 'Calendar' ? dateStr(genDateAfter(sentDate, 0, 7)) : null,
      Icon: navIcon.icon,
    });
  }

  await batchInsert(collection, docs);
}

module.exports = {
  generateEvents,
  generateNotifications,
};
