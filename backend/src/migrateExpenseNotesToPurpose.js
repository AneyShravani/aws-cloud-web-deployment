// ============================================================
// ONE-OFF SCRIPT: migrate Expense.notes -> Expense.purpose
// ------------------------------------------------------------
// The "notes" field was renamed to "purpose". Existing records
// still have their text under the old `notes` key (which the new
// schema no longer maps). This copies notes -> purpose for any
// record that has a note but no purpose yet, then clears notes.
//
// Run from the backend/ folder:
//     node src/migrateExpenseNotesToPurpose.js
//
// Idempotent: re-running does nothing once migrated.
// ============================================================
require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('./config/db');

const run = async () => {
    await connectDB();

    // work at the raw collection level — `notes` is no longer in the schema,
    // so we can't read it through the Mongoose model.
    const collection = mongoose.connection.collection('expenses');

    const cursor = collection.find({
        notes: { $exists: true, $nin: [null, ''] },
    });

    let migrated = 0;
    let skipped = 0;
    for await (const doc of cursor) {
        const hasPurpose = typeof doc.purpose === 'string' && doc.purpose.trim() !== '';
        await collection.updateOne(
            { _id: doc._id },
            {
                // only fill purpose if it's empty, so we never overwrite a real one
                ...(hasPurpose ? {} : { $set: { purpose: String(doc.notes).trim() } }),
                $unset: { notes: '' },
            }
        );
        if (hasPurpose) skipped += 1; else migrated += 1;
    }

    console.log(`Done. Copied ${migrated} note(s) into purpose; ${skipped} already had a purpose (notes cleared).`);
    await mongoose.connection.close();
    process.exit(0);
};

run().catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
});
