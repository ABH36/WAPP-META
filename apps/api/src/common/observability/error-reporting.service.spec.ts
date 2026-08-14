import { Logger } from "@nestjs/common";
import { NoopErrorReportingService } from "./error-reporting.service.js";

describe("NoopErrorReportingService", () => {
  it("logs at debug level (not error), so it never duplicates the caller's own ERROR-level log line", () => {
    const debugSpy = jest.spyOn(Logger.prototype, "debug").mockImplementation();
    const errorSpy = jest.spyOn(Logger.prototype, "error").mockImplementation();

    const service = new NoopErrorReportingService();
    service.captureException(new Error("boom"), { correlationId: "corr-1" });

    expect(debugSpy).toHaveBeenCalledWith(
      expect.stringContaining("boom"),
      expect.objectContaining({ correlationId: "corr-1" }),
    );
    expect(errorSpy).not.toHaveBeenCalled();

    debugSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("handles a non-Error thrown value without throwing itself", () => {
    const debugSpy = jest.spyOn(Logger.prototype, "debug").mockImplementation();

    const service = new NoopErrorReportingService();
    expect(() => service.captureException("plain string failure")).not.toThrow();
    expect(debugSpy).toHaveBeenCalledWith(
      expect.stringContaining("plain string failure"),
      undefined,
    );

    debugSpy.mockRestore();
  });
});
