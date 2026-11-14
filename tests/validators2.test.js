/**
 * Boundary and equivalence tests for every remaining validator (email, password, name, description, tags, file, message,
 * project brief, mentorship request, profile, feedback). TC-V10..V22. Written to raise the mutation score: each test pins
 * an exact limit so a small change to a limit or a message is caught.
 */
const assert = require('node:assert/strict');
const V = require('../shared/validators.js');
const rep = (c, n) => c.repeat(n);

test('TC-V10 email: required, 254 maximum, shape, lower-cased and trimmed', () => {
  assert.equal(V.validateEmail('').ok, false); assert.equal(V.validateEmail(undefined).error, 'Email address is required.');
  assert.equal(V.validateEmail('a@b.co').ok, true);
  assert.equal(V.validateEmail('a@b.c').ok, false, 'one-letter domain ending');
  assert.equal(V.validateEmail('  Name@Port.AC.uk ').value, 'name@port.ac.uk');
  for (const bad of ['no-at.com', 'a@b', 'a b@c.com', 'a@@c.com', '<a>@c.com', 'a@c.com>', '(x)@c.com', '@c.com', 'a@.com']) assert.equal(V.validateEmail(bad).ok, false, bad);
  const long = rep('a', 242) + '@example.com'; assert.equal(long.length, 254); assert.equal(V.validateEmail(long).ok, true);
  assert.equal(V.validateEmail('a' + long).ok, false); assert.equal(V.validateEmail('a' + long).error, 'Email address is too long.');
});
test('TC-V11 password: length 8 to 128, needs lower, upper and a digit, each with its own message', () => {
  assert.equal(V.validatePassword('Abcdef1').error, 'Password must be at least 8 characters.');
  assert.equal(V.validatePassword('Abcdefg1').ok, true);
  assert.equal(V.validatePassword('Aa1' + rep('x', 125)).ok, true); assert.equal(V.validatePassword('Aa1' + rep('x', 126)).error, 'Password must be 128 characters or fewer.');
  assert.equal(V.validatePassword('abcdefg1').error, 'Use both upper-case and lower-case letters.');
  assert.equal(V.validatePassword('ABCDEFG1').error, 'Use both upper-case and lower-case letters.');
  assert.equal(V.validatePassword('Abcdefgh').error, 'Include at least one number.');
  assert.equal(V.validatePassword(undefined).ok, false);
});
test('TC-V12 password strength meter returns 0 to 4 and each rule adds exactly one point', () => {
  assert.equal(V.passwordStrength(''), 0); assert.equal(V.passwordStrength('abc'), 0);
  assert.equal(V.passwordStrength('abcdefgh'), 1); assert.equal(V.passwordStrength('Abcdefgh'), 2); assert.equal(V.passwordStrength('Abcdefg1'), 3);
  assert.equal(V.passwordStrength('Abcdefg1!'), 4); assert.equal(V.passwordStrength('Abcdefghijklm1'), 4, '14 characters also counts');
  assert.equal(V.passwordStrength('Abcdefghijkl1'), 3); assert.equal(V.passwordStrength('a1'), 1, 'digit only gives one');
});
test('TC-V13 name: 2 to 60 characters, letters, spaces and . , \' - only; accents allowed', () => {
  assert.equal(V.validateName('').error, 'Name is required.'); assert.equal(V.validateName('A').error, 'Name must be at least 2 characters.');
  assert.equal(V.validateName('Al').ok, true); assert.equal(V.validateName(rep('a', 60)).ok, true); assert.equal(V.validateName(rep('a', 61)).error, 'Name must be 60 characters or fewer.');
  for (const good of ['José Álvarez', "O'Neil", 'Anne-Marie', 'Dr. Who', 'Zoë Smith']) assert.equal(V.validateName(good).ok, true, good);
  for (const bad of ['1abc', 'a@b', 'Bob 2', '-Bob', ' .x']) assert.equal(V.validateName(bad).ok, false, bad);
});
test('TC-V14 task description: optional, 250 allowed, 251 refused, text is cleaned', () => {
  assert.equal(V.validateTaskDescription('').ok, true); assert.equal(V.validateTaskDescription(undefined).ok, true);
  assert.equal(V.validateTaskDescription(rep('a', 250)).ok, true); assert.equal(V.validateTaskDescription(rep('a', 251)).error, 'Description must be 250 characters or fewer.');
  assert.equal(V.validateTaskDescription('  hello  ').value, 'hello');
});
test('TC-V15 tags: up to 3, each 2 to 20 characters, allowed symbols only, no case-insensitive duplicates', () => {
  assert.deepEqual(V.validateTags([]).value, []); assert.deepEqual(V.validateTags(undefined).value, []); assert.deepEqual(V.validateTags(['', ' ']).value, []);
  assert.equal(V.validateTags(['ab', 'c++', 'C#']).ok, true); assert.equal(V.validateTags(['aa', 'bb', 'cc', 'dd']).error, 'Maximum 3 topic tags allowed.');
  assert.equal(V.validateTags(['a']).error, 'Each tag must be 2-20 characters.'); assert.equal(V.validateTags([rep('a', 20)]).ok, true); assert.equal(V.validateTags([rep('a', 21)]).ok, false);
  assert.match(V.validateTags(['ok', '!bad']).error, /not allowed/); assert.match(V.validateTags(['_x']).error, /not allowed/);
  assert.match(V.validateTags(['Data', 'data']).error, /Duplicate tag "data"/); assert.equal(V.validateTags(['a.b', 'x y', 'q-r']).ok, true);
});
test('TC-V16 file: each allowed type passes, others fail with the type named, size boundaries exact', () => {
  for (const e of ['pdf', 'docx', 'doc', 'xlsx', 'csv', 'txt', 'md', 'png', 'jpg', 'jpeg', 'zip', 'pptx', 'ipynb', 'json', 'parquet']) assert.equal(V.validateFile({ name: 'x.' + e, size: 5 }).ok, true, e);
  assert.equal(V.validateFile({ name: 'x.PDF', size: 5 }).value.ext, 'pdf', 'extension compared in lower case');
  assert.equal(V.validateFile({ name: 'x.exe', size: 5 }).error, 'File type ".exe" is not supported.'); assert.equal(V.validateFile({ name: 'noext', size: 5 }).ok, false);
  assert.equal(V.validateFile(null).error, 'No file selected.'); assert.equal(V.validateFile({ size: 5 }).error, 'No file selected.');
  assert.equal(V.validateFile({ name: 'a.pdf', size: 0 }).error, 'The file is empty.'); assert.equal(V.validateFile({ name: 'a.pdf', size: -1 }).ok, false);
  assert.equal(V.validateFile({ name: 'a.pdf', size: 1 }).ok, true);
  assert.equal(V.validateFile({ name: 'a.pdf', size: 10 * 1048576 }).ok, true);
  const big = V.validateFile({ name: 'a.pdf', size: 10 * 1048576 + 1 }); assert.equal(big.ok, false); assert.equal(big.status, 413); assert.match(big.error, /10 MB limit \(10\.0 MB\)/);
  assert.equal(V.validateFile({ name: 'a.pdf', size: 10.1 * 1048576 }).error, 'File is larger than the 10 MB limit (10.1 MB).');
});
test('TC-V17 file name sanitising: path stripped, unsafe characters replaced, length capped at 120, fallback "file"', () => {
  assert.equal(V.sanitizeFileName('../../a/b\\c.txt'), 'c.txt'); assert.equal(V.sanitizeFileName('my report (1).pdf'), 'my report (1).pdf');
  assert.equal(V.sanitizeFileName('bad<>:"|?*.txt'), 'bad_______.txt'); assert.equal(V.sanitizeFileName(''), 'file'); assert.equal(V.sanitizeFileName(undefined), 'file'); assert.equal(V.sanitizeFileName('dir/'), 'file');
  assert.equal(V.sanitizeFileName(rep('a', 200) + '.txt').length, 120); assert.equal(V.sanitizeFileName(rep('a', 120)).length, 120);
});
test('TC-V18 collaboration message: 10 to 500 characters by default, minimum can be changed', () => {
  assert.equal(V.validateMessage(rep('a', 9)).error, 'Write at least 10 characters so the recipient understands your request.'); assert.equal(V.validateMessage(rep('a', 10)).ok, true);
  assert.equal(V.validateMessage(rep('a', 500)).ok, true); assert.equal(V.validateMessage(rep('a', 501)).error, 'Message must be 500 characters or fewer.');
  assert.equal(V.validateMessage(rep('a', 4), { min: 5 }).ok, false); assert.equal(V.validateMessage(rep('a', 5), { min: 5 }).ok, true); assert.equal(V.validateMessage('', {}).ok, false);
});
const brief = () => ({ title: 'Valid title', subject: 'Computer Science', question: rep('q', 20), objectives: ['one'], skills: ['Python'], hoursPerWeek: 8, stage: 'planning', visibility: 'public' });
test('TC-V19 project brief: every field has an exact boundary and its own error key', () => {
  assert.equal(V.validateProjectBrief(brief()).ok, true);
  const cases = [
    [{ title: 'abcd' }, 'title'], [{ title: rep('t', 121) }, 'title'], [{ subject: '' }, 'subject'], [{ question: rep('q', 19) }, 'question'], [{ question: rep('q', 601) }, 'question'],
    [{ objectives: [] }, 'objectives'], [{ objectives: [' '] }, 'objectives'], [{ skills: [] }, 'skills'], [{ skills: Array(11).fill('x') }, 'skills'],
    [{ hoursPerWeek: 0 }, 'hoursPerWeek'], [{ hoursPerWeek: 41 }, 'hoursPerWeek'], [{ hoursPerWeek: 'abc' }, 'hoursPerWeek'], [{ stage: '' }, 'stage'], [{ visibility: '' }, 'visibility']
  ];
  for (const [patch, key] of cases) { const r = V.validateProjectBrief(Object.assign(brief(), patch)); assert.equal(r.ok, false, key); assert.ok(r.errors[key], key + ' error present'); }
  for (const patch of [{ title: 'abcde' }, { title: rep('t', 120) }, { question: rep('q', 600) }, { skills: Array(10).fill('x') }, { hoursPerWeek: 1 }, { hoursPerWeek: 40 }]) assert.equal(V.validateProjectBrief(Object.assign(brief(), patch)).ok, true, JSON.stringify(patch).slice(0, 30));
  assert.equal(V.validateProjectBrief(brief()).value.hoursPerWeek, 8);
});
test('TC-V20 mentorship request: topic, goals 20 to 600, stage and guidance are all required', () => {
  const ok = { topic: 'Statistics', goals: rep('g', 20), stage: 'planning', guidance: 'Review my plan' }; assert.equal(V.validateMentorshipRequest(ok).ok, true);
  for (const [p, k] of [[{ topic: '' }, 'topic'], [{ goals: rep('g', 19) }, 'goals'], [{ goals: rep('g', 601) }, 'goals'], [{ stage: '' }, 'stage'], [{ guidance: ' ' }, 'guidance']]) { const r = V.validateMentorshipRequest(Object.assign({}, ok, p)); assert.equal(r.ok, false); assert.ok(r.errors[k], k); }
  assert.equal(V.validateMentorshipRequest(Object.assign({}, ok, { goals: rep('g', 600) })).ok, true);
});
test('TC-V21 profile: name rule, headline 100, experience 800, at least one interest and skill, link must be a full URL', () => {
  const ok = { name: 'Aisha Rahman', headline: 'h', interests: ['x'], skills: ['y'], experience: '', link: '' }; assert.equal(V.validateProfile(ok).ok, true);
  for (const [p, k] of [[{ name: '' }, 'name'], [{ headline: rep('h', 101) }, 'headline'], [{ interests: [] }, 'interests'], [{ skills: [] }, 'skills'], [{ experience: rep('e', 801) }, 'experience'], [{ link: 'example.com' }, 'link'], [{ link: 'http://nodot' }, 'link']]) { const r = V.validateProfile(Object.assign({}, ok, p)); assert.equal(r.ok, false, k); assert.ok(r.errors[k], k); }
  for (const p of [{ headline: rep('h', 100) }, { experience: rep('e', 800) }, { link: 'https://a.example.org/x' }, { link: 'HTTP://A.example.org' }]) assert.equal(V.validateProfile(Object.assign({}, ok, p)).ok, true);
});
test('TC-V22 feedback: whole number 1 to 5, comment at most 300', () => {
  for (const r of [1, 2, 3, 4, 5, '5']) assert.equal(V.validateFeedback(r, '').ok, true, String(r));
  for (const r of [0, 6, 2.5, 'x', undefined, -1]) assert.equal(V.validateFeedback(r, '').error, 'Choose a rating from 1 to 5.', String(r));
  assert.equal(V.validateFeedback(3, rep('c', 300)).ok, true); assert.equal(V.validateFeedback(3, rep('c', 301)).error, 'Feedback comment must be 300 characters or fewer.'); assert.deepEqual(V.validateFeedback(4, ' hi ').value, { rating: 4, comment: 'hi' });
});
