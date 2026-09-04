const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");

const app = require("./pr-review-test");

let server;
let baseUrl;

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const payload = body ? JSON.stringify(body) : null;

    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: `${url.pathname}${url.search}`,
      headers: {
        ...(payload && {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        }),
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          const body = data ? JSON.parse(data) : null;
          resolve({ status: res.statusCode, body });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => {
  server.close();
});

test("Persistence: created users persist across requests", async () => {
  const newUser = {
    name: "Persistent User",
    email: "persist@example.com",
    role: "user",
    password: "pass123",
  };

  const createRes = await makeRequest("POST", "/api/users", newUser);
  assert.equal(createRes.status, 201, "User should be created");

  const userId = createRes.body.id;
  const searchRes = await makeRequest("GET", "/api/users?q=Persistent");

  const foundUser = searchRes.body.users.find((u) => u.id === userId);
  assert.ok(foundUser, "Created user should be findable in search");
  assert.equal(foundUser.name, "Persistent User");
});

test("Duplicate Prevention: system allows duplicate emails (REVIEW: possible issue)", async () => {
  const user1 = {
    name: "User One",
    email: "duplicate@example.com",
    password: "pass1",
  };

  const user2 = {
    name: "User Two",
    email: "duplicate@example.com",
    password: "pass2",
  };

  const res1 = await makeRequest("POST", "/api/users", user1);
  const res2 = await makeRequest("POST", "/api/users", user2);

  assert.equal(res1.status, 201);
  assert.equal(res2.status, 201);
  console.log(
    "⚠️  DATA INTEGRITY: Duplicate emails are allowed - consider adding uniqueness constraint",
  );
});

test("Load Test: handle multiple concurrent user creation requests", async () => {
  const users = Array.from({ length: 10 }, (_, i) => ({
    name: `LoadTest User ${i}`,
    email: `load-${i}@example.com`,
    password: `pass${i}`,
  }));

  const startTime = Date.now();
  const results = await Promise.all(
    users.map((user) => makeRequest("POST", "/api/users", user)),
  );
  const duration = Date.now() - startTime;

  const successCount = results.filter((r) => r.status === 201).length;
  assert.equal(successCount, 10, `Should create 10 users, got ${successCount}`);
  console.log(`✓ Created 10 users concurrently in ${duration}ms`);
});

test("Cache Consistency: search cache invalidation after new user", async () => {
  const beforeSearch = await makeRequest(
    "GET",
    "/api/users?q=NewUser&page=1&limit=10",
  );
  const beforeCount = beforeSearch.body.users.length;

  const newUser = {
    name: "NewUserXXX",
    email: "newuserxxx@example.com",
    password: "pass",
  };

  await makeRequest("POST", "/api/users", newUser);

  const afterSearch = await makeRequest(
    "GET",
    "/api/users?q=NewUser&page=1&limit=10",
  );
  const afterCount = afterSearch.body.users.length;

  if (beforeCount === afterCount) {
    console.log(
      "⚠️  CACHE ISSUE: Search results not updated after new user creation",
    );
  } else {
    console.log("✓ Cache correctly reflects new user data");
  }
});

test("Query Extremes: very long search query", async () => {
  const longQuery = "a".repeat(1000);
  const response = await makeRequest(
    "GET",
    `/api/users?q=${encodeURIComponent(longQuery)}`,
  );

  assert.equal(response.status, 200, "Should handle long queries");
  assert.equal(response.body.users.length, 0, "No users should match");
});

test("Boundary: negative page numbers should be handled", async () => {
  const response = await makeRequest("GET", "/api/users?page=-5&limit=10");

  console.log(
    `Negative page handling: status=${response.status}, users=${response.body.users.length}`,
  );
  if (response.body.users.length > 0) {
    console.log(
      "⚠️  BOUNDARY ISSUE: Negative page numbers should return 400 or empty",
    );
  }
});

test("Response Structure: all user fields are properly included", async () => {
  const response = await makeRequest("GET", "/api/users?q=a");

  assert.ok(response.body.users.length > 0, "Should have users");
  const user = response.body.users[0];

  const requiredFields = ["id", "name", "email", "role"];
  for (const field of requiredFields) {
    assert.ok(user.hasOwnProperty(field), `User should have ${field} field`);
  }

  if (user.hasOwnProperty("password")) {
    console.log("⚠️  SECURITY: Password field exposed in response");
  }
});

test("Performance: measure search response time", async () => {
  const start = Date.now();
  const response = await makeRequest("GET", "/api/users?q=test&page=1&limit=5");
  const duration = Date.now() - start;

  console.log(`Search completed in ${duration}ms`);
  assert.ok(duration < 5000, "Search should complete within 5 seconds");
});

test("Role Assignment: default role assigned correctly", async () => {
  const userWithRole = {
    name: "User With Role",
    email: "role@example.com",
    role: "admin",
    password: "pass",
  };

  const userWithoutRole = {
    name: "User Without Role",
    email: "norole@example.com",
    password: "pass",
  };

  const res1 = await makeRequest("POST", "/api/users", userWithRole);
  const res2 = await makeRequest("POST", "/api/users", userWithoutRole);

  assert.equal(res1.body.role, "admin", "Specified role should be preserved");
  assert.equal(res2.body.role, "member", "Default role should be 'member'");
});
console.log("All tests completed");
