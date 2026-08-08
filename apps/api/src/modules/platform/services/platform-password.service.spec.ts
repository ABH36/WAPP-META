import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { PlatformPasswordService } from "./platform-password.service.js";

describe("PlatformPasswordService", () => {
  let service: PlatformPasswordService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PlatformPasswordService,
        { provide: ConfigService, useValue: { get: () => ({ bcryptSaltRounds: 4 }) } },
      ],
    }).compile();

    service = moduleRef.get(PlatformPasswordService);
  });

  it("hashes a password to a value different from the plaintext", async () => {
    const hash = await service.hash("Sup3rSecret!");
    expect(hash).not.toBe("Sup3rSecret!");
    expect(hash.startsWith("$2b$")).toBe(true);
  });

  it("compare() returns true for the correct password", async () => {
    const hash = await service.hash("Sup3rSecret!");
    await expect(service.compare("Sup3rSecret!", hash)).resolves.toBe(true);
  });

  it("compare() returns false for an incorrect password", async () => {
    const hash = await service.hash("Sup3rSecret!");
    await expect(service.compare("WrongPassword!", hash)).resolves.toBe(false);
  });
});
