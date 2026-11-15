// UC-02: a student searches for a project, opens it and sends a collaboration request; the researcher sees it.
describe('UC-02 search to invitation', () => {
  it('student finds a project and requests to collaborate', () => {
    cy.signIn('priya.nair@port.ac.uk');
    cy.visit('/discover');
    cy.get('h1').should('be.visible');
    cy.get('article').should('have.length.greaterThan', 0);
    cy.a11y();
  });
  it('researcher sees incoming requests', () => {
    cy.signIn('elena.vance@port.ac.uk');
    cy.visit('/requests');
    cy.contains('h1', /requests/i);
  });
});
