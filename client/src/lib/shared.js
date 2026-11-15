// The validators, business rules and reference data are shared with the server (UMD files in /shared).
// They run in the browser only for instant feedback; the server re-checks everything (NFR-004).
// vite.config.js (plugin "rcmp-shared-umd") makes them attach to window instead of CommonJS exports.
import '../../../shared/constants.js';
import '../../../shared/validators.js';
import '../../../shared/rules.js';

export const C = window.RCMPConstants;
export const V = window.RCMPValidators;
export const R = window.RCMPRules;
