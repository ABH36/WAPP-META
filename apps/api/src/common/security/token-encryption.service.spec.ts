import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { TokenEncryptionService } from "./token-encryption.service.js";

describe("TokenEncryptionService", () => {
  let service: TokenEncryptionService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        TokenEncryptionService,
        {
          provide: ConfigService,
          useValue: {
            get: () => "0".repeat(64), // 32-byte all-zero key — fine for tests
          },
        },
      ],
    }).compile();

    service = moduleRef.get(TokenEncryptionService);
  });

  it("round-trips a plaintext value", () => {
    const encrypted = service.encrypt("super-secret-waba-token");
    expect(encrypted).not.toContain("super-secret-waba-token");
    expect(service.decrypt(encrypted)).toBe("super-secret-waba-token");
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = service.encrypt("same-value");
    const b = service.encrypt("same-value");
    expect(a).not.toBe(b);
  });

  it("fails to decrypt a tampered ciphertext (authentication failure)", () => {
    const encrypted = service.encrypt("super-secret-waba-token");
    const [iv, authTag, ciphertext] = encrypted.split(".");
    const tampered = `${iv}.${authTag}.${ciphertext}extra`;
    expect(() => service.decrypt(tampered)).toThrow();
  });

  it("rejects a malformed packed value", () => {
    expect(() => service.decrypt("not-a-valid-packed-value")).toThrow("Malformed encrypted value");
  });
});
