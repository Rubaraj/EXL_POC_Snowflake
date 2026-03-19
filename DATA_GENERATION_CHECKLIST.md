# ThinkAgent Data Generation — Information Needed

Use this checklist to gather the missing pieces from the QA database. For each item, either paste the data directly below the question or save it as a file in this repo under a `sample-data/` folder.

---

## 1. Static Lookup Tables (Need EXACT records — these are small)

### 1.1 LeadStatusLookup (11 records)
> Run in QA MongoDB/MSSQL: `db.LeadStatusLookup.find()` or `SELECT * FROM TA_Enrollment_Lead_Status_Lookup`

Paste all 11 records here (JSON or table format):
```json
// PASTE HERE
```

### 1.2 Retailers (21 records)
> Run: `db.Retailers.find()` or `SELECT * FROM TA_Retailers`

Paste all 21 records here:
```json
// PASTE HERE
```

### 1.3 SEPMaster (30 records)
> Run: `db.SEPMaster.find()` or `SELECT * FROM TA_Enrollment_SEP_Master`

Paste all 30 records here:
```json
// PASTE HERE
```

### 1.4 UserTypes (26 records) — ALREADY IN PLAN ✅
> Already have names. But need the full document structure (what other fields exist besides ID and name?)

Confirm full schema — is it just `{ UserTypeID, UserTypeName }` or are there more fields?
```json
// PASTE 1 SAMPLE HERE
```

---

## 2. Sample Documents (Need 5-10 per collection)

For each collection below, export 5-10 representative documents. **Sanitize any real PII** (replace real names/emails/phones with fake ones, but keep the structure and field names intact).

### 2.1 Users
> Run: `db.Users.find().limit(10).toArray()` or `SELECT TOP 10 * FROM TA_USERS`
```json
// PASTE HERE
```

### 2.2 UserTypeMapping
> Run: `db.UserTypeMapping.find().limit(10).toArray()`
```json
// PASTE HERE
```

### 2.3 BrokerProfiles
> Run: `db.BrokerProfiles.find().limit(5).toArray()`
```json
// PASTE HERE
```

### 2.4 Leads (pick a mix of different LeadStatus values)
> Run: `db.Leads.find({ LeadStatus: { $in: [1, 3, 4, 6, 7, 8, 11] } }).limit(10).toArray()`
```json
// PASTE HERE
```

### 2.5 Enrollments
> Run: `db.Enrollments.find().limit(10).toArray()`
```json
// PASTE HERE
```

### 2.6 EnrollmentStore ⚠️ CRITICAL (229 fields)
> This is the most important one. We need the FULL field list.
> Run: `db.EnrollmentStore.findOne()` — paste ONE complete document with ALL 229 fields visible.
> Then: `db.EnrollmentStore.find({ EnrollStatus: "Submitted" }).limit(5).toArray()` — paste 5 submitted records.

**One complete document (all 229 fields):**
```json
// PASTE HERE
```

**5 submitted records:**
```json
// PASTE HERE
```

### 2.7 EnrollmentPortfolioStore (137 fields)
> Run: `db.EnrollmentPortfolioStore.findOne()` — paste ONE complete document with ALL fields.
> Then: `db.EnrollmentPortfolioStore.find().limit(5).toArray()`

**One complete document (all 137 fields):**
```json
// PASTE HERE
```

**5 sample records:**
```json
// PASTE HERE
```

### 2.8 Plans
> Run: `db.Plans.find({ Contract_Year: 2026 }).limit(10).toArray()`
```json
// PASTE HERE
```

### 2.9 PlanBenefits (91 fields)
> Run: `db.PlanBenefits.findOne()` — paste ONE complete document with ALL 91 fields.
> Then: `db.PlanBenefits.find().limit(5).toArray()`

**One complete document (all 91 fields):**
```json
// PASTE HERE
```

### 2.10 PlanZipMapping
> Run: `db.PlanZipMapping.find().limit(5).toArray()`
```json
// PASTE HERE
```

### 2.11 Events
> Run: `db.Events.find().limit(10).toArray()`
```json
// PASTE HERE
```

### 2.12 LocationMaster
> Run: `db.LocationMaster.find().limit(5).toArray()`
```json
// PASTE HERE
```

### 2.13 SOA
> Run: `db.SOA.find().limit(10).toArray()`
```json
// PASTE HERE
```

### 2.14 EKit
> Run: `db.EKit.find().limit(10).toArray()`
```json
// PASTE HERE
```

### 2.15 LeadProviders
> Run: `db.LeadProviders.find().limit(10).toArray()`
```json
// PASTE HERE
```

### 2.16 Notifications
> Run: `db.Notifications.find().limit(10).toArray()`
```json
// PASTE HERE
```

---

## 3. Full Field Lists (for large-schema collections)

The plan only lists ~60 of 229 EnrollmentStore fields and ~70 of 91 PlanBenefits fields. We need the complete field name list.

### 3.1 EnrollmentStore — all 229 column names
> Run in MSSQL: `SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TA_Enrollment_Store' ORDER BY ORDINAL_POSITION`
> Or in MongoDB: `Object.keys(db.EnrollmentStore.findOne())`

```
// PASTE COLUMN LIST HERE
```

### 3.2 EnrollmentPortfolioStore — all 137 column names
> Run: `SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TA_EnrollmentPortfolioStore' ORDER BY ORDINAL_POSITION`

```
// PASTE COLUMN LIST HERE
```

### 3.3 PlanBenefits — all 91 column names
> Run: `SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TA_KeyPlanBenefits' ORDER BY ORDINAL_POSITION`

```
// PASTE COLUMN LIST HERE
```

### 3.4 Events — all 47 column names
> Run: `SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TA_Events' ORDER BY ORDINAL_POSITION`

```
// PASTE COLUMN LIST HERE
```

### 3.5 SOA — all 33 column names
> Run: `SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TA_Enrollment_Lead_SOA' ORDER BY ORDINAL_POSITION`

```
// PASTE COLUMN LIST HERE
```

---

## 4. CountyZip Data (54,169 records)

### Option A: Export from QA database
> Run: `SELECT * FROM County_Zip` and save as CSV
> Save to: `sample-data/county_zip.csv`

### Option B: We source from US Census
> If you don't have this table handy, we can pull from public HUD/Census ZIP-County crosswalk data. Just confirm: **Is your County_Zip table standard US Census data, or does it have custom columns?**

Answer:
```
// Standard Census data OR custom — describe any extra fields
```

---

## 5. Quick Clarification Questions

### 5.1 Data source — MongoDB or MSSQL?
> The plan mentions "original data in MSSQL Server" but the POC uses MongoDB. Which database should we query for sample data?
- [ ] QA MSSQL Server (original source)
- [ ] QA MongoDB (already migrated)
- [ ] Both available

### 5.2 Where should generated data go?
- [ ] Insert directly into the RPi5 MongoDB (`poc_db`) and let Kafka sync to Snowflake
- [ ] Generate JSON files and bulk-import into a separate MongoDB instance
- [ ] Load directly into Snowflake (skip MongoDB/Kafka for the dashboard POC)

### 5.3 Do you have existing sample data exports?
> The plan mentions "Sample data files have been captured from the QA MSSQL database with 50-100 records per table." Do you have these files somewhere?
- [ ] Yes — location: _______________
- [ ] No — need to re-extract

### 5.4 Generation tool preference
- [ ] Node.js (matches existing project stack — create-ppt.js)
- [ ] Python (better data generation libraries like Faker)
- [ ] No preference

### 5.5 Snowflake trial status
> Is the Snowflake free trial (swymwjs-ih56791) still active, or do we need a new one?
- [ ] Still active
- [ ] Expired — need new trial
- [ ] Not sure

---

## 6. Priority Order

If you can only provide a subset, prioritize in this order:

1. **EnrollmentStore full document** (229 fields) — most critical
2. **Static lookups** (LeadStatusLookup, SEPMaster, Retailers) — small effort, high impact
3. **Leads sample** (10 docs with mixed statuses)
4. **Plans + PlanBenefits samples** (with full field lists)
5. **EnrollmentPortfolioStore full document** (137 fields)
6. **SOA + EKit samples** (for funnel dashboard)
7. **Events + LocationMaster samples** (for geo/event dashboards)
8. Everything else

---

## How to Submit

Either:
1. **Paste directly** into each section above and save this file
2. **Create a `sample-data/` folder** in this repo and drop JSON/CSV exports there
3. **Share a link** to exported files if they're too large for git

Once you've filled in what you can, we'll proceed with building the complete `THINKAGENT_DATA_INSTRUCTIONS.md` and the data generation script.
