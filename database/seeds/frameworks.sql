-- =============================================================================
-- ComplianceCore — Framework Seed Data
-- ORION SOFT LIMITED | Seeds the framework_data schema with supported frameworks
-- Run ONCE after schema.sql on a fresh database.
-- =============================================================================

SET search_path = framework_data, global, public;

-- =============================================================================
-- FRAMEWORKS
-- =============================================================================

INSERT INTO framework_data.frameworks
    (id, code, name, short_name, version, jurisdiction, issuing_body, description, is_active, effective_date)
VALUES
    (
        gen_random_uuid(), 'SOC2', 'SOC 2 — Service Organization Control 2',
        'SOC 2', 'Type II', 'United States', 'AICPA',
        'Trust Services Criteria for security, availability, processing integrity, confidentiality, and privacy.',
        TRUE, '2017-04-01'
    ),
    (
        gen_random_uuid(), 'ISO27001', 'ISO/IEC 27001 — Information Security Management',
        'ISO 27001', '2022', 'International', 'ISO/IEC',
        'International standard for information security management systems (ISMS) with 93 controls across 4 themes.',
        TRUE, '2022-10-25'
    ),
    (
        gen_random_uuid(), 'GDPR', 'General Data Protection Regulation',
        'GDPR', '2018', 'European Union', 'European Parliament',
        'EU regulation on data protection and privacy for all individuals within the EU and EEA.',
        TRUE, '2018-05-25'
    ),
    (
        gen_random_uuid(), 'UK_GDPR', 'UK General Data Protection Regulation',
        'UK GDPR', '2021', 'United Kingdom', 'ICO / UK Parliament',
        'UK post-Brexit equivalent of EU GDPR, enforced by the Information Commissioner''s Office (ICO).',
        TRUE, '2021-01-01'
    ),
    (
        gen_random_uuid(), 'HIPAA', 'Health Insurance Portability and Accountability Act',
        'HIPAA', '1996+HITECH', 'United States', 'HHS / OCR',
        'US federal law protecting the privacy and security of protected health information (PHI).',
        TRUE, '1996-08-21'
    ),
    (
        gen_random_uuid(), 'PCIDSS', 'Payment Card Industry Data Security Standard',
        'PCI-DSS', '4.0', 'International', 'PCI Security Standards Council',
        'Security standard for organizations that handle branded credit cards. 12 high-level requirements.',
        TRUE, '2022-03-31'
    ),
    (
        gen_random_uuid(), 'NIST_CSF', 'NIST Cybersecurity Framework',
        'NIST CSF', '2.0', 'United States', 'NIST',
        'Voluntary framework of cybersecurity standards: Govern, Identify, Protect, Detect, Respond, Recover.',
        TRUE, '2024-02-26'
    ),
    (
        gen_random_uuid(), 'NIST_800_53', 'NIST Special Publication 800-53',
        'NIST 800-53', 'Rev 5', 'United States', 'NIST',
        'Security and privacy controls for information systems and organizations, primarily US federal agencies.',
        TRUE, '2020-09-23'
    ),
    (
        gen_random_uuid(), 'NDPR', 'Nigeria Data Protection Regulation',
        'NDPR', '2019', 'Nigeria', 'NITDA / NDPC',
        'Nigerian data protection regulation governing the processing of personal data of Nigerian residents.',
        TRUE, '2019-01-25'
    ),
    (
        gen_random_uuid(), 'POPIA', 'Protection of Personal Information Act',
        'POPIA', '2020', 'South Africa', 'Information Regulator (South Africa)',
        'South African act that promotes the protection of personal information processed by public and private bodies.',
        TRUE, '2020-07-01'
    ),
    (
        gen_random_uuid(), 'UAE_PDPL', 'UAE Personal Data Protection Law',
        'UAE PDPL', '2021', 'United Arab Emirates', 'UAE Government / TDRA',
        'Federal Law No. 45 of 2021 on Personal Data Protection in the UAE.',
        TRUE, '2022-01-02'
    ),
    (
        gen_random_uuid(), 'DPDPA', 'Digital Personal Data Protection Act',
        'DPDPA', '2023', 'India', 'Ministry of Electronics and Information Technology (MeitY)',
        'India''s comprehensive personal data protection law governing digital personal data processing.',
        TRUE, '2023-08-11'
    ),
    (
        gen_random_uuid(), 'ISO27701', 'ISO/IEC 27701 — Privacy Information Management',
        'ISO 27701', '2019', 'International', 'ISO/IEC',
        'Extension to ISO 27001 providing requirements and guidance for privacy information management systems (PIMS).',
        TRUE, '2019-08-06'
    ),
    (
        gen_random_uuid(), 'CIS_V8', 'CIS Critical Security Controls',
        'CIS Controls', 'v8', 'International', 'Center for Internet Security (CIS)',
        '18 prioritized security controls to help organizations defend against the most prevalent cyber attacks.',
        TRUE, '2021-05-18'
    ),
    (
        gen_random_uuid(), 'CCPA', 'California Consumer Privacy Act',
        'CCPA/CPRA', '2023', 'California, USA', 'California Privacy Protection Agency (CPPA)',
        'California state law giving consumers rights over their personal information. Amended by CPRA in 2023.',
        TRUE, '2023-01-01'
    ),
    (
        gen_random_uuid(), 'SOX', 'Sarbanes-Oxley Act — IT General Controls',
        'SOX ITGC', '2002', 'United States', 'SEC / PCAOB',
        'Federal law requiring US public companies to establish internal controls over financial reporting (ICFR), with focus on IT General Controls.',
        TRUE, '2002-07-30'
    ),
    (
        gen_random_uuid(), 'ISO22301', 'ISO 22301 — Business Continuity Management',
        'ISO 22301', '2019', 'International', 'ISO',
        'International standard for business continuity management systems (BCMS).',
        TRUE, '2019-10-31'
    ),
    (
        gen_random_uuid(), 'SAMA_CSF', 'SAMA Cyber Security Framework',
        'SAMA CSF', '2017', 'Saudi Arabia', 'Saudi Arabian Monetary Authority (SAMA)',
        'Mandatory cybersecurity framework for all financial institutions regulated by SAMA in Saudi Arabia.',
        TRUE, '2017-05-01'
    );

-- =============================================================================
-- SOC 2 CATEGORIES (Trust Service Criteria)
-- =============================================================================

WITH soc2 AS (SELECT id FROM framework_data.frameworks WHERE code = 'SOC2')
INSERT INTO framework_data.framework_categories (id, framework_id, code, name, description, sort_order)
SELECT gen_random_uuid(), soc2.id, code, name, description, sort_order
FROM soc2, (VALUES
    ('CC1', 'Common Criteria: Control Environment',
     'Sets the tone at the top and establishes the foundation for the internal control system.', 1),
    ('CC2', 'Common Criteria: Communication and Information',
     'Internal and external communication relevant to achieving security and availability objectives.', 2),
    ('CC3', 'Common Criteria: Risk Assessment',
     'Processes for identifying, analyzing, and managing risks to achieving objectives.', 3),
    ('CC4', 'Common Criteria: Monitoring Activities',
     'Ongoing evaluations and separate evaluations to ascertain whether components of COSO are present.', 4),
    ('CC5', 'Common Criteria: Control Activities',
     'Actions established by policies and procedures to achieve objectives and address risks.', 5),
    ('CC6', 'Common Criteria: Logical and Physical Access Controls',
     'Controls over logical and physical access to prevent unauthorized access.', 6),
    ('CC7', 'Common Criteria: System Operations',
     'Controls related to detecting and mitigating deviations from normal operations.', 7),
    ('CC8', 'Common Criteria: Change Management',
     'Controls over changes to infrastructure, data, software, and procedures.', 8),
    ('CC9', 'Common Criteria: Risk Mitigation',
     'Processes for identifying, selecting, and developing risk mitigation activities.', 9),
    ('A1',  'Availability',
     'System availability for operation and use as committed or agreed.', 10),
    ('C1',  'Confidentiality',
     'Information designated as confidential is protected as committed or agreed.', 11),
    ('PI1', 'Processing Integrity',
     'System processing is complete, valid, accurate, timely, and authorized.', 12),
    ('P1',  'Privacy',
     'Personal information is collected, used, retained, disclosed, and disposed of as committed.', 13)
) AS cats(code, name, description, sort_order);

-- =============================================================================
-- ISO 27001:2022 CATEGORIES (Themes/Clauses)
-- =============================================================================

WITH iso AS (SELECT id FROM framework_data.frameworks WHERE code = 'ISO27001')
INSERT INTO framework_data.framework_categories (id, framework_id, code, name, description, sort_order)
SELECT gen_random_uuid(), iso.id, code, name, description, sort_order
FROM iso, (VALUES
    ('5',  'Organizational Controls',
     '37 controls governing organization-level information security policies and procedures.', 1),
    ('6',  'People Controls',
     '8 controls related to human resources and personnel security.', 2),
    ('7',  'Physical Controls',
     '14 controls for physical and environmental security.', 3),
    ('8',  'Technological Controls',
     '34 controls covering technical security measures and tools.', 4)
) AS cats(code, name, description, sort_order);

-- =============================================================================
-- NDPR CATEGORIES
-- =============================================================================

WITH ndpr AS (SELECT id FROM framework_data.frameworks WHERE code = 'NDPR')
INSERT INTO framework_data.framework_categories (id, framework_id, code, name, description, sort_order)
SELECT gen_random_uuid(), ndpr.id, code, name, description, sort_order
FROM ndpr, (VALUES
    ('SP-1',  'Data Protection Obligations',
     'Core obligations for data controllers and processors under NDPR.', 1),
    ('SP-2',  'Lawful Basis & Consent',
     'Requirements for lawful processing and obtaining valid consent.', 2),
    ('SP-3',  'Data Subject Rights',
     'Rights of Nigerian data subjects including access, correction, and deletion.', 3),
    ('SP-4',  'Data Security',
     'Technical and organizational security measures for personal data.', 4),
    ('SP-5',  'Cross-Border Transfer',
     'Controls on transfer of personal data outside Nigeria.', 5),
    ('SP-6',  'Breach Notification',
     'Requirements for reporting data breaches to NDPC and affected individuals.', 6),
    ('SP-7',  'Data Protection Officer',
     'DPO appointment and responsibilities under NDPR.', 7),
    ('SP-8',  'Audit & Compliance',
     'Data Protection Audit obligations (DPCO/DPA accreditation).', 8)
) AS cats(code, name, description, sort_order);

-- =============================================================================
-- Note: Full control sets (SOC 2 CC criteria, ISO 27001 Annex A controls,
-- NDPR articles, etc.) are seeded via separate dedicated seed files:
--   seeds/controls_soc2.sql
--   seeds/controls_iso27001.sql
--   seeds/controls_gdpr.sql
--   seeds/controls_ndpr.sql
--   seeds/ucf_mappings.sql
--
-- These files contain hundreds of individual control records and are
-- maintained by the ORION SOFT framework team as regulations evolve.
-- =============================================================================

-- Confirm seed completion
DO $$
DECLARE
    v_framework_count INT;
    v_category_count  INT;
BEGIN
    SELECT COUNT(*) INTO v_framework_count FROM framework_data.frameworks;
    SELECT COUNT(*) INTO v_category_count  FROM framework_data.framework_categories;
    RAISE NOTICE 'Framework seed complete: % frameworks, % categories loaded.',
        v_framework_count, v_category_count;
END;
$$;
