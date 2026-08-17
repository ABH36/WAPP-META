import { TracingShutdownService } from "./tracing-shutdown.service.js";

const shutdownTracing = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);

jest.mock("../../tracing.js", () => ({
  shutdownTracing: (): Promise<void> => shutdownTracing(),
}));

describe("TracingShutdownService", () => {
  it("calls shutdownTracing() on application shutdown", async () => {
    const service = new TracingShutdownService();

    await service.onApplicationShutdown();

    expect(shutdownTracing).toHaveBeenCalledTimes(1);
  });
});
