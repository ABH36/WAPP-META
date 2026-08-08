import { Test } from "@nestjs/testing";
import { PlatformMaintenanceGateListener } from "./platform-maintenance-gate.listener.js";
import { PlatformMaintenanceGateRepository } from "../repositories/platform-maintenance-gate.repository.js";

describe("PlatformMaintenanceGateListener", () => {
  let listener: PlatformMaintenanceGateListener;
  let gateRepository: jest.Mocked<PlatformMaintenanceGateRepository>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PlatformMaintenanceGateListener,
        { provide: PlatformMaintenanceGateRepository, useValue: { setEnabled: jest.fn() } },
      ],
    }).compile();

    listener = moduleRef.get(PlatformMaintenanceGateListener);
    gateRepository = moduleRef.get(PlatformMaintenanceGateRepository);
  });

  it("enables the gate on PLATFORM_MAINTENANCE_ENABLED", async () => {
    await listener.onEnabled();
    expect(gateRepository.setEnabled).toHaveBeenCalledWith(true);
  });

  it("disables the gate on PLATFORM_MAINTENANCE_DISABLED", async () => {
    await listener.onDisabled();
    expect(gateRepository.setEnabled).toHaveBeenCalledWith(false);
  });
});
