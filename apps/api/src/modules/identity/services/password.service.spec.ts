import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { PasswordService } from "./password.service.js";

describe("PasswordService", () => {
  let service: PasswordService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PasswordService,
        {
          provide: ConfigService,
          useValue: { get: () => ({ bcryptSaltRounds: 4 }) }, // low cost for fast tests
        },
      ],
    }).compile();

    service = moduleRef.get(PasswordService);
  });

  it("hashes a password to a value different from the plaintext", async () => {
    const hash = await service.hash("Sup3rSecret!");
    expect(hash).not.toBe("Sup3rSecret!");
    expect(hash.startsWith("$2b$")).toBe(true);
  });

  it("produces a different hash each time (random salt)", async () => {
    const [hashA, hashB] = await Promise.all([
      service.hash("Sup3rSecret!"),
      service.hash("Sup3rSecret!"),
    ]);
    expect(hashA).not.toBe(hashB);
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
