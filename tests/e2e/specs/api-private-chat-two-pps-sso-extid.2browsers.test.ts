/// <reference path="../test-types.ts"/>

import addApiChatTestSteps from './api-private-chat-two-pps-impl.test';
import settings = require('../utils/settings');
import lad = require('../utils/log-and-die');
import c = require('../test-constants');


describe("api-private-chat-two-pps-notfs   TyT603WKVJW336", () => {

  //if (settings.prod) {
  //  console.log("Skipping this spec — the server needs to have upsert conf vals enabled."); // E2EBUG
  //  return;
  //}

  addApiChatTestSteps({ useExtIdAndSsoId: true });

});
