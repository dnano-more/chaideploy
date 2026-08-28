const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");

const app = require("./pr-review-test");

let server;
let baseUrl;

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const url = new URL(path, baseUrl);
    const requestOptions = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: `${url.pathname}${url.search}`,
      headers: payload
        ? {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
          }
        : {},
    };

    const request = http.request(requestOptions, (response) => {
      let responseBody = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        responseBody += chunk;
      });
      response.on("end", () => {
        resolve({
          status: response.statusCode,
          body: responseBody ? JSON.parse(responseBody) : null,
        });
      });
    });

    request.on("error", reject);
    if (payload) request.write(payload);
    request.end();
  });
}

test.before(async () => {
  server = await new Promise((resolve) => {
    const runningServer = app.listen(0, () => resolve(runningServer));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => {
  server.close();
});

test("user search returns the requested first page", async () => {
  const response = await request("GET", "/api/users?q=a&page=1&limit=1");

  assert.equal(response.status, 200);
  assert.equal(response.body.page, 1);
  assert.equal(response.body.limit, 1);
  assert.equal(response.body.users.length, 1);
});

test("user search does not expose passwords", async () => {
  const response = await request("GET", "/api/users");

  assert.equal(response.status, 200);
  assert.ok(response.body.users.every((user) => !("password" in user)));
});

test("user creation validates input and does not return the password", async () => {
  const response = await request("POST", "/api/users", {
    name: "New user",
    email: "new-user@example.com",
    password: "temporary-password",
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.name, "New user");
  assert.ok(!("password" in response.body));
});

test("invalid pagination is rejected", async () => {
  const response = await request("GET", "/api/users?page=0&limit=-1");

  assert.equal(response.status, 400);
});
