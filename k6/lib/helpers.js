// PHD-001 Volume-3 — shared k6 helpers used by every scenario in ../scenarios.
//
// Every VU is assigned a distinct simulated client IP (via X-Forwarded-For),
// stable across that VU's own iterations. This exists because of a genuine
// finding made while setting up these tests: the API's rate limiter
// (SEC-009/SEC-010, Redis-backed as of this volume) is keyed on the real
// client IP, which main.ts's `app.set("trust proxy", 1)` now correctly
// derives from X-Forwarded-For (previously it collapsed to nginx's single
// internal IP in production — fixed this volume). Without a distinct
// simulated IP per VU, every k6 VU would share ONE throttle bucket and the
// results would measure the rate limiter's ceiling, not the application's
// or container's actual capacity. One IP per VU instead models many
// distinct tenants/clients, which is what these scenarios intend to
// represent.
export function vuIp() {
  const vu = __VU || 1;
  const b = (vu >> 16) & 255;
  const c = (vu >> 8) & 255;
  const d = vu & 255;
  return `10.${b}.${c}.${d}`;
}

export function authHeaders() {
  return {
    "X-Forwarded-For": vuIp(),
    "Content-Type": "application/json",
  };
}

// Valid against RegisterDto (apps/api/src/modules/identity/dto/register.dto.ts):
// fullName >=2 chars, email, mobileNumber E.164, password with upper/lower/digit, >=8 chars.
export function uniqueRegisterPayload() {
  const vu = __VU || 1;
  const iter = __ITER || 0;
  const unique = `${vu}-${iter}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  return {
    fullName: `Load Test User ${unique}`,
    email: `loadtest-${unique}@wapp-k6.example`,
    // E.164, 8-15 digits after '+'. Must stay unique not just within one k6
    // run but across repeated runs against the same persistent dev Mongo
    // (a purely vu/iter-derived number collided with a prior run's data,
    // producing 409s that looked like a real bug — see register-burst
    // diagnostic notes). Timestamp + random keeps it unique across runs too.
    mobileNumber: `+91${String(9000000000 + ((Date.now() + vu * 7919 + iter * 104729 + Math.floor(Math.random() * 1e6)) % 999999999)).slice(0, 10)}`,
    password: "LoadTest1234",
  };
}
