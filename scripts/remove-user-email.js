require("dotenv").config();
const mongoose = require("mongoose");

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const users = db.collection("users");

  try {
    await users.dropIndex("email_1");
    console.log("Dropped email_1 index.");
  } catch (err) {
    if (err.codeName !== "IndexNotFound") {
      console.log("email_1 index:", err.message);
    }
  }

  const result = await users.updateMany({}, { $unset: { email: "" } });
  console.log(`Removed email from ${result.modifiedCount} user document(s).`);

  try {
    await users.createIndex({ phone_number: 1 }, { unique: true });
    console.log("Ensured unique index on phone_number.");
  } catch (err) {
    console.log("phone_number index:", err.message);
  }

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
