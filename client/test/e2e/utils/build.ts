/// <reference path="../test-types.ts"/>
/// <reference path="../../../../modules/definitely-typed/lodash/lodash.d.ts"/>
/// <reference path="../../../../modules/definitely-typed/node/node.d.ts"/>

import _ = require('lodash');
import assert = require('assert');


var baseData: SiteData = {
  site: {
    id: null,
    localHostname: null,
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
    /*
    id: number;
    page_id: string;
    parent_id?: number;
    name: string;
    slug: string;
    position?: number = 50;
    description?: string;
    new_topic_types?: string;
    created_at: number;
    updated_at: number;
    locked_at?: number;
    frozen_at?: number;
    deleted_at?: number;
    hide_in_forum: boolean;
    */
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


function site_setLocalHostname(site: SiteData, name) {
  site.site.localHostname = name.toLowerCase();
}


var api = {
  emptyForumOnlyOwner: function(localHostname?: string) {
    localHostname = localHostname || 'x' + Date.now();
    var site = _.cloneDeep(baseData);
    site_setLocalHostname(site, 'test--' + localHostname);
    return site;
  }
};


export = api;
