import { IsEnum } from "class-validator";
import { ExportEntityType, ExportFormat } from "../schemas/export-job.schema.js";

export class CreateExportJobDto {
  @IsEnum(ExportEntityType)
  entityType!: ExportEntityType;

  @IsEnum(ExportFormat)
  format!: ExportFormat;
}
