/**
 * rules.js
 * ---------------------------------------------------------------------------
 * Pure business rules for RCMP. No DOM, no storage - so they are trivially
 * unit-testable (tests/rules.test.js).
 *
 *   canTransitionRequest ... FR-016 / NFR-009  legitimate request transitions only
 *   allowanceSummary ....... FR-045..047, UC-06/UC-07 subscription allowance
 *   calcCompensation ....... FR-053..055, UC-08   70% requests / 30% feedback bonus
 *   filterAndPage .......... FR-012/013, NFR-015  search filters + pagination
 *   canViewField ........... FR-005 / FR-009      profile & project visibility
 * ---------------------------------------------------------------------------
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RCMPRules = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Allowed collaboration-request transitions (NFR-009: only legitimate moves).
   * Pending is the only state that can change; every other state is final.
   */
  var REQUEST_TRANSITIONS = {
    pending: ['accepted', 'declined', 'withdrawn'],
    accepted: [], declined: [], withdrawn: []
  };

  /**
   * @param {string} from current stored status
   * @param {string} to   requested status
   * @returns {boolean}
   */
  function canTransitionRequest(from, to) {
    return (REQUEST_TRANSITIONS[from] || []).indexOf(to) !== -1;
  }

  /**
   * Who may perform a transition: recipient accepts/declines, sender withdraws.
   * @param {'accepted'|'declined'|'withdrawn'} to
   * @param {{from:string,to:string}} req  from = sender id, to = recipient id
   * @param {string} userId
   */
  function canActOnRequest(to, req, userId) {
    if (to === 'withdrawn') return req.from === userId;
    return req.to === userId;
  }

  /**
   * Subscription allowance (FR-045..047). Requests are "reserved" on submit
   * and returned when declined/rejected, so used = every non-returned request.
   * @param {{allowance:number}|null} plan
   * @param {Array<{status:string}>} requests requests made in the current period
   * @returns {{allowance:number, used:number, remaining:number, blocked:boolean}}
   */
  function allowanceSummary(plan, requests) {
    var allowance = plan ? plan.allowance : 0;
    var returned = ['declined', 'rejected', 'withdrawn'];
    var used = (requests || []).filter(function (r) { return returned.indexOf(r.status) === -1; }).length;
    var remaining = Math.max(0, allowance - used);
    return { allowance: allowance, used: used, remaining: remaining, blocked: remaining === 0 };
  }

  /**
   * Researcher compensation statement (UC-08, FR-053..055).
   *
   *   eligible  = active researcher with an agreed base and a defined period
   *   bonus     = bonusCap * (0.70 * min(completed/target, 1) + 0.30 * avgFeedback/5)
   *   bonus = 0 (and statement flagged) when feedback count < minFeedback
   *
   * Missing data never produces a silent zero: the statement is flagged for review.
   *
   * @param {object} i
   * @param {number} i.base            agreed base compensation for the period
   * @param {number} i.completed       completed, eligible requests
   * @param {number} i.target          contribution target for the period
   * @param {number[]} i.feedback      student ratings 1-5
   * @param {boolean} i.active         researcher active in the period
   * @param {object} cfg               { weightRequests, weightFeedback, bonusCap, minFeedback }
   */
  function calcCompensation(i, cfg) {
    cfg = cfg || { weightRequests: 0.7, weightFeedback: 0.3, bonusCap: 300, minFeedback: 3 };
    var flags = [];
    var feedback = (i.feedback || []).filter(function (n) { return n >= 1 && n <= 5; });
    var avg = feedback.length ? feedback.reduce(function (a, b) { return a + b; }, 0) / feedback.length : 0;

    if (i.base == null || isNaN(i.base)) flags.push('Missing agreed base compensation');
    if (i.target == null || !(i.target > 0)) flags.push('Missing contribution target');
    if (!i.active) flags.push('Researcher inactive in period - bonus not applied');
    if (feedback.length < cfg.minFeedback) flags.push('Fewer than ' + cfg.minFeedback + ' feedback responses - bonus not applied');

    var base = Number(i.base) || 0;
    var ratio = i.target > 0 ? Math.min(i.completed / i.target, 1) : 0;
    var bonusApplies = i.active && feedback.length >= cfg.minFeedback && i.target > 0;
    var raw = bonusApplies ? cfg.bonusCap * (cfg.weightRequests * ratio + cfg.weightFeedback * (avg / 5)) : 0;
    var bonus = Math.round(raw * 100) / 100;
    return {
      base: base, completedRatio: ratio, feedbackAvg: Math.round(avg * 100) / 100, feedbackCount: feedback.length,
      requestsPart: bonusApplies ? Math.round(cfg.bonusCap * cfg.weightRequests * ratio * 100) / 100 : 0,
      feedbackPart: bonusApplies ? Math.round(cfg.bonusCap * cfg.weightFeedback * (avg / 5) * 100) / 100 : 0,
      bonus: bonus, total: Math.round((base + bonus) * 100) / 100, flags: flags, needsReview: flags.length > 0
    };
  }

  /** Allowed statement status moves - a payout can never be shown as paid without approval. */
  var STATEMENT_TRANSITIONS = {
    draft: ['awaiting_approval'],
    awaiting_approval: ['approved', 'draft'],
    approved: ['paid', 'payout_failed'],
    payout_failed: ['approved'],
    paid: []
  };
  function canTransitionStatement(from, to) {
    return (STATEMENT_TRANSITIONS[from] || []).indexOf(to) !== -1;
  }

  /**
   * Generic search + paginate (FR-012/013, NFR-015).
   * @param {Array} items
   * @param {{q?:string, skills?:string[], filters?:Function[]}} f
   * @param {number} page 1-based
   * @param {number} pageSize
   * @param {(item:any)=>string} haystack text to search in
   * @param {(item:any)=>string[]} skillsOf skills of an item
   */
  function filterAndPage(items, f, page, pageSize, haystack, skillsOf) {
    f = f || {};
    var q = String(f.q || '').trim().toLowerCase();
    var wanted = (f.skills || []).map(function (s) { return s.toLowerCase(); });
    var out = items.filter(function (it) {
      if (q && haystack(it).toLowerCase().indexOf(q) === -1) return false;
      if (wanted.length) {
        var have = (skillsOf(it) || []).map(function (s) { return s.toLowerCase(); });
        if (!wanted.every(function (w) { return have.indexOf(w) !== -1; })) return false;
      }
      return (f.filters || []).every(function (fn) { return fn(it); });
    });
    var total = out.length;
    var pages = Math.max(1, Math.ceil(total / pageSize));
    var p = Math.min(Math.max(1, page || 1), pages);
    return { total: total, pages: pages, page: p, items: out.slice((p - 1) * pageSize, p * pageSize) };
  }

  /**
   * Field visibility (FR-005, FR-009).
   * level: 'public' = every signed-in user, 'team' = people sharing a project, 'private' = owner only.
   */
  function canViewField(level, viewerId, ownerId, sharesProject) {
    if (viewerId === ownerId) return true;
    if (level === 'public') return true;
    if (level === 'team') return !!sharesProject;
    return false;
  }

  /** Pause check for non-essential notifications (FR-034/035). */
  function shouldDeliverNotification(n, prefs, now) {
    if (n.essential) return true;
    if (prefs && prefs.pausedUntil && now < new Date(prefs.pausedUntil).getTime()) return false;
    if (prefs && prefs.categories && prefs.categories[n.category] === false) return false;
    return true;
  }

  return {
    REQUEST_TRANSITIONS: REQUEST_TRANSITIONS, STATEMENT_TRANSITIONS: STATEMENT_TRANSITIONS,
    canTransitionRequest: canTransitionRequest, canActOnRequest: canActOnRequest,
    allowanceSummary: allowanceSummary, calcCompensation: calcCompensation,
    canTransitionStatement: canTransitionStatement, filterAndPage: filterAndPage,
    canViewField: canViewField, shouldDeliverNotification: shouldDeliverNotification
  };
});
