import { withCorrelationId } from "./job-context.util.js";

describe("withCorrelationId", () => {
  it("merges correlationId into the given job data without mutating the original object", () => {
    const data = { payload: "value" };

    const result = withCorrelationId(data, "corr-1");

    expect(result).toEqual({ payload: "value", correlationId: "corr-1" });
    expect(data).toEqual({ payload: "value" });
  });
});
