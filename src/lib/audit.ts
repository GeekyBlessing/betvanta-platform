import { q, type Db } from "./db";
export async function audit(actorId: string | null, action: string, entity: string, entityId: string | null, details: Record<string, unknown> = {}, ip: string | null = null, db?: Db) {
  await q("insert into audit_logs(actor_id, action, entity, entity_id, details, ip) values ($1,$2,$3,$4,$5,$6)", [actorId, action, entity, entityId, JSON.stringify(details), ip], db);
}
