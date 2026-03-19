#!/usr/bin/env node
/**
 * ThinkAgent Data Generator
 * Generates ~1M+ documents across 21 MongoDB collections for Snowflake dashboard POC.
 *
 * Usage:
 *   node index.js                     # Full scale (~1M docs)
 *   node index.js --scale=0.01        # 1% scale (~10K docs, for testing)
 *   node index.js --scale=0.1         # 10% scale (~100K docs)
 *   node index.js --uri=mongodb://... # Custom MongoDB URI
 *   node index.js --db=thinkagent_db  # Custom database name
 *   node index.js --drop              # Drop existing collections first
 */

const { MongoClient } = require('mongodb');

// Parse CLI args
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, val] = arg.replace(/^--/, '').split('=');
  acc[key] = val === undefined ? true : isNaN(val) ? val : parseFloat(val);
  return acc;
}, {});

const SCALE = args.scale || 1;
const MONGO_URI = args.uri || 'mongodb://192.168.0.199:27017/?replicaSet=rs0';
const DB_NAME = args.db || 'poc_db';
const DROP_FIRST = args.drop || false;

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  ThinkAgent Data Generator');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Scale:    ${SCALE}x (${SCALE === 1 ? 'FULL ~1M docs' : `~${Math.round(1000000 * SCALE).toLocaleString()} docs`})`);
  console.log(`  MongoDB:  ${MONGO_URI}`);
  console.log(`  Database: ${DB_NAME}`);
  console.log(`  Drop:     ${DROP_FIRST}`);
  console.log('═══════════════════════════════════════════════════════\n');

  const startTime = Date.now();
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB\n');
    const db = client.db(DB_NAME);

    if (DROP_FIRST) {
      console.log('Dropping existing collections...');
      const collections = await db.listCollections().toArray();
      for (const col of collections) {
        await db.collection(col.name).drop();
        console.log(`  Dropped: ${col.name}`);
      }
      console.log('');
    }

    // ── Phase 1: Static lookups ──
    console.log('━━━ Phase 1: Static Lookups ━━━');
    const { getUserTypes, getLeadStatusLookup, getRetailers, getSEPMaster } = require('./lib/lookups');

    const timer = (label) => {
      const s = Date.now();
      return () => console.log(`  ⏱ ${label}: ${((Date.now() - s) / 1000).toFixed(1)}s`);
    };

    let t = timer('UserTypes');
    await db.collection('UserTypes').insertMany(getUserTypes());
    console.log(`  Inserted ${getUserTypes().length} UserTypes`);
    t();

    t = timer('LeadStatusLookup');
    await db.collection('LeadStatusLookup').insertMany(getLeadStatusLookup());
    console.log(`  Inserted ${getLeadStatusLookup().length} LeadStatusLookup`);
    t();

    t = timer('Retailers');
    await db.collection('Retailers').insertMany(getRetailers());
    console.log(`  Inserted ${getRetailers().length} Retailers`);
    t();

    t = timer('SEPMaster');
    await db.collection('SEPMaster').insertMany(getSEPMaster());
    console.log(`  Inserted ${getSEPMaster().length} SEPMaster`);
    t();

    // ── Phase 2: Core entities ──
    console.log('\n━━━ Phase 2: Core Entities (Users, Geography, Locations) ━━━');
    const { generateUsers, generateUserTypeMapping, generateBrokerProfiles, generateCountyZip, generateLocationMaster } = require('./lib/gen-core');

    t = timer('Users');
    const users = await generateUsers(db, SCALE);
    t();

    t = timer('UserTypeMapping');
    await generateUserTypeMapping(db, users, SCALE);
    t();

    t = timer('BrokerProfiles');
    await generateBrokerProfiles(db, users, SCALE);
    t();

    t = timer('CountyZip');
    const countyZipMap = await generateCountyZip(db, SCALE);
    t();

    t = timer('LocationMaster');
    const locations = await generateLocationMaster(db, countyZipMap, SCALE);
    t();

    // ── Phase 3: Plans ──
    console.log('\n━━━ Phase 3: Plans & Benefits ━━━');
    const { generatePlans, generatePlanBenefits, generatePlanZipMapping } = require('./lib/gen-plans');

    t = timer('Plans');
    const plans = await generatePlans(db, SCALE);
    t();

    t = timer('PlanBenefits');
    await generatePlanBenefits(db, plans, SCALE);
    t();

    t = timer('PlanZipMapping');
    await generatePlanZipMapping(db, plans, countyZipMap, SCALE);
    t();

    // Build plan-state index for enrollment geographic consistency
    const planZipIndex = new Map();
    for (const plan of plans) {
      const market = plan.Market;
      // Find states for this market
      const marketStates = Object.entries(require('./lib/helpers').STATE_TO_MARKET)
        .filter(([_, m]) => m === market)
        .map(([s, _]) => s);
      for (const state of marketStates) {
        if (!planZipIndex.has(state)) planZipIndex.set(state, []);
        planZipIndex.get(state).push(plan);
      }
    }

    // ── Phase 4: Leads + Pipeline ──
    console.log('\n━━━ Phase 4: Leads & Pipeline (Cascade Rules) ━━━');
    const { generateLeads, generateSOA, generateEKit, generateLeadProviders } = require('./lib/gen-leads');

    t = timer('Leads');
    const { leads, leadsByStatus } = await generateLeads(db, users, countyZipMap, SCALE);
    t();

    t = timer('SOA');
    const soaByLead = await generateSOA(db, leads, leadsByStatus, SCALE);
    t();

    t = timer('EKit');
    const ekitByLead = await generateEKit(db, leads, leadsByStatus, soaByLead, plans, SCALE);
    t();

    t = timer('LeadProviders');
    await generateLeadProviders(db, leads, SCALE);
    t();

    // ── Phase 5: Enrollments ──
    console.log('\n━━━ Phase 5: Enrollments (Pareto + YoY + Seasonal) ━━━');
    const { generateEnrollmentStore, generateEnrollments, generateEnrollmentPortfolioStore } = require('./lib/gen-enrollments');

    t = timer('EnrollmentStore');
    const enrollmentStoreRecords = await generateEnrollmentStore(
      db, leads, leadsByStatus, users, plans, planZipIndex, soaByLead, ekitByLead, SCALE
    );
    t();

    t = timer('Enrollments');
    await generateEnrollments(db, enrollmentStoreRecords, users, SCALE);
    t();

    t = timer('EnrollmentPortfolioStore');
    await generateEnrollmentPortfolioStore(db, leads, users, SCALE);
    t();

    // ── Phase 6: Events & Notifications ──
    console.log('\n━━━ Phase 6: Events & Notifications ━━━');
    const { generateEvents, generateNotifications } = require('./lib/gen-events');

    t = timer('Events');
    const events = await generateEvents(db, users, locations, SCALE);
    t();

    t = timer('Notifications');
    await generateNotifications(db, users, events, SCALE);
    t();

    // ── Summary ──
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  Generation Complete!');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  Total time: ${elapsed}s\n`);

    // Verify counts
    console.log('  Collection Counts:');
    const allCollections = await db.listCollections().toArray();
    let totalDocs = 0;
    for (const col of allCollections.sort((a, b) => a.name.localeCompare(b.name))) {
      const count = await db.collection(col.name).countDocuments();
      totalDocs += count;
      console.log(`    ${col.name.padEnd(30)} ${count.toLocaleString().padStart(10)}`);
    }
    console.log(`    ${'─'.repeat(42)}`);
    console.log(`    ${'TOTAL'.padEnd(30)} ${totalDocs.toLocaleString().padStart(10)}`);
    console.log('\n═══════════════════════════════════════════════════════');

  } catch (err) {
    console.error('\nFATAL ERROR:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\nMongoDB connection closed.');
  }
}

main();
