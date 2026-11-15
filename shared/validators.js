/**
 * validators.js
 * ---------------------------------------------------------------------------
 * Pure input-validation functions for the Research Collaboration and
 * Mentorship Platform (RCMP) front end.
 *
 * Every function is side-effect free so it can be unit-tested in Node
 * (tests/validators.test.js) and reused in the browser (window.RCMPValidators).
 *
 * Each validator returns   { ok: boolean, error?: string, value?: any }
 *
 * Requirement traceability
 *   FR-042  Task title 3-20 characters ............ validateTaskTitle
 *   FR-043  Task description <= 250 characters .... validateTaskDescription
 *   FR-044  At most three optional tags ........... validateTags
 *   FR-029  File upload, 10 MB limit (NFR-018) .... validateFile
 *   FR-001  Registration ............................ validateEmail / validatePassword / validateName
 *   FR-007  Project brief ........................... validateProjectBrief
 *   FR-014  Interest message ........................ validateMessage
 *   FR-020  Mentorship request ...................... validateMentorshipRequest
 *   NFR-004 Input sanitisation (XSS / injection) .... escapeHtml / sanitizeText
 * ---------------------------------------------------------------------------
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RCMPValidators = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Maximum upload size: exactly 10 MiB (10.1 MB must be rejected - NFR-018). */
  var MAX_FILE_BYTES = 10 * 1024 * 1024;
  /** File types the workspace accepts. */
  var ALLOWED_EXT = ['pdf', 'docx', 'doc', 'xlsx', 'csv', 'txt', 'md', 'png', 'jpg', 'jpeg', 'zip', 'pptx', 'ipynb', 'json', 'parquet'];

  function ok(value) { return { ok: true, value: value }; }
  function fail(error) { return { ok: false, error: error }; }

  /** Escape HTML special characters so user text can never run as markup (NFR-004). */
  function escapeHtml(input) {
    return String(input == null ? '' : input)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** Remove control characters, collapse whitespace and strip any HTML tags. */
  function sanitizeText(input) {
    return String(input == null ? '' : input)
      .replace(/<[^>]*>/g, '')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .replace(/[ \t]+/g, ' ')
      .trim();
  }

  /** FR-001: standard e-mail shape check (not a deliverability guarantee). */
  function validateEmail(email) {
    var v = String(email || '').trim().toLowerCase();
    if (!v) return fail('Email address is required.');
    if (v.length > 254) return fail('Email address is too long.');
    if (!/^[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]{2,}$/.test(v)) return fail('Enter a valid email address, e.g. name@university.ac.uk.');
    return ok(v);
  }

  /** NFR-002 companion rule: at least 8 chars with upper, lower and a digit. */
  function validatePassword(pw) {
    var v = String(pw || '');
    if (v.length < 8) return fail('Password must be at least 8 characters.');
    if (v.length > 128) return fail('Password must be 128 characters or fewer.');
    if (!/[a-z]/.test(v) || !/[A-Z]/.test(v)) return fail('Use both upper-case and lower-case letters.');
    if (!/[0-9]/.test(v)) return fail('Include at least one number.');
    return ok(v);
  }

  /** Returns 0-4 so the UI can render a strength meter. */
  function passwordStrength(pw) {
    var v = String(pw || ''), s = 0;
    if (v.length >= 8) s++;
    if (/[a-z]/.test(v) && /[A-Z]/.test(v)) s++;
    if (/[0-9]/.test(v)) s++;
    if (/[^A-Za-z0-9]/.test(v) || v.length >= 14) s++;
    return s;
  }

  /** Display names: 2-60 characters, letters, spaces and common punctuation only. */
  function validateName(name) {
    var v = sanitizeText(name);
    if (!v) return fail('Name is required.');
    if (v.length < 2) return fail('Name must be at least 2 characters.');
    if (v.length > 60) return fail('Name must be 60 characters or fewer.');
    if (!/^[\p{L}][\p{L}\p{M} .,'’-]*$/u.test(v)) return fail('Name may only contain letters, spaces and . , \' -');
    return ok(v);
  }

  /** FR-042: title must be 3-20 characters (after trimming). */
  function validateTaskTitle(title) {
    var v = sanitizeText(title);
    if (v.length < 3) return fail('Task title must be at least 3 characters.');
    if (v.length > 20) return fail('Task title must be 20 characters or fewer.');
    return ok(v);
  }

  /** FR-043: optional description, at most 250 characters. */
  function validateTaskDescription(desc) {
    var v = sanitizeText(desc);
    if (v.length > 250) return fail('Description must be 250 characters or fewer.');
    return ok(v);
  }

  /**
   * FR-044: at most three optional tags. Tag format is an open item in the
   * specification, so we adopt: 2-20 chars, letters/digits plus . + # - and space.
   */
  function validateTags(tags) {
    var list = (tags || []).map(sanitizeText).filter(Boolean);
    if (list.length > 3) return fail('Maximum 3 topic tags allowed.');
    var seen = {};
    for (var i = 0; i < list.length; i++) {
      var t = list[i];
      if (t.length < 2 || t.length > 20) return fail('Each tag must be 2-20 characters.');
      if (!/^[A-Za-z0-9][A-Za-z0-9 .+#-]*$/.test(t)) return fail('Tag "' + t + '" contains characters that are not allowed.');
      var k = t.toLowerCase();
      if (seen[k]) return fail('Duplicate tag "' + t + '".');
      seen[k] = 1;
    }
    return ok(list);
  }

  /** Safe file name: strip paths and unsafe characters, keep the extension. */
  function sanitizeFileName(name) {
    var base = String(name || '').split(/[\\/]/).pop();
    return base.replace(/[^\w.\- ()]/g, '_').slice(0, 120) || 'file';
  }

  /**
   * FR-029 / NFR-018: file up to 10 MiB succeeds, 10.1 MB is rejected (HTTP 413).
   * @param {{name:string,size:number}} file
   */
  function validateFile(file) {
    if (!file || !file.name) return fail('No file selected.');
    var name = sanitizeFileName(file.name);
    var ext = (name.split('.').pop() || '').toLowerCase();
    if (name.indexOf('.') === -1 || ALLOWED_EXT.indexOf(ext) === -1) return fail('File type ".' + ext + '" is not supported.');
    if (!(file.size > 0)) return fail('The file is empty.');
    if (file.size > MAX_FILE_BYTES) return { ok: false, status: 413, error: 'File is larger than the 10 MB limit (' + (file.size / 1048576).toFixed(1) + ' MB).' };
    return ok({ name: name, size: file.size, ext: ext });
  }

  /** FR-014: free-text message to a prospective collaborator (<= 500 chars). */
  function validateMessage(msg, opts) {
    var min = (opts && opts.min) || 10;
    var v = sanitizeText(msg);
    if (v.length < min) return fail('Write at least ' + min + ' characters so the recipient understands your request.');
    if (v.length > 500) return fail('Message must be 500 characters or fewer.');
    return ok(v);
  }

  /** FR-007/008: project brief fields. Returns { ok, errors:{field:msg}, value }. */
  function validateProjectBrief(b) {
    var errors = {};
    var title = sanitizeText(b.title);
    if (title.length < 5) errors.title = 'Title must be at least 5 characters.';
    else if (title.length > 120) errors.title = 'Title must be 120 characters or fewer.';
    var subject = sanitizeText(b.subject);
    if (!subject) errors.subject = 'Choose a subject area.';
    var question = sanitizeText(b.question);
    if (question.length < 20) errors.question = 'Describe the research question in at least 20 characters.';
    else if (question.length > 600) errors.question = 'Research question must be 600 characters or fewer.';
    var objectives = (b.objectives || []).map(sanitizeText).filter(Boolean);
    if (objectives.length < 1) errors.objectives = 'Add at least one objective.';
    var skills = (b.skills || []).map(sanitizeText).filter(Boolean);
    if (skills.length < 1) errors.skills = 'Add at least one required skill.';
    if (skills.length > 10) errors.skills = 'Maximum 10 required skills.';
    var hours = Number(b.hoursPerWeek);
    if (!(hours >= 1 && hours <= 40)) errors.hoursPerWeek = 'Enter an expected commitment between 1 and 40 hours per week.';
    if (!b.stage) errors.stage = 'Choose a research stage.';
    if (!b.visibility) errors.visibility = 'Choose who can see this brief.';
    return {
      ok: Object.keys(errors).length === 0,
      errors: errors,
      value: { title: title, subject: subject, question: question, objectives: objectives, skills: skills, hoursPerWeek: hours }
    };
  }

  /** FR-020: mentorship request needs a topic, goals and stage. */
  function validateMentorshipRequest(r) {
    var errors = {};
    if (!sanitizeText(r.topic)) errors.topic = 'Choose a topic.';
    var goals = sanitizeText(r.goals);
    if (goals.length < 20) errors.goals = 'Describe your goals in at least 20 characters.';
    else if (goals.length > 600) errors.goals = 'Goals must be 600 characters or fewer.';
    if (!r.stage) errors.stage = 'Choose your current project stage.';
    if (!sanitizeText(r.guidance)) errors.guidance = 'Say what kind of guidance you need.';
    return { ok: Object.keys(errors).length === 0, errors: errors };
  }

  /** Profile edit (FR-003/004): bio length and list limits. */
  function validateProfile(p) {
    var errors = {};
    var n = validateName(p.name); if (!n.ok) errors.name = n.error;
    if (sanitizeText(p.headline).length > 100) errors.headline = 'Headline must be 100 characters or fewer.';
    if ((p.interests || []).length < 1) errors.interests = 'Add at least one research interest.';
    if ((p.skills || []).length < 1) errors.skills = 'Add at least one skill.';
    if (sanitizeText(p.experience).length > 800) errors.experience = 'Experience summary must be 800 characters or fewer.';
    if (p.link && !/^https?:\/\/[^\s]+\.[^\s]+$/i.test(p.link)) errors.link = 'Enter a full link starting with https://';
    return { ok: Object.keys(errors).length === 0, errors: errors };
  }

  /** Feedback score on a completed support request: integer 1-5. */
  function validateFeedback(rating, comment) {
    var r = Number(rating);
    if (!(r >= 1 && r <= 5) || Math.floor(r) !== r) return fail('Choose a rating from 1 to 5.');
    var c = sanitizeText(comment);
    if (c.length > 300) return fail('Feedback comment must be 300 characters or fewer.');
    return ok({ rating: r, comment: c });
  }

  return {
    MAX_FILE_BYTES: MAX_FILE_BYTES, ALLOWED_EXT: ALLOWED_EXT,
    escapeHtml: escapeHtml, sanitizeText: sanitizeText, sanitizeFileName: sanitizeFileName,
    validateEmail: validateEmail, validatePassword: validatePassword, passwordStrength: passwordStrength,
    validateName: validateName, validateTaskTitle: validateTaskTitle, validateTaskDescription: validateTaskDescription,
    validateTags: validateTags, validateFile: validateFile, validateMessage: validateMessage,
    validateProjectBrief: validateProjectBrief, validateMentorshipRequest: validateMentorshipRequest,
    validateProfile: validateProfile, validateFeedback: validateFeedback
  };
});
