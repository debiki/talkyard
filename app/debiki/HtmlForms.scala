/**
 * Copyright (C) 2012 Kaj Magnus Lindberg (born 1979)
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

package debiki

import com.debiki.core._
//import com.twitter.ostrich.stats.Stats
import java.{util => ju, io => jio}
import scala.collection.JavaConversions._
import _root_.scala.xml.{NodeSeq, Node, Elem, Text, XML, Attribute}
import FlagType.FlagType
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

  def apply(xsrfToken: String, pageRoot: AnyPageRoot, permsOnPage: PermsOnPage) =
    new HtmlForms(xsrfToken, pageRoot, permsOnPage)

  val XsrfInpName = "dw-fi-xsrf"

  object FlagForm {
    object InputNames {
      val Type = "dw-fi-flg-type"
      val Reason = "dw-fi-flg-reason"
    }
    import FlagType._
    def prettify(tyype: FlagType): String = (tyype match {  // i18n
      case Inapt => "Inappropriate"
      case x => x.toString
    })
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


class HtmlForms(xsrfToken: String, val pageRoot: AnyPageRoot, val permsOnPage: PermsOnPage) {

  import HtmlForms._

  val config = new {
    // It'd be better to use Play's revere routing, rather than these old weird constants.

    val termsOfUseUrl = "/terms-of-use"

    val loginActionOpenId = "/-/api/login-openid"
    val loginOkAction = ""
    val loginFailedAction = ""
  }


  val ccWikiLicense =
    <a rel="license" href="http://creativecommons.org/licenses/by/3.0/"
       target="_blank">CC BY-SA 3.0</a>


  def dialogTemplates = {
    <div id="dw-hidden-templates">
    { loginForms ++
      flagForm ++
      deleteForm(None) }
    </div>
  }


  def loginForms =
    loginOkForm() ++
    loginFailedForm()


  /** A query string param that remembers which part of a page we are
   *  currently viewing.
   */
  private def _viewRoot = pageRoot match {
    case DefaultPageRoot => "" // The page body is the default, need not be specified.
    case Some(commentId) => s"&view=$commentId"
    case None => "&view=todo-DwE80IWk5" // This isn't in use right now, could fix later
  }


  private def _xsrfToken = {
    <input type='hidden' class={XsrfInpName}
           name={XsrfInpName} value={xsrfToken}/>
  }


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


  def flagForm = {
    import FlagForm.{InputNames => Inp}
    <div class='dw-fs' title='Report Comment'>
      <form class='dw-f-flg'>
        { _xsrfToken }
        <div class='dw-f-flg-rsns'>{
          def input(idSuffix: String, r: FlagType) = {
            val id = "dw-fi-flgs-"+ idSuffix
            <input type='radio' id={id} name={Inp.Type} value={r.toString}/>
            <label for={id}>{FlagForm.prettify(r)}</label>
          }
          import FlagType._
          input("spam", Spam) ++
          input("inapt", Inapt) ++
          input("othr", Other)
        }</div>
        <div>
          <label for={Inp.Reason}>Details (optional)</label><br/>
          <textarea id={Inp.Reason} rows='2' cols='30'
                 name={Inp.Reason} value=''></textarea>
        </div>
        <div class='dw-submit-set'>
          <input class='dw-fi-submit' type='submit' value='Submit'/>
          <input class='dw-fi-cancel' type='button' value='Cancel'/>
        </div>
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
      def applier_! = page.people.user_!(edit.applierUserId.get)
      <li class='dw-e-sg'>
        <div class='dw-e-sg-e'>{
            <div>{
              (if (applied) "Suggested by " else "By ") ++
              linkTo(edit.user_!) ++
              dateAbbr(edit.creationDati, "dw-e-sg-dt")
              }</div> ++
            (if (!applied) Nil
            else <div>Applied by { linkTo(applier_!) ++
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

    <form id='dw-e-sgs'
          class={cssMayEdit} title='Improvements'>
      { _xsrfToken }
      <div class="row">
        <div id='dw-e-sgss' class="col-md-2">
          <h3>Improvement suggestions:</h3>
          <div id='dw-e-sgs-pending'>
            <ol class='dw-e-sgs'>{
              for (edit <- pending) yield xmlFor(edit)
            }</ol>
          </div>
          <h3>Improvements already applied:</h3>
          <div id='dw-e-sgs-applied'>
            <ol class='dw-e-sgs'>{
              for (editApplied <- applied) yield xmlFor(editApplied)
            }</ol>
          </div>
          {/* cold show original text on hover.
          <div id='dw-e-sgs-org-lbl'>Original text</div> */}
          <pre id='dw-e-sgs-org-src'>{nipo.textInitially}</pre>
        </div>
        <div id='dw-e-sgs-diff' class="col-md-3">{/* COULD rename to -imp-diff */}
          <h3>This improvement:</h3>
          <div id='dw-e-sgs-diff-text'>
          </div>
        </div>
        <div id='dw-e-sgs-save-diff'>
          <h3>Changes to save:</h3>
          <div id='dw-e-sgs-save-diff-text'>
          </div>
        </div>
        <div id='dw-e-sgs-prvw' class="col-md-7">
          <h3>Preview:</h3>
          <div class={"dw-p-bd"+ cssArtclBody}>
            <div id='dw-e-sgs-prvw-html' class='dw-p-bd-blk'/>
          </div>
        </div>
      </div>
      <div class='dw-submit-set'>
        <input type='submit' class='dw-fi-submit' value='Save'/>
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


  def linkTo(user: User): NodeSeq = {
    var url = s"/-/users/#/id/${user.id}"

    val nameElem =
      if (user.isGuest) {
        val fullName = <span class="dw-fullname">{ user.displayName }</span>
        // Indicate that the user was not logged in, that we're not sure
        // about his/her identity, by appending "??". If however s/he
        // provided an email address then only append one "?", because
        // other people probaably don't know what is it, so it's harder
        // for them people to impersonate her.
        // (Well, at least if I some day in some way indicate that two
        // persons with the same name actually have different emails.)
        val guestMark = <span class='dw-lg-t-spl'>{if (user.email isEmpty) "??" else "?"}</span>
        fullName ++ guestMark
      }
      else {
        val usernameOrFullName = user.username match {
          case Some(username) => <span class="dw-username">{ username }</span>
          case None => <span class="dw-fullname">{ user.displayName }</span>
        }

        val fullNameOrNil = user.username match {
          case None => Nil
          case Some(_) =>
            // `usernameOrFullName` contains the username not the full name.
            <span class="dw-fullname"> ({user.displayName})</span>
        }

        usernameOrFullName ++ fullNameOrNil
      }

    val userLink = if (url nonEmpty) {
      <a class='dw-p-by' href={url} data-dw-u-id={user.id} rel='nofollow'>{nameElem}</a>
    } else {
      <span class='dw-p-by' data-dw-u-id={user.id}>{nameElem}</span>
    }

    userLink
  }

}


