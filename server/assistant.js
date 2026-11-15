/**
 * assistant.js - "Scout", the in-product help assistant (tier 2).
 *
 * Scout is NOT a large language model. It is a small retrieval assistant: the
 * user's question is normalised, matched against a curated knowledge base about
 * this platform, and the best-matching, hand-written answer is returned. That
 * is deliberate:
 *   - answers can only state what RCMP really does (limits and plans are read
 *     from the same constants the rest of the system uses);
 *   - there is no external service, key, cost or data leaving the system;
 *   - anything outside the platform is declined, which is the required behaviour;
 *   - it is fully deterministic, so it can be unit-tested (tests/assistant.test.js).
 * The user's text is never echoed back, so it cannot be reflected as markup.
 *
 * answer(message, who) -> { reply, links:[{label,href}], chips:[string], topic, inScope }
 *   who (optional, signed-in users): { name, role, plan:{name,price,allowance}, used, remaining, pending, projects, unread }
 */
'use strict';
const C = require('../shared/constants');
const V = require('../shared/validators');

const PLANS = C.PLANS, money = (n) => '£' + n.toFixed(2);
const planLine = (p) => p.name + ' (' + (p.price ? money(p.price) + ' a month' : 'free') + ', ' + (p.allowance ? p.allowance + ' support or mentorship requests a month' : 'no support or mentorship allowance') + ')';
const PAGES = {
  discover: ['Open Discover', 'discover.html'], projects: ['My projects', 'projects.html'], newProject: ['New project brief', 'project-new.html'],
  requests: ['Requests', 'requests.html'], mentors: ['Find a mentor', 'mentors.html'], support: ['Researcher support', 'support.html'],
  plans: ['Plans and billing', 'subscription.html'], profile: ['My profile', 'profile.html'], notifications: ['Notifications', 'notifications.html'],
  privacy: ['Privacy notice', 'privacy.html'], forgot: ['Reset my password', 'forgot.html'], register: ['Create an account', 'register.html'],
  login: ['Sign in', 'login.html'], compensation: ['Compensation', 'compensation.html'], admin: ['Administration', 'admin.html']
};
const L = (...keys) => keys.map((k) => ({ label: PAGES[k][0], href: PAGES[k][1] }));

/** Knowledge base. keywords: single words weigh 1, phrases (with a space) weigh 2.5. */
const KB = [
  { id: 'about', k: ['what is rcmp', 'what is this', 'about rcmp', 'about the platform', 'what does this platform do', 'what can i do here', 'purpose', 'overview', 'platform'], chips: ['How do I get started?', 'Who is it for?'],
    a: 'RCMP (Research Collaboration and Mentorship Platform) helps students and early-career researchers find collaborators, turn an idea into a clear project brief, agree how the team will work, organise tasks and files in a private workspace, and ask mentors and researchers for guidance.' },
  { id: 'start', k: ['get started', 'getting started', 'start', 'begin', 'first step', 'how do i use', 'new here', 'tutorial', 'guide'], chips: ['Create an account', 'Find collaborators', 'Start a project'], links: L('register', 'discover'),
    a: 'A good first path: 1) create an account and complete your profile (interests, skills, availability); 2) use Discover to find projects or people; 3) send an interest request with a short message, or publish your own project brief; 4) once you are on a team, open the workspace and agree the team agreement.' },
  { id: 'roles', k: ['role', 'student', 'researcher', 'mentor', 'administrator', 'admin', 'who is it for', 'who can use', 'user type', 'account type'], chips: ['What can a mentor do?', 'How do researchers join?'],
    a: 'There are four roles. Students and early-career researchers collaborate and can buy a plan for researcher support and mentorship. Researchers answer support requests and are never charged. Mentors give guidance and set whether they are accepting requests. Administrators approve researchers, handle reports and review compensation.' },
  { id: 'register', k: ['register', 'sign up', 'signup', 'create account', 'create an account', 'new account', 'join'], links: L('register'), chips: ['What password do I need?', 'Is my data private?'],
    a: 'Choose Create an account, enter your name, email and a strong password, pick your role and accept the privacy notice. A password needs at least 8 characters with a mix of letters, numbers and symbols. Researcher accounts are checked by an administrator before they appear for support requests.' },
  { id: 'password', k: ['forgot password', 'forgotten password', 'reset password', 'password reset', 'lost password', 'change password', 'cannot sign in', 'cant log in', 'locked out', 'recover account', 'account recovery', 'password'], links: L('forgot'), chips: ['Why was I signed out?'],
    a: 'Use "Forgot your password?" on the sign-in page. Enter your email and open the reset link. The link works once and expires after 30 minutes. Resetting a password also signs out all your other sessions. After 8 failed sign-ins in 10 minutes you are asked to wait a few minutes.' },
  { id: 'session', k: ['signed out', 'session expired', 'session', 'logged out', 'log out', 'logout', 'sign out', 'token', '401'], chips: ['How do I reset my password?'],
    a: 'Sessions last 8 hours, then you are asked to sign in again; anything you were typing is kept on screen. You are also signed out if your password changes or your account is suspended. To leave on purpose, use the sign-out button at the bottom of the sidebar.' },
  { id: 'profile', k: ['profile', 'edit profile', 'my interests', 'skills', 'availability', 'headline', 'institution', 'visibility', 'who can see my', 'hide my', 'privacy setting', 'listed', 'unlisted'], links: L('profile'), chips: ['Is my data private?', 'Export my data'],
    a: 'On My profile you add interests, skills, experience, availability, preferred roles, languages and an optional link. Each detail can be public, visible to teammates or hidden, and you can unlist yourself from people search entirely. These choices are enforced by the server, not just hidden on screen.' },
  { id: 'discover', k: ['discover', 'search', 'find collaborators', 'find a collaborator', 'find people', 'find projects', 'browse', 'filter', 'collaborator', 'look for'], links: L('discover'), chips: ['How do I ask to join?', 'Start a project'],
    a: 'Open Discover to search projects or people by keyword and filter by skills, interests, role, language and availability. Results are paged so large lists stay fast. Private projects never appear in search.' },
  { id: 'project', k: ['create project', 'new project', 'project brief', 'start a project', 'publish project', 'edit project', 'close project', 'pause project', 'research question', 'brief', 'project'], links: L('newProject', 'projects'), chips: ['Who can see my project?', 'How do I invite someone?'],
    a: 'Choose New project brief. Give it a title, subject, description and research question, then add objectives, stage, methods, required skills, roles and time commitment. Save a draft or publish. The owner can later edit, pause or close the listing; closing a project automatically declines its pending requests.' },
  { id: 'projvis', k: ['project visibility', 'private project', 'public project', 'who can see my project', 'summary only', 'hide project'], chips: ['What does the workspace show?'],
    a: 'The owner picks a visibility for each project: public, summary only (title and research question, not details) or private. Workspaces and files are only ever open to project members, whatever the listing visibility is. Administrators cannot open private workspaces either.' },
  { id: 'requests', k: ['request', 'express interest', 'ask to join', 'join a project', 'interest', 'pending', 'accepted', 'declined', 'withdraw', 'withdrawn', 'invitation', 'invite', 'status of my request'], links: L('requests'), chips: ['How do I invite someone?', 'Can I withdraw a request?'],
    a: 'To join a project, open it and send an interest request with a short message. Owners can invite people too. Every request is pending until the other side accepts or declines; the sender can withdraw while it is pending. Only the right person can act on each request, you get a notification when its status changes, and a second request for the same project and person is refused while one is pending.' },
  { id: 'agreement', k: ['agreement', 'team agreement', 'acknowledge', 'acknowledgement', 'contributions', 'authorship', 'roles and responsibilities', 'revision', 'proposal', 'propose change'], chips: ['What are the task limits?', 'What if two people edit?'],
    a: 'Each project has a team agreement covering roles, responsibilities, expected contributions, deadlines, communication and authorship. The owner edits and publishes it (a published version needs a description of contributions and at least one deadline). Members read it, acknowledge it, or propose a revision. It records team expectations; it does not replace institutional rules or binding decisions.' },
  { id: 'conflict', k: ['409', 'conflict', 'two people edit', 'stale', 'newer version', 'edited elsewhere', 'edit in two tabs', 'lost race'], chips: ['Tell me about the agreement'],
    a: 'If someone saved a newer version of an agreement while you were editing, saving is refused with a "newer version" message instead of overwriting their work. Reload to see their version; the text you typed stays on screen so you can merge it.' },
  { id: 'workspace', k: ['workspace', 'task', 'tasks', 'kanban', 'board', 'milestone', 'milestones', 'tag', 'tags', 'task title', 'to do', 'in progress', 'review', 'done', 'move task'], chips: ['How do I upload a file?', 'What are the task limits?'],
    a: 'The workspace is a private board for your team. Tasks move through To do, In progress, Review and Done (drag a card or use "Move to"). A task title is 3 to 20 characters, the description is optional up to 250 characters, and you can add up to 3 tags. Members can also track milestones and see a history of important changes.' },
  { id: 'files', k: ['file', 'files', 'upload', 'attachment', 'attach', 'download', 'file size', '10 mb', 'file type', 'pdf', 'encrypted', '413', 'too large'], chips: ['Is my data private?'],
    a: 'In the workspace choose "Choose file" or drag a file in. The limit is 10 MB per file (exactly 10 MB is accepted). Accepted types: ' + V.ALLOWED_EXT.join(', ') + '. Files are encrypted at rest and only project members can download them; you can mark a file as visible to the team or to the owner only.' },
  { id: 'mentors', k: ['mentor', 'mentors', 'mentorship', 'find a mentor', 'request a mentor', 'guidance', 'verified', 'verification', 'accepting requests', 'supervisor', 'supervision'], links: L('mentors'), chips: ['Is a mentor my supervisor?', 'What does it cost?'],
    a: 'Open Mentors to browse profiles by subject, topic and expertise, with verification status shown accurately. Send a mentorship request describing your goals, project stage and the guidance you need. Mentors accept or decline and can switch "accepting requests" off. Mentorship complements official university supervision; it never replaces it. Mentorship requests count towards your plan allowance.' },
  { id: 'support', k: ['researcher support', 'support request', 'ask a researcher', 'methodology review', 'statistics support', 'literature search', 'writing feedback', 'ethics guidance', 'data analysis', 'reopen', 'rate', 'feedback', 'support'], links: L('support'), chips: ['What does it cost?', 'How many requests do I have left?'],
    a: 'In Researcher support, choose a category (methodology review, statistics, literature search, writing feedback, ethics guidance or data analysis) and describe what you need. The request is matched to an available approved researcher with relevant expertise. They start and complete it, you can rate the result, and you can reopen it if it did not solve the problem. Support needs a paid student plan.' },
  { id: 'plans', k: ['plan', 'plans', 'price', 'prices', 'pricing', 'cost', 'subscription', 'subscribe', 'upgrade', 'billing', 'allowance', 'explorer', 'scholar', 'how much', 'free', 'pay', 'payment'], links: L('plans').concat([{ label: 'Public pricing page', href: 'pricing.html' }]), chips: ['How many requests do I have left?', 'Can I cancel?'],
    a: 'Student plans: ' + PLANS.map(planLine).join('; ') + '. The allowance is shared by support and mentorship requests and renews each billing period; a request that is declined or cancelled gives its place back. Prices are illustrative proposals and payments in this version run in a sandbox.' },
  { id: 'cancel', k: ['cancel my subscription', 'cancel subscription', 'cancel my plan', 'cancel plan', 'cancel', 'cancel subscription', 'stop subscription', 'end plan', 'unsubscribe', 'refund', 'payment failed', 'payment pending', 'card'], links: L('plans').concat([{ label: 'Public pricing page', href: 'pricing.html' }]), chips: ['Show me the plans'],
    a: 'You can cancel on Plans and billing; the plan then stays active until the end of the paid period and does not renew. A plan is only granted after a confirmed successful payment: failed or pending payments change nothing. RCMP never stores raw card details.' },
  { id: 'comp', k: ['compensation', 'researcher pay', 'bonus', 'statement', 'payout', 'paid', 'earn', 'researcher fee', 'base compensation', 'get paid'], links: L('compensation'), chips: ['How do researchers join?'],
    a: 'Researchers never pay to join or to work on requests. Compensation is calculated per reporting period from completed requests and student feedback (bonus weights ' + (C.COMP_CONFIG.weightRequests * 100) + '% requests and ' + (C.COMP_CONFIG.weightFeedback * 100) + '% feedback, capped at £' + C.COMP_CONFIG.bonusCap + ', and only when at least ' + C.COMP_CONFIG.minFeedback + ' feedback items exist). An administrator must approve a statement before it can be paid, and failed payouts are recorded, never shown as paid. These figures are proposals pending validation.' },
  { id: 'researcherjoin', k: ['become a researcher', 'how do researchers join', 'researcher approval', 'approve researcher', 'researcher account', 'join as researcher'], chips: ['Does it cost researchers anything?'],
    a: 'Register with the Researcher role and complete your profile with your expertise. An administrator reviews and approves you; only approved, active researchers receive support requests. Researchers are never charged.' },
  { id: 'notifications', k: ['notification', 'notifications', 'notify', 'alerts', 'pause notifications', 'unread', 'bell', 'essential'], links: L('notifications'), chips: ['Can I turn some off?'],
    a: 'The bell shows requests, invitations, agreements and billing updates. In Notifications you can switch whole categories off or pause non-essential ones for 1 hour up to 7 days. Essential messages (security, billing, outcomes of requests you are part of and admin tasks) always arrive. Notifications never reveal confidential details to anyone else.' },
  { id: 'privacy', k: ['privacy', 'private', 'my data', 'personal data', 'gdpr', 'data protection', 'export my data', 'delete my account', 'delete account', 'retention', 'remove my data', 'cookies', 'is my data safe'], links: L('privacy', 'profile'), chips: ['Is the platform secure?'],
    a: 'RCMP collects only what its features need and explains each use in the privacy notice. On My profile you can download a JSON copy of your data or delete your account (your profile and memberships are removed). Passwords are stored only as salted hashes and are never written to logs.' },
  { id: 'security', k: ['security', 'secure', 'safe', 'encryption', 'encrypted', 'hack', 'https', 'tls', 'ssl', 'hashed', 'xss', 'injection'], chips: ['Is my data private?'],
    a: 'Security measures: passwords are salted and hashed; sessions are signed tokens that expire after 8 hours; every request is checked for role and project membership on the server; files are encrypted at rest; inputs are validated and output is escaped to stop script injection; repeated failed sign-ins are throttled; and production deployments are served over HTTPS.' },
  { id: 'report', k: ['report', 'abuse', 'inappropriate', 'harassment', 'spam', 'flag', 'moderation', 'block user', 'complain'], chips: ['What do administrators do?'],
    a: 'Use the report option on a profile or project, choose a reason and add short details. An administrator reviews it and can dismiss it or act (for example warn or suspend the account). Sensitive administrator actions are recorded in an audit log.' },
  { id: 'admin', k: ['administrator', 'what do administrators do', 'audit', 'suspend', 'approve', 'admin tasks'], links: L('admin'), chips: ['How do I report something?'],
    a: 'Administrators approve researchers, review reports, approve or reject compensation statements and trigger payouts. Their sensitive actions are written to an audit log. They cannot read private team workspaces.' },
  { id: 'errors', k: ['error', 'something went wrong', 'not saved', 'failed', 'offline', 'try again', '402', '403', '429', '500', 'too many attempts', 'permission denied', 'not allowed'], chips: ['Why was I signed out?'],
    a: 'Common messages: 400 means a field needs fixing (the message sits under the field); 401 means sign in again; 402 means your plan does not include that request or the allowance is used; 403 means your role or team membership does not allow it; 404 means it does not exist or you cannot see it; 409 means it changed meanwhile (for example a request already decided); 413 means a file over 10 MB; 429 means too many sign-in attempts. If a save fails, nothing was saved, so you can safely retry.' },
  { id: 'demo', k: ['demo', 'demo tools', 'demo account', 'demo accounts', 'sample data', 'reset demo', 'simulate', 'failure case'], chips: ['What is RCMP?'],
    a: 'In demo mode the sign-in page has one-click demo accounts (password Demo@1234) and a Demo tools button lets you switch user, reset the sample data and make the server fail on purpose (offline, save failure, expired session, edit conflict, storage failure). These tools are disabled in production.' },
  { id: 'contact', k: ['contact', 'contact us', 'support team', 'human', 'real person', 'email you', 'send a message', 'message the team', 'speak to someone', 'help desk', 'helpdesk'], links: [{ label: 'Contact page', href: 'contact.html' }], chips: ['How do I report something?'],
    a: 'Use the Contact page to send the team a message. You do not need an account. Choose a topic, add a subject and your message, and you will get a reference number. For research or ethics questions, use Researcher support or speak to your own supervisor.' }
];

const WORDS = {
  greeting: ['hello', 'hi', 'hey', 'hiya', 'good morning', 'good afternoon', 'good evening', 'greetings'],
  thanks: ['thanks', 'thank you', 'thx', 'cheers', 'great thanks', 'appreciate'],
  bye: ['bye', 'goodbye', 'see you', 'cya'],
  identity: ['who are you', 'what are you', 'your name', 'are you ai', 'are you a bot', 'are you human', 'are you real', 'chatgpt', 'gpt', 'llm', 'language model', 'which model', 'what model', 'artificial intelligence', 'claude', 'gemini', 'openai', 'are you a robot', 'bot'],
  help: ['help', 'what can you do', 'what can you help', 'how can you help', 'options', 'menu', 'topics']
};
const ATTACK = /ignore (all |any |the )?(previous|above|prior)|system prompt|pretend (to be|you)|act as|jailbreak|developer mode|reveal your (prompt|instructions)|disregard/i;
const STOP = new Set('a an the and or but of to in on at for with without is are was were be been am do does did can could should would will may might i me my we our you your it its this that these those there here how what when where which who why please tell about any some more also just really very so if then than as by from into up out not no yes ok okay'.split(' '));

/** Light stemmer so "uploading" and "uploads" match "upload". */
function stem(w) {
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 4 && w.endsWith('es')) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}
const norm = (text) => String(text || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9£ ]+/g, ' ').split(/\s+/).filter(Boolean);
const toks = (text) => norm(text).filter((w) => !STOP.has(w)).map(stem);

// Pre-compile keywords once.
const COMPILED = KB.map((e) => ({ e, kw: e.k.map((p) => { const t = norm(p).map(stem); return { t, w: t.length > 1 ? 2.5 : 1 }; }) }));
const phraseIn = (hay, needle) => { for (let i = 0; i + needle.length <= hay.length; i++) { let ok = true; for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) { ok = false; break; } if (ok) return true; } return false; };
const hasAny = (text, list) => { const t = ' ' + norm(text).join(' ') + ' '; return list.some((p) => t.includes(' ' + norm(p).join(' ') + ' ')); };

const SUGGEST = ['Find collaborators', 'Start a project', 'Request a mentor', 'Is my work private?', 'What do the plans cost?'];
const OUT = (who) => ({
  reply: 'I\'m Scout, the help assistant built into RCMP, so I can only help with using this platform: finding collaborators, projects and requests, team agreements, the workspace and files, mentors and researcher support, plans, notifications and privacy. I can\'t help with that one, but I\'m happy to answer anything about RCMP' + (who && who.name ? ', ' + who.name.split(' ')[0] : '') + '.',
  links: [], chips: SUGGEST, topic: 'out_of_scope', inScope: false
});

/** Personalised sentence for signed-in users, added to the generic answer where it helps. */
function personal(id, who) {
  if (!who) return '';
  if ((id === 'plans' || id === 'support' || id === 'cancel' || id === 'mentors') && who.role === 'student' && who.plan) {
    return ' You are on ' + who.plan.name + ': ' + (who.plan.allowance ? who.used + ' of ' + who.plan.allowance + ' requests used this period, ' + who.remaining + ' left.' : 'it has no support or mentorship allowance, so choose a plan to send those requests.');
  }
  if (id === 'requests' && who.pending != null) return who.pending ? ' You have ' + who.pending + ' request' + (who.pending === 1 ? '' : 's') + ' waiting for your answer.' : ' You have no requests waiting for you right now.';
  if (id === 'notifications' && who.unread != null) return ' You have ' + who.unread + ' unread notification' + (who.unread === 1 ? '' : 's') + '.';
  if (id === 'project' && who.projects != null) return ' You are currently a member of ' + who.projects + ' project' + (who.projects === 1 ? '' : 's') + '.';
  return '';
}

/** Answer a question from the knowledge base or decline politely; never echoes the input and never throws. */
function answer(message, who) {
  const raw = String(message == null ? '' : message).trim();
  if (!raw) return { reply: 'Type a question about RCMP and I\'ll do my best to help.', links: [], chips: SUGGEST, topic: 'empty', inScope: true };
  if (raw.length > 300) return { reply: 'That\'s a little long for me. Could you ask it in one or two short sentences?', links: [], chips: SUGGEST, topic: 'too_long', inScope: true };
  if (ATTACK.test(raw)) return OUT(who);

  const q = toks(raw), qAll = norm(raw).map(stem), small = norm(raw).length <= 4;
  // Quick conversational intents (only for short messages, so "hello, how do I upload a file" still reaches the KB).
  if (small && hasAny(raw, WORDS.thanks)) return { reply: 'You\'re welcome! Ask me anything else about RCMP.', links: [], chips: SUGGEST, topic: 'thanks', inScope: true };
  if (small && hasAny(raw, WORDS.bye)) return { reply: 'Goodbye, and good luck with your research!', links: [], chips: [], topic: 'bye', inScope: true };

  // Score the knowledge base.
  let best = null, second = null;
  for (const c of COMPILED) {
    let s = 0;
    for (const k of c.kw) { if (k.t.length === 1 ? q.includes(k.t[0]) : phraseIn(qAll, k.t)) s += k.w; }
    if (s > 0 && (!best || s > best.s)) { second = best; best = { c, s }; } else if (s > 0 && (!second || s > second.s)) second = { c, s };
  }
  if (hasAny(raw, WORDS.identity) && (!best || best.s < 2.5)) {
    return { reply: 'I\'m Scout, the help assistant for RCMP. I\'m not a general AI model like ChatGPT: I answer from this platform\'s own help content, which is why I only cover how to use RCMP. For research, ethics or academic questions, use Researcher support or your supervisor.', links: [], chips: ['What can you help with?', 'Find collaborators'], topic: 'identity', inScope: true };
  }
  if (best && best.s >= 1) {
    const e = best.c.e;
    return { reply: e.a + personal(e.id, who), links: e.links || [], chips: e.chips || [], topic: e.id, inScope: true };
  }
  if (hasAny(raw, WORDS.help)) return { reply: 'I can help you use RCMP: ' + ['finding collaborators and projects', 'sending and answering requests', 'team agreements', 'the workspace, tasks and files', 'mentors and researcher support', 'plans and billing', 'notifications, privacy and your account'].join(', ') + '. Pick a suggestion or type your question.', links: [], chips: SUGGEST, topic: 'help', inScope: true };
  if (hasAny(raw, WORDS.greeting) && small) return { reply: (who && who.name ? 'Hi ' + who.name.split(' ')[0] + '! ' : 'Hello! ') + 'I\'m Scout. I can guide you through finding collaborators, mentors, projects, team agreements, the workspace, privacy and plans. What would you like to know?', links: [], chips: SUGGEST, topic: 'greeting', inScope: true };
  return OUT(who);
}

module.exports = { answer, KB, SUGGEST };
