// ============================================================
// ONE-OFF SCRIPT: backfill hardware configs for Torii's systems
// ------------------------------------------------------------
// Populates the new System config fields (deviceName, model,
// processor, ram, ramSpeed, graphics, storage, storageUsed) for
// the systems that already exist in the database, using the specs
// supplied by the Torii team.
//
// Systems are matched by their auto-generated name (System-1 …
// System-6) inside the target organization.
//
// Run from the backend/ folder:
//     node src/backfillSystemConfigs.js
//
// Optional overrides:
//     ORG_NAME="Torii"     node src/backfillSystemConfigs.js   (org name to match, default /torii/i)
//     LAB_ID=<mongoId>     node src/backfillSystemConfigs.js   (restrict to a single lab)
//
// Idempotent: re-running just re-writes the same values.
// ============================================================
require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('./config/db');
const Organization = require('./models/Organization');
const System = require('./models/System');

// specs keyed by system name — extend this list when more systems are added
const CONFIGS = {
    'System-1': {
        deviceName: 'CSE',
        model: 'Dell Vostro 3710',
        processor: '12th Gen Intel Core i7-12700 @ 2.10 GHz',
        ram: '8 GB (7.70 GB usable)',
        ramSpeed: '3200 MT/s',
        graphics: 'Intel UHD Graphics 770 – 128 MB',
        storage: '477 GB',
        storageUsed: '149 GB',
    },
    'System-2': {
        deviceName: 'NCET',
        model: 'Dell Vostro 3710',
        processor: '12th Gen Intel Core i7-12700 @ 2.10 GHz',
        ram: '16 GB (15.7 GB usable)',
        ramSpeed: '3200 MT/s',
        graphics: 'Intel UHD Graphics 770 – 128 MB',
        storage: '1.38 TB',
        storageUsed: '260 GB',
    },
    'System-3': {
        deviceName: 'DESKTOP-2DENORG',
        model: 'Dell Vostro 3710',
        processor: '12th Gen Intel Core i7-12700 @ 2.10 GHz',
        ram: '16 GB (15.7 GB usable)',
        ramSpeed: '3200 MT/s',
        graphics: 'Intel UHD Graphics 770 – 128 MB',
        storage: '943 GB',
        storageUsed: '176 GB',
    },
    'System-4': {
        deviceName: 'NCET',
        model: 'Dell Vostro 3710',
        processor: '12th Gen Intel Core i7-12700 @ 2.10 GHz',
        ram: '8 GB (7.70 GB usable)',
        ramSpeed: '3200 MT/s',
        graphics: 'Intel UHD Graphics 770 – 128 MB',
        storage: '477 GB',
        storageUsed: '150 GB',
    },
    'System-5': {
        deviceName: 'ncet',
        model: 'Dell Vostro 3710',
        processor: '12th Gen Intel Core i7-12700 @ 2.10 GHz',
        ram: '16 GB (15.7 GB usable)',
        ramSpeed: '3200 MT/s',
        graphics: 'Intel UHD Graphics 770 – 128 MB',
        storage: '1.38 TB',
        storageUsed: '124 GB',
    },
    'System-6': {
        deviceName: 'NCET',
        model: 'Dell Vostro 3710',
        processor: '12th Gen Intel Core i7-12700 @ 2.10 GHz',
        ram: '16 GB (15.7 GB usable)',
        ramSpeed: '3200 MT/s',
        graphics: 'Intel UHD Graphics 770 – 128 MB',
        storage: '477 GB',
        storageUsed: '154 GB',
    },
};

const run = async () => {
    await connectDB();

    // 1. resolve the target organization
    const orgNameFilter = process.env.ORG_NAME || 'torii';
    const org = await Organization.findOne({ name: new RegExp(orgNameFilter, 'i') });
    if (!org) {
        const all = await Organization.find().select('name');
        console.error(`No organization matched /${orgNameFilter}/i.`);
        console.error('Existing organizations:', all.map((o) => o.name));
        console.error('Re-run with ORG_NAME="<exact name>".');
        process.exit(1);
    }
    console.log(`Target organization: ${org.name} (${org._id})`);

    // 2. build the query (optionally restrict to one lab)
    const baseQuery = { orgId: org._id };
    if (process.env.LAB_ID && mongoose.Types.ObjectId.isValid(process.env.LAB_ID)) {
        baseQuery.labId = process.env.LAB_ID;
        console.log(`Restricting to lab ${process.env.LAB_ID}`);
    }

    // 3. apply each config
    let updated = 0;
    let missing = 0;
    for (const [name, config] of Object.entries(CONFIGS)) {
        const result = await System.updateMany({ ...baseQuery, name }, { $set: config });
        if (result.matchedCount === 0) {
            console.warn(`  ⚠  no system named "${name}" found — skipped`);
            missing += 1;
        } else {
            console.log(`  ✓  ${name} -> ${config.deviceName} (${result.modifiedCount} updated)`);
            updated += result.matchedCount;
        }
    }

    console.log(`\nDone. Matched ${updated} system(s), ${missing} config name(s) had no match.`);
    await mongoose.connection.close();
    process.exit(0);
};

run().catch((error) => {
    console.error('Backfill failed:', error);
    process.exit(1);
});
