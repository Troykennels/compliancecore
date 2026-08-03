-- =============================================================================
-- Control libraries: CIS Controls v8, NIST SP 800-53 Rev.5, ISO 22301, SAMA CSF
-- ComplianceCore | ORION SOFT LIMITED
--
-- Each block creates its categories first, since none of these frameworks had
-- any seeded. Modelled at the level an organisation is actually assessed at:
-- the 18 CIS Controls, the 800-53 control families, the ISO 22301 clauses, and
-- the SAMA subdomains. Idempotent via uq_framework_controls_ref.
-- =============================================================================

-- ═══════════════════════════ CIS Controls v8 ═════════════════════════════════
WITH fw AS (SELECT id FROM framework_data.frameworks WHERE code = 'CIS_V8')
INSERT INTO framework_data.framework_categories (id, framework_id, code, name, description, sort_order)
SELECT gen_random_uuid(), fw.id, v.code, v.name, v.descr, v.sort
FROM fw, (VALUES
    ('IG1', 'Basic Cyber Hygiene',    'The 56 safeguards every enterprise should implement, appropriate for organisations with limited security expertise.', 1),
    ('IG2', 'Enterprise Safeguards',  'Additional safeguards for enterprises managing IT infrastructure across multiple departments with differing risk profiles.', 2),
    ('IG3', 'Advanced Safeguards',    'Safeguards for mature enterprises with security experts specialising in the different facets of cybersecurity.', 3)
) AS v(code, name, descr, sort)
ON CONFLICT (framework_id, code) DO NOTHING;

WITH fw AS (SELECT id FROM framework_data.frameworks WHERE code = 'CIS_V8')
INSERT INTO framework_data.framework_controls
    (id, framework_id, category_id, control_ref, title, description, sort_order)
SELECT gen_random_uuid(), fw.id,
    (SELECT c.id FROM framework_data.framework_categories c WHERE c.framework_id = fw.id AND c.code = v.cat),
    v.ref, v.title, v.descr, v.sort
FROM fw, (VALUES
    ('IG1','CIS-1','Inventory and Control of Enterprise Assets','Actively manage all enterprise assets connected to the infrastructure, so that the full inventory of devices needing to be monitored and protected is known and accurate.',1),
    ('IG1','CIS-2','Inventory and Control of Software Assets','Actively manage all software on the network so that only authorised software is installed and can execute, and unauthorised software is found and prevented from running.',2),
    ('IG1','CIS-3','Data Protection','Develop processes and technical controls to identify, classify, securely handle, retain and dispose of data.',3),
    ('IG1','CIS-4','Secure Configuration of Enterprise Assets and Software','Establish and maintain the secure configuration of enterprise assets and software, including end-user devices, servers, network devices and applications.',4),
    ('IG1','CIS-5','Account Management','Use processes and tools to assign and manage authorisation to credentials for user, administrator and service accounts.',5),
    ('IG1','CIS-6','Access Control Management','Use processes and tools to create, assign, manage and revoke access credentials and privileges for user, administrator and service accounts.',6),
    ('IG1','CIS-7','Continuous Vulnerability Management','Develop a plan to continuously assess and track vulnerabilities on all enterprise assets, in order to remediate and minimise the window of opportunity for attackers.',7),
    ('IG1','CIS-8','Audit Log Management','Collect, alert on, review and retain audit logs of events that could help detect, understand or recover from an attack.',8),
    ('IG1','CIS-9','Email and Web Browser Protections','Improve protections and detections of threats from email and web vectors, which are opportunities for attackers to manipulate human behaviour.',9),
    ('IG1','CIS-10','Malware Defenses','Prevent or control the installation, spread and execution of malicious applications, code or scripts on enterprise assets.',10),
    ('IG1','CIS-11','Data Recovery','Establish and maintain data recovery practices sufficient to restore in-scope enterprise assets to a pre-incident and trusted state.',11),
    ('IG2','CIS-12','Network Infrastructure Management','Establish, implement and actively manage network devices in order to prevent attackers from exploiting vulnerable network services and access points.',12),
    ('IG2','CIS-13','Network Monitoring and Defense','Operate processes and tooling to establish and maintain comprehensive network monitoring and defence against security threats across the enterprise infrastructure and user base.',13),
    ('IG1','CIS-14','Security Awareness and Skills Training','Establish and maintain a security awareness programme to influence behaviour among the workforce to be security conscious and properly skilled to reduce cybersecurity risks.',14),
    ('IG1','CIS-15','Service Provider Management','Develop a process to evaluate service providers who hold sensitive data, or are responsible for critical IT platforms or processes, to ensure they are protecting those platforms and data appropriately.',15),
    ('IG2','CIS-16','Application Software Security','Manage the security life cycle of in-house developed, hosted or acquired software in order to prevent, detect and remediate security weaknesses before they can impact the enterprise.',16),
    ('IG2','CIS-17','Incident Response Management','Establish a programme to develop and maintain an incident response capability to prepare, detect and quickly respond to an attack.',17),
    ('IG3','CIS-18','Penetration Testing','Test the effectiveness and resiliency of enterprise assets through identifying and exploiting weaknesses in controls, and simulating the objectives and actions of an attacker.',18)
) AS v(cat, ref, title, descr, sort)
ON CONFLICT (framework_id, control_ref) DO NOTHING;

-- ═══════════════════════ NIST SP 800-53 Rev.5 ════════════════════════════════
WITH fw AS (SELECT id FROM framework_data.frameworks WHERE code = 'NIST_800_53')
INSERT INTO framework_data.framework_categories (id, framework_id, code, name, description, sort_order)
SELECT gen_random_uuid(), fw.id, v.code, v.name, v.descr, v.sort
FROM fw, (VALUES
    ('TECH', 'Technical Controls',      'Controls implemented primarily through security mechanisms in hardware, software or firmware.', 1),
    ('OPS',  'Operational Controls',    'Controls implemented and executed primarily by people rather than systems.', 2),
    ('MGMT', 'Management Controls',     'Controls that address the management of risk and information system security.', 3)
) AS v(code, name, descr, sort)
ON CONFLICT (framework_id, code) DO NOTHING;

WITH fw AS (SELECT id FROM framework_data.frameworks WHERE code = 'NIST_800_53')
INSERT INTO framework_data.framework_controls
    (id, framework_id, category_id, control_ref, title, description, sort_order)
SELECT gen_random_uuid(), fw.id,
    (SELECT c.id FROM framework_data.framework_categories c WHERE c.framework_id = fw.id AND c.code = v.cat),
    v.ref, v.title, v.descr, v.sort
FROM fw, (VALUES
    ('TECH','AC','Access Control','Limit information system access to authorised users, processes acting on behalf of authorised users, and devices, and to the types of transactions and functions that authorised users are permitted to exercise.',1),
    ('OPS','AT','Awareness and Training','Ensure that managers and users of organisational systems are made aware of the security risks associated with their activities and of the applicable laws, regulations and policies.',2),
    ('TECH','AU','Audit and Accountability','Create, protect and retain system audit records to enable the monitoring, analysis, investigation and reporting of unlawful or unauthorised system activity.',3),
    ('MGMT','CA','Assessment, Authorization and Monitoring','Periodically assess the security controls in organisational systems to determine whether they are effective, and authorise system operation on that basis.',4),
    ('OPS','CM','Configuration Management','Establish and maintain baseline configurations and inventories of organisational systems throughout their development life cycles.',5),
    ('OPS','CP','Contingency Planning','Establish, maintain and effectively implement plans for emergency response, backup operations and post-disaster recovery for organisational systems.',6),
    ('TECH','IA','Identification and Authentication','Identify system users, processes acting on behalf of users, and devices, and authenticate the identities of those users, processes or devices as a prerequisite to allowing access.',7),
    ('OPS','IR','Incident Response','Establish an operational incident handling capability that includes preparation, detection and analysis, containment, eradication and recovery.',8),
    ('OPS','MA','Maintenance','Perform periodic and timely maintenance on organisational systems, and provide effective controls on the tools, techniques, mechanisms and personnel used to conduct it.',9),
    ('OPS','MP','Media Protection','Protect system media, limit access to information on it to authorised users, and sanitise or destroy it before disposal or release for reuse.',10),
    ('OPS','PE','Physical and Environmental Protection','Limit physical access to systems, equipment and the respective operating environments to authorised individuals, and protect against environmental hazards.',11),
    ('MGMT','PL','Planning','Develop, document, periodically update and implement security plans for organisational systems that describe the controls in place and the rules of behaviour for individuals accessing them.',12),
    ('MGMT','PM','Program Management','Implement an organisation-wide information security programme, including a senior information security officer, resourcing, and a plan of action and milestones process.',13),
    ('OPS','PS','Personnel Security','Ensure that individuals occupying positions of responsibility are trustworthy and meet established security criteria, and that information remains protected during and after personnel actions.',14),
    ('MGMT','PT','Personally Identifiable Information Processing and Transparency','Process personally identifiable information only with authority, and provide notice and consent mechanisms consistent with applicable law.',15),
    ('MGMT','RA','Risk Assessment','Periodically assess the risk to organisational operations, assets and individuals resulting from the operation of organisational systems and the associated processing of information.',16),
    ('MGMT','SA','System and Services Acquisition','Allocate sufficient resources to protect organisational systems, and employ system development life cycle processes and acquisition restrictions that incorporate security.',17),
    ('TECH','SC','System and Communications Protection','Monitor, control and protect communications at the external and key internal boundaries of organisational systems, and employ architectural designs that promote effective security.',18),
    ('TECH','SI','System and Information Integrity','Identify, report and correct system flaws in a timely manner, provide protection from malicious code, and monitor system security alerts and advisories.',19),
    ('MGMT','SR','Supply Chain Risk Management','Identify, assess and mitigate supply chain risks associated with the products and services acquired and used by the organisation.',20)
) AS v(cat, ref, title, descr, sort)
ON CONFLICT (framework_id, control_ref) DO NOTHING;

-- ════════════════════════════ ISO 22301:2019 ═════════════════════════════════
WITH fw AS (SELECT id FROM framework_data.frameworks WHERE code = 'ISO22301')
INSERT INTO framework_data.framework_categories (id, framework_id, code, name, description, sort_order)
SELECT gen_random_uuid(), fw.id, v.code, v.name, v.descr, v.sort
FROM fw, (VALUES
    ('4',  'Context of the Organization', 'Understanding the organisation, interested parties and the scope of the business continuity management system.', 1),
    ('5',  'Leadership',                  'Leadership commitment, policy, and organisational roles and responsibilities.', 2),
    ('6',  'Planning',                    'Actions to address risks and opportunities, and business continuity objectives.', 3),
    ('7',  'Support',                     'Resources, competence, awareness, communication and documented information.', 4),
    ('8',  'Operation',                   'Business impact analysis, risk assessment, strategies, plans, and exercise programmes.', 5),
    ('9',  'Performance Evaluation',      'Monitoring, measurement, internal audit and management review.', 6),
    ('10', 'Improvement',                 'Nonconformity, corrective action and continual improvement.', 7)
) AS v(code, name, descr, sort)
ON CONFLICT (framework_id, code) DO NOTHING;

WITH fw AS (SELECT id FROM framework_data.frameworks WHERE code = 'ISO22301')
INSERT INTO framework_data.framework_controls
    (id, framework_id, category_id, control_ref, title, description, sort_order)
SELECT gen_random_uuid(), fw.id,
    (SELECT c.id FROM framework_data.framework_categories c WHERE c.framework_id = fw.id AND c.code = v.cat),
    v.ref, v.title, v.descr, v.sort
FROM fw, (VALUES
    ('4','22301-4.1','Understanding the organization and its context','Determine external and internal issues relevant to the purpose of the organisation that affect its ability to achieve the intended outcomes of the business continuity management system.',1),
    ('4','22301-4.2','Needs and expectations of interested parties','Determine the interested parties relevant to the BCMS, their requirements, and the legal and regulatory requirements applicable to continuity.',2),
    ('4','22301-4.3','Determining the scope of the BCMS','Determine the boundaries and applicability of the BCMS, including the products and services within scope and any exclusions with justification.',3),
    ('5','22301-5.1','Leadership and commitment','Top management shall demonstrate leadership and commitment with respect to the BCMS, ensuring resources are available and that it achieves its intended outcomes.',4),
    ('5','22301-5.2','Business continuity policy','Establish a business continuity policy appropriate to the purpose of the organisation, communicated within it and available to interested parties.',5),
    ('5','22301-5.3','Roles, responsibilities and authorities','Assign and communicate responsibility and authority for conforming to the standard and for reporting on the performance of the BCMS.',6),
    ('6','22301-6.1','Actions to address risks and opportunities','Determine the risks and opportunities that need to be addressed to give assurance that the BCMS can achieve its intended outcomes and prevent undesired effects.',7),
    ('6','22301-6.2','Business continuity objectives','Establish measurable business continuity objectives consistent with the policy, and plan how they will be achieved.',8),
    ('7','22301-7.1','Resources','Determine and provide the resources needed for the establishment, implementation, maintenance and continual improvement of the BCMS.',9),
    ('7','22301-7.2','Competence','Determine the necessary competence of persons doing work that affects business continuity performance, and ensure they are competent through education, training or experience.',10),
    ('7','22301-7.3','Awareness','Ensure that persons doing work under the control of the organisation are aware of the policy, their contribution to the BCMS and the implications of not conforming.',11),
    ('7','22301-7.4','Communication','Determine the internal and external communications relevant to the BCMS, including what, when, with whom and how to communicate during a disruption.',12),
    ('7','22301-7.5','Documented information','Maintain the documented information required by the standard and determined as necessary for the effectiveness of the BCMS, under appropriate control.',13),
    ('8','22301-8.1','Operational planning and control','Plan, implement and control the processes needed to meet requirements and to implement the actions determined in planning.',14),
    ('8','22301-8.2','Business impact analysis and risk assessment','Implement and maintain a systematic process for analysing business impact over time and assessing the risks of disruption to prioritised activities.',15),
    ('8','22301-8.3','Business continuity strategies and solutions','Identify and select business continuity strategies based on the outputs of the BIA and risk assessment, including resource requirements for each solution.',16),
    ('8','22301-8.4','Business continuity plans and procedures','Establish and document procedures to manage the organisation through a disruption, including response structure, warning and communication, and recovery plans.',17),
    ('8','22301-8.5','Exercise programme','Implement and maintain an exercise and testing programme to validate over time the effectiveness of business continuity strategies and solutions.',18),
    ('8','22301-8.6','Evaluation of business continuity documentation and capabilities','Evaluate the suitability, adequacy and effectiveness of the BIA, risk assessment, strategies, solutions, plans and procedures at planned intervals.',19),
    ('9','22301-9.1','Monitoring, measurement, analysis and evaluation','Determine what needs to be monitored and measured, the methods to be used, and when the results shall be analysed and evaluated.',20),
    ('9','22301-9.2','Internal audit','Conduct internal audits at planned intervals to provide information on whether the BCMS conforms to requirements and is effectively implemented and maintained.',21),
    ('9','22301-9.3','Management review','Top management shall review the BCMS at planned intervals to ensure its continuing suitability, adequacy and effectiveness.',22),
    ('10','22301-10.1','Nonconformity and corrective action','React to nonconformity, evaluate the need for action to eliminate its causes, implement the action needed and review its effectiveness.',23),
    ('10','22301-10.2','Continual improvement','Continually improve the suitability, adequacy and effectiveness of the business continuity management system.',24)
) AS v(cat, ref, title, descr, sort)
ON CONFLICT (framework_id, control_ref) DO NOTHING;

-- ═══════════════════════ SAMA Cyber Security Framework ═══════════════════════
WITH fw AS (SELECT id FROM framework_data.frameworks WHERE code = 'SAMA_CSF')
INSERT INTO framework_data.framework_categories (id, framework_id, code, name, description, sort_order)
SELECT gen_random_uuid(), fw.id, v.code, v.name, v.descr, v.sort
FROM fw, (VALUES
    ('1', 'Cyber Security Leadership and Governance', 'Direction, governance structures and accountability for cyber security within the member organisation.', 1),
    ('2', 'Cyber Security Risk Management and Compliance', 'Identification and management of cyber security risk, and compliance with regulatory requirements.', 2),
    ('3', 'Cyber Security Operations and Technology', 'The operational and technical controls protecting information assets.', 3),
    ('4', 'Third Party Cyber Security', 'Management of cyber security risk arising from outsourcing, cloud and other third parties.', 4)
) AS v(code, name, descr, sort)
ON CONFLICT (framework_id, code) DO NOTHING;

WITH fw AS (SELECT id FROM framework_data.frameworks WHERE code = 'SAMA_CSF')
INSERT INTO framework_data.framework_controls
    (id, framework_id, category_id, control_ref, title, description, sort_order)
SELECT gen_random_uuid(), fw.id,
    (SELECT c.id FROM framework_data.framework_categories c WHERE c.framework_id = fw.id AND c.code = v.cat),
    v.ref, v.title, v.descr, v.sort
FROM fw, (VALUES
    ('1','SAMA-3.1.1','Cyber security governance','A cyber security governance structure shall be defined, approved by the board, and implemented across the member organisation.',1),
    ('1','SAMA-3.1.2','Cyber security strategy','A cyber security strategy shall be defined and aligned with the strategic objectives of the member organisation and with SAMA requirements.',2),
    ('1','SAMA-3.1.3','Cyber security policy','A cyber security policy shall be defined, approved by the board, communicated to relevant stakeholders, and reviewed periodically.',3),
    ('1','SAMA-3.1.4','Cyber security roles and responsibilities','Roles and responsibilities for cyber security shall be defined and allocated, including an independent cyber security function reporting to the board or a delegated committee.',4),
    ('1','SAMA-3.1.5','Cyber security in project management','Cyber security requirements shall be included in project management methodology, from initiation through to closure.',5),
    ('1','SAMA-3.1.6','Cyber security awareness','A cyber security awareness programme shall be defined and conducted for staff, third parties and customers.',6),
    ('1','SAMA-3.1.7','Cyber security training','Staff with cyber security responsibilities shall receive role-specific training to maintain the required skills and certification.',7),
    ('2','SAMA-3.2.1','Cyber security risk management','A cyber security risk management process shall be defined, approved and implemented, aligned with the enterprise risk management process.',8),
    ('2','SAMA-3.2.2','Regulatory compliance','A process shall be in place to identify and comply with applicable cyber security regulatory requirements, including SAMA circulars.',9),
    ('2','SAMA-3.2.3','Compliance with international industry standards','Compliance with mandatory international standards, such as PCI DSS and SWIFT CSP where applicable, shall be monitored and evidenced.',10),
    ('2','SAMA-3.2.4','Cyber security review','The effectiveness of cyber security controls shall be reviewed periodically by an independent party.',11),
    ('2','SAMA-3.2.5','Cyber security audits','Cyber security audits shall be performed in accordance with an approved audit plan, with findings tracked to closure.',12),
    ('3','SAMA-3.3.1','Human resources','Cyber security requirements shall be addressed prior to, during and at the termination of employment, including screening and confidentiality agreements.',13),
    ('3','SAMA-3.3.2','Physical security','Physical security controls shall protect information assets and processing facilities from unauthorised access and environmental threats.',14),
    ('3','SAMA-3.3.3','Asset management','An inventory of information assets shall be maintained, with ownership assigned and classification applied.',15),
    ('3','SAMA-3.3.4','Cyber security architecture','A cyber security architecture shall be defined and maintained, covering segmentation, defence in depth and secure design principles.',16),
    ('3','SAMA-3.3.5','Identity and access management','Access to information assets shall be granted on a need-to-know and least-privilege basis, with periodic review and multi-factor authentication for privileged and remote access.',17),
    ('3','SAMA-3.3.6','Application security','Security requirements shall be defined for application development and acquisition, including secure coding and security testing before release.',18),
    ('3','SAMA-3.3.7','Change management','Changes to information assets shall follow a defined change management process including cyber security impact assessment.',19),
    ('3','SAMA-3.3.8','Infrastructure security','Infrastructure shall be hardened and securely configured, with malware protection, patching and vulnerability management applied.',20),
    ('3','SAMA-3.3.9','Cryptography','Cryptographic solutions and key management shall be defined and applied to protect confidentiality, integrity and authenticity of information.',21),
    ('3','SAMA-3.3.10','Bring your own device','Cyber security requirements shall be defined and enforced for personally owned devices used to access information assets.',22),
    ('3','SAMA-3.3.11','Secure disposal of information assets','Information assets shall be securely disposed of or sanitised when no longer required.',23),
    ('3','SAMA-3.3.12','Payment systems security','Dedicated cyber security controls shall protect payment systems, including transaction monitoring and fraud detection.',24),
    ('3','SAMA-3.3.13','Electronic banking services','Cyber security controls shall protect electronic banking channels, including customer authentication and session management.',25),
    ('3','SAMA-3.3.14','Cyber security event management','Cyber security events shall be logged, monitored and analysed through a security operations capability.',26),
    ('3','SAMA-3.3.15','Cyber security incident management','A cyber security incident management process shall be defined, including classification, escalation, SAMA notification and post-incident review.',27),
    ('3','SAMA-3.3.16','Threat management','A threat intelligence capability shall be established to identify and respond to relevant cyber threats.',28),
    ('3','SAMA-3.3.17','Vulnerability management','Vulnerabilities shall be identified, assessed and remediated within defined timeframes, supported by periodic penetration testing.',29),
    ('4','SAMA-3.4.1','Contract and vendor management','Cyber security requirements shall be defined in contracts with third parties, with the right to audit and clear responsibilities.',30),
    ('4','SAMA-3.4.2','Outsourcing','Outsourcing arrangements shall comply with SAMA outsourcing regulations and include cyber security risk assessment and ongoing monitoring.',31),
    ('4','SAMA-3.4.3','Cloud computing','Cyber security requirements for cloud services shall be defined, including data residency, segregation and exit provisions.',32)
) AS v(cat, ref, title, descr, sort)
ON CONFLICT (framework_id, control_ref) DO NOTHING;
