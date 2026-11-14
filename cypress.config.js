// Cypress end-to-end configuration (Coursework 1 test plan: Cypress + axe-core).
// Start the app first (`npm run build && npm start`, or docker compose up), then `npm run cypress`.
const { defineConfig } = require('cypress');
module.exports = defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL || 'http://localhost:3000',
    specPattern: 'cypress/e2e/**/*.cy.js',
    supportFile: 'cypress/support/e2e.js',
    video: false,
    defaultCommandTimeout: 8000,
    retries: { runMode: 1, openMode: 0 }
  }
});
