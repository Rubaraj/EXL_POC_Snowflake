# POC: Real-Time MongoDB to Snowflake Data Pipeline

<!-- ============================================================
     POC SETUP GUIDE — Docker-Based Implementation
     ============================================================
     This guide documents the step-by-step setup of a real-time
     data pipeline: MongoDB → Kafka → Snowflake.

     All services run in Docker containers on two devices:
       - Raspberry Pi 5 (Edge Device)
       - Windows Laptop (Central Hub)

     Total Cost: $0 (all free/open-source + Snowflake trial)
     Last Updated: 2026-03-08
     ============================================================ -->

---

## Architecture Overview

```
┌──────────────────────────────────┐              ┌──────────────────────────────────────────┐
│   Raspberry Pi 5 (Edge Device)   │              │        Windows Laptop (Central Hub)       │
│   Ubuntu Server 24.04 LTS        │              │                                          │
│                                  │              │   ┌────────────────────────┐              │
│  ┌───────────────┐               │              │   │  Kafka (KRaft mode)    │              │
│  │  MongoDB 7.0  │               │              │   │  Port: 9092 (internal) │              │
│  │  (Replica Set)│               │              │   │  Port: 9094 (external) │              │
│  └──────┬────────┘               │              │   └───────────┬────────────┘              │
│         │ Change Streams         │              │               │                          │
│         ▼                        │              │               │                          │
│  ┌──────────────────────┐        │    Port      │   ┌───────────▼────────────┐              │
│  │ Kafka Connect        ├────────╋────9094─────►│   │ Kafka Connect          │              │
│  │ + MongoDB Source     │        │              │   │ + Snowflake Sink       │              │
│  │   Connector          │        │              │   │   Connector            │              │
│  └──────────────────────┘        │              │   └───────────┬────────────┘              │
│                                  │              │               │                          │
│  Containers:                     │              │               ▼                          │
│   - mongodb (:27017)             │              │   ┌────────────────────────┐              │
│   - mongo-init (one-shot)        │              │   │   Snowflake (Cloud)    │              │
│   - kafka-connect-source (:8083) │              │   └────────────────────────┘              │
│                                  │              │                                          │
│                                  │              │  Containers:                              │
│                                  │              │   - kafka (:9092, :9094)                  │
│                                  │              │   - kafka-connect-sink (:8084)            │
│                                  │              │   - kafka-ui (:8080)                      │
└──────────────────────────────────┘              └──────────────────────────────────────────┘
       192.168.0.x (RPi5)                                  192.168.0.113 (Laptop)
```

### Component Summary

<!-- Each component and where it runs -->

| Component | Device | Docker Image | Purpose |
|-----------|--------|-------------|---------|
| MongoDB 7.0 (Replica Set) | RPi5 | `mongo:7.0` | Source database with Change Streams |
| MongoDB Init | RPi5 | `mongo:7.0` | One-shot: initializes replica set + seeds data |
| Kafka Connect + MongoDB Source | RPi5 | `apache/kafka:3.8.1` | Captures CDC from MongoDB, sends to Kafka |
| Apache Kafka (KRaft mode) | Laptop | `apache/kafka:3.8.1` | Message broker / streaming platform |
| Kafka Connect + Snowflake Sink | Laptop | `apache/kafka:3.8.1` | Reads from Kafka, writes to Snowflake |
| Kafka UI | Laptop | `ghcr.io/kafbat/kafka-ui:latest` | Web dashboard for monitoring Kafka |
| Snowflake | Cloud | N/A | Destination data warehouse |

### Cost

| Service | Cost |
|---------|------|
| MongoDB 7.0 (Community) | Free (open source) |
| Apache Kafka | Free (open source) |
| MongoDB Kafka Source Connector | Free (open source) |
| Snowflake Kafka Sink Connector | Free (open source) |
| Docker | Free |
| Snowflake | Free trial (30 days, $400 credit) |
| **Total** | **$0** |

### Data Flow

```
MongoDB (RPi5)
  │
  │  Change Streams (CDC)
  ▼
MongoDB Kafka Source Connector (RPi5)
  │
  │  Produces to topic: mongo.poc_db.orders
  │  Connects to Kafka on laptop via port 9094
  ▼
Apache Kafka Broker (Laptop)
  │
  │  Consumer reads from topic
  ▼
Snowflake Kafka Sink Connector (Laptop)
  │
  │  Snowpipe ingestion
  ▼
Snowflake ORDERS Table (Cloud)
```

---

## Prerequisites

### Hardware
- **Raspberry Pi 5** with 16GB RAM
- MicroSD card (32GB+ recommended)
- Power supply for RPi5
- Ethernet cable (recommended) or WiFi
- **Windows Laptop** (8GB+ RAM)
- Both devices on the **same local network**

### Software Required

| Software | Device | Purpose |
|----------|--------|---------|
| [Raspberry Pi Imager](https://www.raspberrypi.com/software/) | Laptop | Flash Ubuntu onto SD card |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Laptop | Run containers on Windows |
| Docker Engine | RPi5 | Run containers on Linux ARM64 |
| [Git for Windows](https://git-scm.com/download/win) | Laptop | Provides OpenSSL for key generation |
| SSH client (built into Windows) | Laptop | Remote access to RPi5 |

### Accounts to Create
- [Snowflake Free Trial](https://signup.snowflake.com/) — 30-day trial with $400 credit

---

## Phase 1: Raspberry Pi 5 Setup (Ubuntu Server 24.04 LTS)

<!-- ============================================================
     WHY UBUNTU instead of Raspberry Pi OS?
     MongoDB 7.x officially supports Ubuntu ARM64 but NOT
     Debian ARM64 (which Raspberry Pi OS is based on).
     ============================================================ -->

### 1.1 Flash Ubuntu Server onto SD Card

On your **Windows laptop**:

1. Install and open **Raspberry Pi Imager**
2. Click **Choose Device** → Select **Raspberry Pi 5**
3. Click **Choose OS** → **Other general-purpose OS** → **Ubuntu** → **Ubuntu Server 24.04 LTS (64-bit)**
4. Click **Choose Storage** → Select your SD card
5. Click **Next**, then click the **Edit Settings (gear icon)** button:
   - **Set hostname:** `rpi5-edge`
   - **Enable SSH:** Check "Use password authentication"
   - **Set username:** `pocuser`
   - **Set password:** (choose a strong password)
   - **Configure WiFi:** (if not using Ethernet) enter your SSID and password
   - **Set locale:** Choose your timezone
6. Click **Save** → **Yes** → **Yes** to flash

### 1.2 First Boot and SSH

1. Insert the SD card into the RPi5
2. Connect Ethernet cable (recommended) and power on
3. Wait 2-3 minutes for first boot to complete
4. Find the RPi5's IP address. On your laptop, open PowerShell:

```powershell
# Option 1: Try the hostname
ping rpi5-edge.local

# Option 2: Scan your network
arp -a
```

5. SSH into the RPi5 from your laptop:

```powershell
ssh pocuser@<RPI5_IP_ADDRESS>
```

### 1.3 Update the System

On the **RPi5** (via SSH):

```bash
sudo apt update && sudo apt upgrade -y
sudo reboot
```

Wait 1 minute, then SSH back in.

### 1.4 Set a Static IP Address (Optional but Recommended)

<!-- A static IP ensures the RPi5 address doesn't change between reboots -->

```bash
# Find your current network interface name and IP
ip addr show
```

Look for your interface (usually `eth0` for Ethernet or `wlan0` for WiFi).

```bash
sudo nano /etc/netplan/50-cloud-init.yaml
```

Replace the contents with (adjust values to match your network):

```yaml
network:
  version: 2
  ethernets:
    eth0:
      dhcp4: no
      addresses:
        - 192.168.0.XXX/24       # <-- Choose an IP outside your router's DHCP range
      routes:
        - to: default
          via: 192.168.0.1       # <-- Your router's IP (gateway)
      nameservers:
        addresses:
          - 8.8.8.8
          - 8.8.4.4
```

```bash
# Apply the configuration
sudo netplan apply

# Verify the new IP
ip addr show eth0
```

---

## Phase 2: Docker on RPi5

<!-- ============================================================
     IMPORTANT: Install Docker via get.docker.com script.
     Do NOT use Homebrew (brew install docker) — that only
     installs the CLI client without the daemon/engine.
     ============================================================ -->

### 2.1 Install Docker Engine

On the **RPi5** (via SSH):

```bash
# Install Docker Engine using the official convenience script
curl -fsSL https://get.docker.com | sudo sh

# Add your user to the docker group (avoids needing sudo for docker commands)
sudo usermod -aG docker $USER

# Log out and back in for group changes to take effect
exit
```

SSH back in, then verify:

```bash
docker --version
docker compose version
```

<!-- ============================================================
     NOTE: Docker Compose v2 is included with Docker Engine
     as a plugin (docker compose), NOT as a separate binary
     (docker-compose). Always use "docker compose" (space, not hyphen).
     ============================================================ -->

> **⚠️ Troubleshooting:** If `docker compose version` fails, install the Compose plugin manually:
> ```bash
> sudo mkdir -p /usr/local/lib/docker/cli-plugins
> sudo curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-aarch64" \
>   -o /usr/local/lib/docker/cli-plugins/docker-compose
> sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
> ```

---

## Phase 3: Docker on Laptop (Windows)

### 3.1 Install Docker Desktop

1. Download **Docker Desktop** from: https://www.docker.com/products/docker-desktop/
2. Run the installer
3. Restart your computer when prompted
4. Launch **Docker Desktop** from the Start menu
5. Wait for the Docker engine to start (whale icon in system tray becomes steady)

Verify in PowerShell:

```powershell
docker --version
docker compose version
```

### 3.2 Find Your Laptop's IP Address

```powershell
ipconfig
```

Look for your **IPv4 Address** under your active network adapter (e.g., `192.168.0.113`).

> **IMPORTANT:** Note this IP — the RPi5 source connector needs it to reach the Kafka broker.

---

## Phase 4: Snowflake Setup (Free Trial)

<!-- ============================================================
     Do the Snowflake setup BEFORE the Kafka connectors because
     we need the account URL and RSA key pair for the sink config.
     ============================================================ -->

### 4.1 Create a Free Trial Account

1. Go to https://signup.snowflake.com/
2. Fill in your details
3. Choose:
   - **Cloud Provider:** AWS (or whichever you prefer)
   - **Region:** Choose one close to you
   - **Edition:** Standard (free trial)
4. Verify your email and log in

### 4.2 Note Your Account Identifier

<!-- The account identifier is in the Snowflake URL -->

Once logged in, look at your browser URL:
```
https://app.snowflake.com/<ORG_ID>/<ACCOUNT_ID>/
```

Your Snowflake URL for the connector will be:
```
<ORG_ID>-<ACCOUNT_ID>.snowflakecomputing.com:443
```

For example: `swymwjs-ih56791.snowflakecomputing.com:443`

### 4.3 Create Database, Schema, Role, and User

In the Snowflake **Web UI**, click **Worksheets** → **+ (New Worksheet)**, then run:

```sql
-- =========================================
-- Step 1: Create Database and Schema
-- =========================================
CREATE DATABASE IF NOT EXISTS POC_DB;
USE DATABASE POC_DB;
CREATE SCHEMA IF NOT EXISTS MONGO_SYNC;
USE SCHEMA MONGO_SYNC;

-- =========================================
-- Step 2: Create a Role for Kafka Connect
-- =========================================
CREATE ROLE IF NOT EXISTS KAFKA_CONNECT_ROLE;

-- Grant permissions the connector needs
GRANT USAGE ON DATABASE POC_DB TO ROLE KAFKA_CONNECT_ROLE;
GRANT USAGE ON SCHEMA POC_DB.MONGO_SYNC TO ROLE KAFKA_CONNECT_ROLE;
GRANT CREATE TABLE ON SCHEMA POC_DB.MONGO_SYNC TO ROLE KAFKA_CONNECT_ROLE;
GRANT CREATE STAGE ON SCHEMA POC_DB.MONGO_SYNC TO ROLE KAFKA_CONNECT_ROLE;
GRANT CREATE PIPE ON SCHEMA POC_DB.MONGO_SYNC TO ROLE KAFKA_CONNECT_ROLE;

-- Grant table operations (current and future tables)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA POC_DB.MONGO_SYNC TO ROLE KAFKA_CONNECT_ROLE;
GRANT ALL PRIVILEGES ON FUTURE TABLES IN SCHEMA POC_DB.MONGO_SYNC TO ROLE KAFKA_CONNECT_ROLE;

-- Grant warehouse usage (needed for Snowpipe ingestion)
GRANT USAGE ON WAREHOUSE COMPUTE_WH TO ROLE KAFKA_CONNECT_ROLE;

-- =========================================
-- Step 3: Create a User for Kafka Connect
-- =========================================
-- NOTE: Password is a placeholder — authentication uses RSA key pair
CREATE USER IF NOT EXISTS KAFKA_CONNECT_USER
  PASSWORD = 'TempPassword123!'
  DEFAULT_ROLE = KAFKA_CONNECT_ROLE
  DEFAULT_WAREHOUSE = COMPUTE_WH
  DEFAULT_NAMESPACE = POC_DB.MONGO_SYNC;

-- Assign the role to the user
GRANT ROLE KAFKA_CONNECT_ROLE TO USER KAFKA_CONNECT_USER;

-- =========================================
-- Step 4: Allow ACCOUNTADMIN to see connector-created objects
-- =========================================
-- Without this, objects created by KAFKA_CONNECT_ROLE
-- won't be visible when you query as ACCOUNTADMIN
GRANT ROLE KAFKA_CONNECT_ROLE TO ROLE ACCOUNTADMIN;
```

### 4.4 Generate RSA Key Pair for Authentication

<!-- ============================================================
     The Snowflake Kafka Connector uses KEY PAIR authentication
     (not password). We generate an RSA key pair:
       - Private key → goes into the connector config
       - Public key  → gets registered in Snowflake on the user

     Windows doesn't have OpenSSL by default, but Git for Windows
     bundles it at: C:\Program Files\Git\usr\bin\openssl.exe
     ============================================================ -->

On the **Laptop**, open **Git Bash** (NOT PowerShell):

```bash
# Create a directory for the keys
mkdir -p ~/Development/EXL_POC/kafka-poc/snowflake-keys
cd ~/Development/EXL_POC/kafka-poc/snowflake-keys

# Generate RSA private key in PKCS8 format (no passphrase for POC simplicity)
openssl genrsa 2048 | openssl pkcs8 -topk8 -inform PEM -out snowflake_rsa_key.p8 -nocrypt

# Generate the matching public key
openssl rsa -in snowflake_rsa_key.p8 -pubout -out snowflake_rsa_key.pub

# Display the public key (you'll paste this into Snowflake)
cat snowflake_rsa_key.pub
```

> **⚠️ If you get "openssl not recognized" in PowerShell:** Use Git Bash instead. Git for Windows bundles OpenSSL at `C:\Program Files\Git\usr\bin\openssl.exe`.

### 4.5 Register the Public Key in Snowflake

Copy the public key content (the lines **between** `-----BEGIN PUBLIC KEY-----` and `-----END PUBLIC KEY-----`, without the headers) and run in Snowflake:

```sql
-- Replace the key content below with YOUR public key (no line breaks, no headers)
ALTER USER KAFKA_CONNECT_USER SET RSA_PUBLIC_KEY='MIIBIjANBgkqhkiG9w0BAQE...YOUR_KEY_HERE...DAQAB';
```

### 4.6 Extract the Private Key for Connector Config

<!-- ============================================================
     IMPORTANT: The Snowflake Kafka Connector expects the private
     key as an INLINE string in the properties file, NOT as a
     file path. We need to extract the raw base64 content
     (without the -----BEGIN/END----- headers).
     ============================================================ -->

In **Git Bash**, extract the private key content without headers:

```bash
# Strip the BEGIN/END headers and join into one line
grep -v "^-----" snowflake_rsa_key.p8 | tr -d '\n'
```

Copy this output — you'll need it for the Snowflake Sink Connector config (Phase 6).

---

## Phase 5: RPi5 — MongoDB + Kafka Source Connector (Docker)

<!-- ============================================================
     The RPi5 runs 3 containers:
       1. mongodb       — MongoDB 7.0 with replica set enabled
       2. mongo-init    — One-shot container that initializes the
                          replica set and seeds sample data
       3. kafka-connect-source — Kafka Connect with the MongoDB
                                 Source Connector plugin
     ============================================================ -->

### 5.1 Create the Project Directory Structure

On the **RPi5** (via SSH):

```bash
mkdir -p ~/kafka-poc/config
mkdir -p ~/kafka-poc/scripts
mkdir -p ~/kafka-poc/connect-plugins
cd ~/kafka-poc
```

### 5.2 Download the MongoDB Kafka Source Connector JAR

```bash
# Download the connector JAR (all-in-one JAR, ~5.5MB)
cd ~/kafka-poc/connect-plugins
curl -L -o mongo-kafka-connect-1.13.1-all.jar \
  "https://search.maven.org/remotecontent?filepath=org/mongodb/kafka/mongo-kafka-connect/1.13.1/mongo-kafka-connect-1.13.1-all.jar"

# Verify the download
ls -lh mongo-kafka-connect-1.13.1-all.jar
```

### 5.3 Create the MongoDB Init Script

<!-- ============================================================
     This script runs ONCE when the mongo-init container starts.
     It:
       1. Initializes a single-node replica set (required for
          Change Streams / CDC)
       2. Waits for the node to become PRIMARY
       3. Creates a user for Kafka Connect
       4. Inserts 3 seed documents into poc_db.orders
     ============================================================ -->

```bash
cat > ~/kafka-poc/scripts/init-replica.js << 'EOF'
// Initialize MongoDB Replica Set
// This script runs once when the mongo-init container starts

print("=== Initializing Replica Set ===");

try {
  rs.status();
  print("Replica set already initialized, skipping...");
} catch (e) {
  print("Initializing replica set...");
  rs.initiate({
    _id: "rs0",
    members: [
      { _id: 0, host: "mongodb:27017" }
    ]
  });
  print("Replica set initiated. Waiting for PRIMARY...");

  // Wait for the node to become PRIMARY
  let attempts = 0;
  while (attempts < 30) {
    let status = rs.status();
    if (status.members[0].stateStr === "PRIMARY") {
      print("Node is PRIMARY. Replica set ready!");
      break;
    }
    print("Waiting... (attempt " + attempts + ")");
    sleep(1000);
    attempts++;
  }
}

// Create the POC database and seed data
print("\n=== Creating POC Database and Seed Data ===");

const db = db.getSiblingDB("poc_db");

// Create a user for Kafka Connect (optional — not used in no-auth mode)
const adminDb = db.getSiblingDB("admin");
try {
  adminDb.createUser({
    user: "kafkaconnect",
    pwd: "KafkaConnect2024!",
    roles: [
      { role: "read", db: "poc_db" },
      { role: "read", db: "local" },
      { role: "readAnyDatabase", db: "admin" }
    ]
  });
  print("User 'kafkaconnect' created.");
} catch (e) {
  print("User 'kafkaconnect' already exists, skipping...");
}

// Insert seed data into the orders collection
db.orders.insertMany([
  {
    orderId: "ORD-001",
    customer: "John Doe",
    product: "Laptop Stand",
    amount: 49.99,
    status: "pending",
    createdAt: new Date()
  },
  {
    orderId: "ORD-002",
    customer: "Jane Smith",
    product: "Monitor",
    amount: 299.99,
    status: "confirmed",
    createdAt: new Date()
  },
  {
    orderId: "ORD-003",
    customer: "Bob Wilson",
    product: "USB-C Hub",
    amount: 34.99,
    status: "shipped",
    createdAt: new Date()
  }
]);

print("Seed data inserted into poc_db.orders");
print("\n=== Initialization Complete ===");
EOF
```

### 5.4 Create Kafka Connect Source Configuration Files

**File 1: Kafka Connect Standalone Worker Config**

<!-- ============================================================
     The standalone worker config tells Kafka Connect:
       - Where the Kafka broker is (laptop IP, external port 9094)
       - How to serialize keys/values (JSON, no schema)
       - Where to store offsets (local file in /tmp)
       - Where to find connector plugin JARs
     ============================================================ -->

```bash
cat > ~/kafka-poc/config/connect-standalone-source.properties << 'EOF'
# Kafka Connect Standalone Configuration (MongoDB Source)
# =========================================================

# Kafka broker on the LAPTOP — uses the EXTERNAL listener (port 9094)
# REPLACE 192.168.0.113 with your laptop's actual IP address
bootstrap.servers=192.168.0.113:9094

# Converter settings (JSON without schema registry for simplicity)
key.converter=org.apache.kafka.connect.json.JsonConverter
value.converter=org.apache.kafka.connect.json.JsonConverter
key.converter.schemas.enable=false
value.converter.schemas.enable=false

# Where to store connector offsets (local file — standalone mode)
# NOTE: Stored in /tmp, so offsets reset on container restart.
# This means copy_existing will re-run on restart.
offset.storage.file.filename=/tmp/connect-offsets-source.dat
offset.flush.interval.ms=10000

# Plugin path — where Kafka Connect finds connector JARs
plugin.path=/opt/kafka/plugins

# REST API port for monitoring
rest.port=8083
rest.host.name=0.0.0.0
EOF
```

**File 2: MongoDB Source Connector Config**

<!-- ============================================================
     The source connector config tells the MongoDB connector:
       - How to connect to MongoDB (no auth for POC simplicity)
       - Which database and collection to watch
       - The Kafka topic naming convention (prefix.database.collection)
       - To capture full documents on updates (not just deltas)
       - To copy existing data on first startup

     IMPORTANT: We do NOT use authentication for this POC.
     MongoDB runs without --auth flag, so the connection URI
     is simple: mongodb://mongodb:27017/?replicaSet=rs0

     We also removed output.schema.key and output.schema.value
     properties — they cause Avro schema errors with this
     connector version.
     ============================================================ -->

```bash
cat > ~/kafka-poc/config/mongodb-source-connector.properties << 'EOF'
# MongoDB Source Connector Configuration
# =========================================

name=mongodb-source-connector
connector.class=com.mongodb.kafka.connect.MongoSourceConnector
tasks.max=1

# MongoDB connection (no auth — Docker internal network)
# The hostname "mongodb" resolves via Docker's internal DNS
connection.uri=mongodb://mongodb:27017/?replicaSet=rs0

# What to watch — database and collection
database=poc_db
collection=orders

# Kafka topic prefix (produces topic: mongo.poc_db.orders)
topic.prefix=mongo

# Capture full document on updates (not just the delta)
change.stream.full.document=updateLookup

# Output format
output.format.key=json
output.format.value=json

# Copy existing data on first startup
# This does a full scan of the collection before switching
# to watching the change stream for new changes
startup.mode=copy_existing

# Poll settings
poll.max.batch.size=1000
poll.await.time.ms=5000
EOF
```

### 5.5 Create docker-compose.yml for RPi5

<!-- ============================================================
     Three containers:

     1. mongodb — Runs with --replSet rs0 flag (single-node
        replica set). The healthcheck waits until MongoDB is
        responsive before starting dependent containers.

     2. mongo-init — Depends on mongodb being healthy. Runs
        the init-replica.js script once, then exits. This
        initializes the replica set and seeds data.

     3. kafka-connect-source — Runs Kafka Connect in standalone
        mode with the MongoDB Source Connector plugin. Connects
        to MongoDB locally (Docker DNS) and to Kafka on the
        laptop (via external IP:9094).

     The apache/kafka:3.8.1 image is used (NOT 3.9.0 which has
     Java 21 incompatibility with mongo-kafka-connect-1.13.1).
     ============================================================ -->

```bash
cat > ~/kafka-poc/docker-compose.yml << 'EOF'
services:

  # ============================================
  # MongoDB 7.0 (Replica Set for Change Streams)
  # ============================================
  mongodb:
    image: mongo:7.0
    container_name: mongodb
    ports:
      - "27017:27017"
    command: ["mongod", "--replSet", "rs0", "--bind_ip_all"]
    volumes:
      - mongodb_data:/data/db
      - ./scripts:/scripts
    networks:
      - poc-network
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ============================================
  # MongoDB Replica Set Initializer (runs once)
  # ============================================
  mongo-init:
    image: mongo:7.0
    container_name: mongo-init
    depends_on:
      mongodb:
        condition: service_healthy
    volumes:
      - ./scripts:/scripts
    entrypoint: ["mongosh", "--host", "mongodb:27017", "--file", "/scripts/init-replica.js"]
    networks:
      - poc-network

  # ============================================
  # Kafka Connect (MongoDB Source Connector)
  # ============================================
  kafka-connect-source:
    image: apache/kafka:3.8.1
    container_name: kafka-connect-source
    depends_on:
      mongodb:
        condition: service_healthy
    ports:
      - "8083:8083"
    command: >
      /opt/kafka/bin/connect-standalone.sh
      /opt/kafka/config/connect-standalone-source.properties
      /opt/kafka/config/mongodb-source-connector.properties
    volumes:
      - ./config/connect-standalone-source.properties:/opt/kafka/config/connect-standalone-source.properties
      - ./config/mongodb-source-connector.properties:/opt/kafka/config/mongodb-source-connector.properties
      - ./connect-plugins:/opt/kafka/plugins
    networks:
      - poc-network

volumes:
  mongodb_data:

networks:
  poc-network:
    driver: bridge
EOF
```

### 5.6 Start the RPi5 Stack

```bash
cd ~/kafka-poc
docker compose up -d
```

### 5.7 Verify RPi5 Services

```bash
# Check all containers are running
docker ps

# Expected output:
#   mongodb              — Up (healthy)
#   mongo-init           — Exited (0) — this is normal, it's a one-shot
#   kafka-connect-source — Up

# Check MongoDB has seed data
docker exec -it mongodb mongosh --eval 'db.getSiblingDB("poc_db").orders.find().pretty()'

# Check the source connector is running
curl -s http://localhost:8083/connectors/mongodb-source-connector/status | python3 -m json.tool
# Should show: "state": "RUNNING"
```

> **⚠️ NOTE:** The source connector will fail to start if the Kafka broker on the laptop is not running yet. Start the laptop containers (Phase 6) first, or restart the source connector after the laptop is up: `docker restart kafka-connect-source`

---

## Phase 6: Laptop — Kafka + Snowflake Sink Connector (Docker)

<!-- ============================================================
     The laptop runs 3 containers:
       1. kafka        — Apache Kafka in KRaft mode (no Zookeeper)
       2. kafka-connect-sink — Kafka Connect with Snowflake Sink
       3. kafka-ui     — Web dashboard for monitoring

     CRITICAL CONFIG NOTES:
     - Must set KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1
       because we only have 1 broker (default is 3).
       Without this, the __consumer_offsets topic can't be
       created, and NO consumer groups will work.
     - The EXTERNAL listener (port 9094) is for the RPi5 to
       connect from outside the Docker network.
     - The PLAINTEXT listener (port 9092) is for containers
       within the same Docker network.
     ============================================================ -->

### 6.1 Create the Project Directory Structure

On the **Laptop**, open PowerShell:

```powershell
# Create the project directories
mkdir -p C:\Users\<YOU>\Development\EXL_POC\kafka-poc\config
mkdir -p C:\Users\<YOU>\Development\EXL_POC\kafka-poc\connect-plugins\snowflake-sink
mkdir -p C:\Users\<YOU>\Development\EXL_POC\kafka-poc\snowflake-keys

cd C:\Users\<YOU>\Development\EXL_POC\kafka-poc
```

### 6.2 Download the Snowflake Kafka Connector JARs

<!-- ============================================================
     The Snowflake Kafka Connector needs 3 JARs:
       1. snowflake-kafka-connector — the main connector (~148MB)
       2. bcpkix-jdk18on — Bouncy Castle crypto (for RSA keys)
       3. bcprov-jdk18on — Bouncy Castle provider

     IMPORTANT: JARs must be in a SUBDIRECTORY of the plugin
     path (e.g., plugins/snowflake-sink/). If placed directly
     in the plugins/ folder, Kafka Connect scans each JAR
     individually, which is extremely slow.
     ============================================================ -->

Download these 3 JARs into `connect-plugins\snowflake-sink\`:

```powershell
cd connect-plugins\snowflake-sink

# Main Snowflake connector (~148MB)
curl -L -o snowflake-kafka-connector-2.4.0.jar "https://search.maven.org/remotecontent?filepath=com/snowflake/snowflake-kafka-connector/2.4.0/snowflake-kafka-connector-2.4.0.jar"

# Bouncy Castle dependencies (required for RSA key pair auth)
curl -L -o bcpkix-jdk18on-1.78.1.jar "https://search.maven.org/remotecontent?filepath=org/bouncycastle/bcpkix-jdk18on/1.78.1/bcpkix-jdk18on-1.78.1.jar"
curl -L -o bcprov-jdk18on-1.78.1.jar "https://search.maven.org/remotecontent?filepath=org/bouncycastle/bcprov-jdk18on/1.78.1/bcprov-jdk18on-1.78.1.jar"

cd ..\..
```

### 6.3 Create Kafka Connect Sink Configuration Files

**File 1: Kafka Connect Standalone Worker Config**

Create `config\connect-standalone-sink.properties`:

```properties
# Kafka Connect Standalone Configuration (Snowflake Sink)
# =========================================================

# Kafka broker — uses Docker internal hostname (same Docker network)
bootstrap.servers=kafka:9092

# Converter settings
# Key: simple string (MongoDB connector outputs string keys)
# Value: Snowflake's custom JSON converter (handles schema evolution)
key.converter=org.apache.kafka.connect.storage.StringConverter
value.converter=com.snowflake.kafka.connector.records.SnowflakeJsonConverter

# Offset storage (local file — standalone mode)
offset.storage.file.filename=/tmp/connect-offsets-sink.dat
offset.flush.interval.ms=10000

# Plugin path
plugin.path=/opt/kafka/plugins

# REST API on port 8084 (8083 is used by source on RPi5)
rest.port=8084
rest.host.name=0.0.0.0
```

**File 2: Snowflake Sink Connector Config**

<!-- ============================================================
     CRITICAL: The private key must be provided INLINE as a
     base64 string (without BEGIN/END headers), NOT as a file
     path. The snowflake.private.key.file property does NOT
     work with this connector version.

     To get the inline key from your .p8 file:
       grep -v "^-----" snowflake_rsa_key.p8 | tr -d '\n'
     ============================================================ -->

Create `config\snowflake-sink-connector.properties`:

```properties
# Snowflake Sink Connector Configuration
# =========================================
# IMPORTANT: Replace all <PLACEHOLDER> values before starting

name=snowflake-sink-connector
connector.class=com.snowflake.kafka.connector.SnowflakeSinkConnector
tasks.max=1

# Kafka topic(s) to consume from
# This must match the topic created by the MongoDB Source Connector on RPi5
topics=mongo.poc_db.orders

# =========================================
# Snowflake Connection Settings
# =========================================
# REPLACE with your Snowflake account URL (format: orgid-accountid.snowflakecomputing.com:443)
snowflake.url.name=<YOUR_ORG>-<YOUR_ACCOUNT>.snowflakecomputing.com:443
snowflake.user.name=KAFKA_CONNECT_USER

# REPLACE with your private key content (base64, no BEGIN/END headers, no newlines)
# Generate with: grep -v "^-----" snowflake_rsa_key.p8 | tr -d '\n'
snowflake.private.key=<YOUR_PRIVATE_KEY_BASE64_INLINE>

snowflake.database.name=POC_DB
snowflake.schema.name=MONGO_SYNC
snowflake.role.name=KAFKA_CONNECT_ROLE

# =========================================
# Table Mapping
# =========================================
# Maps Kafka topic to Snowflake table name
snowflake.topic2table.map=mongo.poc_db.orders:ORDERS

# =========================================
# Ingestion Method
# =========================================
snowflake.ingestion.method=SNOWPIPE

# =========================================
# Buffer Settings (tuned for POC — flush quickly)
# =========================================
# Flush after 10 records OR 30 seconds OR 5MB, whichever comes first
buffer.count.records=10
buffer.flush.time=30
buffer.size.bytes=5000000

# =========================================
# Converter Overrides
# =========================================
key.converter=org.apache.kafka.connect.storage.StringConverter
value.converter=com.snowflake.kafka.connector.records.SnowflakeJsonConverter
```

### 6.4 Create docker-compose.yml for Laptop

Create `docker-compose.yml` in the project root:

```yaml
services:

  # ============================================
  # Kafka Broker (KRaft mode — no Zookeeper)
  # Official Apache Kafka image
  # ============================================
  kafka:
    image: apache/kafka:3.8.1
    container_name: kafka
    ports:
      - "9092:9092"    # Internal — for containers in the same Docker network
      - "9094:9094"    # External — for RPi5 to connect from the local network
    environment:
      # KRaft settings (replaces Zookeeper)
      - KAFKA_NODE_ID=1
      - KAFKA_PROCESS_ROLES=broker,controller
      - KAFKA_CONTROLLER_QUORUM_VOTERS=1@kafka:9093
      - KAFKA_CONTROLLER_LISTENER_NAMES=CONTROLLER

      # Listener settings
      # PLAINTEXT (:9092) — internal, for Docker containers
      # CONTROLLER (:9093) — KRaft controller protocol
      # EXTERNAL (:9094) — for RPi5 to connect from local network
      - KAFKA_LISTENERS=PLAINTEXT://:9092,CONTROLLER://:9093,EXTERNAL://:9094
      # REPLACE 192.168.0.113 with your laptop's actual IP
      - KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://kafka:9092,EXTERNAL://192.168.0.113:9094
      - KAFKA_LISTENER_SECURITY_PROTOCOL_MAP=PLAINTEXT:PLAINTEXT,CONTROLLER:PLAINTEXT,EXTERNAL:PLAINTEXT
      - KAFKA_INTER_BROKER_LISTENER_NAME=PLAINTEXT

      # !! CRITICAL: Single-broker overrides !!
      # Default replication factor is 3, but we only have 1 broker.
      # Without these, the __consumer_offsets topic can't be created,
      # which means NO consumer groups work (sink connector hangs forever).
      - KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1
      - KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR=1
      - KAFKA_TRANSACTION_STATE_LOG_MIN_ISR=1

      # Cluster
      - CLUSTER_ID=poc-kafka-cluster-00001
    volumes:
      - kafka_data:/var/lib/kafka/data
    networks:
      - poc-network

  # ============================================
  # Kafka Connect (Snowflake Sink)
  # ============================================
  kafka-connect-sink:
    image: apache/kafka:3.8.1
    container_name: kafka-connect-sink
    depends_on:
      - kafka
    ports:
      - "8084:8084"
    command: >
      /opt/kafka/bin/connect-standalone.sh
      /opt/kafka/config/connect-standalone-sink.properties
      /opt/kafka/config/snowflake-sink-connector.properties
    volumes:
      - ./config/connect-standalone-sink.properties:/opt/kafka/config/connect-standalone-sink.properties
      - ./config/snowflake-sink-connector.properties:/opt/kafka/config/snowflake-sink-connector.properties
      - ./connect-plugins:/opt/kafka/plugins
      - ./snowflake-keys:/opt/kafka/snowflake-keys
    networks:
      - poc-network

  # ============================================
  # Kafka UI (monitoring dashboard)
  # ============================================
  kafka-ui:
    image: ghcr.io/kafbat/kafka-ui:latest
    container_name: kafka-ui
    depends_on:
      - kafka
    ports:
      - "8080:8080"
    environment:
      - KAFKA_CLUSTERS_0_NAME=POC-Cluster
      - KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS=kafka:9092
      - KAFKA_CLUSTERS_0_KAFKACONNECT_0_NAME=SnowflakeSink
      - KAFKA_CLUSTERS_0_KAFKACONNECT_0_ADDRESS=http://kafka-connect-sink:8084
    networks:
      - poc-network

volumes:
  kafka_data:

networks:
  poc-network:
    driver: bridge
```

### 6.5 Start the Laptop Stack

<!-- Start laptop FIRST, then RPi5 — the source connector needs Kafka to be running -->

```powershell
cd C:\Users\<YOU>\Development\EXL_POC\kafka-poc
docker compose up -d
```

### 6.6 Verify Laptop Services

```powershell
# Check all containers are running
docker ps

# Expected output:
#   kafka              — Up
#   kafka-connect-sink — Up
#   kafka-ui           — Up

# Check Kafka broker logs (should end with "Kafka Server started")
docker logs kafka 2>&1 | Select-Object -Last 5

# Check sink connector logs (look for "task started")
docker logs kafka-connect-sink 2>&1 | Select-Object -Last 20

# Open Kafka UI in your browser
# http://localhost:8080
```

---

## Phase 7: Start the Pipeline

### 7.1 Startup Order

<!-- ============================================================
     ORDER MATTERS:
     1. Laptop first (Kafka broker must be running)
     2. RPi5 second (source connector needs to reach Kafka)

     If the RPi5 was started before the laptop, just restart
     the source connector: docker restart kafka-connect-source
     ============================================================ -->

```
1. [Laptop]  docker compose up -d          ← Start Kafka, Sink Connector, Kafka UI
2. [RPi5]    docker compose up -d          ← Start MongoDB, Mongo-Init, Source Connector
3. Wait 60-90 seconds for everything to initialize
```

If the RPi5 was already running before the laptop:

```bash
# On RPi5 — restart the source connector so it reconnects to Kafka
docker restart kafka-connect-source
```

### 7.2 Verify the Source Connector (RPi5)

```bash
# Check source connector status
curl -s http://localhost:8083/connectors/mongodb-source-connector/status

# Expected: connector state RUNNING, task-0 state RUNNING
```

### 7.3 Verify Kafka Has Messages (Laptop)

Open **Kafka UI** at http://localhost:8080 in your browser:

1. Click **Topics** in the left sidebar
2. You should see the topic `mongo.poc_db.orders`
3. Click on it → **Messages** tab
4. You should see 3 messages (the seed data from MongoDB)

Or via command line:

```powershell
# List topics
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list

# Should show: mongo.poc_db.orders
```

### 7.4 Verify the Sink Connector (Laptop)

```powershell
# Check sink connector logs for successful processing
docker logs kafka-connect-sink 2>&1 | Select-String "partition|pipe|flush|ORDERS"

# Key log lines to look for:
#   "Successfully joined group"
#   "Adding newly assigned partitions: mongo.poc_db.orders-0"
#   "Resetting offset for partition mongo.poc_db.orders-0 to position ... offset=0"
#   "initialized the pipe connector for pipe ... PIPE_ORDERS_0"
#   "task opened with 1 partitions"
```

### 7.5 Verify Data in Snowflake

Log in to the **Snowflake Web UI** and run:

```sql
-- Use the correct role (ACCOUNTADMIN inherits KAFKA_CONNECT_ROLE)
USE ROLE ACCOUNTADMIN;

-- Check the ORDERS table exists
SHOW TABLES IN SCHEMA POC_DB.MONGO_SYNC;

-- Query all rows
SELECT * FROM POC_DB.MONGO_SYNC.ORDERS;

-- Parse the JSON content for a cleaner view
SELECT
  RECORD_CONTENT:orderId::STRING AS order_id,
  RECORD_CONTENT:customer::STRING AS customer,
  RECORD_CONTENT:product::STRING AS product,
  RECORD_CONTENT:amount::FLOAT AS amount,
  RECORD_CONTENT:status::STRING AS status,
  RECORD_CONTENT:createdAt::TIMESTAMP AS created_at
FROM POC_DB.MONGO_SYNC.ORDERS;
```

You should see the 3 seed orders (ORD-001, ORD-002, ORD-003). 🎉

---

## Phase 8: End-to-End Testing (Real-Time CDC)

### 8.1 Insert a New Document in MongoDB

On the **RPi5**:

```bash
docker exec -it mongodb mongosh --eval '
  db = db.getSiblingDB("poc_db");
  db.orders.insertOne({
    orderId: "ORD-004",
    customer: "Eve Williams",
    product: "Raspberry Pi 5",
    quantity: 2,
    price: 80.00,
    status: "new",
    createdAt: new Date()
  });
'
```

### 8.2 Verify in Kafka

Check Kafka UI at http://localhost:8080 → Topics → `mongo.poc_db.orders` → Messages.
You should now see a 4th message.

### 8.3 Verify in Snowflake

Wait ~30-60 seconds (buffer flush time), then run in Snowflake:

```sql
SELECT * FROM POC_DB.MONGO_SYNC.ORDERS ORDER BY RECORD_METADATA:offset::INT;
```

You should see ORD-004 appear!

### 8.4 Test an Update

On the **RPi5**:

```bash
docker exec -it mongodb mongosh --eval '
  db = db.getSiblingDB("poc_db");
  db.orders.updateOne(
    { orderId: "ORD-001" },
    { $set: { status: "shipped", updatedAt: new Date() } }
  );
'
```

Check Snowflake — a new row will appear with the updated document (Snowpipe creates append-only rows).

### 8.5 Test Bulk Insert

```bash
docker exec -it mongodb mongosh --eval '
  db = db.getSiblingDB("poc_db");
  db.orders.insertMany([
    { orderId: "ORD-005", customer: "Frank Brown", product: "Keyboard", amount: 49.99, status: "pending", createdAt: new Date() },
    { orderId: "ORD-006", customer: "Grace Lee", product: "Mouse", amount: 29.99, status: "confirmed", createdAt: new Date() }
  ]);
'
```

---

## Troubleshooting Guide

<!-- ============================================================
     These are all REAL issues encountered during this POC setup.
     Each one was hit and resolved during implementation.
     ============================================================ -->

### Issue 1: `__consumer_offsets` Topic Stuck in Creation Loop

**Symptom:** Kafka broker logs show endless repetition of:
```
Sent auto-creation request for Set(__consumer_offsets) to the active controller.
```
Sink connector hangs — never consumes any messages.

**Root Cause:** Default `offsets.topic.replication.factor` is 3, but we only have 1 broker.

**Fix:** Add these environment variables to the Kafka broker in `docker-compose.yml`:
```yaml
- KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1
- KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR=1
- KAFKA_TRANSACTION_STATE_LOG_MIN_ISR=1
```

Then restart with a clean volume:
```bash
docker compose down -v && docker compose up -d
```

### Issue 2: Snowflake "Missed private key" Error

**Symptom:** Sink connector logs show:
```
Snowflake Kafka Connector Config: Missed private key
```

**Root Cause:** The connector expects the private key as an **inline base64 string** in the `snowflake.private.key` property, NOT as a file path.

**Fix:** Use `snowflake.private.key` (not `snowflake.private.key.file`) with the raw key content:
```bash
# Extract inline key from .p8 file
grep -v "^-----" snowflake_rsa_key.p8 | tr -d '\n'
```

### Issue 3: Apache Kafka 3.9.0 + MongoDB Connector Incompatibility

**Symptom:**
```
IllegalAccessError: failed to access class org.apache.kafka.common.utils.SystemTime
```

**Root Cause:** Kafka 3.9.0 uses Java 21 which has stricter module access. The MongoDB Kafka Connector 1.13.1 is not compatible.

**Fix:** Use `apache/kafka:3.8.1` instead of `3.9.0` on ALL machines (both RPi5 and laptop).

### Issue 4: Snowflake "Insufficient Privileges" on ORDERS Table

**Symptom:** Querying `SELECT * FROM ORDERS` as ACCOUNTADMIN returns:
```
SQL access control error: Insufficient privileges to operate on table 'ORDERS'
```

**Root Cause:** The ORDERS table was created by `KAFKA_CONNECT_ROLE`. ACCOUNTADMIN doesn't automatically inherit custom roles.

**Fix:** Grant the role to ACCOUNTADMIN:
```sql
GRANT ROLE KAFKA_CONNECT_ROLE TO ROLE ACCOUNTADMIN;
```

### Issue 5: Docker Compose Plugin Not Found on RPi5

**Symptom:**
```
unknown shorthand flag: 'd' in -d
```

**Root Cause:** Docker was installed but the Compose plugin was missing.

**Fix:**
```bash
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-aarch64" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
```

### Issue 6: `output.schema.key` / `output.schema.value` Error

**Symptom:** MongoDB source connector fails with Avro schema errors.

**Root Cause:** These properties were deprecated/changed in recent connector versions.

**Fix:** Remove `output.schema.key` and `output.schema.value` from the MongoDB source connector config. Only keep `output.format.key=json` and `output.format.value=json`.

### Issue 7: Snowflake 404 Error

**Symptom:** Sink connector logs show `HTTP Response code: 404`.

**Root Cause:** Wrong Snowflake account URL. Characters in the account identifier were wrong.

**Fix:** Double-check your Snowflake URL. It should match exactly what's in your browser URL bar:
```
https://app.snowflake.com/<ORG_ID>/<ACCOUNT_ID>/
→ <ORG_ID>-<ACCOUNT_ID>.snowflakecomputing.com:443
```

### Issue 8: Plugin JAR Scanning Is Extremely Slow

**Symptom:** Kafka Connect takes minutes to start, with logs showing individual JAR scanning.

**Root Cause:** Connector JARs placed directly in the `plugins/` folder instead of a subdirectory.

**Fix:** Move all JARs into a subdirectory:
```
plugins/snowflake-sink/     ← subdirectory
  ├── snowflake-kafka-connector-2.4.0.jar
  ├── bcpkix-jdk18on-1.78.1.jar
  └── bcprov-jdk18on-1.78.1.jar
```

### General Debugging Commands

```bash
# ── RPi5 ──

# Check all containers
docker ps -a

# MongoDB logs
docker logs mongodb

# Source connector logs
docker logs kafka-connect-source

# Source connector status (REST API)
curl -s http://localhost:8083/connectors/mongodb-source-connector/status

# Check MongoDB data
docker exec -it mongodb mongosh --eval 'db.getSiblingDB("poc_db").orders.find()'

# Restart source connector (clears offsets, re-copies data)
docker restart kafka-connect-source


# ── Laptop ──

# Check all containers
docker ps -a

# Kafka broker logs
docker logs kafka

# Sink connector logs
docker logs kafka-connect-sink

# Sink connector status (REST API)
curl -s http://localhost:8084/connectors/snowflake-sink-connector/status

# List Kafka topics
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list

# Read messages from topic
docker exec kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic mongo.poc_db.orders --from-beginning --timeout-ms 5000

# Kafka UI dashboard
# http://localhost:8080
```

---

## Cleanup

### Stop All Services

**Laptop:**
```powershell
cd C:\Users\<YOU>\Development\EXL_POC\kafka-poc
docker compose down
```

**RPi5:**
```bash
cd ~/kafka-poc
docker compose down
```

### Remove Everything (Including Data)

**Laptop:**
```powershell
# Stop containers and remove volumes (deletes all Kafka data)
docker compose down -v
```

**RPi5:**
```bash
# Stop containers and remove volumes (deletes all MongoDB data)
docker compose down -v
```

**Snowflake:**
```sql
-- Clean up all Snowflake resources
USE ROLE ACCOUNTADMIN;

-- Drop the connector-created objects first
DROP TABLE IF EXISTS POC_DB.MONGO_SYNC.ORDERS;

-- Drop schema, database, user, and role
DROP SCHEMA IF EXISTS POC_DB.MONGO_SYNC;
DROP DATABASE IF EXISTS POC_DB;
DROP USER IF EXISTS KAFKA_CONNECT_USER;
DROP ROLE IF EXISTS KAFKA_CONNECT_ROLE;
```

---

## Quick Reference: Startup & Shutdown

### Start Everything (in order)

```
1. [Laptop]  Open Docker Desktop (wait for it to start)
2. [Laptop]  cd kafka-poc && docker compose up -d
3. Wait 30 seconds for Kafka to be ready
4. [RPi5]    cd ~/kafka-poc && docker compose up -d
5. Wait 60 seconds for full initialization
6. [Laptop]  Open http://localhost:8080 (Kafka UI) to monitor
7. [RPi5]    Insert data into MongoDB and watch it appear in Snowflake!
```

### Stop Everything

```
1. [RPi5]    cd ~/kafka-poc && docker compose down
2. [Laptop]  cd kafka-poc && docker compose down
```

---

## File Structure Reference

```
kafka-poc/                              ← Laptop project root
├── docker-compose.yml                  ← Laptop: Kafka + Sink + Kafka UI
├── config/
│   ├── connect-standalone-sink.properties   ← Kafka Connect worker config (sink)
│   └── snowflake-sink-connector.properties  ← Snowflake connector config
├── connect-plugins/
│   └── snowflake-sink/                 ← Snowflake connector JARs
│       ├── snowflake-kafka-connector-2.4.0.jar
│       ├── bcpkix-jdk18on-1.78.1.jar
│       └── bcprov-jdk18on-1.78.1.jar
├── snowflake-keys/                     ← RSA key pair for Snowflake auth
│   ├── snowflake_rsa_key.p8            ← Private key
│   └── snowflake_rsa_key.pub           ← Public key
└── rpi5/                               ← RPi5 files (copy to RPi5)
    ├── docker-compose.yml              ← RPi5: MongoDB + Source Connector
    ├── config/
    │   ├── connect-standalone-source.properties
    │   └── mongodb-source-connector.properties
    ├── scripts/
    │   └── init-replica.js             ← MongoDB init + seed data
    └── connect-plugins/
        └── mongo-kafka-connect-1.13.1-all.jar
```

---

## Version Reference

| Component | Version | Image / Download |
|-----------|---------|-----------------|
| Ubuntu Server (RPi5) | 24.04 LTS (ARM64) | Raspberry Pi Imager |
| Docker Engine | Latest | https://get.docker.com |
| Docker Desktop (Windows) | Latest | https://docker.com/products/docker-desktop |
| MongoDB | 7.0 | `mongo:7.0` |
| Apache Kafka | 3.8.1 | `apache/kafka:3.8.1` |
| MongoDB Kafka Connector | 1.13.1 | [Maven Central](https://search.maven.org/artifact/org.mongodb.kafka/mongo-kafka-connect/1.13.1) |
| Snowflake Kafka Connector | 2.4.0 | [Maven Central](https://search.maven.org/artifact/com.snowflake/snowflake-kafka-connector/2.4.0) |
| Bouncy Castle (bcpkix) | 1.78.1 | [Maven Central](https://search.maven.org/artifact/org.bouncycastle/bcpkix-jdk18on/1.78.1) |
| Bouncy Castle (bcprov) | 1.78.1 | [Maven Central](https://search.maven.org/artifact/org.bouncycastle/bcprov-jdk18on/1.78.1) |
| Kafka UI | Latest | `ghcr.io/kafbat/kafka-ui:latest` |

---

<!-- ============================================================
     END OF GUIDE

     Key Design Decisions:
     - Docker over native installs: consistent environments,
       easy setup/teardown, no dependency conflicts
     - KRaft mode: no Zookeeper needed, simpler architecture
     - Standalone Kafka Connect: simpler than distributed mode
       for a POC (no separate offset topic needed)
     - Snowpipe ingestion: serverless, auto-scales, free tier
     - No authentication on MongoDB: simplified for POC only
     - Inline private key: avoids file path issues in containers
     - apache/kafka:3.8.1: avoids Java 21 compatibility issues
       with the MongoDB connector
     ============================================================ -->
