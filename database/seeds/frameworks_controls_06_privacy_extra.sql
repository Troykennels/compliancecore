-- =============================================================================
-- Control libraries: UK GDPR, POPIA, CCPA/CPRA, DPDPA (India), UAE PDPL, ISO 27701
-- ComplianceCore | ORION SOFT LIMITED
--
-- Regional privacy regimes. Each is modelled on its own statutory structure
-- rather than mapped onto GDPR, because the obligations genuinely differ:
-- POPIA has eight conditions, the DPDPA is consent-notice driven, and the CCPA
-- is built around consumer rights rather than lawful bases.
-- =============================================================================

-- ═════════════════════════════ UK GDPR ═══════════════════════════════════════
WITH fw AS (SELECT id FROM framework_data.frameworks WHERE code = 'UK_GDPR')
INSERT INTO framework_data.framework_categories (id, framework_id, code, name, description, sort_order)
SELECT gen_random_uuid(), fw.id, v.code, v.name, v.descr, v.sort
FROM fw, (VALUES
    ('PR',  'Principles and Lawfulness', 'The data protection principles and the lawful bases for processing.', 1),
    ('RT',  'Individual Rights',         'The rights of data subjects and how the organisation facilitates them.', 2),
    ('AC',  'Accountability',            'Records, DPIAs, the Data Protection Officer and demonstrating compliance.', 3),
    ('SB',  'Security and Breaches',     'Security of processing and personal data breach handling.', 4),
    ('IT',  'International Transfers',   'Restricted transfers of personal data outside the UK.', 5)
) AS v(code, name, descr, sort)
ON CONFLICT (framework_id, code) DO NOTHING;

WITH fw AS (SELECT id FROM framework_data.frameworks WHERE code = 'UK_GDPR')
INSERT INTO framework_data.framework_controls
    (id, framework_id, category_id, control_ref, title, description, sort_order)
SELECT gen_random_uuid(), fw.id,
    (SELECT c.id FROM framework_data.framework_categories c WHERE c.framework_id = fw.id AND c.code = v.cat),
    v.ref, v.title, v.descr, v.sort
FROM fw, (VALUES
    ('PR','UKGDPR-1','Data protection principles','Process personal data lawfully, fairly and transparently; for specified purposes; limited to what is necessary; accurate; kept no longer than necessary; and securely.',1),
    ('PR','UKGDPR-2','Lawful basis for processing','Identify and document a lawful basis for each processing activity, and record it in the privacy notice.',2),
    ('PR','UKGDPR-3','Consent','Where relying on consent, ensure it is freely given, specific, informed and unambiguous, recorded, and as easy to withdraw as to give.',3),
    ('PR','UKGDPR-4','Special category and criminal offence data','Identify an Article 9 condition and, where required, a Schedule 1 condition under the Data Protection Act 2018, with an appropriate policy document in place.',4),
    ('PR','UKGDPR-5','Privacy information','Provide clear privacy information to individuals at the point of collection, or within one month where data is obtained indirectly.',5),
    ('RT','UKGDPR-6','Right of access','Respond to subject access requests within one month, providing a copy of the personal data and the supplementary information.',6),
    ('RT','UKGDPR-7','Rights to rectification and erasure','Enable individuals to have inaccurate data corrected and, where grounds apply, to have their data erased.',7),
    ('RT','UKGDPR-8','Rights to restriction, portability and objection','Support restriction of processing, provision of data in a portable format, and objection including absolute objection to direct marketing.',8),
    ('RT','UKGDPR-9','Automated decision-making and profiling','Identify any solely automated decisions with legal or similarly significant effects, and provide safeguards including human intervention.',9),
    ('AC','UKGDPR-10','Records of processing activities','Maintain a record of processing activities covering purposes, categories, recipients, transfers, retention and security measures.',10),
    ('AC','UKGDPR-11','Data protection by design and default','Implement technical and organisational measures at the design stage and by default, including data minimisation and pseudonymisation.',11),
    ('AC','UKGDPR-12','Data protection impact assessments','Carry out a DPIA before processing likely to result in a high risk, and consult the ICO where residual high risk remains.',12),
    ('AC','UKGDPR-13','Data Protection Officer','Appoint a DPO where required, publish their contact details, and ensure they operate independently and report to the highest management level.',13),
    ('AC','UKGDPR-14','Processor contracts','Ensure written contracts with processors contain the mandatory terms, and that processors provide sufficient guarantees.',14),
    ('SB','UKGDPR-15','Security of processing','Implement appropriate technical and organisational measures to ensure a level of security appropriate to the risk.',15),
    ('SB','UKGDPR-16','Personal data breach notification','Notify the ICO within 72 hours of becoming aware of a reportable breach, and inform affected individuals where the risk is high.',16),
    ('SB','UKGDPR-17','Breach record keeping','Record all personal data breaches, including the facts, effects and remedial action, whether or not they were notifiable.',17),
    ('IT','UKGDPR-18','Restricted transfers','Before transferring personal data outside the UK, rely on adequacy regulations or put an appropriate safeguard in place such as the IDTA or the UK Addendum.',18),
    ('IT','UKGDPR-19','Transfer risk assessment','Carry out a transfer risk assessment where relying on an appropriate safeguard, considering the law and practice of the destination country.',19)
) AS v(cat, ref, title, descr, sort)
ON CONFLICT (framework_id, control_ref) DO NOTHING;

-- ═══════════════════════════════ POPIA ═══════════════════════════════════════
WITH fw AS (SELECT id FROM framework_data.frameworks WHERE code = 'POPIA')
INSERT INTO framework_data.framework_categories (id, framework_id, code, name, description, sort_order)
SELECT gen_random_uuid(), fw.id, v.code, v.name, v.descr, v.sort
FROM fw, (VALUES
    ('COND', 'Conditions for Lawful Processing', 'The eight conditions set out in Chapter 3 of the Act.', 1),
    ('OBL',  'Operational Obligations',          'Registration, prior authorisation, direct marketing and transborder flows.', 2)
) AS v(code, name, descr, sort)
ON CONFLICT (framework_id, code) DO NOTHING;

WITH fw AS (SELECT id FROM framework_data.frameworks WHERE code = 'POPIA')
INSERT INTO framework_data.framework_controls
    (id, framework_id, category_id, control_ref, title, description, sort_order)
SELECT gen_random_uuid(), fw.id,
    (SELECT c.id FROM framework_data.framework_categories c WHERE c.framework_id = fw.id AND c.code = v.cat),
    v.ref, v.title, v.descr, v.sort
FROM fw, (VALUES
    ('COND','POPIA-1','Accountability','The responsible party shall ensure that the conditions for lawful processing are complied with at the time of determining the purpose and means of processing and during processing itself.',1),
    ('COND','POPIA-2','Processing limitation','Process personal information lawfully and in a manner that does not infringe the privacy of the data subject, limited to what is adequate, relevant and not excessive, with consent or another justification.',2),
    ('COND','POPIA-3','Purpose specification','Collect personal information for a specific, explicitly defined and lawful purpose related to a function or activity of the responsible party, and retain it no longer than necessary.',3),
    ('COND','POPIA-4','Further processing limitation','Ensure that further processing of personal information is compatible with the purpose for which it was originally collected.',4),
    ('COND','POPIA-5','Information quality','Take reasonably practicable steps to ensure that personal information is complete, accurate, not misleading and updated where necessary.',5),
    ('COND','POPIA-6','Openness','Maintain documentation of all processing operations and notify the data subject when collecting their personal information, including the purpose and the recipients.',6),
    ('COND','POPIA-7','Security safeguards','Secure the integrity and confidentiality of personal information through appropriate technical and organisational measures, and ensure operators process only with knowledge or authorisation and treat it as confidential.',7),
    ('COND','POPIA-8','Data subject participation','Enable data subjects to request confirmation of, access to, and correction or deletion of their personal information.',8),
    ('OBL','POPIA-9','Notification of security compromises','Notify the Information Regulator and the affected data subjects as soon as reasonably possible after discovering that personal information has been accessed or acquired by an unauthorised person.',9),
    ('OBL','POPIA-10','Information Officer','Register the Information Officer with the Information Regulator, and ensure they encourage compliance, deal with requests and work with the Regulator.',10),
    ('OBL','POPIA-11','Prior authorisation','Obtain prior authorisation from the Information Regulator before certain processing, such as unique identifiers for a purpose other than collection, or transferring special personal information to a third country without adequate protection.',11),
    ('OBL','POPIA-12','Direct marketing','Do not process personal information for direct marketing by electronic communication unless the data subject has consented or is an existing customer, and provide an opt-out on every communication.',12),
    ('OBL','POPIA-13','Transborder information flows','Do not transfer personal information outside South Africa unless the recipient is subject to a law, binding rules or agreement providing an adequate level of protection, or another statutory ground applies.',13),
    ('OBL','POPIA-14','Processing of special personal information','Do not process special personal information such as religious beliefs, race, health, biometrics or criminal behaviour unless a specific authorisation in the Act applies.',14),
    ('OBL','POPIA-15','Processing of childrens personal information','Do not process the personal information of a child unless a specific authorisation applies, including consent of a competent person.',15),
    ('OBL','POPIA-16','Manual and automated decision-making','Ensure a data subject is not subject to a decision resulting in legal consequences based solely on automated processing intended to profile them, unless safeguards apply.',16)
) AS v(cat, ref, title, descr, sort)
ON CONFLICT (framework_id, control_ref) DO NOTHING;

-- ════════════════════════════ CCPA / CPRA ════════════════════════════════════
WITH fw AS (SELECT id FROM framework_data.frameworks WHERE code = 'CCPA')
INSERT INTO framework_data.framework_categories (id, framework_id, code, name, description, sort_order)
SELECT gen_random_uuid(), fw.id, v.code, v.name, v.descr, v.sort
FROM fw, (VALUES
    ('RIGHTS', 'Consumer Rights',        'The rights Californian consumers may exercise and how requests are handled.', 1),
    ('NOTICE', 'Notices and Disclosure',  'Notices at collection, privacy policy content and required disclosures.', 2),
    ('DUTY',   'Business Obligations',    'Service provider contracts, data minimisation, security and risk assessments.', 3)
) AS v(code, name, descr, sort)
ON CONFLICT (framework_id, code) DO NOTHING;

WITH fw AS (SELECT id FROM framework_data.frameworks WHERE code = 'CCPA')
INSERT INTO framework_data.framework_controls
    (id, framework_id, category_id, control_ref, title, description, sort_order)
SELECT gen_random_uuid(), fw.id,
    (SELECT c.id FROM framework_data.framework_categories c WHERE c.framework_id = fw.id AND c.code = v.cat),
    v.ref, v.title, v.descr, v.sort
FROM fw, (VALUES
    ('RIGHTS','CCPA-1','Right to know','Provide consumers, on verifiable request, with the categories and specific pieces of personal information collected, the sources, the business purpose and the third parties it is disclosed to.',1),
    ('RIGHTS','CCPA-2','Right to delete','Delete personal information collected from the consumer on verifiable request, and direct service providers to do the same, subject to the statutory exceptions.',2),
    ('RIGHTS','CCPA-3','Right to correct','Correct inaccurate personal information on verifiable request, using commercially reasonable efforts.',3),
    ('RIGHTS','CCPA-4','Right to opt out of sale or sharing','Provide a clear and conspicuous Do Not Sell or Share My Personal Information link and honour opt-out preference signals such as Global Privacy Control.',4),
    ('RIGHTS','CCPA-5','Right to limit use of sensitive personal information','Provide a Limit the Use of My Sensitive Personal Information link where sensitive information is used beyond permitted purposes.',5),
    ('RIGHTS','CCPA-6','Right to non-discrimination','Do not discriminate against consumers for exercising their rights, including by denying goods or services or charging different prices, unless the difference is reasonably related to value.',6),
    ('RIGHTS','CCPA-7','Request handling and verification','Provide at least two designated methods for submitting requests, verify the requester, and respond within 45 days with one permitted 45-day extension.',7),
    ('RIGHTS','CCPA-8','Authorized agents','Accept and verify requests submitted by an authorised agent on behalf of a consumer.',8),
    ('NOTICE','CCPA-9','Notice at collection','Inform consumers at or before the point of collection of the categories of personal information collected, the purposes, whether it is sold or shared, and the retention period.',9),
    ('NOTICE','CCPA-10','Privacy policy','Maintain a privacy policy containing the required disclosures, describing consumer rights and how to exercise them, updated at least every 12 months.',10),
    ('NOTICE','CCPA-11','Notice of financial incentive','Where offering a financial incentive or price difference related to personal information, provide the required notice and obtain opt-in consent.',11),
    ('DUTY','CCPA-12','Service provider and contractor contracts','Enter written contracts with service providers, contractors and third parties containing the terms required by the CPRA, including purpose limitation and audit rights.',12),
    ('DUTY','CCPA-13','Data minimization and purpose limitation','Collect, use, retain and share personal information only as reasonably necessary and proportionate to the disclosed purposes.',13),
    ('DUTY','CCPA-14','Reasonable security','Implement reasonable security procedures and practices appropriate to the nature of the personal information, to protect against unauthorised access, destruction, use, modification or disclosure.',14),
    ('DUTY','CCPA-15','Risk assessments and cybersecurity audits','Where processing presents significant risk to consumer privacy or security, conduct the risk assessments and annual cybersecurity audits required by regulation.',15),
    ('DUTY','CCPA-16','Training and record keeping','Train personnel responsible for handling consumer requests, and maintain records of requests and responses for at least 24 months.',16)
) AS v(cat, ref, title, descr, sort)
ON CONFLICT (framework_id, control_ref) DO NOTHING;

-- ═══════════════════════ DPDPA 2023 (India) ══════════════════════════════════
WITH fw AS (SELECT id FROM framework_data.frameworks WHERE code = 'DPDPA')
INSERT INTO framework_data.framework_categories (id, framework_id, code, name, description, sort_order)
SELECT gen_random_uuid(), fw.id, v.code, v.name, v.descr, v.sort
FROM fw, (VALUES
    ('OBL', 'Data Fiduciary Obligations', 'Duties of a Data Fiduciary under the Digital Personal Data Protection Act 2023.', 1),
    ('RTS', 'Data Principal Rights',      'Rights of the individual whose personal data is processed.', 2),
    ('SDF', 'Significant Data Fiduciary', 'Additional obligations where the organisation is notified as significant.', 3)
) AS v(code, name, descr, sort)
ON CONFLICT (framework_id, code) DO NOTHING;

WITH fw AS (SELECT id FROM framework_data.frameworks WHERE code = 'DPDPA')
INSERT INTO framework_data.framework_controls
    (id, framework_id, category_id, control_ref, title, description, sort_order)
SELECT gen_random_uuid(), fw.id,
    (SELECT c.id FROM framework_data.framework_categories c WHERE c.framework_id = fw.id AND c.code = v.cat),
    v.ref, v.title, v.descr, v.sort
FROM fw, (VALUES
    ('OBL','DPDPA-1','Notice','Give the Data Principal an itemised notice describing the personal data to be processed, the purpose, how to exercise rights and how to complain to the Board, available in English or any language in the Eighth Schedule.',1),
    ('OBL','DPDPA-2','Consent','Obtain free, specific, informed, unconditional and unambiguous consent with a clear affirmative action, limited to the personal data necessary for the specified purpose.',2),
    ('OBL','DPDPA-3','Withdrawal of consent','Enable the Data Principal to withdraw consent as easily as it was given, and cease processing within a reasonable time once withdrawn.',3),
    ('OBL','DPDPA-4','Legitimate uses','Where processing without consent, confirm that a certified legitimate use under section 7 applies, such as voluntary provision or compliance with law.',4),
    ('OBL','DPDPA-5','Accuracy and completeness','Ensure personal data is complete, accurate and consistent where it is used to make a decision affecting the Data Principal or is disclosed to another Data Fiduciary.',5),
    ('OBL','DPDPA-6','Security safeguards','Implement reasonable security safeguards to prevent personal data breaches, including with respect to Data Processors engaged by the Fiduciary.',6),
    ('OBL','DPDPA-7','Breach notification','Notify the Data Protection Board and each affected Data Principal of a personal data breach in the form and manner prescribed.',7),
    ('OBL','DPDPA-8','Erasure and retention','Erase personal data on withdrawal of consent or once the specified purpose is no longer served, unless retention is required by law, and ensure Processors do the same.',8),
    ('OBL','DPDPA-9','Grievance redressal','Publish the contact details of a Data Protection Officer or a person able to answer questions, and provide an effective grievance redressal mechanism.',9),
    ('OBL','DPDPA-10','Processing of childrens data','Obtain verifiable consent of a parent or lawful guardian before processing the personal data of a child, and do not undertake tracking, behavioural monitoring or targeted advertising directed at children.',10),
    ('RTS','DPDPA-11','Right to access information','Provide, on request, a summary of the personal data processed, the processing activities, and the identities of other Fiduciaries with whom it has been shared.',11),
    ('RTS','DPDPA-12','Right to correction and erasure','Enable the Data Principal to request correction, completion, updating and erasure of their personal data.',12),
    ('RTS','DPDPA-13','Right of grievance redressal','Provide a readily available means for the Data Principal to raise a grievance, and respond within the prescribed period.',13),
    ('RTS','DPDPA-14','Right to nominate','Enable the Data Principal to nominate another individual to exercise their rights in the event of death or incapacity.',14),
    ('SDF','DPDPA-15','Data Protection Officer','Where notified as a Significant Data Fiduciary, appoint a Data Protection Officer based in India who reports to the board and is the point of contact for grievance redressal.',15),
    ('SDF','DPDPA-16','Independent data auditor and DPIA','Appoint an independent data auditor and carry out periodic Data Protection Impact Assessments and audits as required of a Significant Data Fiduciary.',16)
) AS v(cat, ref, title, descr, sort)
ON CONFLICT (framework_id, control_ref) DO NOTHING;

-- ══════════════════════════ UAE PDPL (Federal Decree-Law 45/2021) ════════════
WITH fw AS (SELECT id FROM framework_data.frameworks WHERE code = 'UAE_PDPL')
INSERT INTO framework_data.framework_categories (id, framework_id, code, name, description, sort_order)
SELECT gen_random_uuid(), fw.id, v.code, v.name, v.descr, v.sort
FROM fw, (VALUES
    ('PROC', 'Processing and Consent',   'Lawful processing, consent and the general processing controls.', 1),
    ('RGHT', 'Data Subject Rights',      'Rights granted to data subjects under the Law.', 2),
    ('CTRL', 'Controller and Processor', 'Obligations of controllers and processors, security and breach reporting.', 3),
    ('XFER', 'Cross-Border Transfer',    'Transfer of personal data outside the State.', 4)
) AS v(code, name, descr, sort)
ON CONFLICT (framework_id, code) DO NOTHING;

WITH fw AS (SELECT id FROM framework_data.frameworks WHERE code = 'UAE_PDPL')
INSERT INTO framework_data.framework_controls
    (id, framework_id, category_id, control_ref, title, description, sort_order)
SELECT gen_random_uuid(), fw.id,
    (SELECT c.id FROM framework_data.framework_categories c WHERE c.framework_id = fw.id AND c.code = v.cat),
    v.ref, v.title, v.descr, v.sort
FROM fw, (VALUES
    ('PROC','PDPL-1','Lawful basis for processing','Process personal data only with the consent of the data subject or where one of the cases permitting processing without consent under Article 4 applies.',1),
    ('PROC','PDPL-2','Conditions of consent','Ensure consent is clear, unambiguous, specific to the purpose, evidenced, and capable of being withdrawn at any time.',2),
    ('PROC','PDPL-3','Processing controls','Process personal data fairly, transparently and lawfully; limited to the purpose; accurate; secure; and retained no longer than the purpose requires.',3),
    ('PROC','PDPL-4','Sensitive personal data','Apply the additional restrictions applicable to sensitive personal data, including health data, and to biometric data.',4),
    ('RGHT','PDPL-5','Right to information and access','Provide the data subject with information about the processing and, on request, access to their personal data and the details of processing.',5),
    ('RGHT','PDPL-6','Right to request transfer of data','Enable the data subject to receive their personal data in a structured, machine-readable format and to have it transferred to another controller where technically feasible.',6),
    ('RGHT','PDPL-7','Right to correction or erasure','Enable the data subject to request correction of inaccurate personal data and erasure where the statutory grounds apply.',7),
    ('RGHT','PDPL-8','Right to restrict and object to processing','Enable the data subject to request restriction of processing and to object to processing, including for direct marketing and automated decision-making.',8),
    ('CTRL','PDPL-9','Controller obligations','Maintain records of processing, apply appropriate organisational and technical measures, and be able to demonstrate compliance with the Law.',9),
    ('CTRL','PDPL-10','Processor obligations','Engage processors that provide sufficient guarantees, bind them by contract, and ensure they process only on documented instructions.',10),
    ('CTRL','PDPL-11','Security of personal data','Apply appropriate technical and organisational measures to protect personal data, taking into account the nature of the data and the risks of processing.',11),
    ('CTRL','PDPL-12','Personal data breach notification','Notify the UAE Data Office of a breach that would prejudice the privacy, confidentiality or security of personal data immediately upon becoming aware, and inform the data subject where there is prejudice.',12),
    ('CTRL','PDPL-13','Data Protection Officer','Appoint a Data Protection Officer where the processing involves high risk, large-scale sensitive data, or systematic evaluation, and register their details with the Data Office.',13),
    ('CTRL','PDPL-14','Data protection impact assessment','Carry out an impact assessment before processing using new technologies or presenting a high risk to the privacy of data subjects.',14),
    ('XFER','PDPL-15','Transfer to jurisdictions with adequate protection','Transfer personal data outside the State where the destination has a law providing adequate protection, or an international agreement applies.',15),
    ('XFER','PDPL-16','Transfer in the absence of adequacy','Where adequacy does not apply, rely on a contractual commitment, the explicit consent of the data subject, or another basis permitted by Article 23.',16)
) AS v(cat, ref, title, descr, sort)
ON CONFLICT (framework_id, control_ref) DO NOTHING;

-- ══════════════════════════════ ISO 27701 ════════════════════════════════════
WITH fw AS (SELECT id FROM framework_data.frameworks WHERE code = 'ISO27701')
INSERT INTO framework_data.framework_categories (id, framework_id, code, name, description, sort_order)
SELECT gen_random_uuid(), fw.id, v.code, v.name, v.descr, v.sort
FROM fw, (VALUES
    ('PIMS', 'PIMS Requirements',            'Requirements specific to a Privacy Information Management System, extending ISO 27001.', 1),
    ('CTRL', 'PII Controller Guidance',      'Additional guidance for organisations acting as PII controllers (Annex A).', 2),
    ('PROC', 'PII Processor Guidance',       'Additional guidance for organisations acting as PII processors (Annex B).', 3)
) AS v(code, name, descr, sort)
ON CONFLICT (framework_id, code) DO NOTHING;

WITH fw AS (SELECT id FROM framework_data.frameworks WHERE code = 'ISO27701')
INSERT INTO framework_data.framework_controls
    (id, framework_id, category_id, control_ref, title, description, sort_order)
SELECT gen_random_uuid(), fw.id,
    (SELECT c.id FROM framework_data.framework_categories c WHERE c.framework_id = fw.id AND c.code = v.cat),
    v.ref, v.title, v.descr, v.sort
FROM fw, (VALUES
    ('PIMS','27701-5.2','PIMS scope and context','Determine the role of the organisation as PII controller, PII processor or both, and include privacy in the scope, context and interested-party analysis of the management system.',1),
    ('PIMS','27701-5.3','Privacy leadership and policy','Extend the information security policy to address the protection of PII, with leadership commitment and assigned privacy responsibilities.',2),
    ('PIMS','27701-5.4','Privacy risk assessment','Extend the information security risk assessment to include risks to PII principals, and perform privacy impact assessments where required.',3),
    ('PIMS','27701-5.5','Privacy support and competence','Ensure resources, competence, awareness and communication arrangements cover privacy as well as security.',4),
    ('PIMS','27701-5.6','Privacy operation','Plan and control the processes needed to meet privacy requirements, including operational privacy risk treatment.',5),
    ('PIMS','27701-5.7','Privacy performance evaluation','Monitor, measure, audit and review the PIMS, including privacy objectives and the effectiveness of privacy controls.',6),
    ('PIMS','27701-5.8','Privacy improvement','Address nonconformities relating to PII and continually improve the PIMS.',7),
    ('CTRL','27701-A.7.2','Conditions for collection and processing','Identify and document the lawful basis and purposes for processing PII, obtain and record consent where relied upon, and carry out privacy impact assessments.',8),
    ('CTRL','27701-A.7.3','Obligations to PII principals','Determine and document the obligations to PII principals, provide the required information, and enable access, correction, erasure, objection and portability.',9),
    ('CTRL','27701-A.7.4','Privacy by design and by default','Limit collection, processing, storage and retention to what is necessary, apply de-identification where possible, and dispose of PII securely.',10),
    ('CTRL','27701-A.7.5','PII sharing, transfer and disclosure','Identify the basis for transfers between jurisdictions, record disclosures to third parties, and maintain a list of PII transfer destinations.',11),
    ('PROC','27701-B.8.2','Conditions for collection and processing','Process PII only in accordance with the documented instructions of the customer, and inform the customer if an instruction infringes applicable legislation.',12),
    ('PROC','27701-B.8.3','Obligations to PII principals','Provide the customer with the means to fulfil the obligations of PII principals to access, correct and erase their PII.',13),
    ('PROC','27701-B.8.4','Privacy by design and by default','Support temporary file management, PII return, transfer and disposal, and ensure transmission controls are applied.',14),
    ('PROC','27701-B.8.5','PII sharing, transfer and disclosure','Disclose subcontractors used to process PII, notify the customer of changes, and record disclosures including those required by law.',15)
) AS v(cat, ref, title, descr, sort)
ON CONFLICT (framework_id, control_ref) DO NOTHING;
