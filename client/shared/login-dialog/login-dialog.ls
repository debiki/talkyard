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



d.i.showLoginSubmitDialog = !(anyMode) ->
  d.i.showLoginDialog (anyMode || 'LoginToSubmit')



d.i.showLoginDialog = function(mode)
  if d.i.isInIframe
    d.i.createLoginPopup("#{d.i.serverOrigin}/-/login-popup?mode=#mode")
    return

  doingWhatClass = switch mode
  | 'LoginToSubmit' => 'dw-login-to-submit'
  | 'LoginToComment' => 'dw-login-to-post-comment'
  | 'LoginToLogin' => 'dw-login-to-login'
  | 'LoginToCreateTopic' => 'dw-login-to-create-topic'
  | _ => 'dw-login-to-login'
  $('body').addClass(doingWhatClass)

  dialog = loginDialogHtml()
  dialog.dialog d.i.newModalDialogSettings(
    width: 413
    closeOnEscape: !d.i.isInLoginPopup)

  dialog.find('#dw-lgi-guest').click ->
    d.i.showGuestLoginDialog(loginAndContinue)
    false

  dialog.find('#dw-lgi-pswd').click ->
    d.i.showPasswordLoginDialog(loginAndContinue)
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
    # Submit form in a new popup window, unless we alreaady are in a popup window.
    if d.i.isInLoginPopup
      $('body').append(form)
    else
      d.i.createOpenIdLoginPopup(form)
    form.submit()
    false

  function openOpenAuthLoginWindow(provider)
    url = "#{d.i.serverOrigin}/-/login-openauth-popup/#provider"
    if d.i.isInLoginPopup
      window.location = url
    else
      d.i.createLoginPopup(url)

  !function loginAndContinue(data)
    if d.i.isInLoginPopup
      # (Also see AppLoginOpenId, search for [509KEF31].)
      window.opener.debiki.internal.handleLoginResponse(status: 'LoginOk')
      # This is a login popup, so we're now closing the whole popup window.
      close()

    # This happens only if we're not in a login popup, but a jQuery UI dialog:

    d.i.Me.fireLogin()
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
    if d.i.isInLoginPopup
      window.close()
    else
      dialog.dialog('close')
      $('body').removeClass(doingWhatClass)

  # Preload OpenID resources, in case user clicks OpenID login button.
  d.i.loadOpenIdResources()

  dialog.dialog 'open'

  # Don't focus the ToS link, instead:
  dialog.find('#dw-lgi-google').focus()



!function showLoggedInDialog(opt_continue)
  html = $('''
      <p>You have been logged in, welcome <span id="dw-lgi-name"></span></p>
    ''')
  html.find('#dw-lgi-name').text(d.i.Me.getName!)
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
        <a tabindex="101" href="http://www.debiki.com/hosting/terms-of-service">Terms of Service</a>
        and the
        <a tabindex="102" href="http://www.debiki.com/hosting/privacy-policy">Privacy Policy</a>.
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
        <!--
        <a id="dw-lgi-yahoo" class="btn btn-default" tabindex="114">
          <span class="icon-yahoo"></span>
          Yahoo!
        </a> -->
      </div>

      <p id="dw-lgi-or-login-using">Or, alternatively:</p>

      <a id="dw-lgi-guest" class="btn btn-default" tabindex="121">Login as Guest</a>
      <a id="dw-lgi-pswd" class="btn btn-default" tabindex="122">Login with Email and Password</a>
      <a id="dw-lgi-more" class="btn btn-default" tabindex="123">More login options...</a>

      <input class="btn btn-default dw-fi-cancel" type="button" value="Cancel" tabindex="130">
    </div>
    ''')




# vim: fdm=marker et ts=2 sw=2 fo=tcqwn list
