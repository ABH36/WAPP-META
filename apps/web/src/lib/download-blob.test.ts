import { describe, it, expect, vi, afterEach } from "vitest";
import { downloadBlob } from "./download-blob";

describe("downloadBlob", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates an object URL, triggers a click on a download anchor, then revokes the URL", () => {
    const createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    const blob = new Blob(["a,b,c"], { type: "text/csv" });
    downloadBlob(blob, "leads-report.csv");

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");

    clickSpy.mockRestore();
  });
});
