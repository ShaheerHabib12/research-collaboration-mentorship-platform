// NFR-011 / NFR-013: no sideways scrolling and no serious accessibility violations at phone, tablet and desktop sizes.
// Measured after the page has settled, and retried for up to 4 s: on one CI run the width was read 15 px too wide while the page was still sliding in, then the same page passed. A real overflow stays and still fails.
const noSideScroll = () => cy.document().should((d) => expect(d.documentElement.scrollWidth - d.documentElement.clientWidth).to.be.at.most(1));
const sizes = [[360, 800], [768, 1024], [1280, 800]];
const pub = ['/', '/pricing', '/contact', '/privacy', '/login', '/register'];
const app = ['/dashboard', '/discover', '/projects', '/subscription', '/notifications', '/mentors', '/workspace?id=PRJ-1001'];
sizes.forEach(([w, h]) => {
  describe('viewport ' + w + 'x' + h, () => {
    beforeEach(() => cy.viewport(w, h));
    pub.forEach((u) => it('public ' + u, () => {
      cy.visit(u); cy.get('h1').should('be.visible');
      cy.wait(900); noSideScroll(); cy.a11y();
    }));
    app.forEach((u) => it('signed in ' + u, () => {
      cy.signIn('aisha@port.ac.uk'); cy.visit(u); cy.get('h1').should('be.visible');
      cy.wait(900); noSideScroll(); cy.a11y();
    }));
  });
});
