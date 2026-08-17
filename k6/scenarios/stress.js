// PHD-001 Volume-3 — Stress scenario.
//
// Pure /api/health (cheap, no Mongo/Redis I/O per request — see baseline.js's
// comment) pushed well beyond the load scenario's peak, isolating raw
// container capacity (event loop / connection handling under the
// docker-compose.prod.yml production resource limits: 1.0 CPU, 512MB) from
// SEC-009/SEC-010's intentional rate-limit ceilings — each VU still gets its
// own simulated client IP so this measures the container breaking, not the
// throttle correctly doing its job (that's verified separately).
import http from "k6/http";
import { check } from "k6";
import { authHeaders } from "../lib/helpers.js";

export const options = {
  scenarios: {
    stress: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 100 },
        { duration: "2m", target: 250 },
        { duration: "2m", target: 400 },
        { duration: "2m", target: 400 },
        { duration: "1m", target: 0 },
      ],
    },
  },
  thresholds: {
    // Intentionally loose / observational — the point of a stress test is to
    // find where these break, not to gate on a pre-guessed number.
    http_req_failed: ["rate<0.5"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:4000";

export default function () {
  const res = http.get(`${BASE_URL}/api/health`, { headers: authHeaders() });
  check(res, { "status is 200": (r) => r.status === 200 });
}
