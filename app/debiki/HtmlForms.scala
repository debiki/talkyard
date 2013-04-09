/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import com.debiki.v0._
//import com.twitter.ostrich.stats.Stats
import java.{util => ju, io => jio}
import scala.collection.JavaConversions._
import _root_.scala.xml.{NodeSeq, Node, Elem, Text, XML, Attribute}
import FlagReason.FlagReason
import Prelude._
import DebikiHttp._
import HtmlUtils._


/**
 * HTML forms.
 *
 * A Debiki convention: If a modal dialog has stuff with tabindexes,
 * the tabindexes start on 101 and end on 109 (so any OK and Cancel buttons
 * should have tabindex 109). Some Javascript code relies on this.
 * (See Debiki for Developers #7bZG31.)
 */
object HtmlForms {

  def apply(config: HtmlConfig, xsrfToken: String,
        pageRoot: PageRoot, permsOnPage: PermsOnPage) =
    new HtmlForms(config, xsrfToken, pageRoot, permsOnPage)

  val XsrfInpName = "dw-fi-xsrf"

  object Reply {
    object InputNames {
      val Text = "dw-fi-reply-text"
      val Where = "dw-fi-reply-where"
    }
  }

  object Rating {
    object InputNames {
      val Tag = "dw-fi-r-tag"
    }
  }

  object FlagForm {
    object InputNames {
      val Reason = "dw-fi-flg-reason"
      val Details = "dw-fi-flg-details"
    }
    import FlagReason._
    def prettify(reason: FlagReason): String = (reason match {  // i18n
      case CopyVio => "Copyright Violation"
      case x => x.toString
    })
  }

  object Edit {
    object InputNames {
      val Markup = "dw-fi-e-mup"
      val Text = "dw-fi-e-txt"
    }
  }

  object Delete {
    object InputNames {
      val Reason = "dw-fi-dl-reason"
      val DeleteTree = "dw-fi-dl-tree"
    }
  }

  def respDlgOk(title: String, summary: String, details: String) =
    _responseDialog(
      title, summary, details, debikiErrorCode = "", tyype = "dw-dlg-type-ok")

  def respDlgError(title: String, summary: String, details: String,
                   debikiErrorCode: String) =
    _responseDialog(
      title, summary, details, debikiErrorCode, tyype = "dw-dlg-type-err")

  private def _responseDialog(title: String, summary: String, details: String,
                              debikiErrorCode: String, tyype: String
                                 ): NodeSeq = {
    <div class={"dw-dlg-rsp "+ tyype}>
      <h1 class='dw-dlg-rsp-ttl'>{title}</h1>{
      (if (summary nonEmpty)
        <strong class='dw-dlg-rsp-smr'>{summary} </strong> else Nil) ++
      (if (details nonEmpty)
        <span class='dw-dlg-rsp-dtl'>{details} </span> else Nil) ++
      (if (debikiErrorCode nonEmpty)
        <span class='dw-dlg-rsp-err'>[error {debikiErrorCode}]</span> else Nil)
    }</div>
  }
}


class HtmlForms(val config: HtmlConfig, xsrfToken: String,
    val pageRoot: PageRoot, val permsOnPage: PermsOnPage) {

  import HtmlForms._
  import HtmlPageSerializer._

  val ccWikiLicense =
    <a rel="license" href="http://creativecommons.org/licenses/by/3.0/"
       target="_blank">CC BY-SA 3.0</a>


  def dialogTemplates = {
    <div id="dw-hidden-templates">
    { actionMenu ++
      loginForms ++
      replyForm("", "") ++
      ratingForm ++
      flagForm ++
      collapseForm ++
      closeTreeForm ++
      deleteForm(None) ++
      submittingFormInfoDiv ++
      sortOrterTipsDiv ++
      rateOwnCommentTipsDiv }
    </div>
  }


  def loginForms =
    loginFormSimple ++
    loginFormOpenId ++
    loginOkForm() ++
    loginFailedForm() ++
    logoutForm ++
    emailNotfPrefsForm


  def actionMenu =
      <div id='dw-action-menu' class='dw-as dw-p-as'>
        <a class='dw-a dw-a-reply'>Reply</a>
        <a class='dw-a dw-a-rate'>Rate</a>
        <a class='dw-a dw-a-more'>More...</a>
        {/*<a class='dw-a dw-a-link'>Link</a>*/}
        <a class='dw-a dw-a-edit'>Edits</a>
        <a class='dw-a dw-a-flag'>Report</a>
        { ifThen(permsOnPage.deleteAnyReply, // hide for now only
            <a class='dw-a dw-a-delete'>Delete</a>
            <a class='dw-a dw-a-close'>Close</a>
            <a class='dw-a dw-a-collapse'>Collapse</a>
            <a class='dw-a dw-a-move'>Move</a>) }
        {/*  Disable the Edit form and link for now,
        doesn't work very well right now, or not at all.
        <a class='dw-a dw-a-edit'>Edit</a>
        */}
      </div>
      // Could skip <a>Edit</a> for now, and teach people to
      // use the inline menu instead?


  /** A query string param that remembers which part of a page we are
   *  currently viewing.
   */
  private def _viewRoot = {
    // The page body is the default, need not be specified.
    if (pageRoot.subId == PageParts.BodyId) ""
    else "&view="+ pageRoot.subId
  }


  private def _xsrfToken = {
    <input type='hidden' class={XsrfInpName}
           name={XsrfInpName} value={xsrfToken}/>
  }


  def confirmationForm(question: String, answer: String) = {
    // They can click the browser's Back button to cancel.
    <form action='' method='POST'>
      { _xsrfToken }
      <div>{question}</div>
      <input type='submit' value={answer}/>
    </form>
  }

  /**
   *  The login form below is based on this JavaScript OpenID Selector
   *  example file:
   *    debiki-core/src/main/resources/toserve/lib/openid-selector/demo.html
   */
  def loginFormSimple = {
    // Don't initially focus a text input -- that'd cause Android to auto zoom
    // that input, which triggers certain Android bugs and my workarounds,
    // but the workarounds results in the dialog title appearing off screen,
    // so better not trigger the-bug-and-the-workarounds on dialog open.
    // See debiki.js: resetMobileZoom() and jQueryDialogDefault.open.
      <div class='dw-fs' id='dw-fs-lgi-simple' title='Who are you?'>
        <form action={config.loginActionSimple} method='post'>
          { _xsrfToken }
          <div id='dw-lgi'>
           <div class='dw-lgi-openid'>
             <div class='dw-lgi-openid-info'>
               Login with Gmail, OpenID, Yahoo, etcetera:
             </div>
             <a class='dw-a dw-a-login-openid' tabindex='101'>Log in</a>
             <div class='dw-lgi-openid-why'>
               <small>
               In the future, logging in will enable functionality
               not available for guest login.
               </small>
             </div>
           </div>
           {/*<div class='dw-lgi-or-wrap'>
             <div class='dw-lgi-or-word'>Or</div>
           </div>*/}
           <div class='dw-lgi-simple'>
            <div class='dw-lgi-simple-info'>
              Alternatively, login as guest:
            </div>
            <div>
             <label for='dw-fi-lgi-name'>Enter your name:</label>
             <input id='dw-fi-lgi-name' type='text' size='40' maxlength='100'
                  name='dw-fi-lgi-name' value='Anonymous' tabindex='102'/>
             <small><b>'?'</b> will be appended to your name,
               to indicate that you logged in as a guest.
             </small>
            </div>
            <div>
             <label for='dw-fi-lgi-email'
                >Email: (optional, not shown)</label>
             <input id='dw-fi-lgi-email' type='text' size='40'
                  maxlength='100' name='dw-fi-lgi-email' value=''
                  tabindex='103'/>
            </div>
            <div>
             <label for='dw-fi-lgi-url' id='dw-fi-lgi-url-lbl'
                >Website: (optional)</label>
             <input id='dw-fi-lgi-url' type='text' size='40' maxlength='200'
                  name='dw-fi-lgi-url' value=''
                  tabindex='104'/>
            </div>
           </div>
          </div>
        </form>
      </div>
  }

  def loginFormOpenId =
      <div class='dw-fs' id='dw-fs-openid-login'
            title="Sign In or Create New Account">
        <form action={config.loginActionOpenId} method='post' id='openid_form'>
          { _xsrfToken }
          <input type='hidden' name='action' value='verify' />
          <div id='openid_choice'>
            <p>Please click your account provider:</p>
            <div id='openid_btns'></div>
          </div>
          <div id='openid_input_area'>
            <input id='openid_identifier' name='openid_identifier' type='text'
                value='http://' />
            <input id='openid_submit' type='submit' value='Sign-In'/>
          </div>
          <noscript>
            <p>OpenID is a service that allows you to log-on to many different
            websites using a single indentity. Find out
            <a href='http://openid.net/what/'>more about OpenID</a>
            and <a href='http://openid.net/get/'>how to get an OpenID enabled
            account</a>.</p>
          </noscript>
        </form>
      </div>

  def loginOkForm(name: String = "Anonymous") =
      <div class='dw-fs' id='dw-fs-lgi-ok' title='Welcome'>
        <form action={config.loginOkAction} method='post'>
          { _xsrfToken }
          <p>You have been logged in, welcome
            <span id='dw-fs-lgi-ok-name'>{name}</span>!
          </p>
          <div class='dw-submit-set'>
            <input class='dw-fi-submit' type='submit' value='OK'/>
          </div>
        </form>
      </div>

  def loginFailedForm(error: String = "unknown error") =
      <div class='dw-fs' id='dw-fs-lgi-failed' title='Login Error'>
        <form action={config.loginFailedAction} method='post'>
          { _xsrfToken }
          <p>Login failed:
            <span id='dw-fs-lgi-failed-errmsg'>{error}</span>
          </p>
          <div class='dw-submit-set'>
            <input class='dw-fi-submit' type='submit' value='OK'/>
          </div>
        </form>
      </div>

  def logoutForm =
      <div class='dw-fs' id='dw-fs-lgo' title='Log out'>
        <form action={config.logoutAction} method='post'>
          { _xsrfToken }
          <p>Are you sure?</p>
          <div class='dw-submit-set'>
            <input class='dw-fi-cancel' type='button' value='Cancel'/>
            <input id='dw-f-lgo-submit' class='dw-fi-submit' type='submit'
                   value='Log out'/>
          </div>
        </form>
      </div>


  /**
   * Shown when the user has posted a reply, if she has not
   * specified whether or not to receive email notifications on replies
   * to her.
   *
   * If the user says Yes, but her email address is unknown,
   * then she is asked for it.
   */
  def emailNotfPrefsForm =
    <form id='dw-f-eml-prf' class='dw-f'
          action='?config-user=me'
          accept-charset='UTF-8'
          method='post'
          title='Email Notifications'>
      { _xsrfToken }
      <p>Be notified via email of replies to your comments?</p>
      <div class='dw-submit-set'>
        <input type='radio' id='dw-fi-eml-prf-rcv-no' name='dw-fi-eml-prf-rcv'
               value='no'/>
        <label for='dw-fi-eml-prf-rcv-no'>No</label>
        <input type='radio' id='dw-fi-eml-prf-rcv-yes' name='dw-fi-eml-prf-rcv'
               value='yes'/>
        <label for='dw-fi-eml-prf-rcv-yes'>Yes</label>
      </div>
      <div class='dw-submit-set dw-f-eml-prf-adr'>
        <label for='dw-fi-eml-prf-adr'>Your email address:</label>
        <input id='dw-fi-eml-prf-adr' name='dw-fi-eml-prf-adr'
               type='text' value=''/>
        <input type='submit' name='dw-fi-eml-prf-done'
               class='dw-fi-submit' value='Done'/>
      </div>
    </form>


  def actLinks(pid: String) = {
    val safePid = safe(pid)  // Prevent xss attacks.
    // COULD check permsOnPage.replyHidden/Visible etc.
    <ul>
     <li><a href={"?reply=" + safePid + _viewRoot}>Reply to post</a></li>
     <li><a href={"?rate="  + safePid + _viewRoot}>Rate it</a></li>
     <li><a href={"?edit="  + safePid + _viewRoot}>Suggest edit</a></li>
     <li><a href={"?flag="  + safePid + _viewRoot}>Report spam or abuse</a></li>
     <li><a href={"?delete="+ safePid + _viewRoot}>Delete</a></li>
    </ul>
  }

  def replyForm(replyToPostId: String, text: String) = {
      import Reply.{InputNames => Inp}
    val submitButtonText = "Post as ..." // COULD read user name from `config'
      <li class='dw-fs dw-fs-re'>
        <form
            action={config.replyAction +"="+ replyToPostId + _viewRoot}
            accept-charset='UTF-8'
            method='post'>
          { _xsrfToken }
          {/* timeWaistWarning("reply", "is") */}
          <input type='hidden' id={Inp.Where} name={Inp.Where} value='' />
          <div>
            <label for={Inp.Text}>Your reply:</label><br/>
            <textarea id={Inp.Text} name={Inp.Text} rows='13'
              cols='38'>{text}</textarea>
          </div>
          { termsAgreement("Post as ...") }
          <div class='dw-submit-set'>
            <input class='dw-fi-cancel' type='button' value='Cancel'/>
            <input class='dw-fi-submit' type='submit' value={submitButtonText}/>
          </div>
        </form>
      </li>
  }

  def ratingForm =
      <div class='dw-fs dw-fs-r'>
        <form
            action={config.rateAction + _viewRoot}
            accept-charset='UTF-8'
            method='post'
            class='dw-f dw-f-r'>
          { _xsrfToken }
          <p class='dw-inf dw-f-r-inf-many'>
            You can select many rating tags.
          </p>
          <p class='dw-inf dw-f-r-inf-changing'>
            You are <strong>changing</strong> your rating.
          </p>
          {
            var boxCount = 1
            def rateBox(value: String) = {
              val name = Rating.InputNames.Tag
              val id = name +"-"+ boxCount
              boxCount += 1
              <input id={id} type='checkbox' name={name} value={value} />
              <label for={id}>{value}</label>
            }
            {/* Don't show *all* available values immediately -- that'd
            be too many values, people can't keep them all in mind. Read this:
            en.wikipedia.org/wiki/The_Magical_Number_Seven,_Plus_or_Minus_Two
            although 3 - 5 items is probably much better than 7 - 9. */}
            <div class='dw-f-r-tag-pane'>
              {/* temporary layout hack */}
              <div class='dw-r-tag-set dw-r-tag-set-1'>{
                rateBox("interesting") ++
                rateBox("funny") ++
                rateBox("off-topic")
              }</div>
              <div class='dw-r-tag-set dw-r-tag-set-2'>{
                rateBox("mediocre") ++
                rateBox("faulty")
              }</div>
              {/* One can report (flag) a comment as spam, so there's
              no need for a spam tag too. I don't think the troll tag is
              really needed? "Stupid + Boring" would work instead?
              Or flag as Offensive (if I add such a flag option).

              <a class='dw-show-more-r-tags'>More...</a>
              <div class='dw-r-tag-set dw-more-r-tags'>{
                rateBox("spam") ++
                rateBox("troll")
              }</div>  */}
              <div class='dw-submit-set'>
                <input class='dw-fi-submit' type='submit' value='Submit'/>
                <input class='dw-fi-cancel' type='button' value='Cancel'/>
              </div>
            </div>
          }
        </form>
      </div>

  def flagForm = {
    import FlagForm.{InputNames => Inp}
    <div class='dw-fs' title='Report Comment'>
      <form id='dw-f-flg' action={config.flagAction + _viewRoot}
            accept-charset='UTF-8' method='post'>
        { _xsrfToken }
        <div class='dw-f-flg-rsns'>{
          def input(idSuffix: String, r: FlagReason) = {
            val id = "dw-fi-flgs-"+ idSuffix
            <input type='radio' id={id} name={Inp.Reason} value={r.toString}/>
            <label for={id}>{FlagForm.prettify(r)}</label>
          }
          import FlagReason._
          input("spam", Spam) ++
          input("copy", CopyVio) ++
          input("ilgl", Illegal) ++
          input("othr", Other)
        }</div>
        <div>
          <label for={Inp.Details}>Details (optional)</label><br/>
          <textarea id={Inp.Details} rows='2' cols='30'
                 name={Inp.Details} value=''></textarea>
        </div>
        <div class='dw-submit-set'>
          <input class='dw-fi-submit' type='submit' value='Submit'/>
          <input class='dw-fi-cancel' type='button' value='Cancel'/>
        </div>
      </form>
    </div>
  }


  def collapseForm = {
    <div title='Collapse?'>
      <p><small>
        When you collapse something, it's made small, so it won't grab people's attention.
        Do this, to hide rather uninteresting things.
      </small></p>
      <p>What do you want to collapse?</p>
      <form id="dw-f-collapse">
        <input type="submit" id="dw-f-collapse-post" value="The comment"/>
        <input type="submit" id="dw-f-collapse-replies" value="All replies"/>
        <input type="submit" id="dw-f-collapse-tree" value="The comment and all replies"/>
        <input type='button' class='dw-fi-cancel' value='Cancel'/>
      </form>
    </div>
  }


  def closeTreeForm = {
    <div title='Close comment and all replies?'>
      <form id="dw-f-close-tree">
        <p><small>
          They will be collapsed and tucked away under a Closed Threads section.
        </small></p>
        <p><small>
          Only close something if you're sure it's of interest to no one,
          e.g. a comment about a spelling error that has since been fixed.
        </small></p>
        <input type="submit" id="dw-f-close-tree-yes" value="Yes, close it"/>
        <input type="button" class="dw-fi-cancel" value="Cancel"/>
      </form>
    </div>
  }


  /**
   * Lists improvement suggestions and improvements already applied.
   *
   * When submitted, posts a list of values like:
   * 0-delete-093k25, 1-apply-0932kx3, ...
   * "delete" means that an EditApp is to be deleted, that is, that
   * the-edit-that-was-applied should be reverted. The id is an edit app id.
   * "apply" means that an edit should be applied. The id is an edit id.
   * The initial sequence number ("0-", "1-", ...) is the order in
   * which the changes should be made.
   * (One year later: Why didn't I simply use Json??)
   */
  def editsDialog(nipo: Post, page: PageParts, userName: Option[String],
                  mayEdit: Boolean): NodeSeq = {
    def xmlFor(edit: Patch): NodeSeq = {
      val applied = edit.isApplied
      def applier_! = page.people.user_!(edit.applierLoginId.get)
      <li class='dw-e-sg'>
        <div class='dw-e-sg-e'>{
            <div>{
              (if (applied) "Suggested by " else "By ") ++
              linkTo(edit.user_!, config) ++
              dateAbbr(edit.creationDati, "dw-e-sg-dt")
              }</div> ++
            (if (!applied) Nil
            else <div>Applied by { linkTo(applier_!, config) ++
              dateAbbr(edit.applicationDati.get, "dw-e-ap-dt") }</div>)
          }
          <div class='dw-as'>{
            val name = "dw-fi-appdel"
            // The checkbox value is e.g. "10-delete-r0m84610qy",
            // i.e. <seq-no>-<action>-<edit-id>. The sequence no
            // is added by javascript; it specifies in which order the
            // changes are to be made.
            // (Namely the order in which the user checks/unchecks the
            // checkboxes.)
            if (!mayEdit) {
              // For now, show no Apply/Undo button. COULD show *vote*
              // buttons instead.
              Nil
            }
            else if (!applied) {
              val aplVal = "0-apply-"+ edit.id
              val delVal = "0-delete-"+ edit.id
              val aplId = name +"-apply-"+ edit.id
              val delId = name +"-delete-"+ edit.id
              <label for={aplId}>Apply</label>
              <input id={aplId} type='checkbox' name={name} value={aplVal}/>
              //<label for={delId}>Delete</label>
              //<input id={delId} type='checkbox' name={name} value={delVal}/>
            }
            else {
              val delVal = "0-delete-"+ edit.applicationActionId
              val undoId = name +"-delete-"+ edit.id
              <label for={undoId}>Undo</label>
              <input id={undoId} type='checkbox' name={name} value={delVal}/>
            }
          }</div>
          <pre class='dw-e-text'>{edit.patchText}</pre>
          { edit.actualResult.map(result =>
              <pre class='dw-e-rslt'>{result}</pre>).toList }
        </div>
      </li>
    }

    val pending = nipo.editsPendingDescTime
          // Better keep sorted by time? and if people don't like them,
          // they'll be deleted (faster)?
          //.sortBy(e => -pageStats.likingFor(e).lowerBound)
    // Must be sorted by time, most recent first (debiki.js requires this).
    val applied = nipo.editsAppliedDescTime
    val cssMayEdit = if (mayEdit) "dw-e-sgs-may-edit" else ""
    val cssArtclBody = if (nipo.id == PageParts.BodyId) " dw-ar-p-bd" else ""

    <form id='dw-e-sgs' action={"?applyedits"+ _viewRoot}
          class={cssMayEdit} title='Improvements'>
      { _xsrfToken }
      <div id='dw-e-sgss'>
        <div>Improvement suggestions:</div>
        <div id='dw-e-sgs-pending'>
          <ol class='dw-e-sgs'>{
            for (edit <- pending) yield xmlFor(edit)
          }</ol>
        </div>
        <div>Improvements already applied:</div>
        <div id='dw-e-sgs-applied'>
          <ol class='dw-e-sgs'>{
            for (editApplied <- applied) yield xmlFor(editApplied)
          }</ol>
        </div>
        {/* cold show original text on hover.
        <div id='dw-e-sgs-org-lbl'>Original text</div> */}
        <pre id='dw-e-sgs-org-src'>{nipo.textInitially}</pre>
      </div>
      <div id='dw-e-sgs-diff'>{/* COULD rename to -imp-diff */}
        <div>This improvement:</div>
        <div id='dw-e-sgs-diff-text'>
        </div>
      </div>
      <div id='dw-e-sgs-save-diff'>
        <div>Changes to save:</div>
        <div id='dw-e-sgs-save-diff-text'>
        </div>
      </div>
      <div id='dw-e-sgs-prvw'>
        <div>Preview:</div>
        <div class={"dw-p-bd"+ cssArtclBody}>
          <div id='dw-e-sgs-prvw-html' class='dw-p-bd-blk'/>
        </div>
      </div>
    </form>
  }

  def editForm(postToEdit: Post, newText: String, userName: Option[String]) = {
    import Edit.{InputNames => Inp}
    val isForTitle = postToEdit.id == PageParts.TitleId
    val cssArtclBody =
      if (postToEdit.id == PageParts.BodyId) " dw-ar-p-bd"
      else ""
    val submitBtnText = "Submit as "+ userName.getOrElse("...")
    <form class='dw-f dw-f-e'
          action={"?edit="+ postToEdit.id + _viewRoot}
          accept-charset='UTF-8'
          method='post'>
      { _xsrfToken }
      {/* timeWaistWarning("edits", "are") */}
      { xml.Unparsed(views.html.editorHelp().body) }
      <div class='dw-f-e-inf-save'>Scroll down and click Submit when done.</div>
      <div class='dw-f-e-mup'>
        <label for={Inp.Markup}>Markup: </label>
        <select id={Inp.Markup} name={Inp.Markup}>{
          // List supported markup languages.
          // Place the current markup first in the list.
          val markupsSorted =
            Markup.All.sortWith((a, b) => a.id == postToEdit.markup)
          val current = markupsSorted.head
          <option value={current.id} selected='selected'>{
            current.prettyName +" – in use"}</option> ++
          (markupsSorted.tail map { mup =>
            <option value={mup.id} >{mup.prettyName}</option>
          })
        }
        </select>
      </div>
      <div id='dw-e-tabs' class='dw-e-tabs'>
        <ul>
          <li><a href='#dw-e-tab-edit'>Edit</a></li>
          <li><a href='#dw-e-tab-diff'>Diff</a></li>
          <li><a href='#dw-e-tab-prvw'>Preview</a></li>
        </ul>
        <div id='dw-e-tab-edit' class='dw-e-tab dw-e-tab-edit'>
          <textarea id='dw-fi-edit-text' name={Inp.Text}
                    rows={if (isForTitle) "2" else "7"} cols='38'>{
            newText
          }</textarea>
        </div>
        <div id='dw-e-tab-prvw'
             class={"dw-e-tab dw-e-tab-prvw dw-p-bd"+ cssArtclBody}>
          <div class='dw-p-bd-blk'/>
        </div>
        <div id='dw-e-tab-diff' class='dw-e-tab dw-e-tab-diff'>
        </div>
        { // In debiki.js, updateEditFormDiff() uses textarea.val()
          // (i.e. newText) if there's no .dw-e-src-old tag.
          if (postToEdit.currentText == newText) Nil
          else <pre class='dw-e-src-old'>{postToEdit.currentText}</pre> }
      </div>
      { termsAgreement("Submit as ...") }
      <div class='dw-f-e-prvw-info'>To submit, first click <em>Preview</em>
        (just above).
      </div>
      <div class='dw-f-e-sugg-info'>You are submitting a
        <strong>suggestion</strong>.</div>
      <div class='dw-submit-set'>
       <input type='submit' class='dw-fi-submit' value={submitBtnText}/>
       <input type='button' class='dw-fi-cancel' value='Cancel'/>
      </div>
    </form>
  }

  def deleteForm(postToDelete: Option[Post]): NodeSeq = {
    val deleteAction =
      if (postToDelete.isDefined) "?delete="+ postToDelete.get.id
      else "" // Javascript will fill in post id, do nothing here

    <div class='dw-fs' title='Delete Comment'>
      <form id='dw-f-dl' action={deleteAction + _viewRoot}
            accept-charset='UTF-8' method='post'>{
        import Delete.{InputNames => Inp}
        val deleteTreeLabel = "Delete replies too"
        _xsrfToken ++
        <div>
          <label for={Inp.Reason}>Reason for deletion? (optional)</label><br/>
          <textarea id={Inp.Reason} rows='2' cols='33'
                 name={Inp.Reason} value=''></textarea>
        </div>
        <div>
          <label for={Inp.DeleteTree}>{deleteTreeLabel}</label>
          <input id={Inp.DeleteTree} type='checkbox'
                 name={Inp.DeleteTree} value='t' />
        </div>
        <div class='dw-submit-set'>
          <input class='dw-fi-submit' type='submit' value='Delete'/>
          <input class='dw-fi-cancel' type='button' value='Cancel'/>
        </div>
      }
      </form>
    </div>
  }

  val submittingFormInfoDiv: NodeSeq = {
    <div class='dw-tps dw-inf-submitting-form'>
      <p>Submitting ...</p>
    </div>
  }

  /**
   *  A tips on how replies are sorted, in the horizontal layout.
   */
  val sortOrterTipsDiv: NodeSeq = {
    <div class='dw-tps' id='dw-tps-sort-order'>
      Comments rated <i>interesting, funny</i>
      <span class="dw-tps-sort-order-arw dw-flip-hz"></span>
      <div class='dw-tps-sort-order-your-post'>
        Your post has no ratings, and was therefore placed below.
      </div>
      <span class="dw-tps-sort-order-arw"></span>
      Comments rated <i>boring, stupid</i>
      <div class='dw-tps-close'>(Click this box to dismiss)</div>
    </div>
  }

  /**
   *  A tips to rate one's own comments.
   */
  val rateOwnCommentTipsDiv: NodeSeq = {
    <div class='dw-tps' id='dw-tps-rate-own-comment'>
      <div class='dw-tps-arw-left'/>
      <p><strong>Rate your own comment:</strong>
        Click the <strong class='dw-a-color-primary'>Rate</strong> button.
      </p>
      <p class='dw-tps-close'>(click this box to dismiss)</p>
    </div>
  }


  /*
  def timeWaistWarning(action: String, is: String): NodeSeq = {
    import IntrsAllowed._
    intrsAllowed match {
      case VisibleTalk => Nil
      case HiddenTalk =>  // COULD fix nice CSS and show details on hover only
        <div>
        <em>Time waist warning: On this page, your {action} {is} shown
         only to people who explicitly choose to view user comments.
        </em>
        </div>
    }
  }*/

  /** Does a terms agreement in each Reply and Edit form give a litigious
   *  impression? That the website cares only about legal stuff and so on?
   *  Anyway, any terms agreement must be customizable,
   *  since it would be unique for each tenant. No time to fix that now,
   *  so disable this, for now.
  */
  def termsAgreement(submitBtnText: String) = Nil  /*
    <div class='dw-user-contrib-license'>By clicking <em>{submitBtnText}</em>,
      you agree to release your contributions under the {ccWikiLicense}
      license, and you agree to the
      <a href={config.termsOfUseUrl} target="_blank">Terms of Use</a>.
    </div> */
    /* This short version might be better?
    <div id='tos' style='padding-top: 1ex; font-size: 80%; color: #555;'>
    Please read the <span style='text-decoration: underline;'>
      Terms of Use</span>.</div> */
}


