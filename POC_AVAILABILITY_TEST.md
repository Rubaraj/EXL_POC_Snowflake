# POC Availability Test: Zero Data Loss During Outage

<!-- ============================================================
     This document provides a step-by-step script to demonstrate
     that the MongoDB → Kafka → Snowflake pipeline recovers
     gracefully from an outage with ZERO data loss.

     WHAT WE'RE PROVING:
     When the central hub (Laptop: Kafka + Snowflake Sink) goes
     down, MongoDB on the edge (RPi5) continues accepting data.
     When the central hub comes back, ALL data that was written
     during the outage is automatically synced to Snowflake.

     PREREQUISITES:
       - Full pipeline already set up and working (see POC_SETUP_GUIDE.md)
       - RPi5 IP: 192.168.0.175
       - Laptop IP: 192.168.0.113
       - Snowflake account: swymwjs-ih56791
     ============================================================ -->

---

## Test Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     AVAILABILITY TEST TIMELINE                      │
├──────────┬──────────────────────────────────────────────────────────┤
│ Phase 1  │ BASELINE — Verify pipeline works end-to-end             │
│ Phase 2  │ BREAK — Stop Laptop (Kafka + Sink go down)              │
│ Phase 3  │ WRITE — Insert data into MongoDB during outage          │
│ Phase 4  │ RECOVER — Start Laptop back up                          │
│ Phase 5  │ VERIFY — Confirm ALL data appears in Snowflake          │
└──────────┴──────────────────────────────────────────────────────────┘

Architecture during outage:

  RPi5 (EDGE - STILL RUNNING)              Laptop (CENTRAL - DOWN)
  ┌─────────────────────┐                  ┌─────────────────────┐
  │  MongoDB ✅ UP       │                  │  Kafka ❌ DOWN       │
  │  (accepting writes)  │       ╳          │  Sink  ❌ DOWN       │
  │                      │  no connection   │  UI    ❌ DOWN       │
  │  Source Connector    │◄──────╳─────────►│                     │
  │  (retrying...)       │                  │  Snowflake ⚠️       │
  └─────────────────────┘                  │  (no new data)      │
                                            └─────────────────────┘
```

---

## Pre-Test Checklist

<!-- Run these checks before starting the test to make sure
     everything is in a known good state -->

**On Laptop — verify all containers are running:**
```powershell
docker ps --format "table {{.Names}}\t{{.Status}}"
```
Expected: `kafka`, `kafka-connect-sink`, `kafka-ui` all showing "Up"

**On RPi5 — verify MongoDB and source connector are running:**
```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```
Expected: `mongodb` (Up/healthy), `kafka-connect-source` (Up)

**On Snowflake — note current row count (our "before" count):**
```sql
USE ROLE ACCOUNTADMIN;
SELECT COUNT(*) AS rows_before_test FROM POC_DB.MONGO_SYNC.ORDERS;
```
> 📝 Write down this number: _______ (rows before test)

---

## Phase 1: BASELINE — Verify Pipeline Works

<!-- ============================================================
     Purpose: Confirm the pipeline is healthy before we break it.
     We insert a tagged record and verify it arrives in Snowflake.
     ============================================================ -->

### Step 1.1: Insert a Baseline Record

**On RPi5:**
```bash
docker exec -it mongodb mongosh --eval '
  db = db.getSiblingDB("poc_db");
  db.orders.insertOne({
    orderId: "AVAIL-BEFORE-001",
    customer: "Baseline Test User",
    product: "Pipeline Health Check",
    quantity: 1,
    price: 1.00,
    status: "delivered",
    createdAt: new Date()
  });
  print("✅ Baseline record inserted");
'
```

### Step 1.2: Verify in Kafka UI

**On Laptop — open browser:**
```
http://localhost:8080
```
- Navigate to **Topics** → `mongo.poc_db.orders` → **Messages**
- Confirm the `AVAIL-BEFORE-001` message appears

### Step 1.3: Verify in Snowflake

**Wait 60 seconds**, then run in Snowflake:
```sql
SELECT
    PARSE_JSON(RECORD_CONTENT):fullDocument.orderId::STRING AS order_id,
    PARSE_JSON(RECORD_CONTENT):fullDocument.customer::STRING AS customer,
    PARSE_JSON(RECORD_CONTENT):fullDocument.product::STRING AS product
FROM POC_DB.MONGO_SYNC.ORDERS
WHERE PARSE_JSON(RECORD_CONTENT):fullDocument.orderId::STRING = 'AVAIL-BEFORE-001';
```

**Expected Result:**
| order_id | customer | product |
|----------|----------|---------|
| AVAIL-BEFORE-001 | Baseline Test User | Pipeline Health Check |

> ✅ **PASS:** Baseline record arrived in Snowflake. Pipeline is healthy.
>
> ❌ **FAIL:** If record doesn't appear after 90 seconds, troubleshoot the pipeline before proceeding (see POC_OPERATIONS_GUIDE.md).

---

## Phase 2: BREAK — Stop the Laptop Stack

<!-- ============================================================
     Purpose: Simulate a central hub outage.
     We stop all Docker containers on the Laptop:
       - Kafka broker goes down
       - Snowflake Sink Connector goes down
       - Kafka UI goes down

     The RPi5 (MongoDB + Source Connector) stays running.
     The source connector will start failing to produce to
     Kafka, but MongoDB is completely unaffected.
     ============================================================ -->

### Step 2.1: Note the Current Time

> 📝 Outage started at: _______ (note the time for your demo)

### Step 2.2: Stop All Laptop Containers

**On Laptop:**
```powershell
cd C:\Users\rubar\Development\EXL_POC\kafka-poc
docker compose down
```

**Expected output:**
```
Container kafka-connect-sink  Stopped
Container kafka-ui            Stopped
Container kafka               Stopped
```

### Step 2.3: Verify Laptop Is Down

```powershell
docker ps
```
**Expected:** Empty list (no containers running)

### Step 2.4: Verify Kafka UI Is Unreachable

Open http://localhost:8080 in browser — should show **connection refused / page not found**.

### Step 2.5: Verify RPi5 Is Still Running

**On RPi5:**
```bash
# MongoDB is still healthy
docker exec mongodb mongosh --eval "rs.status().members[0].stateStr"
# Expected: PRIMARY

# Source connector is running but failing to connect to Kafka
docker logs --tail 5 kafka-connect-source 2>&1
# Expected: Connection refused / broker not available errors (THIS IS NORMAL)
```

> ✅ **STATE:** Laptop is DOWN. RPi5 is UP. MongoDB is accepting writes. Source connector is retrying.

---

## Phase 3: WRITE — Insert Data During the Outage

<!-- ============================================================
     Purpose: Prove MongoDB continues working independently.
     We insert 5 clearly tagged records that were written
     DURING the outage. These records should appear in Snowflake
     after recovery.
     ============================================================ -->

### Step 3.1: Insert 5 Orders During Outage

**On RPi5:**
```bash
docker exec -it mongodb mongosh --eval '
  db = db.getSiblingDB("poc_db");

  print("=== Inserting records DURING outage ===");
  print("Kafka is DOWN. Snowflake is unreachable.");
  print("But MongoDB keeps working...\n");

  db.orders.insertMany([
    {
      orderId: "AVAIL-DURING-001",
      customer: "Outage Customer A",
      product: "Edge Device Sensor",
      quantity: 10,
      price: 25.00,
      status: "pending",
      createdAt: new Date()
    },
    {
      orderId: "AVAIL-DURING-002",
      customer: "Outage Customer B",
      product: "Temperature Probe",
      quantity: 5,
      price: 45.00,
      status: "pending",
      createdAt: new Date()
    },
    {
      orderId: "AVAIL-DURING-003",
      customer: "Outage Customer C",
      product: "Pressure Gauge",
      quantity: 3,
      price: 120.00,
      status: "confirmed",
      createdAt: new Date()
    },
    {
      orderId: "AVAIL-DURING-004",
      customer: "Outage Customer D",
      product: "Flow Meter",
      quantity: 2,
      price: 200.00,
      status: "pending",
      createdAt: new Date()
    },
    {
      orderId: "AVAIL-DURING-005",
      customer: "Outage Customer E",
      product: "Vibration Monitor",
      quantity: 8,
      price: 75.00,
      status: "new",
      createdAt: new Date()
    }
  ]);

  print("✅ 5 records inserted while central hub is DOWN");
  print("Total documents in orders: " + db.orders.countDocuments());
'
```

### Step 3.2: Verify Data Is in MongoDB

```bash
docker exec -it mongodb mongosh --eval '
  db = db.getSiblingDB("poc_db");
  print("=== Orders inserted during outage ===");
  db.orders.find(
    { orderId: /^AVAIL-DURING/ },
    { _id: 0, orderId: 1, customer: 1, product: 1, price: 1 }
  ).forEach(printjson);
'
```

**Expected:**
```
{ orderId: 'AVAIL-DURING-001', customer: 'Outage Customer A', product: 'Edge Device Sensor', price: 25 }
{ orderId: 'AVAIL-DURING-002', customer: 'Outage Customer B', product: 'Temperature Probe', price: 45 }
{ orderId: 'AVAIL-DURING-003', customer: 'Outage Customer C', product: 'Pressure Gauge', price: 120 }
{ orderId: 'AVAIL-DURING-004', customer: 'Outage Customer D', product: 'Flow Meter', price: 200 }
{ orderId: 'AVAIL-DURING-005', customer: 'Outage Customer E', product: 'Vibration Monitor', price: 75 }
```

### Step 3.3: Confirm Data Is NOT in Snowflake

**On Snowflake:**
```sql
-- This should return ZERO rows (Kafka/Sink is down, data can't reach Snowflake)
SELECT COUNT(*) AS outage_records
FROM POC_DB.MONGO_SYNC.ORDERS
WHERE PARSE_JSON(RECORD_CONTENT):fullDocument.orderId::STRING LIKE 'AVAIL-DURING%';
```

**Expected:** `0`

> ✅ **STATE:** 5 records exist in MongoDB. Zero of them are in Snowflake. This is the data gap we will recover.

---

## Phase 4: RECOVER — Start the Laptop Back Up

<!-- ============================================================
     Purpose: Bring the central hub back online and demonstrate
     automatic recovery. The recovery flow is:

     1. Laptop starts → Kafka broker comes up
     2. Sink connector starts → connects to Snowflake
     3. RPi5 source connector reconnects to Kafka
     4. Source connector re-copies all MongoDB data (copy_existing)
     5. Sink connector consumes all messages → sends to Snowflake
     6. ALL data (including outage data) appears in Snowflake
     ============================================================ -->

### Step 4.1: Note the Recovery Time

> 📝 Recovery started at: _______ (note the time for your demo)

### Step 4.2: Start Laptop Containers

**On Laptop:**
```powershell
cd C:\Users\rubar\Development\EXL_POC\kafka-poc
docker compose up -d
```

**Expected:**
```
Container kafka              Started
Container kafka-connect-sink Started
Container kafka-ui           Started
```

### Step 4.3: Wait for Kafka to Be Ready (30 seconds)

```powershell
# Wait for Kafka to be fully up
Start-Sleep -Seconds 30

# Verify Kafka is ready
docker logs kafka 2>&1 | Select-String "Kafka Server started"
```

### Step 4.4: Restart Source Connector on RPi5

<!-- ============================================================
     WHY RESTART?
     The source connector was retrying while Kafka was down.
     Restarting it ensures:
       1. Clean reconnection to the Kafka broker
       2. Fresh offset file → triggers copy_existing mode
       3. All MongoDB data is re-sent to Kafka
     ============================================================ -->

**On RPi5:**
```bash
docker restart kafka-connect-source
echo "Source connector restarted. Waiting for it to reconnect..."
```

### Step 4.5: Monitor Recovery Progress

**On RPi5 — watch source connector logs:**
```bash
# Wait 30 seconds, then check source connector is producing
sleep 30
docker logs --tail 20 kafka-connect-source 2>&1
```

**Look for these log lines (indicating successful recovery):**
```
Connected to Kafka cluster
Copying existing data from MongoDB
Producing messages to topic mongo.poc_db.orders
```

**On Laptop — watch sink connector logs:**
```powershell
# Check sink connector is consuming and sending to Snowflake
docker logs --tail 20 kafka-connect-sink 2>&1
```

**Look for:**
```
Successfully joined group
Adding newly assigned partitions: mongo.poc_db.orders-0
Resetting offset for partition mongo.poc_db.orders-0 to position ... offset=0
initialized the pipe connector for pipe ... PIPE_ORDERS_0
task opened with 1 partitions
```

### Step 4.6: Verify Kafka Has Messages

**On Laptop — open Kafka UI:**
```
http://localhost:8080
```
- Navigate to **Topics** → `mongo.poc_db.orders`
- Confirm messages are present (including the AVAIL-DURING-* records)

> ✅ **STATE:** Pipeline is recovered. Data is flowing through Kafka to Snowflake.

---

## Phase 5: VERIFY — Confirm Zero Data Loss

<!-- ============================================================
     Purpose: The critical proof point. We verify that ALL 5
     records inserted during the outage now appear in Snowflake.
     This proves the pipeline recovered with zero data loss.
     ============================================================ -->

### Step 5.1: Wait for Snowpipe to Flush

**Wait 60–90 seconds** after the source connector restart. The Snowflake Sink Connector buffers records and flushes every 30 seconds.

### Step 5.2: Check Outage Records in Snowflake

**On Snowflake:**
```sql
-- THE CRITICAL QUERY: Do all 5 outage records exist?
SELECT
    PARSE_JSON(RECORD_CONTENT):fullDocument.orderId::STRING    AS order_id,
    PARSE_JSON(RECORD_CONTENT):fullDocument.customer::STRING   AS customer,
    PARSE_JSON(RECORD_CONTENT):fullDocument.product::STRING    AS product,
    PARSE_JSON(RECORD_CONTENT):fullDocument.price::FLOAT       AS price,
    PARSE_JSON(RECORD_CONTENT):fullDocument.status::STRING     AS status
FROM POC_DB.MONGO_SYNC.ORDERS
WHERE PARSE_JSON(RECORD_CONTENT):fullDocument.orderId::STRING LIKE 'AVAIL-DURING%'
ORDER BY PARSE_JSON(RECORD_CONTENT):fullDocument.orderId::STRING;
```

**Expected Result — ALL 5 rows present:**

| order_id | customer | product | price | status |
|----------|----------|---------|-------|--------|
| AVAIL-DURING-001 | Outage Customer A | Edge Device Sensor | 25.00 | pending |
| AVAIL-DURING-002 | Outage Customer B | Temperature Probe | 45.00 | pending |
| AVAIL-DURING-003 | Outage Customer C | Pressure Gauge | 120.00 | confirmed |
| AVAIL-DURING-004 | Outage Customer D | Flow Meter | 200.00 | pending |
| AVAIL-DURING-005 | Outage Customer E | Vibration Monitor | 75.00 | new |

### Step 5.3: Check Baseline Record Also Survived

```sql
SELECT
    PARSE_JSON(RECORD_CONTENT):fullDocument.orderId::STRING AS order_id,
    PARSE_JSON(RECORD_CONTENT):fullDocument.customer::STRING AS customer
FROM POC_DB.MONGO_SYNC.ORDERS
WHERE PARSE_JSON(RECORD_CONTENT):fullDocument.orderId::STRING = 'AVAIL-BEFORE-001';
```

**Expected:** `AVAIL-BEFORE-001` / `Baseline Test User` — still present.

### Step 5.4: Full Summary Query

```sql
-- Complete test summary: before, during, and total counts
SELECT
    CASE
        WHEN PARSE_JSON(RECORD_CONTENT):fullDocument.orderId::STRING LIKE 'AVAIL-BEFORE%'
            THEN '1. BEFORE Outage'
        WHEN PARSE_JSON(RECORD_CONTENT):fullDocument.orderId::STRING LIKE 'AVAIL-DURING%'
            THEN '2. DURING Outage'
        ELSE '0. Pre-existing Data'
    END AS test_phase,
    PARSE_JSON(RECORD_CONTENT):fullDocument.orderId::STRING    AS order_id,
    PARSE_JSON(RECORD_CONTENT):fullDocument.customer::STRING   AS customer,
    PARSE_JSON(RECORD_CONTENT):fullDocument.product::STRING    AS product,
    PARSE_JSON(RECORD_CONTENT):fullDocument.price::FLOAT       AS price
FROM POC_DB.MONGO_SYNC.ORDERS
WHERE PARSE_JSON(RECORD_CONTENT):fullDocument.orderId::STRING LIKE 'AVAIL-%'
ORDER BY test_phase,
         PARSE_JSON(RECORD_CONTENT):fullDocument.orderId::STRING;
```

### Step 5.5: Count Verification

```sql
-- Final count verification
SELECT
    'Before Test' AS metric,
    (SELECT COUNT(*) FROM POC_DB.MONGO_SYNC.ORDERS
     WHERE PARSE_JSON(RECORD_CONTENT):fullDocument.orderId::STRING = 'AVAIL-BEFORE-001') AS count
UNION ALL
SELECT
    'During Outage' AS metric,
    (SELECT COUNT(*) FROM POC_DB.MONGO_SYNC.ORDERS
     WHERE PARSE_JSON(RECORD_CONTENT):fullDocument.orderId::STRING LIKE 'AVAIL-DURING%') AS count
UNION ALL
SELECT
    'Total AVAIL Records' AS metric,
    (SELECT COUNT(*) FROM POC_DB.MONGO_SYNC.ORDERS
     WHERE PARSE_JSON(RECORD_CONTENT):fullDocument.orderId::STRING LIKE 'AVAIL-%') AS count;
```

**Expected:**
| metric | count |
|--------|-------|
| Before Test | 1 |
| During Outage | 5 |
| Total AVAIL Records | 6 |

> ✅ **6 out of 6 records present = ZERO DATA LOSS**

---

## Test Results Summary

<!-- Fill this in after running the test -->

| Metric | Value |
|--------|-------|
| Records inserted BEFORE outage | 1 |
| Records inserted DURING outage | 5 |
| **Total records expected in Snowflake** | **6** |
| **Total records found in Snowflake** | **_____** |
| Outage start time | _______ |
| Recovery start time | _______ |
| Time until all data in Snowflake | _______ |
| **Data loss** | **0 records** |

---

## Why This Works — Technical Explanation

<!-- ============================================================
     Include this section when presenting to stakeholders who
     want to understand the "why" behind the recovery.
     ============================================================ -->

### Kafka as a Durable Buffer

```
NORMAL OPERATION:
  MongoDB ──→ Source Connector ──→ [Kafka Buffer] ──→ Sink Connector ──→ Snowflake
                                    offset: 0-100

DURING OUTAGE (Kafka down):
  MongoDB ──→ data stays in MongoDB
              (change stream events accumulate in oplog)

AFTER RECOVERY:
  Source Connector restarts with copy_existing mode
  ──→ Re-reads ALL documents from MongoDB
  ──→ Produces them to Kafka [offset: 0-N]
  ──→ Sink Connector reads from offset 0
  ──→ ALL data arrives in Snowflake
```

### Key Design Features

| Feature | Role in Recovery |
|---------|-----------------|
| **MongoDB Replica Set** | Maintains oplog of all changes. Source connector can replay from any point. |
| **Source Connector `copy_existing` mode** | On restart, performs a full collection scan before watching change streams. Guarantees all existing data is re-sent. |
| **Kafka Message Retention** | Messages stored on disk (default: 7 days). Even if consumers are offline, messages persist until retention expires. |
| **Kafka Consumer Offsets** | Sink connector tracks its position. On restart, resumes from where it left off — no duplicates, no gaps (at-least-once delivery). |
| **Snowpipe Ingestion** | Serverless, auto-scales. Handles burst of queued data when pipeline recovers. |
| **Producer ↔ Consumer Decoupling** | Source and Sink operate independently. One side going down doesn't affect the other. |

### Failure Scenarios Covered

| Scenario | MongoDB | Kafka | Snowflake | Recovery Method |
|----------|---------|-------|-----------|----------------|
| Laptop power off | ✅ Keeps writing | ❌ Down | ❌ No new data | Start laptop → restart source connector |
| Network outage (RPi5 ↔ Laptop) | ✅ Keeps writing | ✅ Running | ⚠️ No new data from source | Restore network → source reconnects automatically |
| Snowflake maintenance | ✅ Keeps writing | ✅ Buffering | ❌ Unreachable | Sink retries automatically when Snowflake is back |
| Sink connector crash | ✅ Keeps writing | ✅ Buffering | ❌ No new data | Restart sink → resumes from last committed offset |
| Source connector crash | ✅ Keeps writing | ⚠️ No new messages | ⚠️ No new data | Restart source → copy_existing re-sends all data |
| Both Kafka + Sink down (THIS TEST) | ✅ Keeps writing | ❌ Down | ❌ No new data | Start both → restart source → all data syncs |

---

## Cleanup After Test

<!-- Remove test data if desired -->

**Option A: Keep test data** (recommended for demo)
- No action needed. Test records are clearly tagged with `AVAIL-` prefix.

**Option B: Remove test data**

On RPi5:
```bash
docker exec -it mongodb mongosh --eval '
  db = db.getSiblingDB("poc_db");
  result = db.orders.deleteMany({ orderId: /^AVAIL-/ });
  print("Deleted " + result.deletedCount + " test records");
'
```

On Snowflake:
```sql
-- Note: Snowflake ORDERS table is append-only via Snowpipe
-- Test records will remain unless you recreate the table
-- They are easily filtered out with: WHERE order_id NOT LIKE 'AVAIL-%'
```

---

## Quick Re-Run Checklist

<!-- Use this if you need to run the test again (e.g., for a live demo) -->

```
□ 1. Verify pipeline is working          (Phase 1)
□ 2. Stop laptop: docker compose down    (Phase 2)
□ 3. Insert data on RPi5                 (Phase 3)
□ 4. Confirm NOT in Snowflake            (Phase 3)
□ 5. Start laptop: docker compose up -d  (Phase 4)
□ 6. Wait 30s, restart source on RPi5    (Phase 4)
□ 7. Wait 90s                            (Phase 5)
□ 8. Query Snowflake — all data present  (Phase 5)
□ 9. Record results in summary table     (Phase 5)
```
