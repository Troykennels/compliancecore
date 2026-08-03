-- =============================================================================
-- Control library: Sarbanes-Oxley Act (SOX)
-- ComplianceCore | ORION SOFT LIMITED
--
-- SOX itself sets obligations rather than controls, so compliance is evidenced
-- through the internal control framework management adopts - in practice COSO
-- 2013 for entity-level control and IT general controls for the systems that
-- produce the numbers. Modelled that way here: the statutory sections, the COSO
-- components, and the ITGC domains an external auditor actually tests.
-- =============================================================================

WITH fw AS (SELECT id FROM framework_data.frameworks WHERE code = 'SOX')
INSERT INTO framework_data.framework_categories (id, framework_id, code, name, description, sort_order)
SELECT gen_random_uuid(), fw.id, v.code, v.name, v.descr, v.sort
FROM fw, (VALUES
    ('SEC',  'Statutory Sections',            'The obligations imposed directly by the Act on issuers, officers and auditors.', 1),
    ('ELC',  'Entity-Level Controls (COSO)',  'The five COSO components through which management assesses internal control over financial reporting.', 2),
    ('ITGC', 'IT General Controls',           'Controls over the systems that initiate, record, process and report financial transactions.', 3),
    ('PLC',  'Process-Level Controls',        'Transaction-level controls over significant financial reporting processes.', 4)
) AS v(code, name, descr, sort)
ON CONFLICT (framework_id, code) DO NOTHING;

WITH fw AS (SELECT id FROM framework_data.frameworks WHERE code = 'SOX')
INSERT INTO framework_data.framework_controls
    (id, framework_id, category_id, control_ref, title, description, sort_order)
SELECT gen_random_uuid(), fw.id,
    (SELECT c.id FROM framework_data.framework_categories c WHERE c.framework_id = fw.id AND c.code = v.cat),
    v.ref, v.title, v.descr, v.sort
FROM fw, (VALUES
    -- ── Statutory sections ──────────────────────────────────────────────────
    ('SEC','SOX-302','Corporate responsibility for financial reports','The signing officers shall certify that they have reviewed the report, that it contains no material untrue statement or omission, and that the financial statements fairly present the financial condition and results of operations.',1),
    ('SEC','SOX-302.4','Disclosure controls and procedures','The signing officers are responsible for establishing and maintaining disclosure controls and procedures, evaluating their effectiveness within 90 days of the report, and presenting their conclusions.',2),
    ('SEC','SOX-302.5','Disclosure of deficiencies and fraud','The signing officers shall disclose to the auditors and the audit committee all significant deficiencies and material weaknesses in internal control, and any fraud involving management or employees with a significant role in internal control.',3),
    ('SEC','SOX-404a','Management assessment of internal controls','Management shall state its responsibility for establishing and maintaining an adequate internal control structure, and assess the effectiveness of internal control over financial reporting as of the end of the fiscal year.',4),
    ('SEC','SOX-404b','Auditor attestation on internal control','The registered public accounting firm shall attest to and report on the assessment made by management, in accordance with the standards of the PCAOB, where the issuer is not exempt.',5),
    ('SEC','SOX-409','Real time issuer disclosures','Disclose to the public, on a rapid and current basis, material changes in the financial condition or operations of the issuer.',6),
    ('SEC','SOX-802','Criminal penalties for altering documents','Retain audit and review workpapers and records for the statutory period, and prevent the knowing alteration, destruction or falsification of records with intent to obstruct an investigation.',7),
    ('SEC','SOX-806','Whistleblower protection','Establish procedures for the confidential, anonymous submission of concerns regarding questionable accounting or auditing matters, and protect employees who provide them from retaliation.',8),
    ('SEC','SOX-906','Corporate responsibility for financial reports (criminal)','The chief executive officer and chief financial officer shall certify that the periodic report fully complies with the reporting requirements and fairly presents the financial condition, subject to criminal penalty.',9),

    -- ── COSO entity-level ───────────────────────────────────────────────────
    ('ELC','SOX-COSO-CE','Control environment','Demonstrate a commitment to integrity and ethical values, board independence and oversight, appropriate structures and reporting lines, competence, and accountability for internal control responsibilities.',10),
    ('ELC','SOX-COSO-RA','Risk assessment','Specify objectives with sufficient clarity, identify and analyse risks to their achievement, consider the potential for fraud, and identify and assess significant change.',11),
    ('ELC','SOX-COSO-CA','Control activities','Select and develop control activities that mitigate risk to acceptable levels, including general controls over technology, deployed through policies and procedures.',12),
    ('ELC','SOX-COSO-IC','Information and communication','Obtain and use relevant, quality information, communicate internal control responsibilities internally, and communicate with external parties on matters affecting internal control.',13),
    ('ELC','SOX-COSO-MA','Monitoring activities','Perform ongoing and separate evaluations to ascertain whether the components of internal control are present and functioning, and communicate deficiencies on a timely basis to those responsible for corrective action.',14),

    -- ── IT general controls ─────────────────────────────────────────────────
    ('ITGC','SOX-ITGC-1','Logical access provisioning','Access to financially significant applications, databases and operating systems shall be requested, approved by an appropriate owner, and provisioned on the principle of least privilege.',15),
    ('ITGC','SOX-ITGC-2','Access de-provisioning','Access shall be revoked promptly on termination or role change, evidenced against an authoritative source such as the human resources leaver record.',16),
    ('ITGC','SOX-ITGC-3','Periodic user access review','Access to financially significant systems shall be reviewed at least quarterly by the application owner, with inappropriate access removed and the removal evidenced.',17),
    ('ITGC','SOX-ITGC-4','Privileged and generic accounts','Administrative, emergency and shared accounts shall be restricted, individually attributable where possible, and their activity logged and reviewed.',18),
    ('ITGC','SOX-ITGC-5','Authentication controls','Password and authentication settings on in-scope systems shall meet policy, and multi-factor authentication shall be enforced for remote and privileged access.',19),
    ('ITGC','SOX-ITGC-6','Segregation of duties','Conflicting duties within financially significant applications shall be identified, prevented by system configuration where possible, and mitigated and monitored where not.',20),
    ('ITGC','SOX-ITGC-7','Change management','Changes to financially significant applications and infrastructure shall be requested, tested, approved and migrated to production by someone other than the developer.',21),
    ('ITGC','SOX-ITGC-8','Emergency changes','Emergency changes shall follow a defined process with retrospective approval and documentation within a defined period.',22),
    ('ITGC','SOX-ITGC-9','Segregation of environments','Development, test and production environments shall be segregated, and developers shall not have standing write access to production.',23),
    ('ITGC','SOX-ITGC-10','Job scheduling and monitoring','Scheduled jobs supporting financial processing shall be authorised, monitored, and failures investigated and resolved.',24),
    ('ITGC','SOX-ITGC-11','Backup and recovery','Financially significant data shall be backed up in line with policy, and restoration shall be tested periodically.',25),
    ('ITGC','SOX-ITGC-12','Data interfaces','Interfaces transferring financial data between systems shall be controlled, with completeness and accuracy of transfer monitored and exceptions resolved.',26),

    -- ── Process-level ───────────────────────────────────────────────────────
    ('PLC','SOX-PLC-1','Journal entry controls','Manual journal entries shall be supported, reviewed and approved by someone other than the preparer, with entries above a threshold subject to additional scrutiny.',27),
    ('PLC','SOX-PLC-2','Account reconciliations','Balance sheet accounts shall be reconciled on a defined cycle, with reconciling items investigated and cleared, and reconciliations reviewed and approved independently.',28),
    ('PLC','SOX-PLC-3','Management review controls','Management review controls over estimates, accruals and financial results shall be performed at a defined precision, with the review criteria and outliers investigated and documented.',29),
    ('PLC','SOX-PLC-4','Financial close and reporting','The financial close shall follow a documented timetable with defined ownership, and the consolidation and disclosure process shall be reviewed and approved before reporting.',30),
    ('PLC','SOX-PLC-5','Delegation of authority','Financial commitments and expenditure shall be approved in accordance with a documented delegation of authority matrix, enforced within the relevant systems.',31),
    ('PLC','SOX-PLC-6','Evidence retention','Evidence supporting the operation of each key control shall be retained for the statutory period and be available for auditor inspection.',32)
) AS v(cat, ref, title, descr, sort)
ON CONFLICT (framework_id, control_ref) DO NOTHING;
