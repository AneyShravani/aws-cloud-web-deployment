// a one-time script you run manually that connects to your
// database and creates fake starter data (1 Organization,
// 1 AdminUser, 1 Lab), so you have something real to test System.js against.
require("dotenv").config(); // loads your .env file so MONGO_URI is available
const { connectDB } = require("./config/db"); // db.js exports { connectDB }, so we destructure it
const Organization = require("./models/Organization");
const AdminUser = require("./models/AdminUser");
const Lab = require("./models/Lab");

const seed = async () => {
    await connectDB(); // step 1: connect to MongoDB first

    // step 2: create one Organization
    const org = await Organization.create({ name: "Test Organization" });

    // step 3: create one AdminUser matching the REAL schema (orgId)
    const admin = await AdminUser.create({
        name: "Test Admin", // required field
        email: "admin2@example.com", // unique — avoids duplicate key error with old test data
        password: "password123", // plaintext here; real login likely expects bcrypt hash, fine for seed/testing only
        role: "ADMIN",
        orgId: org._id
    });

    // step 4: create one Lab
    const lab = await Lab.create({ name: "Test Lab", orgId: org._id }); // Lab.js still uses orgId

    // step 5: print the IDs so you can copy them for Postman/Thunder Client
    

    process.exit(0);
};

seed();
