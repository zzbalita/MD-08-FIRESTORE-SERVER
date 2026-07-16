require("dotenv").config();
const mongoose = require("mongoose");

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const result = await mongoose.connection.db.collection("orders").deleteMany({});
  console.log(`Deleted ${result.deletedCount} order(s).`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
