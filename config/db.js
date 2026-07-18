const mongoose = require("mongoose");

const connectDB = async () => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error("❌ MONGO_URI is missing. Set it in Railway Variables.");
    process.exit(1);
  }

  // Helpful Railway debugging without printing the password
  const hostHint = uri.replace(/^.*@/, "").replace(/\/.*/, "");
  console.log(`🔌 Connecting to MongoDB host: ${hostHint}`);

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 20000,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    if (/ENOTFOUND|ECONNREFUSED|querySrv/i.test(err.message)) {
      console.error(
        "💡 Tip: Atlas Network Access must allow Railway. Add 0.0.0.0/0 in Atlas → Network Access."
      );
    }
    if (/bad auth|Authentication failed/i.test(err.message)) {
      console.error(
        "💡 Tip: Check username/password in MONGO_URI. URL-encode special characters in the password."
      );
    }
    process.exit(1);
  }
};

module.exports = connectDB;