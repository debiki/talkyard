var testData = {
  site: {
    id: 'zzgg',
    name: 'zzwwqq4' + Date.now(),
    hostname: 'whatever4' + Date.now(),
    creatorEmailAddress: "e2e-test-owner@ex.com",
  },
  settings: [{

  }],
  groups: [{

  }],
  users: [{
    id: 123,
    username: "e2e_test__owner",
    fullName: "E2E Test Owner",
    createdAtMs: 1449198824000,
    emailAddress: "e2e-test-owner@ex.com",
    emailVerifiedAtMs: 1449198824000,
    passwordHash: "cleartext:public123",
    isOwner: true,
    isAdmin: true,
  }],
  identities: [{

  }],
  guests: [{

  }],
  blocks: [{

  }],
  invites: [{

  }],
  categories: [{

  }],
  pages: [{

  }],
  emailsOut: [{

  }],
  notifications: [{

  }],
  uploads: [{

  }],
  auditLog: [{

  }],
  reviewTasks: [{

  }],
};

var tests = {
  '@tags': ['Import'],
  'test import': function(b) {
    var globals = b.globals;

    b.import(testData, (site) => {
      console.log("Site: " + JSON.stringify(site));
      b.url(site.siteIdOrigin);
    });

    // Better: give the text block an #e2e... id.
    b.expect.element('body').text.to.contain('login as admin to create something');
    b.endOrPause();
  },
};

export = tests;
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
