# POC Operations Guide: Start, Monitor & Troubleshoot

<!-- ============================================================
     This guide is for DAY-TO-DAY operations of the existing
     POC setup. Use this after the initial setup is complete.

     Assumes:
       - RPi5 IP: 192.168.0.175
       - Laptop IP: 192.168.0.113
       - All config files and Docker images already in place
     ============================================================ -->

---

## 1. Startup Procedure

<!-- ============================================================
     ORDER MATTERS:
     The Kafka broker on the laptop MUST be running before the
     source connector on RPi5 starts — otherwise the source
     connector can't produce messages to Kafka.
     ============================================================ -->

### Step 1: Start Docker Desktop on Laptop

1. Open **Docker Desktop** from the Start menu
2. Wait for the whale icon in the system tray to become **steady** (not animating)
3. Verify Docker is ready:

```powershell
docker info
```

> You should see "Server: Docker Desktop" and no errors.

---

### Step 2: Start Laptop Containers (Kafka + Sink + UI)

```powershell
cd C:\Users\rubar\Development\EXL_POC\kafka-poc
docker compose up -d
```

**Expected output:**
```
Container kafka              Started
Container kafka-connect-sink Started
Container kafka-ui           Started
```

**Wait 30 seconds** for Kafka to fully initialize before starting RPi5.

---

### Step 3: Verify Laptop Containers Are Healthy

```powershell
# Check all 3 containers are running
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

**Expected:**
```
NAMES                STATUS          PORTS
kafka                Up X minutes    0.0.0.0:9092->9092/tcp, 0.0.0.0:9094->9094/tcp
kafka-connect-sink   Up X minutes    0.0.0.0:8084->8084/tcp
kafka-ui             Up X minutes    0.0.0.0:8080->8080/tcp
```

> **If any container is missing or shows "Restarting"**, check its logs:
> ```powershell
> docker logs <container-name>
> ```

---

### Step 4: Start RPi5 Containers (MongoDB + Source Connector)

SSH into the RPi5:

```powershell
ssh ubuntu001@192.168.0.175
```

Then start the containers:

```bash
cd ~/kafka-poc
docker compose up -d
```

**Expected output:**
```
Container mongodb              Started (or already running)
Container mongo-init           Started (exits immediately — normal)
Container kafka-connect-source Started
```

---

### Step 5: Verify RPi5 Containers Are Healthy

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

**Expected:**
```
NAMES                  STATUS              PORTS
mongodb                Up X minutes        0.0.0.0:27017->27017/tcp
kafka-connect-source   Up X minutes        0.0.0.0:8083->8083/tcp
```

> **Note:** `mongo-init` will show as "Exited (0)" — this is **normal**. It's a one-shot container that only runs the init script.

---

## 2. Health Check — Is Everything Working?

<!-- ============================================================
     Run these checks in order. If any check fails, see the
     troubleshooting section at the bottom.
     ============================================================ -->

### Check 1: MongoDB is Accepting Connections (RPi5)

```bash
docker exec mongodb mongosh --eval "rs.status().members[0].stateStr"
```

**Expected:** `PRIMARY`

> If it says `SECONDARY` or errors, the replica set needs re-initialization:
> ```bash
> docker restart mongodb
> # Wait 10 seconds
> docker exec mongodb mongosh --eval "rs.initiate({_id:'rs0', members:[{_id:0, host:'mongodb:27017'}]})"
> ```

---

### Check 2: MongoDB Has Data (RPi5)

```bash
docker exec mongodb mongosh --eval "db.getSiblingDB('poc_db').orders.countDocuments()"
```

**Expected:** A number > 0 (e.g., `8`)

---

### Check 3: Kafka Broker is Running (Laptop)

```powershell
docker logs kafka 2>&1 | Select-String "Kafka Server started"
```

**Expected:** `[KafkaRaftServer nodeId=1] Kafka Server started`

> If not found, Kafka may still be starting. Wait 30 seconds and try again.

---

### Check 4: Kafka Has the Topic (Laptop)

```powershell
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list
```

**Expected:**
```
__consumer_offsets
mongo.poc_db.orders
```

> If `mongo.poc_db.orders` is missing, the source connector hasn't produced any messages yet. Check the source connector (Check 6).

---

### Check 5: Kafka Topic Has Messages (Laptop)

```powershell
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --describe --topic mongo.poc_db.orders
```

**Expected:** Shows `PartitionCount: 1` and `ReplicationFactor: 1`

To see message count:

```powershell
docker exec kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic mongo.poc_db.orders --from-beginning --timeout-ms 5000 2>$null | Measure-Object -Line
```

**Expected:** `Lines: X` (number of messages in the topic)

---

### Check 6: Source Connector is RUNNING (RPi5)

```bash
curl -s http://localhost:8083/connectors/mongodb-source-connector/status | python3 -m json.tool
```

**Expected:**
```json
{
    "name": "mongodb-source-connector",
    "connector": {
        "state": "RUNNING",
        "worker_id": "..."
    },
    "tasks": [
        {
            "id": 0,
            "state": "RUNNING",
            "worker_id": "..."
        }
    ]
}
```

> **If state is FAILED:** Check source connector logs:
> ```bash
> docker logs kafka-connect-source 2>&1 | tail -30
> ```
>
> **If tasks array is empty `[]`:** The connector started but the task crashed. Restart it:
> ```bash
> docker restart kafka-connect-source
> ```

---

### Check 7: Sink Connector is RUNNING (Laptop)

```powershell
curl -s http://localhost:8084/connectors/snowflake-sink-connector/status
```

**Expected:** `"state": "RUNNING"` for both connector and task-0.

> **If not reachable or FAILED:** Check sink connector logs:
> ```powershell
> docker logs kafka-connect-sink 2>&1 | Select-Object -Last 30
> ```

---

### Check 8: Sink Connector Has Partition Assignment (Laptop)

```powershell
docker logs kafka-connect-sink 2>&1 | Select-String "partition"
```

**Expected:** Look for these lines:
```
Adding newly assigned partitions: mongo.poc_db.orders-0
task opened with 1 partitions
```

> **If "Node -1 disconnected" is the last log:** The consumer can't join a group.
> Check that `KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1` is set in docker-compose.yml.
> Then: `docker compose down -v && docker compose up -d`

---

### Check 9: Snowflake Has Data

Log in to Snowflake Web UI and run:

```sql
USE ROLE ACCOUNTADMIN;
SELECT COUNT(*) FROM POC_DB.MONGO_SYNC.ORDERS;
```

**Expected:** A number > 0

To see structured data:

```sql
SELECT * FROM POC_DB.MONGO_SYNC.ORDERS_VIEW ORDER BY KAFKA_OFFSET;
```

---

### Check 10: Kafka UI Dashboard (Laptop)

Open in your browser: **http://localhost:8080**

**What to look for:**
- **Brokers** → Should show 1 broker (online)
- **Topics** → Should show `mongo.poc_db.orders` with message count
- **Topics → mongo.poc_db.orders → Messages** → Should show actual message content
- **Kafka Connect** → Should show `SnowflakeSink` connector

---

## 3. End-to-End Verification Test

<!-- ============================================================
     This test inserts a new document in MongoDB and verifies
     it appears in Snowflake within ~60 seconds.
     ============================================================ -->

### Step 1: Insert a Test Document (RPi5)

```bash
docker exec -it mongodb mongosh --eval '
  db = db.getSiblingDB("poc_db");
  db.orders.insertOne({
    orderId: "TEST-" + new Date().getTime(),
    customer: "Health Check",
    product: "Test Product",
    quantity: 1,
    price: 0.01,
    status: "test",
    createdAt: new Date()
  });
'
```

### Step 2: Verify in Kafka (Laptop — within 10 seconds)

Open Kafka UI: http://localhost:8080 → Topics → `mongo.poc_db.orders` → Messages

You should see the new test message at the top.

### Step 3: Verify in Snowflake (within 60 seconds)

```sql
SELECT * FROM POC_DB.MONGO_SYNC.ORDERS_VIEW
WHERE ORDER_ID LIKE 'TEST-%'
ORDER BY KAFKA_OFFSET DESC
LIMIT 1;
```

> **If the data doesn't appear in Snowflake after 90 seconds:**
> 1. Check sink connector logs for errors
> 2. Check if the buffer flush time (30s) has elapsed
> 3. Restart the sink connector: `docker restart kafka-connect-sink`

---

## 4. Monitoring Commands Cheat Sheet

### RPi5 Commands (via SSH)

```bash
# ── Container Status ──
docker ps -a                                              # All containers
docker stats --no-stream                                  # CPU/Memory usage

# ── MongoDB ──
docker exec mongodb mongosh --eval "rs.status().ok"       # Replica set OK (1 = good)
docker exec mongodb mongosh --eval \
  "db.getSiblingDB('poc_db').orders.countDocuments()"      # Document count

# ── Source Connector ──
curl -s http://localhost:8083/connectors | python3 -m json.tool         # List connectors
curl -s http://localhost:8083/connectors/mongodb-source-connector/status # Connector status
docker logs --tail 20 kafka-connect-source                              # Recent logs
docker logs kafka-connect-source 2>&1 | grep -i "error"                # Errors only

# ── Network Test (can RPi5 reach Kafka on Laptop?) ──
nc -zv 192.168.0.113 9094                                 # Should say "succeeded"
```

### Laptop Commands (PowerShell)

```powershell
# ── Container Status ──
docker ps -a                                              # All containers
docker stats --no-stream                                  # CPU/Memory usage

# ── Kafka Broker ──
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list
docker logs --tail 20 kafka                               # Recent logs

# ── Sink Connector ──
curl -s http://localhost:8084/connectors                  # List connectors
curl -s http://localhost:8084/connectors/snowflake-sink-connector/status  # Status
docker logs --tail 20 kafka-connect-sink                  # Recent logs
docker logs kafka-connect-sink 2>&1 | Select-String "error|exception" -CaseSensitive:$false

# ── Kafka UI ──
# Open http://localhost:8080 in browser
```

### Snowflake Queries (Web UI)

```sql
-- Total rows ingested
SELECT COUNT(*) AS total_rows FROM POC_DB.MONGO_SYNC.ORDERS;

-- Latest 5 records
SELECT * FROM POC_DB.MONGO_SYNC.ORDERS_VIEW ORDER BY KAFKA_OFFSET DESC LIMIT 5;

-- Check Snowpipe status
SELECT SYSTEM$PIPE_STATUS('POC_DB.MONGO_SYNC.SNOWFLAKE_KAFKA_CONNECTOR_SNOWFLAKE_SINK_CONNECTOR_225951378_PIPE_ORDERS_0');

-- Check ingestion history (last 1 hour)
SELECT *
FROM TABLE(INFORMATION_SCHEMA.COPY_HISTORY(
    TABLE_NAME => 'ORDERS',
    START_TIME => DATEADD(HOUR, -1, CURRENT_TIMESTAMP())
))
ORDER BY LAST_LOAD_TIME DESC;
```

---

## 5. Shutdown Procedure

### Stop Everything (Preserves Data)

```bash
# On RPi5
cd ~/kafka-poc
docker compose down
```

```powershell
# On Laptop
cd C:\Users\rubar\Development\EXL_POC\kafka-poc
docker compose down
```

> **Data is preserved** in Docker volumes. Next startup will resume from where you left off.

### Stop Everything (Delete All Data — Fresh Start)

```bash
# On RPi5 — removes MongoDB data volume
cd ~/kafka-poc
docker compose down -v
```

```powershell
# On Laptop — removes Kafka data volume
cd C:\Users\rubar\Development\EXL_POC\kafka-poc
docker compose down -v
```

> **⚠️ WARNING:** Using `-v` deletes all data. On next startup:
> - MongoDB will be empty, then re-seeded with 3 initial orders by `mongo-init`
> - Kafka topics will be gone, then re-created by the source connector
> - Snowflake data remains (it's in the cloud, not affected by local volume deletion)
> - Source connector will re-run `copy_existing` to re-copy all MongoDB data

---

## 6. Common Issues & Quick Fixes

| Symptom | Quick Fix |
|---------|-----------|
| **Source connector can't reach Kafka** | Verify laptop IP hasn't changed: `ipconfig`. Update `connect-standalone-source.properties` if needed. Restart: `docker restart kafka-connect-source` |
| **Sink connector hangs, no data in Snowflake** | Check for `__consumer_offsets` spam in Kafka logs. Ensure `KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1` is set. Restart with clean volume: `docker compose down -v && docker compose up -d` |
| **Snowflake "Insufficient privileges"** | Run: `GRANT ROLE KAFKA_CONNECT_ROLE TO ROLE ACCOUNTADMIN;` |
| **Snowflake query returns all NULLs** | Use `PARSE_JSON()`: query `ORDERS_VIEW` instead of raw `ORDERS` table |
| **Source connector task is empty `[]`** | `docker restart kafka-connect-source` (this re-triggers `copy_existing`) |
| **Kafka UI shows 0 messages but connector is RUNNING** | Kafka volume was wiped. Restart source connector on RPi5: `docker restart kafka-connect-source` |
| **Container stuck in "Restarting"** | Check logs: `docker logs <container-name>`. Usually a config error. |
| **Laptop IP changed (DHCP)** | Update `KAFKA_ADVERTISED_LISTENERS` in `docker-compose.yml` and `bootstrap.servers` in RPi5's `connect-standalone-source.properties`. Restart both stacks. |
| **MongoDB replica set not PRIMARY** | `docker restart mongodb`, wait 10s, then verify: `docker exec mongodb mongosh --eval "rs.status().members[0].stateStr"` |
| **"Connection refused" from RPi5 to Laptop** | Check Windows Firewall allows port 9094: `netsh advfirewall firewall add rule name="Kafka External" dir=in action=allow protocol=TCP localport=9094` |

---

## 7. Architecture Quick Reference

```
RPi5 (192.168.0.175)                    Laptop (192.168.0.113)
┌─────────────────────┐                 ┌──────────────────────────┐
│  mongodb (:27017)   │                 │  kafka (:9092/:9094)     │
│         │           │                 │         │                │
│         ▼           │    Port 9094    │         ▼                │
│  kafka-connect-     ├────────────────►│  kafka-connect-          │
│  source (:8083)     │                 │  sink (:8084)            │
│                     │                 │         │                │
│                     │                 │         ▼                │
│                     │                 │  Snowflake (Cloud)       │
│                     │                 │                          │
│                     │                 │  kafka-ui (:8080)        │
└─────────────────────┘                 └──────────────────────────┘

Monitoring URLs:
  - Kafka UI:    http://localhost:8080
  - Source API:  http://192.168.0.175:8083/connectors
  - Sink API:    http://localhost:8084/connectors
  - MongoDB:     mongodb://192.168.0.175:27017/?replicaSet=rs0
  - Snowflake:   https://app.snowflake.com/swymwjs/ih56791/
```

---

## 8. Useful MongoDB Commands (RPi5)

```bash
# Connect to MongoDB shell
docker exec -it mongodb mongosh

# Inside mongosh:
use poc_db

# Count documents
db.orders.countDocuments()

# Find all orders
db.orders.find().pretty()

# Find specific order
db.orders.find({ orderId: "ORD-001" })

# Insert new order
db.orders.insertOne({
  orderId: "ORD-NEW",
  customer: "New Customer",
  product: "New Product",
  quantity: 1,
  price: 99.99,
  status: "pending",
  createdAt: new Date()
})

# Update an order
db.orders.updateOne(
  { orderId: "ORD-001" },
  { $set: { status: "shipped", updatedAt: new Date() } }
)

# Delete an order
db.orders.deleteOne({ orderId: "ORD-NEW" })

# Exit
exit
```
