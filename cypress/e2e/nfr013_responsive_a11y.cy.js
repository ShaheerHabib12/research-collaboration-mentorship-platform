// NFR-011 / NFR-013: no sideways scrolling and no serious accessibility violations at phone, tablet and desktop sizes.
const sizes = [[360, 800], [768, 1024], [1280, 800]];
const pub = ['/', '/pricing', '/contact', '/privacy', '/login', '/register'];
const app = ['/dashboard', '/discover', '/projects', '/subscription', '/notifications', '/mentors', '/workspace?id=PRJ-1001'];
sizes.forEach(([w, h]) => {
  describe('viewport ' + w + 'x' + h, () => {
    beforeEach(() => cy.viewport(w, h));
    pub.forEach((u) => it('public ' + u, () => {
      cy.visit(u); cy.get('h1').should('be.visible');
      cy.document().then((d) => expect(d.documentElement.scrollWidth - d.documentElement.clientWidth).to.be.at.most(1));
      cy.wait(900); cy.a11y();
    }));
    app.forEach((u) => it('signed in ' + u, () => {
      cy.signIn('aisha@port.ac.uk'); cy.visit(u); cy.get('h1').should('be.visible');
      cy.document().then((d) => expect(d.documentElement.scrollWidth - d.documentElement.clientWidth).to.be.at.most(1));
      cy.wait(900); cy.a11y();
    }));
  });
});
