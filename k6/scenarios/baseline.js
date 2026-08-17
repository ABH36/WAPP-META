// PHD-001 Volume-3 — Baseline scenario.
//
// Low, constant concurrency against the cheapest real endpoint (/api/health,
// a version-neutral, unauthenticated, pure in-memory readyState check — no
// Mongo/Redis I/O per request, confirmed by reading health-check.service.ts).
// This establishes the steady-state latency floor every other scenario
// (load/stress/spike/recovery) is compared against — it is not itself a
// capacity test.
import http from "k6/http";
import { check, sleep } from "k6";
import { authHeaders } from "../lib/helpers.js";

export const options = {
  scenarios: {
    baseline: {
      executor: "constant-vus",
      vus: 10,
      duration: "2m",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<150", "p(99)<300"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:4000";

export default function () {
  const res = http.get(`${BASE_URL}/api/health`, { headers: authHeaders() });
  check(res, {
    "status is 200": (r) => r.status === 200,
    "database connected": (r) => r.json("data.status") === "ok",
  });
  sleep(1);
}
