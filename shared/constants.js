/**
 * constants.js - reference data shared by the browser and the server (UMD).
 *
 * Plans, allowances, subjects and the compensation configuration live in ONE
 * place so the interface and the API can never disagree (NFR-012, NFR-017).
 * Prices, allowances and bonus caps are proposals pending stakeholder
 * validation (Table 14 of the specification).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RCMPConstants = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var SUBJECTS = ['Computer Science', 'Data Science & AI', 'Health & Medicine', 'Social Sciences', 'Engineering', 'Environmental Science', 'Psychology', 'Economics & Finance', 'Education', 'Life Sciences'];
  var STAGES = [
    { id: 'idea', label: 'Idea' }, { id: 'planning', label: 'Planning' },
    { id: 'active', label: 'Active research' }, { id: 'writing', label: 'Writing up' }
  ];
  var TOPICS = ['Research methodology', 'Statistics & analysis', 'Machine learning', 'Literature review', 'Academic writing', 'Research ethics', 'Qualitative methods', 'Grant & funding', 'Publishing & peer review', 'Career in research'];
  var SUPPORT_CATEGORIES = ['Methodology review', 'Statistics support', 'Literature search', 'Writing feedback', 'Ethics guidance', 'Data analysis'];
  var SKILL_SUGGESTIONS = ['Python', 'R', 'Statistics', 'PyTorch', 'NLP', 'Survey design', 'Qualitative analysis', 'Cryptography', 'Bioinformatics', 'GIS', 'Systematic review', 'Data visualisation', 'Machine learning', 'SPSS', 'Academic writing', 'Ethics'];
  var LANGUAGES = ['English', 'Urdu', 'Arabic', 'Spanish', 'French', 'Mandarin', 'Hindi', 'German'];
  var DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var PLANS = [
    { id: 'free', name: 'Explorer', price: 0, allowance: 0, tagline: 'Collaborate and discover - free for every student.', features: ['Profile, project briefs and discovery', 'Team agreements and private workspace', 'Browse mentor directory', 'No researcher-support or mentorship allowance'] },
    { id: 'basic', name: 'Scholar Basic', price: 4.99, allowance: 2, tagline: 'Occasional guidance when you get stuck.', features: ['Everything in Explorer', '2 support / mentorship requests per month', 'Request status tracking', 'Email-style in-app notifications'] },
    { id: 'plus', name: 'Scholar Plus', price: 9.99, allowance: 6, featured: true, tagline: 'Regular researcher support for a live project.', features: ['Everything in Basic', '6 support / mentorship requests per month', 'Priority matching by workload', 'Feedback loop on every completed request'] },
    { id: 'pro', name: 'Scholar Pro', price: 19.99, allowance: 15, tagline: 'Intensive support through a dissertation.', features: ['Everything in Plus', '15 support / mentorship requests per month', 'Priority queue for ethics and methodology review', 'Extended request history'] }
  ];
  var COMP_CONFIG = { weightRequests: 0.7, weightFeedback: 0.3, bonusCap: 300, minFeedback: 3 };
  var COLORS = ['#2563eb', '#0d9488', '#7c3aed', '#db2777', '#ea580c', '#0891b2', '#4f46e5', '#059669', '#9333ea', '#c2410c'];
  function colorFor(id) { var n = 0; String(id).split('').forEach(function (c) { n += c.charCodeAt(0); }); return COLORS[n % COLORS.length]; }
  function initials(name) { return String(name).replace(/^(Dr|Prof)\.?\s+/i, '').split(/\s+/).slice(0, 2).map(function (p) { return p[0]; }).join('').toUpperCase(); }
  return {
    SUBJECTS: SUBJECTS, STAGES: STAGES, TOPICS: TOPICS, SUPPORT_CATEGORIES: SUPPORT_CATEGORIES, SKILL_SUGGESTIONS: SKILL_SUGGESTIONS,
    LANGUAGES: LANGUAGES, DAYS: DAYS, PLANS: PLANS, COMP_CONFIG: COMP_CONFIG, initials: initials, colorFor: colorFor
  };
});
