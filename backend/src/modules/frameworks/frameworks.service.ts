import { withTenantSchema } from '../../lib/prisma';
import { setAuditSessionVars } from '../../middleware/audit.middleware';
import { NotFoundError } from '../../lib/errors';
import { frameworksRepository } from './frameworks.repository';
import type { AdoptResult } from './frameworks.types';

type Actor = { id: string; email: string; role: string | null; tenantId: string | null };

export const frameworksService = {
  async list(schemaName: string) {
    return withTenantSchema(schemaName, (tx) =>
      frameworksRepository.findAll(tx),
    );
  },

  async getById(schemaName: string, id: string) {
    const framework = await withTenantSchema(schemaName, (tx) =>
      frameworksRepository.findById(tx, id),
    );
    if (!framework) throw new NotFoundError('Framework not found.');
    return framework;
  },

  // Adopt a framework: create one starter control per framework category in the
  // tenant `controls` table, skipping any category already adopted for this
  // framework. Returns the number of controls created.
  async adopt(schemaName: string, id: string, actor: Actor): Promise<AdoptResult> {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);

      const framework = await frameworksRepository.findById(tx, id);
      if (!framework) throw new NotFoundError('Framework not found.');

      const existing = await frameworksRepository.existingControlRefs(tx, id);

      let created = 0;
      for (const category of framework.categories) {
        if (existing.has(category.code)) continue;
        const inserted = await frameworksRepository.insertStarterControl(tx, {
          frameworkId: id,
          controlRef:  category.code,
          title:       category.name,
          description: category.description,
          createdBy:   actor.id,
        });
        created += inserted;
      }

      return { created };
    });
  },
};
