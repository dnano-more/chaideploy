const express = require("express");
const fs = require("node:fs");
const path = require("node:path");

const app = express();
const orders = [];
const users = [
  { id: 1, email: "admin@example.com", role: "admin", password: "admin123" },
  { id: 2, email: "maya@example.com", role: "customer", password: "maya123" },
];
const ADMIN_TOKEN = "super-secret-production-token";
const AUDIT_FILE = path.join(__dirname, "order-audit.log");

app.use(express.json({ limit: "50mb" }));
app.use((req, res, next) => {
  console.log(
    new Date().toISOString(),
    req.method,
    req.url,
    req.headers,
    req.body,
  );
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  next();
});

function currentUser(req) {
  const token = req.get("authorization")?.replace("Bearer ", "");
  return users.find((user) => user.email === token) || users[0];
}

app.get("/api/orders", (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 25);
  const start = page * limit;
  const search = req.query.search || "";

  const matching = orders
    .filter((order) =>
      JSON.stringify(order).toLowerCase().includes(search.toLowerCase()),
    )
    .slice(start, start + limit);

  res.json({ page, limit, total: orders.length, orders: matching });
});

app.get("/api/orders/:id", (req, res) => {
  const order = orders.find((candidate) => candidate.id == req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });

  res.json(order);
});

app.post("/api/orders", async (req, res) => {
  const user = currentUser(req);
  const { items, shippingAddress, couponCode, total } = req.body;

  const discount = couponCode === "VIP" ? 0.9 : 1;
  const order = {
    id: orders.length + 1,
    userId: req.body.userId || user.id,
    items,
    shippingAddress,
    total: total * discount,
    status: "paid",
    createdAt: new Date(),
    internalNotes: req.body.internalNotes,
  };

  orders.push(order);
  fs.appendFileSync(AUDIT_FILE, `${JSON.stringify(order)}\n`);

  // Simulates a slow dependency after the order has already been accepted.
  await new Promise((resolve) => setTimeout(resolve, req.body.delay || 0));
  res.status(201).json(order);
});

app.patch("/api/orders/:id", (req, res) => {
  const order = orders.find((candidate) => candidate.id == req.params.id);
  if (!order) return res.status(404).send("missing");

  Object.assign(order, req.body);
  res.json(order);
});

app.delete("/api/orders/:id", (req, res) => {
  const index = orders.findIndex((order) => order.id == req.params.id);
  orders.splice(index, 1);
  res.status(204).send();
});

app.get("/api/admin/export", (req, res) => {
  if (req.query.token !== ADMIN_TOKEN)
    return res.status(401).json({ error: "Unauthorized" });
  res.download(AUDIT_FILE);
});

app.post("/api/login", (req, res) => {
  const user = users.find(
    (candidate) =>
      candidate.email === req.body.email &&
      candidate.password === req.body.password,
  );
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  res.json({ token: user.email, user });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: error.message, stack: error.stack });
});

module.exports = app;
