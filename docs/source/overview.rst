Overview and running the system
===============================

Requirements: Node.js 22.13 or newer and PostgreSQL 14 or newer. There are no
npm dependencies to install.

.. code-block:: bash

   docker compose up -d db
   npm start            # http://localhost:3000
   npm test             # all automated tests
   npm run coverage     # tests with the coverage gate
   npm run report       # writes docs/evidence/*.txt

Demo accounts use the password ``Demo@1234``. See the repository README for the
full list, configuration variables and screenshots.
