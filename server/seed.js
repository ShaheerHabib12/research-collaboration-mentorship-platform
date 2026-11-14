/**
 * seed.js - demo data. Mirrors the sample data used by the front-end
 * prototype so the demo video, tests and screenshots stay reproducible.
 * Every demo account shares the password below, so one bcrypt hash is
 * computed (each registered account still gets its own random salt).
 */
'use strict';
/** Hashed once per process so "Reset demo data" does not change the hash (and so does not sign everyone out). */
let sharedHash = null;
/** The real administrator (not a demo account). Its password is never the demo password: RCMP_ADMIN_PASSWORD, or a random one shown once at seeding. */
const ADMIN_EMAIL = (process.env.RCMP_ADMIN_EMAIL || 'muhammad.habib@myport.ac.uk').toLowerCase();
const ADMIN_NAME = process.env.RCMP_ADMIN_NAME || 'Muhammad Habib';
let lastAdminPassword = null;
const Auth = require('./auth');
const C = require('../shared/constants');
const DEMO_PASSWORD = 'Demo@1234', COMP_CONFIG = C.COMP_CONFIG;
const H = 3600 * 1000, D = 24 * H;
/** Current time in ms. */
function now() { return Date.now(); }
/** Timestamp `h` hours ago. */
function ago(h) { return now() - h * H; }
/** ISO date `d` days from now. */
function inDays(d) { return new Date(now() + d * D).toISOString().slice(0, 10); }
/** Deep copy of a JSON-safe value. */
function clone(o) { return JSON.parse(JSON.stringify(o)); }
  /** Demo data: users, projects, requests, agreements, tasks, plans, statements. Passwords share one cached hash. */
  function buildSeed(shared, adminHash) {
    var pw = function () { return shared; };
    function U(id, email, role, name, headline, inst, dept, interests, skills, extra) {
      var u = { id: id, email: email, pw: pw(email), role: role, status: 'active', name: name, headline: headline, institution: inst, department: dept, interests: interests, skills: skills, experience: '', availability: { hours: 6, days: ['Tue', 'Thu'], note: '' }, preferredRoles: [], languages: ['English'], assistance: [], link: '', visibility: { overall: 'listed', fields: { institution: 'public', experience: 'public', availability: 'public', link: 'team' } }, createdAt: ago(24 * 60) };
      Object.assign(u, extra || {}); return u;
    }
    // hashPw salts per-email so login can recompute: salt is stored inside the string.
    var realAdmin = U('USR-099', ADMIN_EMAIL, 'admin', ADMIN_NAME, 'Platform administrator', 'University of Portsmouth', '', [], []);
    realAdmin.pw = adminHash;
    var users = [
      realAdmin,
      U('USR-100', 'admin@rcmp.example', 'admin', 'Jordan Hale', 'Platform moderator and compensation approver', 'RCMP Platform Team', '', [], []),
      U('USR-101', 'aisha@port.ac.uk', 'student', 'Aisha Rahman', 'MSc Data Science student interested in sleep and wellbeing research', 'University of Portsmouth', 'School of Computing', ['Student wellbeing', 'Sleep science', 'Health analytics'], ['Python', 'Statistics', 'Survey design'], { experience: 'Completed a BSc dissertation on wearable-sensor data. Looking for a clinical or psychology partner for a first-year wellbeing study.', availability: { hours: 8, days: ['Mon', 'Wed', 'Fri'], note: 'Evenings after 5pm UK time' }, preferredRoles: ['Data analyst', 'Co-author'], languages: ['English', 'Urdu'], assistance: ['Methodology review', 'Statistics support'], link: 'https://example.com/aisha-portfolio' }),
      U('USR-102', 'elena.vance@port.ac.uk', 'researcher', 'Dr. Elena Vance', 'Senior lecturer - medical imaging and multimodal learning', 'University of Portsmouth', 'School of Computing', ['Medical imaging', 'Multimodal learning', 'Clinical AI'], ['PyTorch', 'Machine learning', 'Academic writing'], { experience: '12 years in clinical AI. PI on three funded studies; 40+ publications.', availability: { hours: 5, days: ['Tue', 'Thu'], note: '' }, preferredRoles: ['Lead researcher', 'Supervisor'], assistance: ['Methodology review', 'Data analysis'], researcher: { approved: true, designation: 'Methodologist', expertise: ['Methodology review', 'Data analysis', 'Writing feedback'], active: true, base: 1200 } }),
      U('USR-103', 'marcus.okafor@port.ac.uk', 'mentor', 'Prof. Marcus Okafor', 'Professor of statistics - research design and causal inference', 'University of Portsmouth', 'Mathematics', ['Causal inference', 'Research design', 'Biostatistics'], ['Statistics', 'R', 'SPSS'], { experience: '25 years teaching applied statistics. Former journal editor.', availability: { hours: 3, days: ['Wed'], note: 'Office hours online' }, mentor: { expertise: ['Research methodology', 'Statistics & analysis', 'Publishing & peer review'], qualifications: ['PhD Statistics, Imperial College London', 'Fellow of the Royal Statistical Society', 'Former Associate Editor, JRSS-A'], verification: 'verified', accepting: true } }),
      U('USR-104', 'priya.nair@port.ac.uk', 'student', 'Priya Nair', 'BSc Computer Science - low-resource NLP', 'University of Portsmouth', 'School of Computing', ['NLP', 'Low-resource languages', 'Health forums'], ['Python', 'NLP', 'PyTorch'], { availability: { hours: 10, days: ['Mon', 'Tue', 'Thu'], note: '' }, languages: ['English', 'Hindi'], preferredRoles: ['Developer'] }),
      U('USR-105', 'tariq.khan@ic.example', 'researcher', 'Dr. Tariq Khan', 'Cryptography researcher - zero-knowledge proofs', 'Imperial College London', 'Computing', ['Zero-knowledge proofs', 'Distributed systems', 'Privacy'], ['Cryptography', 'Rust', 'Distributed systems'], { experience: 'Six years on verifiable computation; 3 published CVPR-adjacent privacy papers.', languages: ['English', 'Urdu'], researcher: { approved: true, designation: 'Reviewer', expertise: ['Methodology review', 'Ethics guidance'], active: true, base: 1200 } }),
      U('USR-106', 'sarah.lindqvist@ki.example', 'researcher', 'Sarah Lindqvist', 'Health economist - micro-grants and civic resilience', 'Karolinska Institutet', 'Public Health', ['Health economics', 'Urban policy', 'Micro-grants'], ['Qualitative analysis', 'Survey design', 'R'], { researcher: { approved: true, designation: 'Statistician', expertise: ['Statistics support', 'Literature search'], active: true, base: 1200 }, languages: ['English', 'German'] }),
      U('USR-107', 'ananya.roy@berkeley.example', 'mentor', 'Dr. Ananya Roy', 'Field methods and qualitative research mentor', 'UC Berkeley', 'Urban Studies', ['Qualitative methods', 'Ethnography', 'Research ethics'], ['Qualitative analysis', 'Ethics', 'Survey design'], { mentor: { expertise: ['Qualitative methods', 'Research ethics', 'Literature review'], qualifications: ['PhD Sociology, UC Berkeley', 'Certified IRB reviewer'], verification: 'verified', accepting: true }, languages: ['English', 'Hindi'] }),
      U('USR-108', 'noor.ahmed@lums.example', 'mentor', 'Dr. Noor Ahmed', 'Machine learning for health - early-career mentor', 'LUMS', 'Computer Science', ['Machine learning', 'Healthcare AI', 'Careers'], ['Machine learning', 'PyTorch', 'Python'], { mentor: { expertise: ['Machine learning', 'Career in research', 'Academic writing'], qualifications: ['PhD Computer Science, LUMS'], verification: 'pending', accepting: true }, languages: ['English', 'Urdu'] }),
      U('USR-109', 'chloe.martin@sorbonne.example', 'mentor', 'Dr. Chloe Martin', 'Grant writing and research funding', 'Sorbonne Universite', 'Research Office', ['Grant writing', 'Funding strategy'], ['Academic writing'], { mentor: { expertise: ['Grant & funding', 'Academic writing', 'Publishing & peer review'], qualifications: ['PhD Life Sciences', '8 years in a university research office'], verification: 'none', accepting: false }, languages: ['English', 'French'] }),
      U('USR-110', 'liam.chen@port.ac.uk', 'student', 'Liam Chen', 'MA Economics - micro-finance field studies', 'University of Portsmouth', 'Economics', ['Micro-finance', 'Field experiments'], ['Survey design', 'R', 'Statistics'], { languages: ['English', 'Mandarin'] }),
      U('USR-111', 'hannah.weber@tum.example', 'student', 'Hannah Weber', 'MSc Psychology - sleep and cognition', 'TU Munich', 'Psychology', ['Sleep', 'Cognition', 'Wellbeing'], ['SPSS', 'Survey design', 'Statistics'], { languages: ['English', 'German'] }),
      U('USR-112', 'omar.siddiqui@qau.example', 'researcher', 'Dr. Omar Siddiqui', 'Computational biology - quantum optimisation', 'Quaid-i-Azam University', 'Physics', ['Quantum annealing', 'Genomics'], ['Bioinformatics', 'Python'], { researcher: { approved: true, designation: 'Reviewer', expertise: ['Data analysis'], active: false, base: 1200 }, languages: ['English', 'Urdu'] }),
      U('USR-113', 'fatima.zahra@lums.example', 'researcher', 'Dr. Fatima Zahra', 'Urban climate and mobility', 'LUMS', 'Environmental Science', ['Urban heat', 'Mobility', 'GIS'], ['GIS', 'R', 'Data visualisation'], { researcher: { approved: false, designation: '', expertise: ['Data analysis', 'Literature search'], active: true, base: 1200 }, languages: ['English', 'Urdu', 'Arabic'] }),
      U('USR-114', 'ben.carter@bristol.example', 'student', 'Ben Carter', 'PhD candidate - behavioural nudges', 'University of Bristol', 'Psychology', ['Behavioural science', 'Libraries', 'Replication'], ['R', 'Survey design'], { visibility: { overall: 'unlisted', fields: { institution: 'public', experience: 'public', availability: 'public', link: 'team' } } }),
      U('USR-115', 'yuki.tanaka@titech.example', 'student', 'Yuki Tanaka', 'MSc AI - explainable credit scoring', 'Tokyo Tech', 'Computer Science', ['Explainable AI', 'Fintech'], ['Python', 'Machine learning', 'Data visualisation'], { languages: ['English', 'Japanese'] })
    ];
    var ms = function (t, d, done) { return { id: 'MS-' + t.replace(/\W/g, '').slice(0, 6) + d.slice(-2), title: t, due: d, done: !!done }; };
    function P(id, owner, title, subject, q, obj, stage, skills, roles, hours, vis, status, members, extra) {
      return Object.assign({ id: id, ownerId: owner, title: title, subject: subject, question: q, objectives: obj, stage: stage, methods: [], skills: skills, roles: roles, hoursPerWeek: hours, visibility: vis, status: status, members: members, milestones: [], createdAt: ago(24 * 40), updatedAt: ago(5) }, extra || {});
    }
    var projects = [
      P('PRJ-1001', 'USR-102', 'Multimodal Neural Architectures for Clinical Diagnosis', 'Health & Medicine', 'Can attention-guided fusion of 12-lead ECG traces and chest radiograph embeddings improve triage accuracy over single-modality baselines?', ['Build a reproducible multimodal benchmark', 'Quantify gains over ECG-only and image-only models', 'Document failure cases for clinician review'], 'active', ['PyTorch', 'Machine learning', 'Statistics'], ['Data analyst', 'Student fellow'], 8, 'public', 'open', ['USR-102', 'USR-101', 'USR-104', 'USR-103'], { methods: ['Cross-validation', 'Ablation study'], milestones: [ms('Ethics approval', inDays(-20), true), ms('Baseline models', inDays(6)), ms('Draft methods section', inDays(18)), ms('Submit to workshop', inDays(60))] }),
      P('PRJ-1002', 'USR-105', 'Decentralised Zero-Knowledge Verification in P2P Grids', 'Computer Science', 'Which succinct non-interactive argument systems keep verification under a millisecond on heterogeneous edge nodes?', ['Survey SNARK families for edge hardware', 'Prototype a verifier in Rust', 'Benchmark on three device classes'], 'planning', ['Cryptography', 'Rust'], ['Co-author', 'Formal verifier'], 10, 'public', 'open', ['USR-105']),
      P('PRJ-1003', 'USR-106', 'Socioeconomic Impact of Micro-Grants in Urban Centres', 'Economics & Finance', 'How do small unconditional grants change household resilience over 36 months in five cities?', ['Design a comparable five-city survey', 'Link grant receipt to resilience indices', 'Publish an open dataset'], 'active', ['Survey design', 'R', 'Qualitative analysis'], ['Field interviewer', 'Data analyst'], 6, 'public', 'open', ['USR-106', 'USR-110']),
      P('PRJ-1004', 'USR-112', 'Genomic Sequence Alignment Using Quantum Annealing', 'Life Sciences', 'Can QUBO formulations of sequence assembly beat classical heuristics on NP-hard instances?', ['Formulate alignment as QUBO', 'Run on annealing hardware'], 'planning', ['Bioinformatics', 'Python'], ['Quantum developer'], 12, 'public', 'paused', ['USR-112']),
      P('PRJ-1005', 'USR-101', 'Sleep Patterns and Wellbeing in First-Year University Students', 'Psychology', 'Is irregular sleep timing in the first term associated with lower self-reported wellbeing at the end of term?', ['Recruit 150 first-year students', 'Collect two-week sleep diaries and a wellbeing scale', 'Test association controlling for course load'], 'planning', ['Survey design', 'SPSS', 'Statistics'], ['Psychology partner', 'Data analyst'], 6, 'public', 'open', ['USR-101', 'USR-111'], { methods: ['Sleep diary', 'WEMWBS scale'], milestones: [ms('Draft survey', inDays(10)), ms('Ethics application', inDays(24)), ms('Pilot with 10 students', inDays(45))] }),
      P('PRJ-1006', 'USR-104', 'Low-Resource NLP for Urdu Health Forums', 'Data Science & AI', 'Can multilingual transformers detect health misinformation in code-mixed Urdu-English forum posts with fewer than 2,000 labelled examples?', ['Collect and annotate a pilot corpus', 'Fine-tune and compare three models'], 'idea', ['NLP', 'Python', 'PyTorch'], ['Annotator (Urdu)', 'ML engineer'], 5, 'summary', 'open', ['USR-104']),
      P('PRJ-1007', 'USR-113', 'Urban Heat Islands and Pedestrian Route Choice', 'Environmental Science', 'Do pedestrians choose shaded routes during heatwaves, and what is the exposure saved?', ['Map shade using LiDAR', 'Model route choice from GPS traces'], 'planning', ['GIS', 'R', 'Data visualisation'], ['GIS analyst', 'Field data collector'], 8, 'public', 'open', ['USR-113']),
      P('PRJ-1008', 'USR-114', 'Replication: Pre-Registered Nudges in Library Use', 'Social Sciences', 'Do prompts at the point of borrowing replicate across two university libraries?', ['Pre-register the design', 'Run a two-site experiment'], 'idea', ['R', 'Survey design'], ['Site coordinator'], 4, 'public', 'draft', ['USR-114']),
      P('PRJ-1009', 'USR-102', 'Confidential Re-analysis of a Clinical Trial Dataset', 'Health & Medicine', 'Restricted by data-sharing agreement - invited collaborators only.', ['Re-analyse primary endpoints'], 'active', ['Statistics', 'R'], ['Statistician'], 6, 'private', 'open', ['USR-102', 'USR-105']),
      P('PRJ-1010', 'USR-115', 'Explainable ML for Credit Risk in Microfinance', 'Economics & Finance', 'Do SHAP-based explanations improve loan officers\' trust and decision accuracy for thin-file borrowers?', ['Train gradient-boosted baselines', 'Run a user study with loan officers', 'Report calibration and fairness metrics'], 'planning', ['Machine learning', 'Python', 'Data visualisation'], ['UX researcher', 'Data analyst'], 7, 'public', 'open', ['USR-115']),
      P('PRJ-1011', 'USR-111', 'Low-Cost Spectroscopy for Microplastics Detection', 'Environmental Science', 'Can a 3D-printed spectrometer detect microplastics in tap water at survey-grade accuracy?', ['Build and calibrate the device', 'Validate against FTIR'], 'writing', ['Python', 'Statistics'], ['Electronics tinkerer'], 5, 'public', 'closed', ['USR-111'])
    ];
    var requests = [
      { id: 'REQ-982', type: 'interest', projectId: 'PRJ-1001', from: 'USR-105', to: 'USR-102', message: 'I have six years of PyTorch experience and three published privacy-preserving ML papers. I would like to join as a co-author on the fusion experiments.', status: 'pending', createdAt: ago(6), history: [{ ts: ago(6), status: 'pending', by: 'USR-105' }] },
      { id: 'REQ-985', type: 'interest', projectId: 'PRJ-1005', from: 'USR-115', to: 'USR-101', message: 'I can help with the analysis plan and have experience with longitudinal diaries. Happy to take the data analyst role.', status: 'pending', createdAt: ago(20), history: [{ ts: ago(20), status: 'pending', by: 'USR-115' }] },
      { id: 'REQ-986', type: 'invitation', projectId: 'PRJ-1003', from: 'USR-106', to: 'USR-101', message: 'Your survey design background fits our five-city study. Would you join as a data analyst for two terms?', status: 'pending', createdAt: ago(30), history: [{ ts: ago(30), status: 'pending', by: 'USR-106' }] },
      { id: 'REQ-979', type: 'interest', projectId: 'PRJ-1001', from: 'USR-104', to: 'USR-102', message: 'I would like to work on the data loaders and evaluation scripts.', status: 'accepted', createdAt: ago(24 * 18), history: [{ ts: ago(24 * 18), status: 'pending', by: 'USR-104' }, { ts: ago(24 * 17), status: 'accepted', by: 'USR-102' }] },
      { id: 'REQ-977', type: 'interest', projectId: 'PRJ-1003', from: 'USR-101', to: 'USR-106', message: 'I would like to help with survey design and analysis.', status: 'declined', createdAt: ago(24 * 30), history: [{ ts: ago(24 * 30), status: 'pending', by: 'USR-101' }, { ts: ago(24 * 29), status: 'declined', by: 'USR-106' }] },
      { id: 'REQ-984', type: 'interest', projectId: 'PRJ-1010', from: 'USR-101', to: 'USR-115', message: 'Interested in the calibration and fairness metrics - I can contribute analysis in R and Python.', status: 'pending', createdAt: ago(3), history: [{ ts: ago(3), status: 'pending', by: 'USR-101' }] }
    ];
    var T = function (id, p, title, desc, tags, due, status, assignee, by) { return { id: id, projectId: p, title: title, description: desc, tags: tags, due: due, status: status, assignee: assignee, createdBy: by, createdAt: ago(24 * 14), updatedAt: ago(8) }; };
    var tasks = [
      T('TSK-101', 'PRJ-1001', 'Model baseline', 'Construct standard non-sparse ViT-B/16 reference pipeline for the MIMIC-CXR benchmark.', ['PyTorch', 'Data'], inDays(6), 'todo', 'USR-104', 'USR-102'),
      T('TSK-102', 'PRJ-1001', 'Clean ECG data', 'Normalise sampling rates to 500Hz and remove baseline wander using bi-directional Butterworth filtering.', ['Data', 'Preprocess'], inDays(9), 'todo', 'USR-101', 'USR-102'),
      T('TSK-103', 'PRJ-1001', 'Ablation test 3', 'Measure top-1 accuracy reduction across varying cross-attention block depths (L=4 vs L=8 vs L=12).', ['GPU', 'PyTorch', 'Audit'], inDays(1), 'progress', 'USR-101', 'USR-102'),
      T('TSK-104', 'PRJ-1001', 'Validate ResNet', 'Benchmark the 3D convolution layer against spatio-temporal ECG token embeddings on the test split.', ['PyTorch', 'Data'], inDays(2), 'progress', 'USR-104', 'USR-102'),
      T('TSK-105', 'PRJ-1001', 'Draft methods doc', 'Synthesise the mathematical formalisation of multi-modal cross-entropy loss and describe the fusion block.', ['Review', 'Writing'], inDays(5), 'review', 'USR-102', 'USR-102'),
      T('TSK-096', 'PRJ-1001', 'IRB protocol v2', 'Resubmit the ethics protocol with the data-retention amendment.', ['Approved'], inDays(-14), 'done', 'USR-102', 'USR-102'),
      T('TSK-097', 'PRJ-1001', 'Ingest DICOM data', 'Import the NIH X-ray subset into the encrypted vault.', ['NIH-Xray'], inDays(-10), 'done', 'USR-104', 'USR-102'),
      T('TSK-098', 'PRJ-1001', 'Token embeddings', 'Pre-compute token embeddings for radiograph patches.', ['PyTorch'], inDays(-7), 'done', 'USR-101', 'USR-102'),
      T('TSK-106', 'PRJ-1005', 'Draft survey', 'Draft the sleep diary and wellbeing scale items.', ['Survey'], inDays(10), 'progress', 'USR-101', 'USR-101'),
      T('TSK-107', 'PRJ-1005', 'Ethics form', 'Complete the university ethics application.', ['Ethics'], inDays(24), 'todo', 'USR-111', 'USR-101'),
      T('TSK-108', 'PRJ-1005', 'Recruit pilot', 'Contact ten first-year students for a pilot.', ['Pilot'], inDays(40), 'todo', 'USR-101', 'USR-101')
    ];
    var files = [
      { id: 'FIL-1', projectId: 'PRJ-1001', name: 'nih_chest_xray_subset.parquet', size: 8.4 * 1048576 | 0, ext: 'parquet', uploader: 'USR-102', permission: 'team', uploadedAt: ago(24 * 6) },
      { id: 'FIL-2', projectId: 'PRJ-1001', name: 'model_hyperparameters.json', size: 142 * 1024, ext: 'json', uploader: 'USR-101', permission: 'team', uploadedAt: ago(24 * 3) },
      { id: 'FIL-3', projectId: 'PRJ-1001', name: 'ethical_clearance_protocol_v2.pdf', size: 1.8 * 1048576 | 0, ext: 'pdf', uploader: 'USR-102', permission: 'owner', uploadedAt: ago(24 * 14) },
      { id: 'FIL-4', projectId: 'PRJ-1005', name: 'sleep_diary_template.docx', size: 96 * 1024, ext: 'docx', uploader: 'USR-101', permission: 'team', uploadedAt: ago(24 * 2) }
    ];
    var act = [
      { id: 'ACT-1', projectId: 'PRJ-1001', userId: 'USR-101', text: 'Moved TSK-103 from todo to progress', ts: ago(2) },
      { id: 'ACT-2', projectId: 'PRJ-1001', userId: 'USR-102', text: 'Published team agreement v2', ts: ago(30) },
      { id: 'ACT-3', projectId: 'PRJ-1001', userId: 'USR-104', text: 'Uploaded model_hyperparameters.json', ts: ago(72) },
      { id: 'ACT-4', projectId: 'PRJ-1005', userId: 'USR-101', text: 'Published the project brief', ts: ago(24 * 5) }
    ];
    var agreements = [{
      projectId: 'PRJ-1001', version: 2, status: 'published', publishedAt: ago(30), publishedBy: 'USR-102',
      published: { roles: [{ userId: 'USR-102', role: 'Principal investigator', responsibilities: 'Overall direction, ethics, final sign-off and corresponding authorship.' }, { userId: 'USR-101', role: 'Data analyst / co-author', responsibilities: 'ECG preprocessing, ablation experiments and results tables.' }, { userId: 'USR-104', role: 'ML engineer / co-author', responsibilities: 'Model baselines, data loaders and evaluation scripts.' }, { userId: 'USR-103', role: 'Methods mentor', responsibilities: 'Reviews the statistical analysis plan; no authorship claim unless he contributes text.' }], contributions: 'Each member commits roughly 6-8 hours a week. Code is reviewed by one other member before merging. Results are reproducible from the repository.', communication: 'Friday 30-minute video check-in; asynchronous updates in the workspace; response within two working days.', authorship: 'Order follows contribution: PI last, first author decided by contribution to experiments. Any change is discussed with the whole team and recorded here.', deadlines: [{ id: 'DL-1', label: 'Baseline results', date: inDays(14) }, { id: 'DL-2', label: 'Full draft', date: inDays(45) }, { id: 'DL-3', label: 'Workshop submission', date: inDays(60) }] },
      draft: null, acks: { 'USR-102': 2, 'USR-101': 2, 'USR-104': 1 },
      proposals: [{ id: 'PRP-1', userId: 'USR-104', section: 'Authorship', text: 'Could we agree that anyone who writes more than one section is named in the author list, even if they joined later?', status: 'open', createdAt: ago(10), version: 2 }],
      history: [{ version: 1, ts: ago(24 * 12), by: 'USR-102', summary: 'Initial agreement' }, { version: 2, ts: ago(30), by: 'USR-102', summary: 'Added mentor role and communication cadence' }]
    }];
    agreements[0].draft = clone(agreements[0].published);
    var statements = [
      { id: 'CMP-2610-102', researcherId: 'USR-102', period: '2026-10', base: 1200, completed: 14, target: 12, feedback: [5, 5, 4, 5, 4, 5], active: true, status: 'awaiting_approval', adjustment: 0, history: [{ ts: ago(10), status: 'awaiting_approval', by: 'USR-100' }] },
      { id: 'CMP-2610-105', researcherId: 'USR-105', period: '2026-10', base: 1200, completed: 9, target: 12, feedback: [4, 4, 5], active: true, status: 'awaiting_approval', adjustment: 0, history: [{ ts: ago(10), status: 'awaiting_approval', by: 'USR-100' }] },
      { id: 'CMP-2610-106', researcherId: 'USR-106', period: '2026-10', base: 1200, completed: 6, target: 12, feedback: [3, 4], active: true, status: 'draft', adjustment: 0, history: [] },
      { id: 'CMP-2610-112', researcherId: 'USR-112', period: '2026-10', base: 1200, completed: 0, target: 12, feedback: [], active: false, status: 'draft', adjustment: 0, history: [] },
      { id: 'CMP-2609-102', researcherId: 'USR-102', period: '2026-09', base: 1200, completed: 12, target: 12, feedback: [5, 4, 5, 5], active: true, status: 'paid', payoutRef: 'PAY-7KQ2MX', adjustment: 0, history: [{ ts: ago(24 * 20), status: 'paid', by: 'USR-100' }] },
      { id: 'CMP-2609-105', researcherId: 'USR-105', period: '2026-09', base: 1200, completed: 10, target: 12, feedback: [4, 5, 4], active: true, status: 'paid', payoutRef: 'PAY-B91TZ4', adjustment: 0, history: [{ ts: ago(24 * 20), status: 'paid', by: 'USR-100' }] },
      { id: 'CMP-2609-106', researcherId: 'USR-106', period: '2026-09', base: 1200, completed: 11, target: 12, feedback: [4, 4, 5, 3], active: true, status: 'payout_failed', payoutRef: 'PAY-Q03NNA', adjustment: 0, history: [{ ts: ago(24 * 19), status: 'payout_failed', by: 'USR-100' }] }
    ];
    var notifications = [
      { id: 'NTF-1', userId: 'USR-101', category: 'requests', title: 'Invitation to Socioeconomic Impact of Micro-Grants', body: 'Sarah Lindqvist invited you to collaborate.', href: 'requests.html', ts: ago(30), read: false, essential: false },
      { id: 'NTF-2', userId: 'USR-101', category: 'requests', title: 'New interest in Sleep Patterns and Wellbeing', body: 'Yuki Tanaka wants to join.', href: 'requests.html', ts: ago(20), read: false, essential: false },
      { id: 'NTF-3', userId: 'USR-101', category: 'projects', title: 'Team agreement v2 published', body: 'Please read and acknowledge it for Multimodal Neural Architectures.', href: 'agreement.html?id=PRJ-1001', ts: ago(30), read: true, essential: false },
      { id: 'NTF-4', userId: 'USR-101', category: 'support', title: 'Support request completed', body: 'Please rate the support you received.', href: 'support.html', ts: ago(26), read: false, essential: false },
      { id: 'NTF-5', userId: 'USR-102', category: 'requests', title: 'New interest in Multimodal Neural Architectures', body: 'Dr. Tariq Khan wants to join.', href: 'requests.html', ts: ago(6), read: false, essential: false },
      { id: 'NTF-6', userId: 'USR-102', category: 'support', title: 'Support request assigned', body: 'Methodology review for Aisha Rahman.', href: 'support.html', ts: ago(40), read: false, essential: false },
      { id: 'NTF-7', userId: 'USR-103', category: 'mentorship', title: 'New mentorship request', body: 'Aisha Rahman asked for help with Statistics & analysis.', href: 'mentors.html?tab=inbox', ts: ago(14), read: false, essential: false },
      { id: 'NTF-8', userId: 'USR-100', category: 'admin', title: 'Researcher awaiting approval', body: 'Dr. Fatima Zahra registered as a researcher.', href: 'admin.html', ts: ago(12), read: false, essential: true },
      { id: 'NTF-9', userId: 'USR-100', category: 'admin', title: 'New report: Fake profile', body: 'Profile of "Prof. A. Quick"', href: 'admin.html', ts: ago(8), read: false, essential: true },
      { id: 'NTF-10', userId: 'USR-104', category: 'projects', title: 'Task assigned: Validate ResNet', body: 'Due in 2 days.', href: 'workspace.html?id=PRJ-1001', ts: ago(50), read: true, essential: false }
    ];
    var mentorRequests = [
      { id: 'MEN-201', studentId: 'USR-101', mentorId: 'USR-103', topic: 'Statistics & analysis', goals: 'Check that my mixed-effects analysis plan for the sleep and wellbeing study is appropriate for repeated diary data.', stage: 'planning', guidance: 'Review of analysis plan', projectId: 'PRJ-1005', status: 'pending', createdAt: ago(14), note: '' },
      { id: 'MEN-199', studentId: 'USR-101', mentorId: 'USR-107', topic: 'Research ethics', goals: 'Understand what the ethics committee expects for wellbeing surveys with first-year students.', stage: 'planning', guidance: 'Ethics application walkthrough', projectId: 'PRJ-1005', status: 'accepted', createdAt: ago(24 * 6), note: '' }
    ];
    var supportRequests = [
      { id: 'SUP-301', studentId: 'USR-101', category: 'Methodology review', description: 'Please review the sampling and exclusion criteria for my first-year sleep study before I submit the ethics form.', projectId: 'PRJ-1005', status: 'in_progress', researcherId: 'USR-102', createdAt: ago(48), feedback: null, log: [{ ts: ago(48), text: 'Matched to Dr. Elena Vance (expertise, availability, lowest workload)' }, { ts: ago(40), text: 'Researcher started work' }] },
      { id: 'SUP-299', studentId: 'USR-101', category: 'Statistics support', description: 'Help choosing between a repeated-measures ANOVA and a mixed model for two-week diary data.', projectId: '', status: 'completed', researcherId: 'USR-106', createdAt: ago(24 * 9), completedAt: ago(26), feedback: null, log: [{ ts: ago(24 * 9), text: 'Matched to Sarah Lindqvist (expertise, availability, lowest workload)' }, { ts: ago(26), text: 'Marked completed: Recommended a linear mixed model; shared worked example.' }] },
      { id: 'SUP-296', studentId: 'USR-104', category: 'Writing feedback', description: 'Feedback on the introduction of my NLP project proposal, especially the problem statement.', projectId: 'PRJ-1006', status: 'completed', researcherId: 'USR-102', createdAt: ago(24 * 12), completedAt: ago(24 * 10), feedback: { rating: 5, comment: 'Clear and fast.' }, log: [] }
    ];
    var reports = [
      { id: 'RPT-51', reporterId: 'USR-110', targetType: 'user', targetId: 'USR-114', targetName: 'Ben Carter', reason: 'Fake profile', details: 'Profile claims a position I could not verify.', status: 'open', outcome: '', createdAt: ago(8) },
      { id: 'RPT-52', reporterId: 'USR-111', targetType: 'project', targetId: 'PRJ-1008', targetName: 'Replication: Pre-Registered Nudges in Library Use', reason: 'Inappropriate content', details: 'Brief contains a personal e-mail address.', status: 'open', outcome: '', createdAt: ago(30) },
      { id: 'RPT-49', reporterId: 'USR-101', targetType: 'user', targetId: 'USR-115', targetName: 'Yuki Tanaka', reason: 'Spam', details: 'Sent the same message to many projects.', status: 'dismissed', outcome: 'No policy breach found', createdAt: ago(24 * 8) }
    ];
    var auditLog = [
      { id: 'AUD-1', ts: ago(24 * 19), actor: 'USR-100', action: 'Payout FAILED PAY-Q03NNA - needs reconciliation', target: 'CMP-2609-106' },
      { id: 'AUD-2', ts: ago(24 * 20), actor: 'USR-100', action: 'Payout confirmed PAY-7KQ2MX', target: 'CMP-2609-102' },
      { id: 'AUD-3', ts: ago(24 * 20), actor: 'USR-100', action: 'Approved statement - total GBP 1500.00', target: 'CMP-2609-102' },
      { id: 'AUD-4', ts: ago(24 * 8), actor: 'USR-100', action: 'Report dismiss (Spam)', target: 'RPT-49' }
    ];
    var billing = [
      { id: 'BIL-701', userId: 'USR-101', ts: ago(24 * 10), type: 'charge', planId: 'plus', amount: 9.99, status: 'succeeded', ref: 'PSP-8D2K1A' },
      { id: 'BIL-700', userId: 'USR-101', ts: ago(24 * 40), type: 'charge', planId: 'plus', amount: 9.99, status: 'succeeded', ref: 'PSP-3F9Q7B' }
    ];
    return {
      version: 1, seq: { PRJ: 1011, REQ: 986, TSK: 108, USR: 115, MEN: 201, SUP: 301, NTF: 1010, ACT: 4, FIL: 4, AUD: 5004, RPT: 52, MSG: 500, BIL: 701, PRP: 1, MS: 100, DL: 3 },
      users: users, projects: projects, requests: requests, agreements: agreements, tasks: tasks, files: files, activity: act,
      mentorRequests: mentorRequests, supportRequests: supportRequests, subscriptions: { 'USR-101': { planId: 'plus', status: 'active', periodStart: ago(24 * 10), periodEnd: now() + 20 * D, cancelAtEnd: false } },
      billing: billing, statements: statements, compConfig: clone(COMP_CONFIG), reports: reports, contactMessages: [], audit: auditLog, notifications: notifications, prefs: {}
    };
  }

/**
 * The password given to every demo account. On a public production site it is a random value nobody knows, so the sample
 * projects stay visible but nobody can sign in as a demo user (set RCMP_DEMO_LOGIN=1 to keep the public demo password).
 */
function demoSecret(env) {
  return env.NODE_ENV === 'production' && env.RCMP_DEMO_LOGIN !== '1' ? require('node:crypto').randomBytes(24).toString('hex') : DEMO_PASSWORD;
}

/** Insert the sample data through the Unit of Work (one transaction). */
async function seedDatabase(pool, DB, keepAdminHash) {
  sharedHash = sharedHash || await Auth.hashPassword(demoSecret(process.env));
  lastAdminPassword = process.env.RCMP_ADMIN_PASSWORD || 'Rcmp-' + require('node:crypto').randomBytes(9).toString('base64url') + '9!';
  const adminHash = keepAdminHash || await Auth.hashPassword(lastAdminPassword);
  const data = buildSeed(sharedHash, adminHash), ctx = {};
  await DB.transact(pool, ctx, async function () {
    Object.keys(DB.COLLECTIONS).forEach(function (name) { const t = ctx.db[name]; (data[name] || []).forEach(function (x) { t.push(x); }); });
    Object.assign(ctx.db.seq, data.seq); Object.assign(ctx.db.compConfig, data.compConfig);
    Object.keys(data.subscriptions).forEach(function (k) { ctx.db.subscriptions[k] = data.subscriptions[k]; });
  });
}
module.exports = { buildSeed, seedDatabase, demoSecret, DEMO_PASSWORD, ADMIN_EMAIL, adminPassword: function () { return lastAdminPassword; } };
