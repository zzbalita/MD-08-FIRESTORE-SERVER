require("dotenv").config();
const mongoose = require("mongoose");

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  const products = await db.collection("products").find({}).toArray();
  let productCount = 0;
  for (const p of products) {
    const update = {};
    if (p.brand !== undefined && p.origin === undefined) {
      update.origin = p.brand;
      update.$unset = { ...(update.$unset || {}), brand: "" };
    }
    if (Array.isArray(p.variations)) {
      update.variations = p.variations.map((v) => ({
        package: v.package || v.size || "Mặc định",
        quantity: Number(v.quantity) || 0,
      }));
    }
    if (Object.keys(update).length > 0) {
      const { $unset, ...setFields } = update;
      const op = { $set: setFields };
      if ($unset) op.$unset = $unset;
      await db.collection("products").updateOne({ _id: p._id }, op);
      productCount++;
    }
  }

  const carts = await db.collection("carts").find({}).toArray();
  let cartCount = 0;
  for (const c of carts) {
    if (!Array.isArray(c.items)) continue;
    const items = c.items.map((item) => {
      const next = { ...item };
      if (item.package === undefined && item.size !== undefined) {
        next.package = item.size;
      }
      delete next.size;
      delete next.color;
      return next;
    });
    await db.collection("carts").updateOne({ _id: c._id }, { $set: { items } });
    cartCount++;
  }

  const orders = await db.collection("orders").find({}).toArray();
  let orderCount = 0;
  for (const o of orders) {
    if (!Array.isArray(o.items)) continue;
    const items = o.items.map((item) => {
      const next = { ...item };
      if (item.package === undefined && item.size !== undefined) {
        next.package = item.size;
      }
      delete next.size;
      delete next.color;
      return next;
    });
    await db.collection("orders").updateOne({ _id: o._id }, { $set: { items } });
    orderCount++;
  }

  const brandDocs = await db.collection("brands").find({}).toArray();
  if (brandDocs.length > 0) {
    const origins = brandDocs.map(({ _id, ...rest }) => rest);
    await db.collection("origins").deleteMany({});
    await db.collection("origins").insertMany(origins);
  }

  const sizeDocs = await db.collection("sizes").find({}).toArray();
  if (sizeDocs.length > 0) {
    const packages = sizeDocs.map(({ _id, ...rest }) => rest);
    await db.collection("packages").deleteMany({});
    await db.collection("packages").insertMany(packages);
  }

  console.log(`Migrated ${productCount} product(s), ${cartCount} cart(s), ${orderCount} order(s).`);
  console.log(`Copied ${brandDocs.length} brand(s) → origins, ${sizeDocs.length} size(s) → packages.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
