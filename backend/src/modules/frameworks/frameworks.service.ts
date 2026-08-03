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

  // Adopt a framework: copy its published control library (ISO 27001 Annex A,
  // SOC 2 TSC, NDPR articles, …) into the tenant `controls` table so the
  // organisation gets a real, auditable control set to work through.
  //
  // Controls already adopted for this framework are skipped, so re-adopting is
  // safe and picks up controls added to the library since the last adoption.
  //
  // Frameworks whose library has not been modelled yet fall back to one starter
  // control per category — better than adopting nothing, and clearly reported
  // via `source` so the UI can say so rather than implying full coverage.
  async adopt(schemaName: string, id: string, actor: Actor): Promise<AdoptResult> {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);

      const framework = await frameworksRepository.findById(tx, id);
      if (!framework) throw new NotFoundError('Framework not found.');

      const existing = await frameworksRepository.existingControlRefs(tx, id);

      const library = framework.controls;
      const source: AdoptResult['source'] = library.length ? 'library' : 'categories';

      const toAdopt = library.length
        ? library.map((c) => ({
            controlRef:  c.controlRef,
            title:       c.title,
            description: c.description,
            category:    c.categoryName,
            guidance:    c.guidance,
          }))
        : framework.categories.map((c) => ({
            controlRef:  c.code,
            title:       c.name,
            description: c.description,
            category:    c.name,
            guidance:    null,
          }));

      let created = 0;
      let skipped = 0;
      for (const control of toAdopt) {
        if (existing.has(control.controlRef)) { skipped++; continue; }
        created += await frameworksRepository.insertStarterControl(tx, {
          frameworkId: id,
          ...control,
          createdBy: actor.id,
        });
      }

      return { created, skipped, source };
    });
  },
};
