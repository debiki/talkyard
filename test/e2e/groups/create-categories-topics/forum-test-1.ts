var testData = {
  site: {
    name: 'zzwwqq',
  },
  settings: [{

  }],
  groups: [{

  }],
  users: [{

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

    b.import(testData, (response) => console.log("Yayzz2 " + JSON.stringify(response)));
    b.end();
  },
};

export = tests;
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
