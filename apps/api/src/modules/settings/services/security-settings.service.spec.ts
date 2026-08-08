import { Test } from "@nestjs/testing";
import { SecuritySettingsService } from "./security-settings.service.js";
import { AuthService } from "../../identity/services/auth.service.js";

describe("SecuritySettingsService", () => {
  let service: SecuritySettingsService;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SecuritySettingsService,
        {
          provide: AuthService,
          useValue: {
            changePassword: jest.fn(),
            listSessions: jest.fn(),
            revokeSession: jest.fn(),
            logoutAllDevices: jest.fn(),
            getLoginHistory: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(SecuritySettingsService);
    authService = moduleRef.get(AuthService);
  });

  it("changePassword delegates to AuthService", async () => {
    await service.changePassword("user-1", "current", "newpass");
    expect(authService.changePassword).toHaveBeenCalledWith("user-1", "current", "newpass");
  });

  it("listSessions delegates to AuthService", async () => {
    authService.listSessions.mockResolvedValue([]);
    await service.listSessions("user-1");
    expect(authService.listSessions).toHaveBeenCalledWith("user-1");
  });

  it("revokeSession delegates to AuthService", async () => {
    await service.revokeSession("user-1", "session-1");
    expect(authService.revokeSession).toHaveBeenCalledWith("user-1", "session-1");
  });

  it("revokeAllSessions delegates to AuthService.logoutAllDevices", async () => {
    await service.revokeAllSessions("user-1");
    expect(authService.logoutAllDevices).toHaveBeenCalledWith("user-1");
  });

  it("getLoginHistory delegates to AuthService", async () => {
    authService.getLoginHistory.mockResolvedValue([]);
    await service.getLoginHistory("user-1");
    expect(authService.getLoginHistory).toHaveBeenCalledWith("user-1");
  });
});
