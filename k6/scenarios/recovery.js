// PHD-001 Volume-3 — Recovery scenario.
//
// One continuous run: a short high-concurrency surge against /api/health,
// immediately followed by a low, constant-load "recovery" window timed to
// start exactly when the surge ends (via `startTime`). k6 auto-tags every
// request with its owning scenario name, so http_req_duration can be sliced
// per phase and the recovery window's p95 compared directly against
// baseline.js's own p95<150ms threshold — answering "how long, and how
// cleanly, does latency return to baseline after a surge ends" rather than
// just "does it survive the surge" (that's stress.js/spike.js's job).
import http from "k6/http";
import { check } from "k6";
import { authHeaders } from "../lib/helpers.js";

export const options = {
  scenarios: {
    surge: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "20s", target: 300 },
        { duration: "40s", target: 300 },
        { duration: "10s", target: 0 },
      ],
    },
    recovery_window: {
      executor: "constant-vus",
      vus: 10,
      duration: "2m",
      startTime: "70s", // exactly when the `surge` scenario above ends
    },
  },
  thresholds: {
    "http_req_duration{scenario:recovery_window}": ["p(95)<200"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:4000";

export default function () {
  const res = http.get(`${BASE_URL}/api/health`, { headers: authHeaders() });
  check(res, { "status is 200": (r) => r.status === 200 });
}
