import { withTenantSchema } from '../../lib/prisma';
import { setAuditSessionVars } from '../../middleware/audit.middleware';
import { AppError, NotFoundError } from '../../lib/errors';
import { frameworksRepository } from './frameworks.repository';
import type { AdoptResult, UnadoptImpact, UnadoptResult } from './frameworks.types';

type Actor = { id: string; email: string; role: string | null; tenantId: string | null };

export const frameworksService = {
  async list(schemaName: string) {
    return withTenantSchema(schemaName, (tx) =>
      frameworksRepository.findAll(tx),
    );
  },

  /**
   * Whether this framework's controls are already present.
   *
   * The plan-limit guard uses this so re-adopting is never refused: adoption is
   * idempotent, so repeating it consumes no allowance and blocking it would
   * just look broken.
   */
  async isAdopted(schemaName: string, frameworkId: string): Promise<boolean> {
    return withTenantSchema(schemaName, async (tx) => {
      const rows = (await tx.$queryRawUnsafe(
        `SELECT 1 FROM controls
          WHERE framework_id = $1::uuid AND deleted_at IS NULL
          LIMIT 1`,
        frameworkId,
      )) as unknown[];
      return rows.length > 0;
    });
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

  /**
   * What removing this framework would cost, without removing anything.
   *
   * The confirmation dialog asks for this first so it can say "this deletes 93
   * controls, 12 of them implemented and 4 with evidence attached" rather than
   * the useless "are you sure?".
   */
  async unadoptImpact(schemaName: string, id: string): Promise<UnadoptImpact> {
    return withTenantSchema(schemaName, async (tx) => {
      const framework = await frameworksRepository.findById(tx, id);
      if (!framework) throw new NotFoundError('Framework not found.');
      const impact = await frameworksRepository.unadoptImpact(tx, id);
      return { frameworkId: id, frameworkName: framework.name, ...impact };
    });
  },

  /**
   * Remove an adopted framework from the tenant.
   *
   * QA raised this as the one outright failure: a framework adopted by mistake
   * could not be undone from anywhere in the product, so the only route back was
   * to contact support. Adoption was a one-way door — and it is a door people
   * walk through by accident, because the whole Frameworks page is a grid of
   * unfamiliar names with an Adopt button on each.
   *
   * The rule is proportionate to what would actually be lost:
   *
   *   nothing has been done to the controls  →  remove, no argument. This is the
   *                                             mistake case, and it is the one
   *                                             QA reported. It should cost one
   *                                             click.
   *   somebody has worked on them            →  refuse with a 409 that itemises
   *                                             the damage, and require an
   *                                             explicit `force`. Not to be
   *                                             obstructive: at this point the
   *                                             controls carry evidence and
   *                                             audit history, and a misclick
   *                                             would be expensive.
   *
   * Removal is a soft delete throughout — see the repository — so even the
   * forced path is recoverable.
   */
  async unadopt(
    schemaName: string,
    id: string,
    actor: Actor,
    opts: { force?: boolean } = {},
  ): Promise<UnadoptResult> {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);

      const framework = await frameworksRepository.findById(tx, id);
      if (!framework) throw new NotFoundError('Framework not found.');

      const impact = await frameworksRepository.unadoptImpact(tx, id);

      if (impact.controls === 0) {
        throw new AppError(
          `${framework.name} is not currently adopted, so there is nothing to remove.`,
          409,
          'NOT_ADOPTED',
        );
      }

      if (impact.touched > 0 && !opts.force) {
        throw new AppError(
          `${framework.name} has ${impact.touched} control${impact.touched === 1 ? '' : 's'} with work recorded against ` +
          `${impact.touched === 1 ? 'it' : 'them'}. Removing the framework withdraws ${impact.controls} control` +
          `${impact.controls === 1 ? '' : 's'} from your compliance scope. Confirm to continue.`,
          409,
          'FRAMEWORK_IN_USE',
          { frameworkId: id, frameworkName: framework.name, ...impact },
        );
      }

      const removed = await frameworksRepository.softDeleteFrameworkControls(tx, id, actor.id);
      return { removed, frameworkName: framework.name };
    });
  },
};
