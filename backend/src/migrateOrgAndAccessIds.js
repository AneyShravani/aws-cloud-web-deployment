// ============================================================
// ONE-OFF SCRIPT: assign org codes + shorten access IDs
// ------------------------------------------------------------
// 1. Every organization without an orgCode gets one (e.g. TM-1042).
// 2. Every existing Assignment's lengthy referenceId is regenerated
//    to the new <ORG_PREFIX>-<unique 4-digit> format, reusing its
//    org's prefix. All 4-digits stay unique within a prefix.
//
// Bookings link by assignmentId/labUserId (not by the ID string),
// so rewriting referenceId is safe — only the human-facing pass
// changes, which is exactly what was asked for.
//
// Run from backend/:  node src/migrateOrgAndAccessIds.js
// Idempotent-ish: re-running keeps existing orgCodes; it WILL mint
// fresh access IDs each run, so run it once.
// ============================================================
require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('./config/db');
const Organization = require('./models/Organization');
const Assignment = require('./models/Assignment');
const { derivePrefix, usedNumbersForPrefix, pickNumber } = require('./services/referenceIdService');

const run = async () => {
  await connectDB();

  // 1) org codes
  const orgs = await Organization.find();
  for (const org of orgs) {
    if (!org.orgCode) {
      const prefix = derivePrefix(org.name);
      const used = await usedNumbersForPrefix(prefix);
      org.orgCode = `${prefix}-${pickNumber(used)}`;
      await org.save();
      console.log(`  org "${org.name}" -> ${org.orgCode}`);
    } else {
      console.log(`  org "${org.name}" already has ${org.orgCode}`);
    }
  }

  // 2) access IDs, org by org (saving as we go keeps the used-set fresh)
  let rewritten = 0;
  for (const org of orgs) {
    const prefix = org.orgCode.split('-')[0];
    const used = await usedNumbersForPrefix(prefix); // includes org codes + any already-migrated IDs
    const assignments = await Assignment.find({ orgId: org._id });
    for (const a of assignments) {
      const num = pickNumber(used);
      used.add(num);
      const next = `${prefix}-${num}`;
      console.log(`    ${a.referenceId} -> ${next}`);
      a.referenceId = next;
      await a.save();
      rewritten += 1;
    }
  }

  console.log(`\nDone. ${orgs.length} org(s) processed, ${rewritten} access ID(s) rewritten.`);
  await mongoose.connection.close();
  process.exit(0);
};

run().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
