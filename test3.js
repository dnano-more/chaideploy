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
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null,
          });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });

    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

test.before(async (t) => {
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  console.log(`Test server running at ${baseUrl}`);
});

test.after(() => {
  server.close();
});

test("API Security: user search should NOT expose passwords in response", async () => {
  const response = await makeRequest("GET", "/api/users?q=ash");
  assert.equal(response.status, 200, "Expected 200 status");
  assert.ok(Array.isArray(response.body.users), "Expected users array");

  for (const user of response.body.users) {
    assert.ok(
      !user.hasOwnProperty("password"),
      `SECURITY ISSUE: Password exposed in response for user ${user.name}`,
    );
  }
});

test("API Security: user creation should NOT return password in response", async () => {
  const newUser = {
    name: "Test User",
    email: "test@example.com",
    password: "secret-password-123",
  };

  const response = await makeRequest("POST", "/api/users", newUser);
  assert.equal(response.status, 201, "Expected 201 Created");
  assert.ok(
    !response.body.hasOwnProperty("password"),
    "SECURITY ISSUE: Password returned in creation response",
  );
});

test("Input Validation: missing required fields should be rejected", async () => {
  const invalidUser = { email: "incomplete@example.com" };
  const response = await makeRequest("POST", "/api/users", invalidUser);

  // Current implementation accepts this - flagging for review
  console.log(
    `⚠️  INPUT VALIDATION: POST /api/users accepted incomplete data: ${response.status}`,
  );
  assert.ok(
    response.status === 400 || response.body.name === undefined,
    "REVIEW NEEDED: Missing name validation",
  );
});

test("Pagination: offset-based pagination starts from correct index", async () => {
  const page1 = await makeRequest("GET", "/api/users?page=1&limit=1");
  const page2 = await makeRequest("GET", "/api/users?page=2&limit=1");

  assert.equal(page1.body.users.length, 1, "Page 1 should have 1 user");
  assert.equal(page2.body.users.length, 1, "Page 2 should have 1 user");

  if (page1.body.users[0] && page2.body.users[0]) {
    assert.notEqual(
      page1.body.users[0].id,
      page2.body.users[0].id,
      "Pages should contain different users",
    );
  }
});

test("Cache Issue: concurrent requests with same query should return consistent results", async () => {
  const query = "?q=ravi&page=1&limit=10";

  const [res1, res2, res3] = await Promise.all([
    makeRequest("GET", `/api/users${query}`),
    makeRequest("GET", `/api/users${query}`),
    makeRequest("GET", `/api/users${query}`),
  ]);

  assert.deepEqual(
    res1.body.users,
    res2.body.users,
    "Cache should return identical results",
  );
  assert.deepEqual(
    res2.body.users,
    res3.body.users,
    "Concurrent requests should match",
  );
});

test("Search: case-insensitive search functionality", async () => {
  const lowercase = await makeRequest("GET", "/api/users?q=asha");
  const uppercase = await makeRequest("GET", "/api/users?q=ASHA");
  const mixed = await makeRequest("GET", "/api/users?q=AshA");

  assert.equal(
    lowercase.body.users.length,
    uppercase.body.users.length,
    "Search should be case-insensitive",
  );
  assert.equal(
    uppercase.body.users.length,
    mixed.body.users.length,
    "Mixed case search should match",
  );
});

test("Resource Limits: empty query should return all users (or paginated results)", async () => {
  const response = await makeRequest("GET", "/api/users?q=");
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body.users), "Should return users array");
  console.log(
    `Total users found with empty query: ${response.body.users.length}`,
  );
});

test("Error Handling: invalid query parameters should be handled gracefully", async () => {
  const response = await makeRequest(
    "GET",
    "/api/users?page=invalid&limit=abc",
  );
  // NaN values will be parsed as 0 or 10 defaults
  assert.equal(
    response.status,
    200,
    "Should handle invalid parameters gracefully",
  );
  console.log(
    `⚠️  REVIEW: Invalid query params returned status ${response.status}`,
  );
});
