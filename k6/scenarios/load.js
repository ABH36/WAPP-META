// PHD-001 Volume-3 — Load scenario.
//
// Ramps toward a realistic expected peak, mixing a cheap read (/api/health)
// with a real write-heavy business workload (/api/v1/auth/register:
// bcrypt hash, Mongo write, BullMQ email-queue enqueue). Each VU simulates
// one distinct tenant/client (own X-Forwarded-For — see lib/helpers.js) and
// registers at most once every ~20s, comfortably inside SEC-009's 5-req/min
// per-client throttle on this endpoint — this scenario measures application
// capacity, not the auth throttle's own ceiling (a separate, intentional
// control, not a bug to push past).
import http from "k6/http";
import { check, sleep } from "k6";
import { authHeaders, uniqueRegisterPayload } from "../lib/helpers.js";

export const options = {
  scenarios: {
    load: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 50 },
        { duration: "3m", target: 50 },
        { duration: "1m", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.02"],
    "http_req_duration{name:health}": ["p(95)<300"],
    "http_req_duration{name:register}": ["p(95)<800"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:4000";

export default function () {
  const headers = authHeaders();

  const health = http.get(`${BASE_URL}/api/health`, { headers, tags: { name: "health" } });
  check(health, { "health 200": (r) => r.status === 200 });

  sleep(1);

  const register = http.post(
    `${BASE_URL}/api/v1/auth/register`,
    JSON.stringify(uniqueRegisterPayload()),
    { headers, tags: { name: "register" } },
  );
  check(register, {
    "register 201 or throttled": (r) => r.status === 201 || r.status === 429,
  });

  sleep(19);
}
