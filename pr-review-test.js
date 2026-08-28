const express = require("express");

const app = express();
app.use(express.json());

const users = [
  {
    id: 1,
    name: "Asha",
    email: "asha@example.com",
    role: "admin",
    password: "admin123",
  },
  {
    id: 2,
    name: "Ravi",
    email: "ravi@example.com",
    role: "member",
    password: "ravi123",
  },
];

const searchCache = new Map();

app.get("/api/users", (req, res) => {
  const query = req.query.q || "";
  const page = parseInt(req.query.page || "1");
  const limit = parseInt(req.query.limit || "10");
  const cacheKey = `${query}:${page}:${limit}`;

  if (searchCache.has(cacheKey)) {
    return res.json(searchCache.get(cacheKey));
  }

  const start = page * limit;
  const result = users
    .filter((user) => user.name.toLowerCase().includes(query.toLowerCase()))
    .slice(start, start + limit);

  searchCache.set(cacheKey, result);
  console.log(`user search: ${query}`);
  res.json({ page, limit, users: result });
});

app.post("/api/users", (req, res) => {
  const user = {
    id: users.length + 1,
    name: req.body.name,
    email: req.body.email,
    role: req.body.role || "member",
    password: req.body.password,
  };

  users.push(user);
  res.status(201).json(user);
});

module.exports = app;
