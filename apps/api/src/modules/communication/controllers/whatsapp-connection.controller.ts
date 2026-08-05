import { Body, Controller, Get, Post } from "@nestjs/common";
import { Permission } from "@wapp/shared-types";
import { CurrentUser } from "../../identity/decorators/current-user.decorator.js";
import { RequirePermission } from "../../identity/decorators/require-permission.decorator.js";
import type { AuthenticatedUser } from "../../identity/identity.types.js";
import { WhatsAppConnectionService } from "../services/whatsapp-connection.service.js";
import { ConnectWhatsAppDto } from "../dto/connect-whatsapp.dto.js";
import type { ConnectionSummary, PhoneNumberSummary } from "../communication.types.js";

@Controller({ path: "communication/whatsapp", version: "1" })
export class WhatsAppConnectionController {
  constructor(private readonly connectionService: WhatsAppConnectionService) {}

  // WA-BR-003 — only Owner/Admin may connect WhatsApp.
  @RequirePermission(Permission.CONNECT_WHATSAPP)
  @Post("connect")
  async connect(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConnectWhatsAppDto,
  ): Promise<{ connection: ConnectionSummary; phoneNumber: PhoneNumberSummary }> {
    return this.connectionService.connect(user.workspaceId!, user.userId, dto);
  }

  @RequirePermission(Permission.VIEW_WORKSPACE)
  @Get("connection")
  async getConnection(@CurrentUser() user: AuthenticatedUser): Promise<ConnectionSummary | null> {
    return this.connectionService.getConnection(user.workspaceId!);
  }

  @RequirePermission(Permission.VIEW_WORKSPACE)
  @Get("phone-numbers")
  async listPhoneNumbers(@CurrentUser() user: AuthenticatedUser): Promise<PhoneNumberSummary[]> {
    return this.connectionService.listPhoneNumbers(user.workspaceId!);
  }
}
