require("dotenv").config();
const crypto = require("crypto");
const mongoose = require("mongoose");
const User = require("../models/User");

const VALID_PHONE = /^0[35789]\d{8}$/;

function isValidPhone(phone) {
  if (!phone || typeof phone !== "string") return false;
  return VALID_PHONE.test(phone.replace(/\s/g, "").trim());
}

const NEW_USERS = [
  { full_name: "Khách Lan", phone_number: "0901234567" },
  { full_name: "Khách Minh", phone_number: "0912345678" },
];

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  const allUsers = await User.find({ role: 1 }).lean();
  const invalid = allUsers.filter((u) => !isValidPhone(u.phone_number));
  const valid = allUsers.filter((u) => isValidPhone(u.phone_number));

  console.log(`Found ${allUsers.length} customer(s), ${valid.length} valid, ${invalid.length} invalid.`);

  if (invalid.length > 0) {
    const ids = invalid.map((u) => u._id);
    const result = await User.deleteMany({ _id: { $in: ids } });
    console.log(`Deleted ${result.deletedCount} user(s) with invalid phone.`);
    invalid.forEach((u) => {
      console.log(`  - ${u.full_name} | phone: ${u.phone_number ?? "(none)"}`);
    });
  }

  for (const data of NEW_USERS) {
    const existing = await User.findOne({ phone_number: data.phone_number });
    if (existing) {
      console.log(`Skip create ${data.phone_number} — already exists (${existing.full_name})`);
      continue;
    }

    const user = await User.create({
      full_name: data.full_name,
      password: crypto.randomBytes(16).toString("hex"),
      phone_number: data.phone_number,
      role: 1,
      status: 1,
    });
    console.log(`Created: ${user.full_name} — ${user.phone_number}`);
  }

  console.log("\nDone.");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
