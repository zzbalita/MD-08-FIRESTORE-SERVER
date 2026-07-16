require("dotenv").config();
const mongoose = require("mongoose");

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const orders = mongoose.connection.db.collection("orders");

  const processing = await orders.updateMany(
    { status: { $in: ["processing", "shipping"] } },
    { $set: { status: "confirmed" } }
  );
  const cancelled = await orders.updateMany(
    { status: "cancelled" },
    { $set: { status: "pending" } }
  );

  console.log(`Mapped processing/shipping -> confirmed: ${processing.modifiedCount}`);
  console.log(`Mapped cancelled -> pending: ${cancelled.modifiedCount}`);
  console.log("Done.");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
