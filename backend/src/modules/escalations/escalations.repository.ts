import { withTenantSchema } from '../../lib/tenant';
import type { EscalationRule, EscalationEvent, CreateEscalationRuleDto, EscalationChainStep } from './escalations.types';

// ── Rules ─────────────────────────────────────────────────────

export async function findRules(schemaName: string): Promise<EscalationRule[]> {
  return withTenantSchema(schemaName, async (prisma) => {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM escalation_rules WHERE deleted_at IS NULL ORDER BY created_at DESC
    `);
    return rows.map(mapRule);
  });
}

export async function findRuleById(schemaName: string, id: string): Promise<EscalationRule | null> {
  return withTenantSchema(schemaName, async (prisma) => {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM escalation_rules WHERE id = $1::uuid AND deleted_at IS NULL
    `, id);
    return rows.length ? mapRule(rows[0]) : null;
  });
}

export async function createRule(schemaName: string, dto: CreateEscalationRuleDto, userId: string): Promise<string> {
  return withTenantSchema(schemaName, async (prisma) => {
    const [row] = await prisma.$queryRawUnsafe<any[]>(`
      INSERT INTO escalation_rules(name,description,trigger_type,entity_type,conditions,escalation_chain,created_by)
      VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::uuid) RETURNING id
    `,
      dto.name, dto.description ?? null, dto.triggerType, dto.entityType ?? null,
      JSON.stringify(dto.conditions), JSON.stringify(dto.escalationChain), userId,
    );
    return row.id as string;
  });
}

export async function updateRule(schemaName: string, id: string, dto: Partial<CreateEscalationRuleDto>): Promise<void> {
  return withTenantSchema(schemaName, async (prisma) => {
    await prisma.$executeRawUnsafe(`
      UPDATE escalation_rules SET
        name             = COALESCE($2, name),
        description      = CASE WHEN $3::text IS NOT NULL THEN $3 ELSE description END,
        trigger_type     = COALESCE($4, trigger_type),
        entity_type      = CASE WHEN $5::text IS NOT NULL THEN $5 ELSE entity_type END,
        conditions       = CASE WHEN $6::text IS NOT NULL THEN $6::jsonb ELSE conditions END,
        escalation_chain = CASE WHEN $7::text IS NOT NULL THEN $7::jsonb ELSE escalation_chain END,
        updated_at       = NOW()
      WHERE id = $1::uuid AND deleted_at IS NULL
    `,
      id, dto.name ?? null, dto.description ?? null, dto.triggerType ?? null,
      dto.entityType ?? null,
      dto.conditions ? JSON.stringify(dto.conditions) : null,
      dto.escalationChain ? JSON.stringify(dto.escalationChain) : null,
    );
  });
}

export async function toggleRule(schemaName: string, id: string, isActive: boolean): Promise<void> {
  return withTenantSchema(schemaName, async (prisma) => {
    await prisma.$executeRawUnsafe(
      `UPDATE escalation_rules SET is_active=$2, updated_at=NOW() WHERE id=$1::uuid`, id, isActive,
    );
  });
}

export async function softDeleteRule(schemaName: string, id: string): Promise<void> {
  return withTenantSchema(schemaName, async (prisma) => {
    await prisma.$executeRawUnsafe(`UPDATE escalation_rules SET deleted_at=NOW() WHERE id=$1::uuid`, id);
  });
}

export async function findActiveRules(schemaName: string): Promise<EscalationRule[]> {
  return withTenantSchema(schemaName, async (prisma) => {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM escalation_rules WHERE is_active=TRUE AND deleted_at IS NULL
    `);
    return rows.map(mapRule);
  });
}

// ── Events ────────────────────────────────────────────────────

export async function findEvents(schemaName: string, status?: string): Promise<EscalationEvent[]> {
  return withTenantSchema(schemaName, async (prisma) => {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT ee.*, er.name AS rule_name
      FROM escalation_events ee
      JOIN escalation_rules er ON er.id = ee.rule_id
      WHERE ($1::text IS NULL OR ee.status = $1)
      ORDER BY ee.triggered_at DESC
      LIMIT 100
    `, status ?? null);
    return rows.map(mapEvent);
  });
}

export async function hasActiveEvent(schemaName: string, ruleId: string, entityType: string, entityId: string): Promise<boolean> {
  return withTenantSchema(schemaName, async (prisma) => {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT 1 FROM escalation_events
      WHERE rule_id=$1::uuid AND entity_type=$2 AND entity_id=$3::uuid AND status='active' LIMIT 1
    `, ruleId, entityType, entityId);
    return rows.length > 0;
  });
}

export async function createEvent(
  schemaName: string,
  ruleId: string,
  entityType: string,
  entityId: string,
  nextEscalationAt: Date | null,
  metadata: Record<string, unknown>,
): Promise<string> {
  return withTenantSchema(schemaName, async (prisma) => {
    try {
      const [row] = await prisma.$queryRawUnsafe<any[]>(`
        INSERT INTO escalation_events(rule_id,entity_type,entity_id,next_escalation_at,metadata)
        VALUES($1::uuid,$2,$3::uuid,$4::timestamptz,$5::jsonb)
        -- Targets the partial index from template 013. The inferred target must
        -- match the index predicate, so the WHERE clause is required here too.
        ON CONFLICT(rule_id,entity_type,entity_id) WHERE status = 'active' DO NOTHING
        RETURNING id
      `, ruleId, entityType, entityId, nextEscalationAt ?? null, JSON.stringify(metadata));
      return row?.id as string;
    } catch {
      return '';
    }
  });
}

export async function advanceEvent(schemaName: string, eventId: string, nextStep: number, nextEscalationAt: Date | null): Promise<void> {
  return withTenantSchema(schemaName, async (prisma) => {
    await prisma.$executeRawUnsafe(`
      UPDATE escalation_events SET current_chain_step=$2, next_escalation_at=$3::timestamptz WHERE id=$1::uuid
    `, eventId, nextStep, nextEscalationAt ?? null);
  });
}

export async function resolveEvent(
  schemaName: string,
  eventId: string,
  resolutionNote?: string,
): Promise<EscalationEvent | null> {
  return withTenantSchema(schemaName, async (prisma) => {
    // The table has no dedicated note column, so the resolution note is kept in
    // the metadata JSONB blob.
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      UPDATE escalation_events ee SET
        status = 'resolved',
        resolved_at = NOW(),
        metadata = CASE
          WHEN $2::text IS NOT NULL
          THEN COALESCE(ee.metadata, '{}'::jsonb) || jsonb_build_object('resolutionNote', $2::text)
          ELSE ee.metadata
        END
      WHERE ee.id = $1::uuid
      RETURNING ee.*
    `, eventId, resolutionNote ?? null);
    if (!rows.length) return null;

    const [withName] = await prisma.$queryRawUnsafe<any[]>(`
      SELECT ee.*, er.name AS rule_name
      FROM escalation_events ee
      JOIN escalation_rules er ON er.id = ee.rule_id
      WHERE ee.id = $1::uuid
    `, eventId);
    return mapEvent(withName ?? rows[0]);
  });
}

export async function completeEvent(schemaName: string, eventId: string): Promise<void> {
  return withTenantSchema(schemaName, async (prisma) => {
    await prisma.$executeRawUnsafe(`
      UPDATE escalation_events SET status='completed' WHERE id=$1::uuid
    `, eventId);
  });
}

export async function findDueEvents(schemaName: string): Promise<any[]> {
  return withTenantSchema(schemaName, async (prisma) => {
    return prisma.$queryRawUnsafe<any[]>(`
      SELECT ee.*, er.escalation_chain, er.name AS rule_name
      FROM escalation_events ee
      JOIN escalation_rules er ON er.id = ee.rule_id
      WHERE ee.status='active' AND ee.next_escalation_at <= NOW()
    `);
  });
}

// ── Mappers ───────────────────────────────────────────────────

function mapRule(r: any): EscalationRule {
  return {
    id: r.id, name: r.name, description: r.description,
    triggerType: r.trigger_type, entityType: r.entity_type,
    conditions: r.conditions ?? {}, escalationChain: r.escalation_chain ?? [],
    isActive: r.is_active, createdBy: r.created_by,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

function mapEvent(r: any): EscalationEvent {
  return {
    id: r.id, ruleId: r.rule_id, ruleName: r.rule_name ?? null,
    entityType: r.entity_type, entityId: r.entity_id,
    triggeredAt: r.triggered_at, currentChainStep: r.current_chain_step,
    status: r.status, nextEscalationAt: r.next_escalation_at,
    resolvedAt: r.resolved_at, metadata: r.metadata ?? {}, createdAt: r.created_at,
  };
}
