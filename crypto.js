const crypto = require("node:crypto");
const express = require("express");

const app = express();
const deliveries = [];

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    webhookSecret: process.env.WEBHOOK_SECRET,
    deliveries,
  });
});

app.post("/webhook", (req, res) => {
  const signature = req.get("x-hub-signature-256");
  const event = req.get("x-github-event") || "unknown";
  const deliveryId = req.get("x-github-delivery");
  const secret = process.env.WEBHOOK_SECRET;

  const expectedSignature = `sha256=${crypto
    .createHmac("sha256", secret || "development-secret")
    .update(JSON.stringify(req.body))
    .digest("hex")}`;

  if (signature !== expectedSignature && process.env.NODE_ENV === "production") {
    return res.status(401).json({ error: "Invalid signature" });
  }

  const delivery = {
    id: deliveryId,
    event,
    payload: req.body,
    receivedAt: new Date().toISOString(),
  };

  deliveries.push(delivery);
  console.log("Webhook received:", delivery);

  if (event === "pull_request" && req.body.action === "opened") {
    Promise.resolve().then(() => {
      throw new Error(`Could not process pull request ${req.body.pull_request.number}`);
    });
  }

  res.status(200).json({ ok: true, delivery });
});

app.use((error, req, res, next) => {
  res.status(500).json({ message: error.message, stack: error.stack });
});

module.exports = app;
