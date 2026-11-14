import 'cypress-axe';

// Sign in through the real login form (demo accounts exist only when the server runs with demo data, never in production).
Cypress.Commands.add('signIn', (email, password = 'Demo@1234') => {
  cy.visit('/login');
  cy.get('#form input[type=email], #email').first().type(email);
  cy.get('#form input[type=password], #password').first().type(password, { log: false });
  cy.get('#form button[type=submit]').click();
  cy.location('pathname').should('eq', '/dashboard');
});

// axe-core: no serious or critical violation (WCAG 2.1 A/AA), NFR-013.
Cypress.Commands.add('a11y', () => {
  cy.injectAxe();
  cy.checkA11y(null, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, includedImpacts: ['serious', 'critical'] });
});
