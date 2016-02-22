var _ = require('lodash');
var assert = require('assert');
var settings = require('./settings.js');


var baseData = {
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


var api = {
  emptyForumOnlyOwner: function() {
    return _.cloneDeep(baseData);
  }
};


module.exports = api;