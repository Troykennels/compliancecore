import { describe, expect, it } from "vitest";
import { z } from "zod";
import { patchObject } from "../../src/lib/patch-schema";
import { updateControlSchema } from "../../src/modules/controls/controls.schema";
import { updateAuditSchema } from "../../src/modules/audits/audits.schema";
import { updatePolicySchema } from "../../src/modules/policies/policies.schema";
import { updateTaskSchema } from "../../src/modules/tasks/tasks.schema";
import { updateTrainingSchema } from "../../src/modules/training/training.schema";
import { updateVendorSchema } from "../../src/modules/vendors/vendors.schema";

describe("partial update safety after the validator upgrade", () => {
  it("keeps a title change from resetting control, audit, policy, task or training state", () => {
    for (const schema of [
      updateControlSchema,
      updateAuditSchema,
      updatePolicySchema,
      updateTaskSchema,
      updateTrainingSchema,
    ]) {
      expect(schema.parse({ title: "Updated title" })).toEqual({
        title: "Updated title",
      });
      expect(schema.parse({})).toEqual({});
    }
    expect(updateVendorSchema.parse({ name: "Updated supplier" })).toEqual({
      name: "Updated supplier",
    });
  });
  it("preserves explicit false, null and chosen status values", () => {
    expect(
      updateControlSchema.parse({
        implementationStatus: "planned",
        ownerId: null,
      }),
    ).toEqual({ implementationStatus: "planned", ownerId: null });
    expect(updateTrainingSchema.parse({ isMandatory: false })).toEqual({
      isMandatory: false,
    });
  });
  it("preserves refinements on default and nullable wrappers", () => {
    const schema = patchObject(
      z.object({
        title: z
          .string()
          .default("created")
          .refine((v) => v.length > 3),
        note: z
          .string()
          .nullable()
          .refine((v) => v !== null),
      }),
    );
    expect(schema.parse({})).toEqual({});
    expect(schema.safeParse({ title: "bad" }).success).toBe(false);
    expect(schema.safeParse({ note: null }).success).toBe(false);
    expect(schema.parse({ title: "valid", note: "saved" })).toEqual({
      title: "valid",
      note: "saved",
    });
  });
  it("removes defaults wrapped in optional/nullable fields while preserving supplied values", () => {
    const schema = patchObject(
      z.object({
        a: z.string().default("create").optional(),
        b: z.string().default("create").nullable(),
        enabled: z.boolean().default(true),
      }),
    );
    expect(schema.parse({})).toEqual({});
    expect(schema.parse({ b: null, enabled: false })).toEqual({
      b: null,
      enabled: false,
    });
    expect(schema.safeParse({ enabled: "false" }).success).toBe(false);
  });
});
