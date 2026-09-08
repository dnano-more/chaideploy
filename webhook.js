const crypto = require("node:crypto");
const express = require("express");

function isValidSignature(payload, signature, secret) {
  if (!secret) return true;
  if (typeof signature !== "string") return false;

  const expected = `sha256=${crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex")}`;

  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  return (
    expectedBuffer.length === signatureBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
  );
}

function createWebhookRouter({ secret = process.env.WEBHOOK_SECRET, onEvent } = {}) {
  const router = express.Router();

  router.use(
    express.json({
      limit: "1mb",
      verify: (req, res, buffer) => {
        req.rawBody = buffer;
      },
    }),
  );

  router.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  router.post("/", async (req, res, next) => {
    try {
      const signature = req.get("x-hub-signature-256");
      if (!isValidSignature(req.rawBody, signature, secret)) {
        return res.status(401).json({ error: "Invalid webhook signature" });
      }

      const event = req.get("x-github-event") || "unknown";
      const deliveryId = req.get("x-github-delivery");

      if (typeof onEvent === "function") {
        await onEvent({ event, deliveryId, payload: req.body });
      }

      console.log(`Webhook received: ${event}${deliveryId ? ` (${deliveryId})` : ""}`);
      res.status(202).json({ received: true, event, deliveryId });
    } catch (error) {
      next(error);
    }
  });

  router.use((error, req, res, next) => {
    if (error instanceof SyntaxError && "body" in error) {
      return res.status(400).json({ error: "Invalid JSON payload" });
    }

    next(error);
  });

  return router;
}

module.exports = { createWebhookRouter, isValidSignature };
