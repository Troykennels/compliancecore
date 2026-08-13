import { describe, it, expect } from 'vitest';
import { buildFrameworkScore } from '../../src/modules/compliance-score/score.service';

/**
 * "Not scored" is not zero.
 *
 * QA raised this against the dashboard: an organisation that had adopted no
 * framework was shown a compliance score of 0 with the band "Critical". The
 * test case said in as many words that the widget must read "—" or "NOT
 * SCORED", "not 0%".
 *
 * The distinction runs the entire depth of the product, and it is the kind that
 * decays quietly — every layer is one `?? 0` away from reintroducing it, and a
 * fabricated 0 looks like a real measurement everywhere it lands: red on the
 * dashboard gauge, red on the executive KPI, red on the cover of a board pack,
 * and a number in an exported spreadsheet that will be charted and averaged by
 * someone who was not there when it was invented.
 *
 * These tests pin the one function the whole chain derives from.
 */
describe('buildFrameworkScore — nothing in scope is null, never 0', () => {
  it('returns null for a tenant with no controls at all', () => {
    const result = buildFrameworkScore([], null, 'All Frameworks');
    expect(result.score).toBeNull();
    expect(result.controlCounts.total).toBe(0);
  });

  it('returns null when every control is marked not applicable', () => {
    // Not applicable controls are excluded from the denominator by design, so
    // this is a real route to a zero denominator that is NOT a zero score:
    // the organisation has scoped everything out, not failed everything.
    const result = buildFrameworkScore(
      [{ implementationStatus: 'not_applicable', criticality: 'high', count: 12 }],
      'fw-1',
      'ISO 27001',
    );
    expect(result.score).toBeNull();
    expect(result.controlCounts.notApplicable).toBe(12);
  });

  it('returns a real 0 when controls exist but none are implemented', () => {
    // The genuine zero, and the reason "just treat null as 0" is wrong: this
    // case and the two above must not look the same. Here the organisation has
    // adopted a framework and implemented nothing, which IS critical.
    const result = buildFrameworkScore(
      [{ implementationStatus: 'not_implemented', criticality: 'high', count: 5 }],
      'fw-1',
      'ISO 27001',
    );
    expect(result.score).toBe(0);
    expect(result.controlCounts.total).toBe(5);
  });

  it('weights partial implementation at half, and criticality as configured', () => {
    const result = buildFrameworkScore(
      [
        { implementationStatus: 'implemented',           criticality: 'low', count: 1 },
        { implementationStatus: 'partially_implemented', criticality: 'low', count: 1 },
        { implementationStatus: 'not_implemented',       criticality: 'low', count: 2 },
      ],
      'fw-1',
      'ISO 27001',
    );
    // Equal weights: (1 + 0.5) / 4 = 37.5%
    expect(result.score).toBe(37.5);
  });

  it('does not let not-applicable controls drag the score down', () => {
    const withoutNa = buildFrameworkScore(
      [{ implementationStatus: 'implemented', criticality: 'medium', count: 2 }],
      'fw-1', 'ISO 27001',
    );
    const withNa = buildFrameworkScore(
      [
        { implementationStatus: 'implemented',    criticality: 'medium', count: 2 },
        { implementationStatus: 'not_applicable', criticality: 'medium', count: 8 },
      ],
      'fw-1', 'ISO 27001',
    );
    expect(withoutNa.score).toBe(100);
    expect(withNa.score).toBe(100);
  });
});
