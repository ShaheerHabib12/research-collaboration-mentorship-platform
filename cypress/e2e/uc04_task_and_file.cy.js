// UC-04: a team member adds a task (3-20 characters) and uploads a private file in the workspace.
describe('UC-04 task and file upload', () => {
  beforeEach(() => cy.signIn('aisha@port.ac.uk'));
  it('refuses a 21-character title and saves a valid one', () => {
    cy.visit('/workspace?id=PRJ-1001');
    cy.get('#newTask').click();
    cy.get('#tt').type('x'.repeat(21));
    cy.get('#sv').click();
    cy.get('[data-field=title] .error-text').should('be.visible');
    cy.get('#tt').clear().type('Cypress task');
    cy.get('#sv').click();
    cy.contains('Cypress task').should('be.visible');
  });
  it('uploads a small file and refuses one above 10 MB', () => {
    cy.visit('/workspace?id=PRJ-1001');
    cy.get('#file').selectFile({ contents: Cypress.Buffer.from('hello research'), fileName: 'notes.txt', mimeType: 'text/plain' }, { force: true });
    cy.contains('notes.txt').should('be.visible');
    cy.get('#big').click();
    cy.contains(/10 ?MB/i).should('be.visible');
  });
});
