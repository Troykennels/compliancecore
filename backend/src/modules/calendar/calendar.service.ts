import { withTenantSchema } from '../../lib/prisma';
import { setAuditSessionVars } from '../../middleware/audit.middleware';
import { NotFoundError } from '../../lib/errors';
import { calendarRepository } from './calendar.repository';
import type { CreateCalendarEventInput, UpdateCalendarEventInput, ListCalendarEventsInput } from './calendar.schema';

type Actor = { id: string; email: string; role: string | null; tenantId: string | null };

export const calendarService = {
  async list(schemaName: string, filters: ListCalendarEventsInput) {
    return withTenantSchema(schemaName, (tx) => calendarRepository.findAll(tx, filters));
  },

  async getById(schemaName: string, id: string) {
    const ev = await withTenantSchema(schemaName, (tx) => calendarRepository.findById(tx, id));
    if (!ev) throw new NotFoundError('Calendar event not found.');
    return ev;
  },

  async create(schemaName: string, input: CreateCalendarEventInput, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      const { id } = await calendarRepository.create(tx, { ...input, createdBy: actor.id });
      return calendarRepository.findById(tx, id);
    });
  },

  async update(schemaName: string, id: string, input: UpdateCalendarEventInput, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      const ok = await calendarRepository.update(tx, id, { ...input, updatedBy: actor.id });
      if (!ok) throw new NotFoundError('Calendar event not found.');
      return calendarRepository.findById(tx, id);
    });
  },

  async delete(schemaName: string, id: string, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      const ok = await calendarRepository.softDelete(tx, id, actor.id);
      if (!ok) throw new NotFoundError('Calendar event not found.');
    });
  },

  async getUpcoming(schemaName: string, daysAhead = 14) {
    return withTenantSchema(schemaName, (tx) => calendarRepository.findUpcoming(tx, daysAhead));
  },
};
