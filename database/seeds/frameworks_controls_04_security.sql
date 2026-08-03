-- =============================================================================
-- Security frameworks — PCI DSS v4.0, HIPAA Security Rule, NIST CSF 2.0
-- ComplianceCore | ORION SOFT LIMITED
--
-- These three frameworks had no categories seeded, so each block creates its
-- categories before its controls.
-- =============================================================================

-- ═══════════════════════════════ PCI DSS v4.0 ════════════════════════════════
WITH fw AS (SELECT id FROM framework_data.frameworks WHERE code = 'PCIDSS')
INSERT INTO framework_data.framework_categories (id, framework_id, code, name, description, sort_order)
SELECT gen_random_uuid(), fw.id, v.code, v.name, v.descr, v.sort
FROM fw, (VALUES
    ('R1',  'Install and Maintain Network Security Controls', 'Network security controls protecting the cardholder data environment.', 1),
    ('R2',  'Apply Secure Configurations',                    'Secure configuration of all system components.', 2),
    ('R3',  'Protect Stored Account Data',                    'Protection of stored cardholder and sensitive authentication data.', 3),
    ('R4',  'Protect Data in Transmission',                   'Strong cryptography for account data transmitted over open, public networks.', 4),
    ('R5',  'Protect Against Malicious Software',             'Anti-malware protection across the environment.', 5),
    ('R6',  'Develop and Maintain Secure Systems',            'Secure development and timely patching of systems and software.', 6),
    ('R7',  'Restrict Access by Business Need to Know',       'Least-privilege access to system components and cardholder data.', 7),
    ('R8',  'Identify Users and Authenticate Access',          'Identification and authentication of all access to system components.', 8),
    ('R9',  'Restrict Physical Access',                       'Physical access controls over cardholder data and media.', 9),
    ('R10', 'Log and Monitor All Access',                     'Logging and monitoring of all access to system components and cardholder data.', 10),
    ('R11', 'Test Security of Systems and Networks',          'Regular testing of security systems, processes and networks.', 11),
    ('R12', 'Support Information Security with Policies',     'Organisational policies and programmes supporting information security.', 12)
) AS v(code, name, descr, sort)
ON CONFLICT (framework_id, code) DO NOTHING;

WITH fw AS (SELECT id FROM framework_data.frameworks WHERE code = 'PCIDSS')
INSERT INTO framework_data.framework_controls
    (id, framework_id, category_id, control_ref, title, description, sort_order)
SELECT gen_random_uuid(), fw.id,
    (SELECT c.id FROM framework_data.framework_categories c WHERE c.framework_id = fw.id AND c.code = v.cat),
    v.ref, v.title, v.descr, v.sort
FROM fw, (VALUES
    ('R1','1.1','Processes and mechanisms for network security controls are defined','All security policies and operational procedures for Requirement 1 are documented, kept up to date, in use and known to all affected parties.',1),
    ('R1','1.2','Network security controls are configured and maintained','Configuration standards for network security controls are defined, implemented and maintained, and changes are approved and managed.',2),
    ('R1','1.3','Network access to and from the cardholder data environment is restricted','Inbound and outbound traffic to the CDE is restricted to that which is necessary, and all other traffic is explicitly denied.',3),
    ('R1','1.4','Network connections between trusted and untrusted networks are controlled','Controls restrict connections between trusted and untrusted networks, including anti-spoofing measures and restrictions on stored account data.',4),
    ('R1','1.5','Risks from computing devices connecting to both untrusted networks and the CDE are mitigated','Security controls are implemented on any device that connects to both untrusted networks and the CDE.',5),
    ('R2','2.1','Processes and mechanisms for applying secure configurations are defined','Policies and procedures for Requirement 2 are documented, current, in use and known to affected parties.',6),
    ('R2','2.2','System components are configured and managed securely','Configuration standards are developed, applied to all system components, and cover vendor defaults, unnecessary services and security parameters.',7),
    ('R2','2.3','Wireless environments are configured and managed securely','Wireless vendor defaults are changed and wireless environments are secured with strong encryption and authentication.',8),
    ('R3','3.1','Processes and mechanisms for protecting stored account data are defined','Policies and procedures for Requirement 3 are documented, current, in use and known to affected parties.',9),
    ('R3','3.2','Storage of account data is kept to a minimum','Data retention and disposal policies limit stored account data to what is required, with defined retention periods and secure deletion.',10),
    ('R3','3.3','Sensitive authentication data is not stored after authorization','Full track data, card verification codes and PIN data are not retained after authorization, even if encrypted.',11),
    ('R3','3.4','Access to displays of full PAN and ability to copy PAN is restricted','The primary account number is masked when displayed, with only personnel with a legitimate business need able to view more than the first six and last four digits.',12),
    ('R3','3.5','Primary account number is secured wherever it is stored','PAN is rendered unreadable anywhere it is stored using one-way hashes, truncation, tokens, or strong cryptography.',13),
    ('R3','3.6','Cryptographic keys used to protect stored account data are secured','Key-management procedures protect keys against disclosure and misuse, restricting access to the fewest custodians necessary.',14),
    ('R3','3.7','Key management processes are defined and implemented','Key generation, distribution, storage, rotation, retirement and replacement follow documented procedures across the full key lifecycle.',15),
    ('R4','4.1','Processes and mechanisms for protecting data in transit are defined','Policies and procedures for Requirement 4 are documented, current, in use and known to affected parties.',16),
    ('R4','4.2','PAN is protected with strong cryptography during transmission','Strong cryptography and security protocols protect PAN during transmission over open, public networks, and PAN is never sent by unprotected end-user messaging.',17),
    ('R5','5.1','Processes and mechanisms for protecting against malicious software are defined','Policies and procedures for Requirement 5 are documented, current, in use and known to affected parties.',18),
    ('R5','5.2','Malicious software is prevented or detected and addressed','An anti-malware solution is deployed on all system components at risk, kept current, and performs periodic scans and active scanning.',19),
    ('R5','5.3','Anti-malware mechanisms are active, maintained and monitored','Anti-malware mechanisms cannot be disabled or altered by users unless specifically authorised for a limited period, and generate audit logs.',20),
    ('R5','5.4','Anti-phishing mechanisms protect users','Processes and automated mechanisms detect and protect personnel against phishing attacks.',21),
    ('R6','6.1','Processes and mechanisms for developing and maintaining secure systems are defined','Policies and procedures for Requirement 6 are documented, current, in use and known to affected parties.',22),
    ('R6','6.2','Bespoke and custom software is developed securely','Software is developed based on industry standards and secure coding practices, with developers trained annually and code reviewed before release.',23),
    ('R6','6.3','Security vulnerabilities are identified and addressed','Vulnerabilities are identified from reputable sources, assigned a risk ranking, and patches for critical or high-risk issues are installed within one month.',24),
    ('R6','6.4','Public-facing web applications are protected against attacks','Public-facing web applications are protected by regular vulnerability assessment or an automated technical solution such as a web application firewall.',25),
    ('R6','6.5','Changes to all system components are managed securely','Change control procedures separate environments, restrict access, and require testing and approval before production deployment.',26),
    ('R7','7.1','Processes and mechanisms for restricting access are defined','Policies and procedures for Requirement 7 are documented, current, in use and known to affected parties.',27),
    ('R7','7.2','Access to system components and data is appropriately defined and assigned','An access control model assigns privileges based on job classification and function, granting least privilege required to perform the role.',28),
    ('R7','7.3','Access to system components and data is managed via an access control system','An access control system enforces the defined policy across all system components and denies all access by default.',29),
    ('R8','8.1','Processes and mechanisms for identifying users are defined','Policies and procedures for Requirement 8 are documented, current, in use and known to affected parties.',30),
    ('R8','8.2','User identification and account lifecycle are managed','Every user is assigned a unique ID, shared accounts are controlled, and accounts are provisioned, reviewed and revoked through a defined lifecycle.',31),
    ('R8','8.3','Strong authentication for users and administrators is established','Authentication factors meet minimum strength requirements, credentials are protected in storage and transit, and passwords are changed on suspicion of compromise.',32),
    ('R8','8.4','Multi-factor authentication is implemented to secure access to the CDE','MFA is required for all remote network access, all non-console administrative access, and all access into the cardholder data environment.',33),
    ('R8','8.5','Multi-factor authentication systems are configured to prevent misuse','MFA systems are not susceptible to replay attacks, cannot be bypassed, and require at least two different factor types to succeed.',34),
    ('R8','8.6','Use of application and system accounts is managed','Interactive use of system and application accounts is prevented or tightly controlled, and their credentials are protected and rotated.',35),
    ('R9','9.1','Processes and mechanisms for restricting physical access are defined','Policies and procedures for Requirement 9 are documented, current, in use and known to affected parties.',36),
    ('R9','9.2','Physical access controls manage entry into facilities and systems','Facility entry controls restrict and monitor physical access to areas within the CDE, including individual access points and publicly accessible network jacks.',37),
    ('R9','9.3','Physical access for personnel and visitors is authorised and managed','Access is authorised based on role, visitors are identified and escorted, and access is revoked immediately on termination.',38),
    ('R9','9.4','Media with cardholder data is securely stored, accessed, distributed and destroyed','Media is classified, physically secured, tracked when moved, and destroyed when no longer needed for business or legal reasons.',39),
    ('R9','9.5','Point-of-interaction devices are protected from tampering','POI devices are inventoried, periodically inspected for tampering or substitution, and personnel are trained to detect and report suspicious behaviour.',40),
    ('R10','10.1','Processes and mechanisms for logging and monitoring are defined','Policies and procedures for Requirement 10 are documented, current, in use and known to affected parties.',41),
    ('R10','10.2','Audit logs capture all events needed to detect anomalies','Audit logs record individual user access, administrative actions, access to logs, invalid access attempts, authentication changes and system-level object changes.',42),
    ('R10','10.3','Audit logs are protected from destruction and unauthorised modification','Log files are restricted to those with a job-related need, protected from modification, and promptly backed up to a secure, central location.',43),
    ('R10','10.4','Audit logs are reviewed to identify anomalies or suspicious activity','Security event logs are reviewed at least daily, using automated mechanisms where possible, and exceptions are addressed.',44),
    ('R10','10.5','Audit log history is retained and available for analysis','At least twelve months of audit log history is retained, with the most recent three months immediately available for analysis.',45),
    ('R10','10.6','Time-synchronisation mechanisms support consistent time settings','System clocks and time are synchronised using approved time-synchronisation technology, and time data is protected.',46),
    ('R10','10.7','Failures of critical security control systems are detected and responded to','Failures of critical security controls are detected, alerted and responded to promptly, with the cause documented and remediated.',47),
    ('R11','11.1','Processes and mechanisms for testing security are defined','Policies and procedures for Requirement 11 are documented, current, in use and known to affected parties.',48),
    ('R11','11.2','Wireless access points are identified and monitored','Authorised and unauthorised wireless access points are managed, with testing performed at least quarterly to detect rogue devices.',49),
    ('R11','11.3','External and internal vulnerabilities are regularly identified and addressed','Internal and external vulnerability scans are performed at least quarterly and after significant change, with rescans until passing results are achieved.',50),
    ('R11','11.4','External and internal penetration testing is performed','A penetration testing methodology is defined and executed at least annually and after significant infrastructure or application changes, with findings corrected and retested.',51),
    ('R11','11.5','Network intrusions and unexpected file changes are detected and responded to','Intrusion detection or prevention techniques monitor traffic at the CDE perimeter and critical points, and a change-detection mechanism alerts on unauthorised modification of critical files.',52),
    ('R11','11.6','Unauthorised changes on payment pages are detected and responded to','A change- and tamper-detection mechanism alerts personnel to unauthorised modification of the HTTP headers and content of payment pages as received by the consumer browser.',53),
    ('R12','12.1','A comprehensive information security policy is established and maintained','An overall information security policy is established, published, maintained, reviewed at least annually, and disseminated to all relevant personnel.',54),
    ('R12','12.2','Acceptable use policies for end-user technologies are defined','Acceptable use policies govern end-user technologies, requiring explicit approval, acceptable uses, and a list of approved products and locations.',55),
    ('R12','12.3','Risks to the cardholder data environment are formally identified and managed','A targeted risk analysis is performed for each requirement that permits flexibility, and risks to the CDE are identified, assessed and managed.',56),
    ('R12','12.4','PCI DSS compliance is managed','Responsibility for PCI DSS compliance is formally assigned, and for service providers, executive management establishes a programme with defined charter and reporting.',57),
    ('R12','12.5','PCI DSS scope is documented and validated','An inventory of system components in scope is maintained, and PCI DSS scope is documented and confirmed at least annually and on significant change.',58),
    ('R12','12.6','Security awareness education is an ongoing activity','A formal security awareness programme educates personnel on the security policy and their role in protecting account data, on hire and at least annually.',59),
    ('R12','12.7','Personnel are screened to reduce risk from insider threats','Potential personnel who will have access to the cardholder data environment are screened prior to hire, within the limits of local law.',60),
    ('R12','12.8','Risk to information assets from third-party service providers is managed','Third-party service providers with access to account data are inventoried, subject to written agreements acknowledging their responsibility, engaged through due diligence, and monitored at least annually.',61),
    ('R12','12.9','Third-party service providers support their customers PCI DSS compliance','Service providers acknowledge in writing their responsibility for the security of account data they possess and support customer requests for compliance information.',62),
    ('R12','12.10','Suspected and confirmed security incidents are responded to immediately','An incident response plan exists and is tested at least annually, covering roles, communication, containment, legal requirements and business recovery.',63)
) AS v(cat, ref, title, descr, sort)
ON CONFLICT (framework_id, control_ref) DO NOTHING;

-- ══════════════════════════════ HIPAA Security Rule ══════════════════════════
WITH fw AS (SELECT id FROM framework_data.frameworks WHERE code = 'HIPAA')
INSERT INTO framework_data.framework_categories (id, framework_id, code, name, description, sort_order)
SELECT gen_random_uuid(), fw.id, v.code, v.name, v.descr, v.sort
FROM fw, (VALUES
    ('ADM', 'Administrative Safeguards', 'Administrative actions, policies and procedures to manage the security of electronic protected health information.', 1),
    ('PHY', 'Physical Safeguards',       'Physical measures, policies and procedures to protect electronic information systems and related buildings and equipment.', 2),
    ('TEC', 'Technical Safeguards',      'Technology and related policies and procedures that protect electronic protected health information and control access to it.', 3),
    ('ORG', 'Organizational Requirements','Business associate contracts and other arrangements required by the Rule.', 4),
    ('BRE', 'Breach Notification',       'Requirements for notifying individuals, the Secretary and the media following a breach of unsecured PHI.', 5)
) AS v(code, name, descr, sort)
ON CONFLICT (framework_id, code) DO NOTHING;

WITH fw AS (SELECT id FROM framework_data.frameworks WHERE code = 'HIPAA')
INSERT INTO framework_data.framework_controls
    (id, framework_id, category_id, control_ref, title, description, sort_order)
SELECT gen_random_uuid(), fw.id,
    (SELECT c.id FROM framework_data.framework_categories c WHERE c.framework_id = fw.id AND c.code = v.cat),
    v.ref, v.title, v.descr, v.sort
FROM fw, (VALUES
    ('ADM','164.308(a)(1)(i)','Security management process','Implement policies and procedures to prevent, detect, contain and correct security violations, including risk analysis, risk management, a sanction policy and information system activity review.',1),
    ('ADM','164.308(a)(2)','Assigned security responsibility','Identify the security official who is responsible for the development and implementation of the policies and procedures required by the Security Rule.',2),
    ('ADM','164.308(a)(3)(i)','Workforce security','Implement policies and procedures to ensure that all members of the workforce have appropriate access to electronic protected health information and to prevent those who do not have access from obtaining it.',3),
    ('ADM','164.308(a)(4)(i)','Information access management','Implement policies and procedures for authorizing access to electronic protected health information consistent with the applicable requirements of the Privacy Rule.',4),
    ('ADM','164.308(a)(5)(i)','Security awareness and training','Implement a security awareness and training program for all members of the workforce, including security reminders, protection from malicious software, log-in monitoring and password management.',5),
    ('ADM','164.308(a)(6)(i)','Security incident procedures','Implement policies and procedures to address security incidents, including identifying and responding to suspected or known incidents and documenting outcomes.',6),
    ('ADM','164.308(a)(7)(i)','Contingency plan','Establish policies and procedures for responding to an emergency or other occurrence that damages systems containing electronic protected health information, including data backup, disaster recovery and emergency mode operation plans.',7),
    ('ADM','164.308(a)(8)','Evaluation','Perform a periodic technical and non-technical evaluation that establishes the extent to which security policies and procedures meet the requirements of the Security Rule.',8),
    ('ADM','164.308(b)(1)','Business associate contracts and other arrangements','Obtain satisfactory assurances that a business associate will appropriately safeguard electronic protected health information it creates, receives, maintains or transmits.',9),
    ('PHY','164.310(a)(1)','Facility access controls','Implement policies and procedures to limit physical access to electronic information systems and the facilities in which they are housed, while ensuring that properly authorized access is allowed.',10),
    ('PHY','164.310(b)','Workstation use','Implement policies and procedures that specify the proper functions to be performed, the manner in which those functions are to be performed, and the physical attributes of the surroundings of a specific workstation.',11),
    ('PHY','164.310(c)','Workstation security','Implement physical safeguards for all workstations that access electronic protected health information to restrict access to authorized users.',12),
    ('PHY','164.310(d)(1)','Device and media controls','Implement policies and procedures that govern the receipt and removal of hardware and electronic media containing electronic protected health information into and out of a facility, and their movement within it.',13),
    ('TEC','164.312(a)(1)','Access control','Implement technical policies and procedures for electronic information systems that maintain electronic protected health information to allow access only to those persons or software programs that have been granted access rights, including unique user identification and emergency access procedures.',14),
    ('TEC','164.312(b)','Audit controls','Implement hardware, software and procedural mechanisms that record and examine activity in information systems that contain or use electronic protected health information.',15),
    ('TEC','164.312(c)(1)','Integrity','Implement policies and procedures to protect electronic protected health information from improper alteration or destruction.',16),
    ('TEC','164.312(d)','Person or entity authentication','Implement procedures to verify that a person or entity seeking access to electronic protected health information is the one claimed.',17),
    ('TEC','164.312(e)(1)','Transmission security','Implement technical security measures to guard against unauthorized access to electronic protected health information that is being transmitted over an electronic communications network, including integrity controls and encryption.',18),
    ('ORG','164.314(a)(1)','Business associate contract requirements','Ensure that business associate contracts provide that the business associate will comply with the applicable requirements of the Security Rule and report security incidents.',19),
    ('ORG','164.316(a)','Policies and procedures','Implement reasonable and appropriate policies and procedures to comply with the standards and implementation specifications of the Security Rule.',20),
    ('ORG','164.316(b)(1)','Documentation and retention','Maintain the required policies, procedures and actions in written or electronic form and retain the documentation for six years from the date of creation or last effective date, whichever is later.',21),
    ('BRE','164.404','Notification to individuals','Following the discovery of a breach of unsecured protected health information, notify each affected individual without unreasonable delay and in no case later than 60 days after discovery.',22),
    ('BRE','164.406','Notification to the media','For a breach affecting more than 500 residents of a State or jurisdiction, notify prominent media outlets serving that State or jurisdiction.',23),
    ('BRE','164.408','Notification to the Secretary','Notify the Secretary of Health and Human Services of breaches of unsecured protected health information, contemporaneously for breaches of 500 or more individuals and annually for smaller breaches.',24),
    ('BRE','164.410','Notification by a business associate','A business associate shall notify the covered entity of a breach of unsecured protected health information without unreasonable delay and no later than 60 days after discovery.',25)
) AS v(cat, ref, title, descr, sort)
ON CONFLICT (framework_id, control_ref) DO NOTHING;

-- ═══════════════════════════════ NIST CSF 2.0 ════════════════════════════════
WITH fw AS (SELECT id FROM framework_data.frameworks WHERE code = 'NIST_CSF')
INSERT INTO framework_data.framework_categories (id, framework_id, code, name, description, sort_order)
SELECT gen_random_uuid(), fw.id, v.code, v.name, v.descr, v.sort
FROM fw, (VALUES
    ('GV', 'Govern',   'The organization cybersecurity risk management strategy, expectations and policy are established, communicated and monitored.', 1),
    ('ID', 'Identify', 'The organization current cybersecurity risks are understood.', 2),
    ('PR', 'Protect',  'Safeguards to manage the organization cybersecurity risks are used.', 3),
    ('DE', 'Detect',   'Possible cybersecurity attacks and compromises are found and analyzed.', 4),
    ('RS', 'Respond',  'Actions regarding a detected cybersecurity incident are taken.', 5),
    ('RC', 'Recover',  'Assets and operations affected by a cybersecurity incident are restored.', 6)
) AS v(code, name, descr, sort)
ON CONFLICT (framework_id, code) DO NOTHING;

WITH fw AS (SELECT id FROM framework_data.frameworks WHERE code = 'NIST_CSF')
INSERT INTO framework_data.framework_controls
    (id, framework_id, category_id, control_ref, title, description, sort_order)
SELECT gen_random_uuid(), fw.id,
    (SELECT c.id FROM framework_data.framework_categories c WHERE c.framework_id = fw.id AND c.code = v.cat),
    v.ref, v.title, v.descr, v.sort
FROM fw, (VALUES
    ('GV','GV.OC','Organizational Context','The circumstances — mission, stakeholder expectations, dependencies, and legal, regulatory and contractual requirements — surrounding the organization cybersecurity risk management decisions are understood.',1),
    ('GV','GV.RM','Risk Management Strategy','The organization priorities, constraints, risk tolerance and appetite statements, and assumptions are established, communicated and used to support operational risk decisions.',2),
    ('GV','GV.RR','Roles, Responsibilities and Authorities','Cybersecurity roles, responsibilities and authorities to foster accountability, performance assessment and continuous improvement are established and communicated.',3),
    ('GV','GV.PO','Policy','Organizational cybersecurity policy is established, communicated and enforced.',4),
    ('GV','GV.OV','Oversight','Results of organization-wide cybersecurity risk management activities and performance are used to inform, improve and adjust the risk management strategy.',5),
    ('GV','GV.SC','Cybersecurity Supply Chain Risk Management','Cyber supply chain risk management processes are identified, established, managed, monitored and improved by organizational stakeholders.',6),
    ('ID','ID.AM','Asset Management','Assets — data, hardware, software, systems, facilities, services and people — that enable the organization to achieve business purposes are identified and managed consistent with their relative importance to objectives and risk strategy.',7),
    ('ID','ID.RA','Risk Assessment','The cybersecurity risk to the organization, assets and individuals is understood by the organization.',8),
    ('ID','ID.IM','Improvement','Improvements to organizational cybersecurity risk management processes, procedures and activities are identified across all Framework Functions.',9),
    ('PR','PR.AA','Identity Management, Authentication and Access Control','Access to physical and logical assets is limited to authorized users, services and hardware, and is managed commensurate with the assessed risk of unauthorized access.',10),
    ('PR','PR.AT','Awareness and Training','The organization personnel are provided with cybersecurity awareness and training so that they can perform their cybersecurity-related tasks.',11),
    ('PR','PR.DS','Data Security','Data are managed consistent with the organization risk strategy to protect the confidentiality, integrity and availability of information.',12),
    ('PR','PR.PS','Platform Security','The hardware, software and services of physical and virtual platforms are managed consistent with the organization risk strategy to protect their confidentiality, integrity and availability.',13),
    ('PR','PR.IR','Technology Infrastructure Resilience','Security architectures are managed with the organization risk strategy to protect asset confidentiality, integrity and availability, and organizational resilience.',14),
    ('DE','DE.CM','Continuous Monitoring','Assets are monitored to find anomalies, indicators of compromise and other potentially adverse events.',15),
    ('DE','DE.AE','Adverse Event Analysis','Anomalies, indicators of compromise and other potentially adverse events are analyzed to characterize the events and detect cybersecurity incidents.',16),
    ('RS','RS.MA','Incident Management','Responses to detected cybersecurity incidents are managed.',17),
    ('RS','RS.AN','Incident Analysis','Investigations are conducted to ensure effective response and support forensics and recovery activities.',18),
    ('RS','RS.CO','Incident Response Reporting and Communication','Response activities are coordinated with internal and external stakeholders as required by laws, regulations or policies.',19),
    ('RS','RS.MI','Incident Mitigation','Activities are performed to prevent expansion of an event and mitigate its effects.',20),
    ('RC','RC.RP','Incident Recovery Plan Execution','Restoration activities are performed to ensure operational availability of systems and services affected by cybersecurity incidents.',21),
    ('RC','RC.CO','Incident Recovery Communication','Restoration activities are coordinated with internal and external parties.',22)
) AS v(cat, ref, title, descr, sort)
ON CONFLICT (framework_id, control_ref) DO NOTHING;
