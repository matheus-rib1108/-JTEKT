import "server-only";
import { prisma } from "@/server/db/client";
import type { Prisma } from "@prisma/client";

export interface AuditEntry {
  tenantId?: string | null;
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  ipAddress?: string | null;
  beforeData?: Prisma.InputJsonValue | null;
  afterData?: Prisma.InputJsonValue | null;
}

/** Append-only audit trail (product brief §28). Never update or delete rows
 * written here from application code. */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  await prisma.auditLog.create({
    data: {
      tenantId: entry.tenantId ?? undefined,
      actorUserId: entry.actorUserId ?? undefined,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? undefined,
      ipAddress: entry.ipAddress ?? undefined,
      beforeData: entry.beforeData ?? undefined,
      afterData: entry.afterData ?? undefined,
    },
  });
}
