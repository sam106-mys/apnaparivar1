const functions = require("firebase-functions");
const {setGlobalOptions} = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const {MongoClient} = require("mongodb");
const dotenv = require("dotenv");
const {v4: uuid} = require("uuid");

setGlobalOptions({maxInstances: 10});
dotenv.config();

// Express app
const app = express();
app.use(cors({origin: true}));
app.use(express.json());

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI || (functions.config().mongo && functions.config().mongo.uri);
if (!MONGO_URI) {
  throw new Error("❌ MONGO_URI not set in environment variables or Firebase config");
}
const client = new MongoClient(MONGO_URI);
let db, Families, Members, Tokens;

async function getDB() {
  if (!db) {
    await client.connect();
    db = client.db("apnaparivar");
    Families = db.collection("families");
    Members = db.collection("members");
    Tokens = db.collection("tokens");
    console.log("✅ MongoDB connected");
  }
  return {Families, Members, Tokens};
}

// ---------------- ROUTES ----------------

// Create / update a family
app.post("/family", async (req, res) => {
  try {
    const {Families} = await getDB();
    const {familyId, familyName, superAdmin} = req.body;

    if (!familyId || !familyName || !superAdmin) {
      return res.status(400).json({error: "Missing required fields"});
    }

    await Families.updateOne(
      {familyId},
      {$set: {familyId, familyName, superAdmin}},
      {upsert: true}
    );

    return res.json({ok: true});
  } catch (err) {
    console.error("Error in /family:", err);
    return res.status(500).json({error: "Server error"});
  }
});

// Add subadmin
app.post("/subadmin", async (req, res) => {
  try {
    const {Families} = await getDB();
    const {familyId, name} = req.body;

    if (!familyId || !name) {
      return res.status(400).json({error: "Missing required fields"});
    }

    await Families.updateOne(
      {familyId},
      {$addToSet: {subAdmins: name}},
      {upsert: true}
    );

    return res.json({ok: true});
  } catch (err) {
    console.error("Error in /subadmin:", err);
    return res.status(500).json({error: "Server error"});
  }
});

// Add member
app.post("/member", async (req, res) => {
  try {
    const {Members} = await getDB();
    const {familyId, name} = req.body;

    if (!familyId || !name) {
      return res.status(400).json({error: "Missing required fields"});
    }

    await Members.insertOne({
      familyId,
      memberId: uuid(),
      name,
      createdAt: new Date(),
    });

    return res.json({ok: true});
  } catch (err) {
    console.error("Error in /member:", err);
    return res.status(500).json({error: "Server error"});
  }
});

// Generate invite token
app.post("/invite", async (req, res) => {
  try {
    const {Tokens} = await getDB();
    const {familyId} = req.body;

    if (!familyId) {
      return res.status(400).json({error: "Missing familyId"});
    }

    const token = uuid();

    await Tokens.insertOne({
      familyId,
      token,
      createdAt: new Date(),
      used: false,
    });

    return res.json({ok: true, token});
  } catch (err) {
    console.error("Error in /invite:", err);
    return res.status(500).json({error: "Server error"});
  }
});

// Export as Firebase Function (v1)
exports.api = functions.https.onRequest(app);

// Allow local run without Firebase (optional)
if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`HTTP server listening on http://localhost:${port}`);
  });
}
