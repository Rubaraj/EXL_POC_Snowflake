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

// Create a user for Kafka Connect
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

// Insert seed data
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
