/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/pages-for';
import settings = require('../utils/settings');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

let owen: Member;
let owensBrowser: TyE2eTestBrowser;
let maria: Member;
let mariasBrowser: TyE2eTestBrowser;
let michael: Member;

let site: IdAddress;
let forum: EmptyTestForum;

let tocipUrl: string;

const mentionOwen = '@owen_owner';
const mentionOwen001 = mentionOwen + ' 001';
const mentionOwen002 = mentionOwen + ' 002';
const mentionOwen003 = mentionOwen + ' 003';
const mentionOwen004 = mentionOwen + ' 004';
const mentionOwen005 = mentionOwen + ' 005';
const mentionOwen006 = mentionOwen + ' 006';

const mentionMichael = '@michael';
const mentionMichael002 = mentionMichael + ' 002';
const mentionMichael003 = mentionMichael + ' 003';
const mentionMichael004 = mentionMichael + ' 004';
const mentionMichael005 = mentionMichael + ' 005';
const mentionMichael006 = mentionMichael + ' 006';

describe("notfs-snooze-talk  TyT782RKTL36R", () => {

  it("initialize people, import site", () => {
    const richBrowserA = new TyE2eTestBrowser(browserA);
    const richBrowserB = new TyE2eTestBrowser(browserB);

    const builder = buildSite();
    forum = builder.addEmptyForum({
      title: "Snooze Notfs Forum",
      members: undefined, // default = everyone
    });

    owen = forum.members.owen;
    owensBrowser = richBrowserA;

    maria = forum.members.maria;
    mariasBrowser = richBrowserB;

    michael = forum.members.michael;

    // Disable reviews, so notfs get generated directly.
    // 2nd snooze spec, with review tasks enabled?  TESTS_MISSING TyT04KSTH257
    builder.settings({ numFirstPostsToReview: 0, numFirstPostsToApprove: 0 });

    assert(builder.getSite() === forum.siteData);
    site = server.importSiteData(forum.siteData);
  });

  it("Maria logs in", () => {
    mariasBrowser.go2(site.origin + '/');
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });

  it("... creates a topic, @mentions Owen", () => {
    mariasBrowser.complex.createAndSaveTopic({
          title: "Attention!", body: "Attention please " + mentionOwen001 });
    tocipUrl = mariasBrowser.getUrl();
  });

  it("Owen gets notified", () => {
    server.waitUntilLastEmailMatches(
          site.id, owen.emailAddress, mentionOwen001);
  });

  it("Owen logs in", () => {
    owensBrowser.go2(site.origin);
    owensBrowser.complex.loginWithPasswordViaTopbar(owen);
  });



  // ----- Snooze works directly after snoozing


  it("Owen snoozes notifications 4 hours, the default", () => {
    owensBrowser.complex.snoozeNotifications({ hours: 4 });
  });

  it("Maria mentions first Owen, then Michael", () => {
    mariasBrowser.complex.replyToOrigPost(mentionOwen002);
    mariasBrowser.complex.replyToOrigPost(mentionMichael002);
  });

  it("Michael gets notified", () => {
    server.waitUntilLastEmailMatches(
          site.id, michael.emailAddress, mentionMichael002);
  });

  it("But not Owen — he's snoozed email notifications", () => {
    // Any notf to Owen ought to have arrived before the one to Michael,
    // since Owen was mentioned first.
    // But no new notf should have been sent — instead, Owen's old email notf
    // should be the most recent one, that is, 001  but not  002.
    server.assertLastEmailMatches(
          site.id, owen.emailAddress, mentionOwen001, browserA);
  });

  it("Owen's browser shows two unread @mention notfs from Maria though", () => {
    owensBrowser.refresh();
    owensBrowser.topbar.waitForNumDirectNotfs(2);
  });



  // ----- Snooze works just before snooze period ends


  it("Almost four hours passes, snooze almost ended", () => {
    const minutes = 60 + 60 + 60 + 30;
    owensBrowser.playTimeSeconds(minutes * 60);
    server.playTimeMinutes(minutes);
  });

  it("Maria mentions first Owen, then Michael — again", () => {
    mariasBrowser.complex.replyToOrigPost(mentionOwen003);
    mariasBrowser.complex.replyToOrigPost(mentionMichael003);
  });

  it("Michael gets notified, again", () => {
    server.waitUntilLastEmailMatches(
          site.id, michael.emailAddress, mentionMichael003);
  });

  it("But not Owen", () => {
    server.assertLastEmailMatches(
          site.id, owen.emailAddress, mentionOwen001, browserA);  // not 003
  });



  // ----- Notifs back when snooze ends


  it("More than four hours passes. Snooze ends", () => {
    owensBrowser.playTimeSeconds(35 * 60);
    server.playTimeMinutes(35);  // in total 4 hours + 2 minutes
  });

  it("Maria mentions first Owen, then Michael — *what* is so important?", () => {
    mariasBrowser.complex.replyToOrigPost(mentionOwen004);
    mariasBrowser.complex.replyToOrigPost(mentionMichael004);
  });

  it("Michael gets notified, this time too", () => {
    server.waitUntilLastEmailMatches(
          site.id, michael.emailAddress, mentionMichael004);
  });

  it("... and Owen — he's snoozing no more!", () => {
    server.assertLastEmailMatches(
          site.id, owen.emailAddress, mentionOwen004, browserA);
  });



  // ----- Snooze stops when manually un-snoozing


  it("Owen quickly snoozes notifications, until tomorrow", () => {
    // Needs to refresh (remove) the snooze icon, otherwise snoozeNotifications()
    // fails a  ttt  assertion.
    // — Fine, gets refreshed because of Maria @mentioning Owen which bumps
    // Owen's unread notfs counter, and the snooze icon.
    owensBrowser.complex.snoozeNotifications({ toWhen: 'TomorrowMorning9am' });
  });

  it("Maria mentions first Owen, then Michael", () => {
    mariasBrowser.complex.replyToOrigPost(mentionOwen005);
    mariasBrowser.complex.replyToOrigPost(mentionMichael005);
  });

  it("Michael gets notified", () => {
    server.waitUntilLastEmailMatches(
          site.id, michael.emailAddress, mentionMichael005);
  });

  it("But not Owen", () => {
    server.assertLastEmailMatches(
          site.id, owen.emailAddress, mentionOwen004, browserA);  // not 005
  });

  it("Owen is sleeping, but his cat steps on the keyboard, and " +
          "un-snoozes notifications, unintentionally", () => {
    owensBrowser.complex.unsnoozeNotifications();
  });

  it("The cat falls asleep on the keyboard", () => {
    // Noop
  });

  it("Maria mentions first Owen, then Michael — the 6th time now", () => {
    mariasBrowser.complex.replyToOrigPost(mentionOwen006);
    mariasBrowser.complex.replyToOrigPost(mentionMichael006);
  });

  it("Michael gets notified, as usual", () => {
    server.waitUntilLastEmailMatches(
          site.id, michael.emailAddress, mentionMichael006);
  });

  it("... and Owen and the cat", () => {
    server.assertLastEmailMatches(
          site.id, owen.emailAddress, mentionOwen006, browserA);
  });


});

