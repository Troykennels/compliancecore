const schemaPattern=/^tenant_[a-f0-9]{32}$/;
export function runtimeTenantGrants(schema:string,role:string):string {
 if(!schemaPattern.test(schema)||!/^[a-z_][a-z0-9_]{0,62}$/.test(role))throw new Error('Invalid runtime grant target.');
 return `GRANT USAGE ON SCHEMA "${schema}" TO "${role}";
 GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA "${schema}" TO "${role}";
 GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA "${schema}" TO "${role}";
 REVOKE ALL ON "${schema}".audit_log FROM "${role}";
 GRANT SELECT ON "${schema}".audit_log TO "${role}";
 REVOKE UPDATE,DELETE ON "${schema}".policy_versions,"${schema}".risk_reviews,"${schema}".compliance_obligation_versions,"${schema}".framework_implementation_events,"${schema}".evidence_events FROM "${role}";
 REVOKE UPDATE ON "${schema}".control_tests,"${schema}".vendor_questionnaire_responses FROM "${role}";
 GRANT UPDATE(status,reviewed_by,reviewed_at,review_note) ON "${schema}".control_tests,"${schema}".vendor_questionnaire_responses TO "${role}";`;
}
