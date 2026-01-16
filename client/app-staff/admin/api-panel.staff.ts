/*
 * Copyright (c) 2018 Kaj Magnus Lindberg
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/// <reference path="../staff-prelude.staff.ts" />
/// <reference path="oop-method.staff.ts" />


//------------------------------------------------------------------------------
   namespace debiki2.admin {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;



export const ApiPanel = createFactory({
  displayName: 'ApiPanel',

  getInitialState: function() {
    return {};
  },

  componentDidMount: function() {
    Server.listApiSecrets(secrets => {
      if (this.isGone) return;
      this.setState({ secrets });
    });
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  createSecret: function() {
    Server.createApiSecret(secret => {
      if (this.isGone) return;
      const secrets = [secret, ...this.state.secrets];
      this.setState({ secrets });
    });
  },

  deleteSecret: function(secretNr: ApiSecretNr) {
    Server.deleteApiSecrets([secretNr], (secrets) => {
      if (this.isGone) return;
      this.setState({ secrets });
    });
  },

  render: function() {
    if (!this.state.secrets)
      return r.p({}, "Loading...");

    const store: Store = this.props.store;

    let elems = this.state.secrets.map((apiSecret: ApiSecret, index: Nr) => {
      return ApiSecretItem({ key: index, apiSecret, deleteSecret: this.deleteSecret });
    });

    const elemsList = elems.length
        ? r.table({ className: 's_A_Api_SecrT' },
            r.thead({}, r.tr({},
              r.th({}, "Nr"),
              r.th({}, "For user"),
              r.th({}, "Created"),
              r.th({}, "Deleted"),
              r.th({}, "Capabilities"),
              r.th({}, "Value and actions"))),
            r.tbody({},
              elems))
        : r.p({ className: 'e_NoApiSecrets' }, "No API secrets.");

    const createSecretButton =
        Button({ onClick: this.createSecret, className: 'e_GenSecrB' },
          "Generate new secret");

    return (
      r.div({ className: 's_A_Api' },
        WebhooksApiPanel(),
        r.h3({}, "API Secrets"),
        r.p({}, "Recent first."),
        elemsList,
        createSecretButton));
  }
});



const ApiSecretItem = createComponent({
  displayName: 'ApiSecretItem',

  showSecret: function(secret: ApiSecret) {
    const userIdAndSecret = `tyid=2:${secret.secretKey}`;
    util.openDefaultStupidDialog({
      body: rFragment({},
        r.p({},
          "Secret value: ", r.code({ className: 'e_SecrVal' }, secret.secretKey)),
        r.p({},
          "cURL example: (note: includes the secret; don't send to anyone)"),
        r.pre({ style: { whiteSpace: 'pre-line' }},
          `curl --user ${userIdAndSecret} ${location.origin}/-/v0/ping`),
        r.p({},
          "This: ", r.code({}, 'tyid=2:..'), " means user 2, which is Sysbot, " +
          "a built-in user that can be used for API requests."),
        r.p({},
          "Here's Sysbot and the secret value, in a Basic Auth HTTP header, " +
          "base 64 encoded: (don't send to anyone!)"),
        r.pre({},
          `Authorization: Basic ${btoa(userIdAndSecret)}`)),
      closeButtonTitle: "Close",
    });
  },

  render: function() {
    const secret: ApiSecret = this.props.apiSecret;
    // Don't show secrets that still works, unless one clicks Show — so less risk that they get exposed.
    const secretKeyOrShowButton = secret.isDeleted
        ? r.s({}, secret.secretKey)
        : Button({ onClick: () => this.showSecret(secret), className: 'e_ShowSecrB' },
            "Show");

    const deleteButton = secret.isDeleted ? null :
      Button({ onClick: () => this.props.deleteSecret(secret.nr) }, "Delete");

    const clazz = 's_ApiSecr';
    const clazzActiveOrDeleted = clazz + (secret.isDeleted ? '-Dd' : '-Active');

    return r.tr({ className: clazz + ' ' + clazzActiveOrDeleted },
      r.td({}, secret.nr),
      r.td({}, "Any"),  // currently may call API using any user id  [api_secret_caps]
      r.td({}, timeExact(secret.createdAt)),
      r.td({}, secret.isDeleted ? rFragment("Yes, ", timeExact(secret.deletedAt)) : "No"),
      r.td({}, "Do anything"), // secret.secretType is always for any user  [api_secret_caps]
      r.td({}, deleteButton, secretKeyOrShowButton));
  }
});



interface WebhooksApiPanelProps {
}


const WebhooksApiPanel = React.createFactory<WebhooksApiPanelProps>(function(props) {
  const isGone = React.useRef<Bo>(false);
  const [webhooksBef, setWebhooksBef] = React.useState<Webhook[] | N>(null);
  const [webhooksCur, setWebhooksCur] = React.useState<Webhook[] | N>(null);
  const [lastEvtInf, setLastEvtInf] = React.useState<LastEvtInf | N>(null);
  const [badHeaders, setBadHeaders] = React.useState<Bo>(false);
  const [savedMsg, setSavedMsg] = React.useState<St | N>(null);

  React.useEffect(() => {
    Server.listWebhooks((whksResp: ListWebhooksResp) => {
      const whks: Webhook[] = whksResp.webhooks;
      // If there's not yet any webhook, let's make a new one [_lazy_create], which the admins
      // can edit and save. It'll get to know about everything that happens
      // (runs as sysbot).
      const whks2: Webhook[] = whks.length ? whks : [{
            id: 1, ownerId: Groups.AdminsId, runAsId: Users.SysbotId, sendToUrl: '' }];
      setWebhooksBef(whks2);
      setWebhooksCur(whks2);
      setLastEvtInf(whksResp.lastEvtInf);
    });
    return () => isGone.current = true;
  }, []);

  if (!webhooksCur || !lastEvtInf)
    return r.p({}, "Loading webhooks ...");

  // Lazy inited above if missing. [_lazy_create]
  const theCurHook: Webhook = webhooksCur[0];

  const unsavedChanges =  !_.isEqual(webhooksBef, webhooksCur);

  function updWebhook(changes: Partial<Webhook>) {
    const curHook = webhooksCur[0];
    const updatedHook = {...curHook, ...changes };
    setWebhooksCur([updatedHook]);   // currently there can be just one webhook
    setSavedMsg(null);
  }

  function reloadWebhook() {
    // This'll reload it.
    alterWebhook({});
  }

  function alterWebhook(mutation: { setPaused?: Bo, skipToNow?: Bo }) {
    const curHook = webhooksCur[0];
    Server.alterWebhook(curHook.id, mutation, (resp: ListWebhooksResp) => {
      setWebhooksBef(resp.webhooks);
      setWebhooksCur(resp.webhooks);
      setLastEvtInf(resp.lastEvtInf);
      setSavedMsg(null);
    });
  }

  const urlElm =
      Input({ label: "URL",
          labelClassName: 'col-xs-2',
          wrapperClassName: 'col-xs-10',
          className: 'c_A_Api_Wh_Url',
          value: theCurHook.sendToUrl,
          onChange: (event) => {
              updWebhook({ sendToUrl: event.target.value });
            }
          });

  /* Let's wait, next-next release.
  const customHeadersElm =
      Input({ label: "Custom HTTP Headers",
          type: 'textarea',
          labelClassName: 'col-xs-2',
          wrapperClassName: 'col-xs-10',
          className: 'c_A_Api_Wh_Hdrs',
          defaultValue: !theCurHook.sendCustomHeaders ? null :
              JSON.stringify(theCurHook.sendCustomHeaders, undefined, 2),
          onChange: (event) => {
              try {
                const json = JSON.parse(event.target.value);
                updWebhook({ sendCustomHeaders: json });
                setBadHeaders(false);
              }
              catch (ex) {
                setBadHeaders(true);
              }
            },
          help: !badHeaders ? null :
              r.div({ className: 'c_A_Api_Wh_BadHdrsJsn' },
                r.span({}, `Error: Bad headers JSON, should be like:  `),
                r.code({}, `{ "Header-Name": "Header value", ... }`))
          });  */
  const activePausedTxt = theCurHook.enabled ? "Active" : (
            theCurHook.sentUpToEventId ? "Paused" : "New, not started");
  const activePausedCss = theCurHook.enabled ? "-Run" : "-Pau";
  const brokenCss = theCurHook.brokenReason ? "-Brkn" : '';
  const brokenTxt = !theCurHook.brokenReason ? '' : (
                            theCurHook.enabled ? ", but broken, stopped" : ", broken");


  const runningPausedInfBtns = r.div({
          className: 'c_Wh_Act' + activePausedCss + brokenCss },
            r.span({ className: 'c_FormTxt' }, activePausedTxt + brokenTxt),
            ' ',
            unsavedChanges ? null : theCurHook.enabled
                ? Button({ className: 'e_Wh_PauseB', onClick: () => {
                    alterWebhook({ setPaused: true });
                  }}, "Pause")
                : rFr({},
                    // When starting the first time, we always skip old events, start fresh
                    // [start_webhook_at_now], so then we don't need any _skip_to_now btn.
                    Button({ className: 'e_Wh_StartB', onClick: () => {
                          alterWebhook({ setPaused: false });
                        }},
                        theCurHook.sentUpToEventId ? "Resume from last sent event" : "Start"),
                    !theCurHook.sentUpToEventId ? null :  // _skip_to_now
                        Button({ className: 'e_Wh_StartFreshB', onClick: () => {
                            util.openDefaultStupidDialog({
                              body: "Skip all pending events, start sending future events only?",
                              primaryButtonTitle: r.span({ className: 'e_YesFresh' },
                                  "Yes: Skip, and start"),
                              secondaryButonTitle: "No, cancel",
                              onPrimaryClick: () => {
                                alterWebhook({ setPaused: false, skipToNow: true });
                              },
                             });
                          }},
                          "Start fresh (ignore past events) …")));

  // @ifdef DEBUG
  // If broken, it must have failed. That's also enforced by db constraints:
  // webhooks_c_failed_brokenreason  and  webhooks_c_failed_since_how.
  dieIf(theCurHook.brokenReason && !theCurHook.lastFailedHow, 'TyE7FKSJ3LS8');
  // @endif

  const retryOnceMsg =
        !theCurHook.retryExtraTimes ? null :
            r.div({ className: 'e_WillExtraRetry c_FormTxt' },
              " Will retry in a few seconds. Wait and reload page, then click View Log");

  const retryOnceBtn = !theCurHook.lastFailedHow || unsavedChanges || retryOnceMsg ? null :
      Button({ className: 'c_A_Api_Wh_RetryB',
          onClick: () => {
            Server.retryWebhook(theCurHook.id, (resp: ListWebhooksResp) => {
              setWebhooksBef(resp.webhooks);
              setWebhooksCur(resp.webhooks);
              setLastEvtInf(resp.lastEvtInf);
            });
          }, }, "Retry once");

  const brokenInf = !theCurHook.lastFailedHow ? null :
      r.div({ className: 'c_FormTxt c_Wh_Brokn c_Wh_Brokn-' + (
                      theCurHook.brokenReason ? 'Stopped' : 'Failing') },
        theCurHook.brokenReason
            ? r.b({}, "Broken, stopped")
            : r.span({}, r.b({}, "Broken?"), ` Failed ${theCurHook.retriedNumTimes} times.`),
      );

  const runningBrokenInf = !theCurHook.sendToUrl ? null :
      r.div({ className: 'form-group' },
      r.label({ className: 'col-xs-2 control-label' }, "Status"),
      r.div({ className: 'col-xs-10' },
        runningPausedInfBtns,
        brokenInf,
        retryOnceMsg,
        retryOnceBtn,
        !theCurHook.lastErrMsgOrResp ? null :
              r.div({},
                  r.b({}, "Last error:"),
                  r.pre({}, theCurHook.lastErrMsgOrResp))
      ));


  const allDone = theCurHook && lastEvtInf && (
            !lastEvtInf.lastEventAtMs || theCurHook.sentUpToEventId >= lastEvtInf.lastEventId);

  const lastEventElm = r.div({ className: 'c_FormTxt' },
      !lastEvtInf?.lastEventAtMs
          ? r.p({}, "No events, nothing has happened.")
          : r.p({}, "Last event at: ", whenMsToIsoDate(lastEvtInf.lastEventAtMs),
                ', event id ' + lastEvtInf.lastEventId +  // _bit_dupl_event_code
                ', ' + debiki.prettyDuration(lastEvtInf.lastEventAtMs, lastEvtInf.nowMs)),
      !theCurHook.sentUpToWhen
          ? r.p({}, "No events sent.")
          : r.p({},
              "Sent up to: ", whenMsToIsoDate(theCurHook.sentUpToWhen), ' ',
              r.span({ className: allDone ? 'e_Wh_AllDone' : 'e_Wh_Lagging' },
                  allDone
                    ? "— all caught up"
                    : ', event id ' + theCurHook.sentUpToEventId +  // _bit_dupl_event_code
                      ', ' + debiki.prettyDuration(theCurHook.sentUpToWhen, lastEvtInf.nowMs))));

  /* const retrySecs = null;  // Later:
      Input({ type: 'number', label: "Retry max seconds",
          labelClassName: 'col-xs-2',
          wrapperClassName: 'col-xs-10',
          className: 'c_A_Api_Wh_RetrSecs',
          value: theCurHook.retryMaxSecs,
          onChange: () => {
            updWebhook({ enabled: !theCurHook.enabled });
          }}); */

  // For now: (makes troubleshooting simpler)
  const webhookDetailsElm =
      r.pre({ className: 'col-xs-offset-2 col-xs-10' },
        JSON.stringify(webhooksCur, undefined, 2),
        JSON.stringify(lastEvtInf));

  // Break out a save button for "isolated" things like webhooks?  [single_setting_save_btn]
  const saveBtn = !unsavedChanges && !savedMsg ? null :
      r.div({ className: 'form-group' },
      r.div({ className: 'col-xs-offset-2 col-xs-10' },
      Button({
          className: 'c_Wh_SavB',
          disabled: !unsavedChanges || badHeaders,
          onClick: () => {
            Server.upsertWebhooks(webhooksCur, (webhooks: Webhook[]) => {
              if (isGone.current) return;
              setWebhooksBef(webhooks);
              setWebhooksCur(webhooks);
              setSavedMsg("Saved.");
            });
          }, }, "Save"),
        !savedMsg ? null :
            r.span({ className: 'e_Wh_Savd' }, savedMsg)));

  const reloadBtn = !theCurHook.sendToUrl || unsavedChanges ? null :
          Button({ onClick: () => {
            reloadWebhook();
          }}, "Refresh");


  const skipToNowBtn = allDone || !theCurHook.sendToUrl || unsavedChanges ||
            !theCurHook.sentUpToEventId ? null :  // if new, don't need any _skip_to_now
      Button({
          className: 'e_Skip2NowB',
          onClick: () => {
            util.openDefaultStupidDialog({
              body: r.div({},
                r.p({}, "Skip all events up to now?"),
                r.p({},
                    "This is useful if webhookshave been broken or disabled " +
                    "for very long, and you don't want to send webhooks " +
                    "for past events, instead, only from now and onwards.")),
              primaryButtonTitle: r.span({ className: 'e_YesSkip' }, "Yes, skip to now"),
              // primaryIsDanger: true,
              secondaryButonTitle: "No, cancel",
              onPrimaryClick: () => {
                util.openDefaultStupidDialog({
                  body: "Really?",
                    primaryButtonTitle: r.span({ className: 'e_Really' }, "Yes, really"),
                    secondaryButonTitle: "No, cancel",
                    onPrimaryClick: () => {
                      //setRetryMsg("Skipping to now ...");
                      alterWebhook({ skipToNow: true });
                    },
                 });
               },
            });
          }, }, "Skip to now ...");

  const showLogBtn =
      Button({
          onClick: () => {
            Server.listWebhookReqsOut(theCurHook.id, (reqsOut) => {
              showReqs(reqsOut);
            });
          }, }, "View log");

  const progressInf =
      r.div({ className: 'form-group' },
      r.label({ className: 'col-xs-2 control-label' }, "Progress"),
      r.div({ className: 'col-xs-10' },
        lastEventElm,
        r.div({},
            showLogBtn,
            reloadBtn,
            skipToNowBtn),
      ));

  // Webhooks disabled server side too. [webhooks_ty_v1]
  let enableWebhooks = isSelfHosted();
  // But don't look at: isAutoTestSite()
  // @ifdef DEBUG
  enableWebhooks = true;
  // @endif

  return r.div({ className: 'c_A_Api_Wh' },
      r.h3({}, "Webhooks"),
      r.p({}, "You can configure one webhook endpoint only, currently. " +
            "It'll get notified about new and edited pages and comments, " +
            "and new users (but currently not about updated user)."),
      !enableWebhooks
          ? r.div({},
              r.p({},
                  "Update 2025-01: Webhooks disabled, " +
                  "unless you're self-hosted, which you are not."),
              r.p({},
                  "We'll enable again in Talkyard v1, later this year 2026."))
          :
      r.div({ className: 'form-horizontal' },
        // Config:
        urlElm,
        // retrySecs,
        // customHeadersElm,
        // ... more settings, later ...
        saveBtn,
        // Status:
        runningBrokenInf,
        progressInf,
        // Debug:
        webhookDetailsElm,
        ));
});



function showReqs(reqsOut: WebhookReqOut[]) {
  util.openDefaultStupidDialog({
    large: true,
    body: WebhookReqsPanel({ reqsOut }),
  });
}



const WebhookReqsPanel = React.createFactory(function(ps: { reqsOut: WebhookReqOut[] }) {
  const [showOnlyFailed, setShowOnlyFailed] = React.useState<Bo>(false);
  const reqstToShow = ps.reqsOut;  
  const numFailed = _.filter(ps.reqsOut, (r: WebhookReqOut) => !!r.failedAt).length;

  const filterCB =
      Input({ type: 'checkbox',
        label: `Show only failed requests (${numFailed} out of ${ps.reqsOut.length})`,
        tabIndex: 1,
        checked: showOnlyFailed, onChange: (event: CheckboxEvent) => {
          setShowOnlyFailed(event.target.checked);
        }});

  // [wbhk_reqs_dlg_scroll]
  return r.div({ className: 'c_WbhkReqs' },
        r.p({}, r.b({}, "Webhook requests, the last 50, recent first:")),
        filterCB,
        r.ol({}, reqstToShow.map(reqOut => showOneReq({ reqOut, showOnlyFailed }))));
});



function showOneReq(ps: { reqOut: WebhookReqOut, showOnlyFailed: Bo }) {
  const reqOut = ps.reqOut;
  const isOk = 200 <= ps.reqOut.respStatus && ps.reqOut.respStatus <= 299;
  const listItemClasses = 'c_WbhkReqs_Req c_WbhkReqs_Req' + (isOk ? '-Ok' : '-Err');

  if (ps.showOnlyFailed && isOk) {
    // Then "collapse" this reply.
    return r.li({ className: listItemClasses }, "Ok.");
  }

  function boldLine(title: St | RElm, value: St | Nr | RElm) {
    return r.div({}, r.b({}, title, ': '), r.samp({}, value));
  }

  const retryNr = !reqOut.retryNr ? null :
      boldLine("Retry nr", reqOut.retryNr === -1 ? "Manual" : reqOut.retryNr);

  const failInfo = !reqOut.failedAt ? null : rFr({},
      boldLine("Failed after", `${reqOut.failedAt - reqOut.sentAt} millis`),
      boldLine("Failed how", reqOut.failedHow),
      boldLine("Error msg", reqOut.errMsg));

  const respInfo = !reqOut.respAt ? null : rFr({},
      boldLine("Response after", `${reqOut.respAt - reqOut.sentAt} millis`),
      // Not so interesting:
      // boldLine("Response at", whenMsToIsoDate(reqOut.respAt)),
      boldLine("Response status", `${reqOut.respStatus} ${reqOut.respStatusText || ''}`));

  const sentJsonSt = JSON.stringify(reqOut.sentJson, undefined, 2);
  return r.li({ className: listItemClasses },
      boldLine("Request nr", reqOut.reqNr),
      boldLine("Sent at", whenMsToIsoDate(reqOut.sentAt)),
      boldLine("Sent to", reqOut.sentToUrl),
      boldLine("Ty version", reqOut.sentByAppVer + ' API v' + reqOut.sentApiVersion),
      boldLine("Event types", JSON.stringify(reqOut.sentEventTypes)),
      boldLine("Event ids", JSON.stringify(reqOut.sentEventIds)),
      retryNr,
      failInfo,
      respInfo,
      r.div({},
          r.b({}, `Sent JSON, ${sentJsonSt.length} chars:`),
          r.pre({}, sentJsonSt)),
      !reqOut.respAt ? r.div({}, "No response.") : rFr({},
          boldLine("Response headers", JSON.stringify(reqOut.respHeaders, undefined, 2)),
          boldLine("Response body", reqOut.respBody)),
      );
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
