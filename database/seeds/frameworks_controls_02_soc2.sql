-- =============================================================================
-- SOC 2 — Trust Services Criteria control library
-- ComplianceCore | ORION SOFT LIMITED
--
-- Common Criteria (CC1–CC9) plus the Availability, Confidentiality, Processing
-- Integrity and Privacy categories, at the level a service organization is
-- actually assessed against.
-- =============================================================================

WITH fw AS (SELECT id FROM framework_data.frameworks WHERE code = 'SOC2')
INSERT INTO framework_data.framework_controls
    (id, framework_id, category_id, control_ref, title, description, sort_order)
SELECT
    gen_random_uuid(),
    fw.id,
    (SELECT c.id FROM framework_data.framework_categories c
      WHERE c.framework_id = fw.id AND c.code = v.cat),
    v.ref, v.title, v.descr, v.sort
FROM fw, (VALUES
    -- ── CC1 Control Environment ─────────────────────────────────────────────
    ('CC1','CC1.1','Commitment to integrity and ethical values','The entity demonstrates a commitment to integrity and ethical values through its code of conduct, tone at the top, and enforcement of standards.',1),
    ('CC1','CC1.2','Board independence and oversight','The board of directors demonstrates independence from management and exercises oversight of the development and performance of internal control.',2),
    ('CC1','CC1.3','Organizational structure and reporting lines','Management establishes, with board oversight, structures, reporting lines, and appropriate authorities and responsibilities in the pursuit of objectives.',3),
    ('CC1','CC1.4','Commitment to competence','The entity demonstrates a commitment to attract, develop, and retain competent individuals in alignment with objectives.',4),
    ('CC1','CC1.5','Accountability for internal control','The entity holds individuals accountable for their internal control responsibilities in the pursuit of objectives.',5),

    -- ── CC2 Communication and Information ───────────────────────────────────
    ('CC2','CC2.1','Quality information for internal control','The entity obtains or generates and uses relevant, quality information to support the functioning of internal control.',6),
    ('CC2','CC2.2','Internal communication of responsibilities','The entity internally communicates information, including objectives and responsibilities for internal control, necessary to support the functioning of internal control.',7),
    ('CC2','CC2.3','External communication','The entity communicates with external parties regarding matters affecting the functioning of internal control, including commitments and system requirements.',8),

    -- ── CC3 Risk Assessment ─────────────────────────────────────────────────
    ('CC3','CC3.1','Objectives specified for risk assessment','The entity specifies objectives with sufficient clarity to enable the identification and assessment of risks relating to those objectives.',9),
    ('CC3','CC3.2','Risk identification and analysis','The entity identifies risks to the achievement of its objectives across the entity and analyzes risks as a basis for determining how the risks should be managed.',10),
    ('CC3','CC3.3','Consideration of fraud risk','The entity considers the potential for fraud in assessing risks to the achievement of objectives.',11),
    ('CC3','CC3.4','Identification of significant change','The entity identifies and assesses changes that could significantly impact the system of internal control.',12),

    -- ── CC4 Monitoring Activities ───────────────────────────────────────────
    ('CC4','CC4.1','Ongoing and separate evaluations','The entity selects, develops, and performs ongoing and/or separate evaluations to ascertain whether the components of internal control are present and functioning.',13),
    ('CC4','CC4.2','Evaluation and communication of deficiencies','The entity evaluates and communicates internal control deficiencies in a timely manner to those parties responsible for taking corrective action.',14),

    -- ── CC5 Control Activities ──────────────────────────────────────────────
    ('CC5','CC5.1','Selection and development of control activities','The entity selects and develops control activities that contribute to the mitigation of risks to the achievement of objectives to acceptable levels.',15),
    ('CC5','CC5.2','Technology general controls','The entity selects and develops general control activities over technology to support the achievement of objectives.',16),
    ('CC5','CC5.3','Deployment through policies and procedures','The entity deploys control activities through policies that establish what is expected and procedures that put policies into action.',17),

    -- ── CC6 Logical and Physical Access ─────────────────────────────────────
    ('CC6','CC6.1','Logical access security software and infrastructure','The entity implements logical access security software, infrastructure, and architectures over protected information assets to protect them from security events.',18),
    ('CC6','CC6.2','Registration and authorization of users','Prior to issuing system credentials, the entity registers and authorizes new internal and external users whose access is administered by the entity.',19),
    ('CC6','CC6.3','Role-based access and least privilege','The entity authorizes, modifies, or removes access to data, software, functions, and other protected information assets based on roles, responsibilities, or the system design and changes, giving consideration to least privilege and segregation of duties.',20),
    ('CC6','CC6.4','Physical access to facilities','The entity restricts physical access to facilities and protected information assets to authorized personnel commensurate with assessed risk.',21),
    ('CC6','CC6.5','Disposal of physical assets','The entity discontinues logical and physical protections over physical assets only after the ability to read or recover data and software has been diminished and is no longer required.',22),
    ('CC6','CC6.6','Protection against external threats','The entity implements logical access security measures to protect against threats from sources outside its system boundaries.',23),
    ('CC6','CC6.7','Restriction of information transmission and movement','The entity restricts the transmission, movement, and removal of information to authorized internal and external users and processes, and protects it during transmission, movement, or removal.',24),
    ('CC6','CC6.8','Prevention and detection of unauthorized software','The entity implements controls to prevent or detect and act upon the introduction of unauthorized or malicious software.',25),

    -- ── CC7 System Operations ───────────────────────────────────────────────
    ('CC7','CC7.1','Detection of configuration changes and vulnerabilities','The entity uses detection and monitoring procedures to identify changes to configurations that result in the introduction of new vulnerabilities, and susceptibilities to newly discovered vulnerabilities.',26),
    ('CC7','CC7.2','Monitoring for anomalies','The entity monitors system components and the operation of those components for anomalies that are indicative of malicious acts, natural disasters, and errors affecting the ability of the entity to meet its objectives.',27),
    ('CC7','CC7.3','Evaluation of security events','The entity evaluates security events to determine whether they could or have resulted in a failure of the entity to meet its objectives, and if so, takes action to prevent or address such failures.',28),
    ('CC7','CC7.4','Incident response programme','The entity responds to identified security incidents by executing a defined incident response programme to understand, contain, remediate, and communicate security incidents, as appropriate.',29),
    ('CC7','CC7.5','Recovery from identified incidents','The entity identifies, develops, and implements activities to recover from identified security incidents.',30),

    -- ── CC8 Change Management ───────────────────────────────────────────────
    ('CC8','CC8.1','Authorized change management','The entity authorizes, designs, develops or acquires, configures, documents, tests, approves, and implements changes to infrastructure, data, software, and procedures to meet its objectives.',31),

    -- ── CC9 Risk Mitigation ─────────────────────────────────────────────────
    ('CC9','CC9.1','Business disruption risk mitigation','The entity identifies, selects, and develops risk mitigation activities for risks arising from potential business disruptions.',32),
    ('CC9','CC9.2','Vendor and business partner risk management','The entity assesses and manages risks associated with vendors and business partners.',33),

    -- ── A1 Availability ─────────────────────────────────────────────────────
    ('A1','A1.1','Capacity management','The entity maintains, monitors, and evaluates current processing capacity and use of system components to manage capacity demand and to enable the implementation of additional capacity to help meet its objectives.',34),
    ('A1','A1.2','Backup, recovery and environmental protection','The entity authorizes, designs, develops or acquires, implements, operates, approves, maintains, and monitors environmental protections, software, data backup processes, and recovery infrastructure to meet its objectives.',35),
    ('A1','A1.3','Recovery plan testing','The entity tests recovery plan procedures supporting system recovery to meet its objectives.',36),

    -- ── C1 Confidentiality ──────────────────────────────────────────────────
    ('C1','C1.1','Identification and maintenance of confidential information','The entity identifies and maintains confidential information to meet the objectives of the entity related to confidentiality.',37),
    ('C1','C1.2','Disposal of confidential information','The entity disposes of confidential information to meet the objectives of the entity related to confidentiality.',38),

    -- ── PI1 Processing Integrity ────────────────────────────────────────────
    ('PI1','PI1.1','Information about processing objectives','The entity obtains or generates, uses, and communicates relevant, quality information regarding the objectives related to processing, including definitions of data processed and product and service specifications.',39),
    ('PI1','PI1.2','Completeness and accuracy of inputs','The entity implements policies and procedures over system inputs, including controls over completeness and accuracy, to result in products, services, and reporting to meet the objectives of the entity.',40),
    ('PI1','PI1.3','Processing controls','The entity implements policies and procedures over system processing to result in products, services, and reporting to meet the objectives of the entity.',41),
    ('PI1','PI1.4','Completeness and accuracy of outputs','The entity implements policies and procedures to make available or deliver output completely, accurately, and timely in accordance with specifications to meet the objectives of the entity.',42),
    ('PI1','PI1.5','Storage of inputs and outputs','The entity implements policies and procedures to store inputs, items in processing, and outputs completely, accurately, and timely in accordance with system specifications to meet the objectives of the entity.',43),

    -- ── P1 Privacy ──────────────────────────────────────────────────────────
    ('P1','P1.1','Notice of privacy practices','The entity provides notice to data subjects about its privacy practices to meet the objectives of the entity related to privacy.',44),
    ('P1','P2.1','Choice and consent','The entity communicates choices available regarding the collection, use, retention, disclosure, and disposal of personal information to data subjects, and obtains consent where required.',45),
    ('P1','P3.1','Collection limited to identified purposes','Personal information is collected consistent with the objectives of the entity related to privacy and limited to that necessary for the identified purposes.',46),
    ('P1','P4.1','Use, retention and disposal','The entity limits the use of personal information to the purposes identified in its objectives, retains it only as long as needed, and securely disposes of it thereafter.',47),
    ('P1','P5.1','Data subject access','The entity grants identified and authenticated data subjects the ability to access their stored personal information for review and, upon request, provides physical or electronic copies.',48),
    ('P1','P6.1','Disclosure to third parties','The entity discloses personal information to third parties only with the explicit consent of data subjects or as otherwise permitted, and such consent is obtained prior to disclosure.',49),
    ('P1','P7.1','Quality of personal information','The entity collects and maintains accurate, up-to-date, complete, and relevant personal information to meet the objectives of the entity related to privacy.',50),
    ('P1','P8.1','Privacy monitoring and enforcement','The entity implements a process for receiving, addressing, resolving, and communicating the resolution of inquiries, complaints, and disputes from data subjects and others.',51)
) AS v(cat, ref, title, descr, sort)
ON CONFLICT (framework_id, control_ref) DO NOTHING;
