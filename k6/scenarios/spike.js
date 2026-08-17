// PHD-001 Volume-3 — Spike scenario.
//
// Sudden burst of concurrency (not a gradual ramp) against /api/health, to
// observe connection-handling and event-loop behavior under an abrupt
// traffic surge (e.g. a broadcast campaign landing, or a client integration
// misbehaving) rather than gradual growth. Same endpoint/IP-per-VU rationale
// as stress.js.
import http from "k6/http";
import { check } from "k6";
import { authHeaders } from "../lib/helpers.js";

export const options = {
  scenarios: {
    spike: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "10s", target: 10 },
        { duration: "10s", target: 200 },
        { duration: "30s", target: 200 },
        { duration: "10s", target: 10 },
        { duration: "30s", target: 10 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.5"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:4000";

export default function () {
  const res = http.get(`${BASE_URL}/api/health`, { headers: authHeaders() });
  check(res, { "status is 200": (r) => r.status === 200 });
}
