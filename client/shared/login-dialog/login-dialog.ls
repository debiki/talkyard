/* Shows a login dialog.
 * Copyright (C) 2012-2013 Kaj Magnus Lindberg (born 1979)
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

d = i: debiki.internal, u: debiki.v0.util
$ = d.i.$;


d.i.closeAnyLoginDialogs = !->
  try
    $('#dw-fs-openid-login').dialog('close')
  catch
    void # Ignore, the dialog was probably not open.

  try
    $('#dw-lgi').dialog('close')
  catch
    void # Ignore, the dialog was probably not open


d.i.showLoginSubmitDialog = !(anyMode, anyReturnToUrl) ->
  d.i.showLoginDialog(anyMode || 'LoginToSubmit', anyReturnToUrl)



d.i.showLoginDialog = function(mode, anyReturnToUrl)
  clearLoginRelatedCookies()

  if d.i.isInIframe
    url = "#{d.i.serverOrigin}/-/login-popup?mode=#mode&returnToUrl=#anyReturnToUrl"
    d.i.createLoginPopup(url)
    return

  doingWhatClass = switch mode
  | 'LoginBecomeMainSiteAdmin' => 'dw-login-become-main-site-admin'
  | 'LoginAsAdmin' => 'dw-login-as-admin'
  | 'LoginToSubmit' => 'dw-login-to-submit'
  | 'LoginToComment' => 'dw-login-to-post-comment'
  | 'LoginToLogin' => 'dw-login-to-login'
  | 'LoginToCreateTopic' => 'dw-login-to-create-topic'
  | _ => 'dw-login-to-login'
  $('body').addClass(doingWhatClass)

  dialog = loginDialogHtml()
  dialog.dialog d.i.newModalDialogSettings(
    width: 413
    closeOnEscape: !d.i.isInLoginWindow)

  doingWhatClass = switch mode
  | 'LoginToAdministrate' =>
      dialog.find('#dw-lgi-guest').hide()
      dialog.find('#dw-lgi-create-password-user').hide()
      dialog.find('.dw-fi-cancel').hide()
  | 'LoginToCreateSite' =>
      dialog.find('#dw-lgi-guest').hide()
      dialog.find('.dw-fi-cancel').hide()

  dialog.find('#dw-lgi-guest').click ->
    d.i.showGuestLoginDialog(loginAndContinue)
    false

  dialog.find('#dw-lgi-pswd').click ->
    d.i.showPasswordLoginDialog(loginAndContinue)
    false

  dialog.find('#dw-lgi-create-password-user').click ->
    d.i.showCreateUserDialog({ createPasswordUser: true }, anyReturnToUrl)
    false

  dialog.find('#dw-lgi-more').click ->
    d.i.showLoginOpenId()
    false

  dialog.find('.dw-fi-cancel').click ->
    close()
    false

  dialog.find('#dw-lgi-google').click ->
    openOpenAuthLoginWindow('google')

  dialog.find('#dw-lgi-yahoo').click ->
    submitOpenIdLoginForm("http://me.yahoo.com/")

  dialog.find('#dw-lgi-facebook').click ->
    openOpenAuthLoginWindow('facebook')

  dialog.find('#dw-lgi-twitter').click ->
    openOpenAuthLoginWindow('twitter')

  dialog.find('#dw-lgi-github').click ->
    openOpenAuthLoginWindow('github')

  /**
   * Logs in at Yahoo by submitting an OpenID login form in a popup.
   */
  function submitOpenIdLoginForm(openidIdentifier)
    form = $("""
      <form action="#{d.i.serverOrigin}/-/api/login-openid" method="POST">
        <input type="text" name="openid_identifier" value="#openidIdentifier">
      </form>
      """)
    # Submit form in a new login popup window, unless we already are in a login window.
    if d.i.isInLoginWindow
      $('body').append(form)
    else
      d.i.createOpenIdLoginPopup(form)
    form.submit()
    false

  function openOpenAuthLoginWindow(provider)
    # Any new user wouldn't be granted access to the admin page, so don't allow
    # creation of  new users from here.
    # (This parameter tells the server to set a certain cookie. Setting it here
    # instead has no effect, don't know why.)
    mayNotCreateUser = if mode == 'LoginToAdministrate' then '&mayNotCreateUser' else ''
    returnToUrlOrEmpty = if anyReturnToUrl then anyReturnToUrl else ''
    url = "#{d.i.serverOrigin}/-/login-openauth/#provider?returnToUrl=#returnToUrlOrEmpty#mayNotCreateUser"
    if d.i.isInLoginWindow
      # Let the server know we're in a login window, so it can choose to reply with
      # complete HTML pages to show in the popup window.
      $.cookie('dwCoIsInLoginWindow', 'true')
      window.location = url
    else
      d.i.createLoginPopup(url)

  !function loginAndContinue(data)
    if d.i.isInLoginWindow
      if anyReturnToUrl && anyReturnToUrl.indexOf('_RedirFromVerifEmailOnly_') === -1
        window.location = anyReturnToUrl
        return
      # (Also see AppLoginOpenId, search for [509KEF31].)
      window.opener.debiki.internal.handleLoginResponse(status: 'LoginOk')
      # This is a login popup, so we're now closing the whole popup window.
      close()
      return # actually not needed after close()?

    # This happens only if we're not in a login popup, but a jQuery UI dialog:

    debiki2.ReactActions.login()
    # Show response dialog, and continue with whatever caused
    # the login to happen.
    # {{{ If the login happens because the user submits a reply,
    # then, if the reply is submitted (from within
    # continueAnySubmission) before the dialog is closed, then,
    # when the browser moves the viewport to focus the new reply,
    # the welcome dialog might no longer be visible in the viewport.
    # But the viewport will still be dimmed, because the welcome
    # dialog is modal. So don't continueAnySubmission until
    # the user has closed the response dialog. }}}
    close()
    showLoggedInDialog(d.i.continueAnySubmission)

  !function close
    if d.i.isInLoginWindow
      window.close()
    else
      dialog.dialog('close')
      $('body').removeClass(doingWhatClass)

  # Preload OpenID resources, in case user clicks OpenID login button.
  d.i.loadOpenIdResources()

  dialog.dialog 'open'

  # Don't focus the ToS link, instead:
  dialog.find('#dw-lgi-google').focus()



/**
 * Clears login related cookies so e.g. any lingering return-to-url won't cause troubles.
 */
!function clearLoginRelatedCookies
  $.cookie('dwCoReturnToUrl', null)
  $.cookie('dwCoReturnToSite', null)
  $.cookie('dwCoReturnToSiteXsrfToken', null)
  $.cookie('dwCoIsInLoginWindow', null)
  $.cookie('dwCoMayCreateUser', null)



!function showLoggedInDialog(opt_continue)
  html = $('''
      <p>You have been logged in, welcome!</p>
    ''')
  html.dialog $.extend({}, d.i.jQueryDialogNoClose,
      title: 'Welcome'
      autoOpen: true
      buttons: [
        text: 'OK'
        id: 'dw-dlg-rsp-ok'
        click: !->
          # Remove the dialog, so the OK button id can be reused
          # — then it's easier to write automatic tests.
          $(this).dialog('destroy').remove()
          if opt_continue
            opt_continue()
      ])



/**
 * For now, hardcode terms-of-service and privacy-policy links.
 * Should they be customizable on a per site basis?
 */
function loginDialogHtml
  $('''
    <div class="dw-fs" title="Who are you?" id="dw-lgi">

      <p id="dw-lgi-tos">
        By logging in, you agree to the
        <a tabindex="101" href="/-/terms-of-use">Terms of Use</a>
        and the
        <a tabindex="102" href="/-/privacy-policy">Privacy Policy</a>.
      </p>

      <p id="dw-lgi-or-login-using">
        Login<span class="dw-login-to-post-comment">, and post your comment,</span><span class="dw-login-to-create-topic">, and create a topic,</span>
        using your account (if any) at:</p>
      <div id="dw-lgi-other-sites">
        <a id="dw-lgi-google" class="btn btn-default" tabindex="111">
          <span class="icon-google-plus"></span>Google
        </a>
        <a id="dw-lgi-facebook" class="btn btn-default" tabindex="112">
          <span class="icon-facebook"></span>
          Facebook
        </a>
        <a id="dw-lgi-twitter" class="btn btn-default" tabindex="113">
          <span class="icon-twitter"></span>
          Twitter
        </a>
        <a id="dw-lgi-github" class="btn btn-default" tabindex="113">
          <span class="icon-github"></span>
          GitHub
        </a>
        <!-- OpenID doesn't work right now.
        <a id="dw-lgi-yahoo" class="btn btn-default" tabindex="114">
          <span class="icon-yahoo"></span>
          Yahoo!
        </a> -->
      </div>

      <p id="dw-lgi-or-login-using">Or, alternatively:</p>

      <a id="dw-lgi-guest" class="btn btn-default" tabindex="121">Login as Guest</a>
      <a id="dw-lgi-pswd" class="btn btn-default" tabindex="122">Login with Username and Password</a>
      <a id="dw-lgi-create-password-user" class="btn btn-default" tabindex="123">Create New Account</a>
      <!-- <a id="dw-lgi-more" class="btn btn-default" tabindex="124">More login options...</a> -->

      <input class="btn btn-default dw-fi-cancel" type="button" value="Cancel" tabindex="130">
    </div>
    ''')




# vim: fdm=marker et ts=2 sw=2 fo=tcqwn list
