import * as makeRequest from 'supertest';
import server from '../server';
import { buildSite } from '../../e2e/utils/site-builder';
import { dj } from '../../e2e/utils/log-and-die';
import { default as settings } from '../../e2e/utils/settings-exp-def';

let site: IdAddress;
let forum: EmptyTestForum;  // or TwoPagesTestForum or LargeTestForum

beforeAll(async () => {
  if (!settings.localHostname) {
    settings.randomLocalHostname = true;
  }
  server.initOrExit(settings);
  const builder = buildSite(undefined, { okInitEarly: true });
  forum = builder.addEmptyForum({  // or addTwoPagesForum or addLargeForum
    title: "Some E2E Test",
    members: ['owen'],
      // ['mons', 'modya', 'regina', 'corax', 'memah', 'maria', 'michael', 'mallory']
  });
  site = server.importSiteOrDieExit(forum.siteData);
  server.skipRateLimits(site.id);
});



describe(`Test tests`, () => {
  test(`Test request`, async () => {
    const response = await makeRequest(site.origin).get('/-/ping-nginx');
    dj("response from /-/ping-nginx: ", response, 4);
    expect(response.status).toBe(200);
    expect(response.text).toBe('pong\n');
  });
});

// Cookies? See:
// >  it('should save cookies' ...
// https://github.com/visionmedia/supertest/blob/master/test/supertest.js#L858