-- =============================================================================
-- Privacy frameworks — NDPR (Nigeria) and GDPR (EU) control libraries
-- ComplianceCore | ORION SOFT LIMITED
--
-- NDPR reuses the SP-1..SP-8 categories seeded in frameworks.sql. GDPR has no
-- categories yet, so its chapters are created here first.
-- =============================================================================

-- ── GDPR chapters (categories) ───────────────────────────────────────────────
WITH fw AS (SELECT id FROM framework_data.frameworks WHERE code = 'GDPR')
INSERT INTO framework_data.framework_categories (id, framework_id, code, name, description, sort_order)
SELECT gen_random_uuid(), fw.id, v.code, v.name, v.descr, v.sort
FROM fw, (VALUES
    ('CH2', 'Principles',                'Lawfulness, fairness, transparency, purpose limitation, minimisation, accuracy, storage limitation, integrity and confidentiality, accountability.', 1),
    ('CH3', 'Rights of the Data Subject','Transparency, access, rectification, erasure, restriction, portability, objection and automated decision-making.', 2),
    ('CH4', 'Controller and Processor',  'Obligations of controllers and processors, security of processing, DPIA, and the Data Protection Officer.', 3),
    ('CH5', 'Transfers to Third Countries','Conditions for transferring personal data outside the EEA.', 4),
    ('CH8', 'Remedies and Liability',    'Complaint handling, remedies, liability and administrative fines.', 5)
) AS v(code, name, descr, sort)
ON CONFLICT (framework_id, code) DO NOTHING;

-- ── GDPR controls ────────────────────────────────────────────────────────────
WITH fw AS (SELECT id FROM framework_data.frameworks WHERE code = 'GDPR')
INSERT INTO framework_data.framework_controls
    (id, framework_id, category_id, control_ref, title, description, sort_order)
SELECT gen_random_uuid(), fw.id,
    (SELECT c.id FROM framework_data.framework_categories c WHERE c.framework_id = fw.id AND c.code = v.cat),
    v.ref, v.title, v.descr, v.sort
FROM fw, (VALUES
    ('CH2','Art.5','Principles relating to processing of personal data','Personal data shall be processed lawfully, fairly and transparently; collected for specified, explicit and legitimate purposes; adequate, relevant and limited to what is necessary; accurate; kept no longer than necessary; and processed securely. The controller shall be able to demonstrate compliance.',1),
    ('CH2','Art.6','Lawfulness of processing','Processing is lawful only if and to the extent that at least one lawful basis applies: consent, contract, legal obligation, vital interests, public task or legitimate interests.',2),
    ('CH2','Art.7','Conditions for consent','Where processing is based on consent, the controller shall be able to demonstrate that the data subject has consented, using a request that is clearly distinguishable, intelligible and easily accessible, and as easy to withdraw as to give.',3),
    ('CH2','Art.9','Processing of special categories of personal data','Processing of data revealing racial or ethnic origin, political opinions, religious beliefs, trade union membership, genetic, biometric, health, sex life or sexual orientation data is prohibited unless a specific exemption applies.',4),
    ('CH3','Art.12','Transparent information and communication','The controller shall provide information to data subjects in a concise, transparent, intelligible and easily accessible form, using clear and plain language, and facilitate the exercise of data subject rights.',5),
    ('CH3','Art.13','Information to be provided where data is collected from the data subject','At the time personal data is obtained, the controller shall provide identity and contact details, purposes and legal basis, recipients, transfer intentions, retention period and the data subject rights.',6),
    ('CH3','Art.14','Information to be provided where data has not been obtained from the data subject','Where personal data has not been obtained from the data subject, the controller shall provide equivalent information within a reasonable period and at the latest within one month.',7),
    ('CH3','Art.15','Right of access by the data subject','The data subject has the right to obtain confirmation as to whether personal data concerning them is being processed, access to that data, and the supplementary information listed in the Article.',8),
    ('CH3','Art.16','Right to rectification','The data subject has the right to obtain without undue delay the rectification of inaccurate personal data and to have incomplete data completed.',9),
    ('CH3','Art.17','Right to erasure (right to be forgotten)','The data subject has the right to obtain erasure of personal data without undue delay where one of the grounds in the Article applies.',10),
    ('CH3','Art.18','Right to restriction of processing','The data subject has the right to obtain restriction of processing where accuracy is contested, processing is unlawful, the data is no longer needed but required for legal claims, or an objection is pending.',11),
    ('CH3','Art.20','Right to data portability','The data subject has the right to receive their personal data in a structured, commonly used and machine-readable format and to transmit it to another controller without hindrance.',12),
    ('CH3','Art.21','Right to object','The data subject has the right to object at any time to processing based on public task or legitimate interests, and absolutely to processing for direct marketing.',13),
    ('CH3','Art.22','Automated individual decision-making and profiling','The data subject has the right not to be subject to a decision based solely on automated processing, including profiling, which produces legal or similarly significant effects, subject to the stated exceptions and safeguards.',14),
    ('CH4','Art.24','Responsibility of the controller','The controller shall implement appropriate technical and organisational measures to ensure and demonstrate that processing is performed in accordance with the Regulation, reviewed and updated where necessary.',15),
    ('CH4','Art.25','Data protection by design and by default','The controller shall implement appropriate technical and organisational measures, such as pseudonymisation and data minimisation, both at the time of determining the means of processing and at the time of the processing itself.',16),
    ('CH4','Art.28','Processor','Processing by a processor shall be governed by a contract setting out the subject matter, duration, nature and purpose of processing, the type of personal data and the obligations of both parties.',17),
    ('CH4','Art.30','Records of processing activities','Each controller and processor shall maintain a record of processing activities under its responsibility, containing the information specified in the Article.',18),
    ('CH4','Art.32','Security of processing','The controller and processor shall implement appropriate technical and organisational measures to ensure a level of security appropriate to the risk, including pseudonymisation and encryption, resilience, restoration and regular testing.',19),
    ('CH4','Art.33','Notification of a personal data breach to the supervisory authority','In the case of a personal data breach, the controller shall notify the competent supervisory authority without undue delay and, where feasible, not later than 72 hours after having become aware of it.',20),
    ('CH4','Art.34','Communication of a personal data breach to the data subject','When a breach is likely to result in a high risk to the rights and freedoms of natural persons, the controller shall communicate it to the data subject without undue delay.',21),
    ('CH4','Art.35','Data protection impact assessment','Where processing is likely to result in a high risk, the controller shall carry out an assessment of the impact of the envisaged processing operations on the protection of personal data prior to processing.',22),
    ('CH4','Art.37','Designation of the data protection officer','The controller and processor shall designate a data protection officer where processing is carried out by a public authority, or the core activities require regular and systematic monitoring on a large scale, or large-scale processing of special categories.',23),
    ('CH5','Art.44','General principle for transfers','Any transfer of personal data to a third country or international organisation shall take place only if the conditions of Chapter V are complied with by the controller and processor.',24),
    ('CH5','Art.46','Transfers subject to appropriate safeguards','In the absence of an adequacy decision, a controller or processor may transfer personal data only if appropriate safeguards are provided, such as standard contractual clauses or binding corporate rules.',25),
    ('CH8','Art.82','Right to compensation and liability','Any person who has suffered material or non-material damage as a result of an infringement shall have the right to receive compensation from the controller or processor.',26)
) AS v(cat, ref, title, descr, sort)
ON CONFLICT (framework_id, control_ref) DO NOTHING;

-- ── NDPR controls (Nigeria Data Protection Regulation / NDPA 2023) ───────────
WITH fw AS (SELECT id FROM framework_data.frameworks WHERE code = 'NDPR')
INSERT INTO framework_data.framework_controls
    (id, framework_id, category_id, control_ref, title, description, sort_order)
SELECT gen_random_uuid(), fw.id,
    (SELECT c.id FROM framework_data.framework_categories c WHERE c.framework_id = fw.id AND c.code = v.cat),
    v.ref, v.title, v.descr, v.sort
FROM fw, (VALUES
    ('SP-1','NDPR-1.1','Publish a data privacy policy','The organisation shall publish a conspicuous and comprehensible privacy policy covering the categories of personal data collected, the purpose of collection, the technical methods used, and the rights of data subjects.',1),
    ('SP-1','NDPR-1.2','Maintain a record of processing activities','The organisation shall maintain records of the personal data it processes, the purposes, categories of data subjects and recipients, transfers, retention periods and security measures applied.',2),
    ('SP-1','NDPR-1.3','Data processor agreements','Any third party engaged to process personal data on behalf of the organisation shall be bound by a written contract imposing NDPR-equivalent obligations, confidentiality and security duties.',3),
    ('SP-1','NDPR-1.4','Privacy by design in new systems','Data protection requirements shall be considered and documented at the design stage of any new system, product or process that handles personal data.',4),
    ('SP-2','NDPR-2.1','Establish a lawful basis for processing','Personal data shall only be processed where the data subject has given consent, or processing is necessary for a contract, a legal obligation, vital interests, or a public-interest task.',5),
    ('SP-2','NDPR-2.2','Obtain and evidence valid consent','Consent shall be obtained without fraud, coercion or undue influence, be specific to the stated purpose, and the organisation shall retain evidence of when and how it was given.',6),
    ('SP-2','NDPR-2.3','Provide a means to withdraw consent','Data subjects shall be able to withdraw consent at any time, as easily as it was given, and the organisation shall cease the related processing on withdrawal.',7),
    ('SP-2','NDPR-2.4','Purpose limitation and data minimisation','Personal data shall be adequate, accurate and limited to the minimum necessary for the specific purpose for which it was collected, and not further processed incompatibly with that purpose.',8),
    ('SP-3','NDPR-3.1','Right of access','On request, the organisation shall confirm whether it processes a data subject personal data and provide a copy of that data together with the supporting information.',9),
    ('SP-3','NDPR-3.2','Right to rectification','Data subjects shall be able to request correction of inaccurate or incomplete personal data, and the organisation shall action such requests without undue delay.',10),
    ('SP-3','NDPR-3.3','Right to erasure and objection','Data subjects shall be able to request deletion of their personal data and to object to processing, subject to the organisation legal retention obligations.',11),
    ('SP-3','NDPR-3.4','Right to data portability','Where processing is based on consent or contract and carried out by automated means, the organisation shall provide the data subject personal data in a structured, commonly used, machine-readable format.',12),
    ('SP-3','NDPR-3.5','Respond to data subject requests within statutory time','Data subject requests shall be acknowledged and resolved within the timeframe required by the regulation, with any refusal explained and the right of appeal stated.',13),
    ('SP-4','NDPR-4.1','Technical security measures for personal data','The organisation shall protect personal data using measures appropriate to the risk, including access control, encryption in transit and at rest, secure backups and anti-malware protection.',14),
    ('SP-4','NDPR-4.2','Organisational security measures','Staff handling personal data shall be subject to confidentiality obligations, role-based access, and documented handling procedures for storage, transfer and disposal.',15),
    ('SP-4','NDPR-4.3','Personnel data protection training','All personnel who handle personal data shall receive data protection training on appointment and at planned intervals thereafter.',16),
    ('SP-4','NDPR-4.4','Retention and secure disposal','Personal data shall be retained only for as long as required by the purpose or by law, and securely destroyed or anonymised thereafter.',17),
    ('SP-5','NDPR-5.1','Assess adequacy before cross-border transfer','Before transferring personal data outside Nigeria, the organisation shall confirm that the recipient country is on the approved adequacy list or that another lawful transfer condition applies.',18),
    ('SP-5','NDPR-5.2','Safeguards and consent for restricted transfers','Where adequacy does not apply, the transfer shall be supported by the explicit informed consent of the data subject or by contractual safeguards, and shall be documented.',19),
    ('SP-6','NDPR-6.1','Breach detection and internal reporting','The organisation shall have a documented procedure enabling personnel to detect and report suspected personal data breaches without delay.',20),
    ('SP-6','NDPR-6.2','Notify the supervisory authority','Personal data breaches shall be reported to the Nigeria Data Protection Commission within the statutory period of becoming aware of the breach.',21),
    ('SP-6','NDPR-6.3','Notify affected data subjects','Where a breach is likely to result in high risk to the rights and freedoms of data subjects, those data subjects shall be informed without undue delay in plain language.',22),
    ('SP-6','NDPR-6.4','Maintain a breach register','All personal data breaches shall be recorded, including the facts, effects and remedial action taken, whether or not they were notifiable.',23),
    ('SP-7','NDPR-7.1','Designate a Data Protection Officer','The organisation shall designate a Data Protection Officer or engage a suitably qualified data protection service, and publish their contact details.',24),
    ('SP-7','NDPR-7.2','Define DPO responsibilities and independence','The DPO responsibilities shall be documented, and the DPO shall report to the highest level of management and not be penalised for performing their duties.',25),
    ('SP-8','NDPR-8.1','Conduct the annual data protection audit','Organisations processing personal data of more than the prescribed number of data subjects shall carry out a data protection audit and file the report through a licensed Data Protection Compliance Organisation.',26),
    ('SP-8','NDPR-8.2','Remediate audit findings','Findings from the data protection audit shall be tracked to closure with assigned owners and target dates.',27),
    ('SP-8','NDPR-8.3','Register with the supervisory authority','Where required by its processing profile, the organisation shall register as a data controller or processor of major importance with the Nigeria Data Protection Commission and keep the registration current.',28)
) AS v(cat, ref, title, descr, sort)
ON CONFLICT (framework_id, control_ref) DO NOTHING;
