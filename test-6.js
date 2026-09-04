const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");

const app = require("./pr-review-test");

let server;
let baseUrl;

function request(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const url = new URL(path, baseUrl);
    const req = http.request(
      {
        method,
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        headers: {
          ...(payload && {
            "content-type": "application/json",
            "content-length": Buffer.byteLength(payload),
          }),
          ...headers,
        },
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          let parsedBody = data;
          try {
            parsedBody = data ? JSON.parse(data) : null;
          } catch {
            // Keep non-JSON responses as text.
          }
          resolve({ status: res.statusCode, body: parsedBody });
        });
      },
    );

    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

test.before(() => {
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => {
  server.close();
});

test("GET /api/users returns a paginated response", async () => {
  const response = await request("GET", "/api/users?page=1&limit=1");

  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(response.body).sort(), [
    "limit",
    "page",
    "users",
  ]);
  assert.equal(response.body.page, 1);
  assert.equal(response.body.limit, 1);
  assert.equal(response.body.users.length, 1);
});

test("search matching is case insensitive", async () => {
  const response = await request("GET", "/api/users?q=ASHA");

  assert.equal(response.status, 200);
  assert.ok(response.body.users.some((user) => user.name === "Asha"));
});

test("unknown routes return a not-found response", async () => {
  const response = await request("GET", "/api/does-not-exist");

  assert.equal(response.status, 404);
});

test("malformed JSON is rejected instead of creating a user", async () => {
  const response = await request("POST", "/api/users", undefined, {
    "content-type": "application/json",
  });

  assert.notEqual(response.status, 201);
});

test("created users receive a numeric id", async () => {
  const response = await request("POST", "/api/users", {
    name: "Contract Test User",
    email: "contract-test@example.com",
    password: "not-returned",
  });

  assert.equal(response.status, 201);
  assert.equal(typeof response.body.id, "number");
});
