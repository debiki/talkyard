// vim: ts=2 sw=2 et
/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

package com.debiki.v0

import java.{util => ju}
import scala.collection.JavaConversions._
import collection.{mutable => mut, immutable => imm}
import _root_.scala.xml.{NodeSeq, Elem, Text}
import Prelude._

private[debiki]
object Paths {
  val EditsProposed = "edits/proposed/post/"
}

// Should be a LayoutManager static class, but how can I then acces
// it from Java?
class LayoutConfig {
  // These default form action values (the empty string) reload the current
  // page, says this RFC: http://www.apps.ietf.org/rfc/rfc3986.html#sec-5.4
  var replyAction = ""
  var rateAction = ""
  var editAction = ""
}

class LayoutVariables {
  var lastPageVersion: Option[ju.Date] = None
  var newReply: Option[String] = None
}

object LayoutManager {

  /** Digs a {@code Reply} or a {@code Rating} out of a
   *  {@code javax.servlet.ServletRequest.getParameterMap()}.
   *
   *  If {@code userName} specifies, ignores {@code dw-fi-by}.
   *
   *  If {@code date} is {@code None}, uses the current date-time.
   *
   *  The param map maps input-names to input-value-arrays. This function
   *  searches the map for Debiki specific input/value data,
   *  and constructs a rating or a reply or nothing.
   */
  def digServletRequestParamMap(
        map: ju.Map[String, Array[String]],
        userName: Option[String],
        ip: Option[String],
        date: Option[ju.Date]): Option[Object] = {

    def hasValues(arr: Array[String]) = arr != null && !arr.isEmpty

    // Check the form-input-action map entry, to find out how to interpret
    // other map entries.
    val actionOrNull = map.get("dw-fi-action")
    var action = ""
    
    actionOrNull match {
      case null => return None
      case Array(value) =>
        require(List("reply", "rate", "edit", "vote-on-edits").
            contains(value), "Unknown dw-fi-action value: "+ safe(value))
        action = value
      case Array() => illegalArg("No dw-fi-action value")
      case Array(_, _, _*) => illegalArg("Too many dw-fi-action values")
      case x => illegalArg("Request map value is no array, it is a: "+
                          x.getClass.getSimpleName)
    }

    def requireUser() = {
      val by = map.get("dw-fi-by")
      require(userName.isDefined || hasValues(by),
              "A user must be specified")
      require(userName.isDefined || by.length == 1,
              "Not more than one user specified")
      userName.getOrElse(by.head)
    }

    val ip_ = ip.getOrElse("?.?.?.?")

    action match {
      case "reply" =>
        val posts = map.get("dw-fi-post")
        val replyTexts = map.get("dw-fi-reply-text")
        require(hasValues(posts), "Found no reply-to post")
        require(posts.length == 1, "More than one reply-to post")
        require(hasValues(replyTexts), "Found no reply text")
        require(replyTexts.length == 1, "More than one reply text")
        Some(Post(
                id = "?", // illegal id, only a-z allowed
                parent = posts.head,
                date = date.getOrElse(new ju.Date),
                by = requireUser(),
                ip = ip_,
                text = replyTexts.head))
      case "rate" =>
        val posts = map.get("dw-fi-post")
        val tags = map.get("dw-fi-rat-tag")
        require(hasValues(posts), "Found no post to rate")
        require(posts.length == 1, "Found more than one post to rate")
        require(hasValues(tags), "Found no rating tag")
        require(tags.length < 100, "Less than 100 rating tags") // safer?
        Some(Rating(
                postId = posts.head,
                by = "?", // TODO: Remove `by'?
                ip = ip_,
                date = date.getOrElse(new ju.Date),
                tags = tags.toList))
      case "edit" =>
        val editText = map.get("dw-fi-edit-text")
        val postId = map.get("dw-fi-edit-post")
        require(hasValues(editText), "No edit-text found")
        require(editText.length <= 1, "More than one edit-text")
        require(hasValues(postId), "Which post-to-edit must be specified")
        require(postId.length == 1, "More than one post-to-edit specified")
        Some(Edit(
                id = "?",
                postId = postId.head,
                by = requireUser(),
                ip = ip_,
                date = date.getOrElse(new ju.Date),
                text = editText.head))
      case "vote-on-edits" =>
        var likes = List[String]()
        var disses = List[String]()
        val prefix = "dw-fi-vote-edit-"
        for ((key, array) <- map; if key startsWith prefix) {
          val editId = key.drop(prefix.length)
          array match {
            case Array("1") => likes ::= editId
            case Array("0") => disses ::= editId
            case Array(x) => illegalArg("Bad vote value: "+ safe(x))
            case Array(x, y, _) => illegalArg("More than one vote value")
            case Array() => illegalArg("Map entry is empty array")
            case x => illegalArg("Map entry not an array: "+
                                    x.getClass.getSimpleName)
          }
        }
        if (likes.length + disses.length == 0) return None
        Some(EditVote(
                id = "?",
                by = "?", // TODO: Remove `by'?
                ip = ip_,
                date = date.getOrElse(new ju.Date),
                like = likes,
                diss = disses))
      case x =>
        assertionError("Unknown case: "+ x)
    }
  }

  /** Converts text to xml, returns (html, approx-line-count).
   */
  private[v0]
  def textToHtml(text: String, charsPerLine: Int = 80)
      : Tuple2[NodeSeq, Int] = {
    var lines = 0
    val xml =
      // Two newlines ends a paragraph.
      for (par <- text.split("\n\n").toList)
      yield {
        lines += 1 + par.length / charsPerLine
        <p>{par}</p>
      }
    (xml, lines)
  }

  /** Replaces spaces with the Unicode representation of non-breaking space,
   *  which is interpreted as {@code &nbsp;} by Web browsers.
   */
  private[v0]
  def spaceToNbsp(text: String): String = text.replace(' ', '\u00a0')

  private[v0]
  def dateToAbbr(date: ju.Date, cssClass: String): NodeSeq =
    <abbr class={"dw-date "+ cssClass} title={toIso8601(date)} />

  /** WARNING: XSS / DoS attacks possible?
   */
  private[v0]
  def optionToJsVar[E](o: Option[E], varName: String): String =
    "\n"+ varName +" = "+ (o match {
      case None => "undefined"
      case Some(null) => "null"
      case Some(d: ju.Date) => "'"+ toIso8601(d) +"'"
      case Some(x) => "'"+ x.toString +"'"
    }) +";"

  /** WARNING: XSS / DoS attacks possible?
   *  All available options:
   *    "expires: 7, path: '/', domain: 'jquery.com', secure: true"
   */
  private[v0]
  def optionToJsCookie[E](
          o: Option[E], cookieName: String, options: String = ""): String =
    if (o.isEmpty) ""  // do nothing with cookie
    else
      "\njQuery.cookie('"+ cookieName +"', "+
      ((o: @unchecked) match {
        case Some(null) => "null"  // delete cookie
        case Some(d: ju.Date) => "'"+ toIso8601(d) +"'"
        case Some(x) => "'"+ x.toString + "'"
      }) +
      (if (options.isEmpty) "" else ", {"+ options +"}") +
      ");"

}

import LayoutManager._

class LayoutManager(val debate: Debate) {

  import LayoutManager._

  private var config = new LayoutConfig

  private lazy val statscalc: StatsCalc = new StatsCalc(debate)
  private var lastChange: Option[String] = null
  private var vars: LayoutVariables = null

  def configure(conf: LayoutConfig) { this.config = conf }

  def layoutDebate(vars: LayoutVariables = new LayoutVariables)
      : NodeSeq = {
    this.vars = vars
    this.lastChange = debate.lastChangeDate.map(toIso8601(_))
    layoutPosts ++ menus ++ variables
  }

  private def layoutPosts(): NodeSeq = {
    val rootPosts = debate.repliesTo(debate.RootPostId)
    val articleActions =
      if (rootPosts.length == 1) Nil // TODO: Nil iff no article
      else {
        <div class='dw-art-acts'>
          <a class='dw-reply'>Reply</a>
        </div>
      }
    <div id={debate.id} class="debiki dw-debate">
      <div class="dw-debate-info">{
        if (lastChange isDefined) {
          <p class="dw-last-changed">Last changed on
          <abbr class="dw-date"
                title={lastChange.get}>{lastChange.get}</abbr>
          </p>
        }
      }
      </div>
      { articleActions }
      <ol class='dw-cmts ui-helper-clearfix'>{
        // If there is only 1 root post, start on depth 0. Then it
        // will be made wide (via CSS), so it covers the whole first
        // row. Otherwise start on depth 1: posts on depth 1
        // are layed out into columns.
        _layoutPosts(
            if (rootPosts.length == 1) 0 else 1,
            rootPosts)
      }
      </ol>
    </div>
  }

  private def _layoutPosts(depth: Int, posts: List[Post]): NodeSeq = {
    for {
      c <- posts.sortBy(p => -statscalc.scoreFor(p.id).liking)
      cssThreadId = "dw-thread-"+ c.id
      cssDepth = "dw-depth-"+ depth
    }
    yield
      <li id={cssThreadId} class={"dw-cmt "+ cssDepth + " dw-thread"}>
      {
        comment(c) ++
        (if (debate.repliesTo(c.id).isEmpty) Nil
        else
          <ol class='dw-cmts'>
            { _layoutPosts(depth + 1, debate.repliesTo(c.id)) }
          </ol>)
      }
      </li>
  }

  private def comment(post: Post): NodeSeq = {
    val count = debate.successorsTo(post.id).length + 1
    val dateCreated = toIso8601(post.date)
    val editApps = debate.editsAppliedTo(post.id)
    val lastEditApp = editApps.headOption
    val lastEditDate = editApps.headOption.map(ea => toIso8601(ea.date))
    val cssPostId = "dw-post-"+ post.id
    val (xmlText, numLines) =
        textToHtml(lastEditApp.map(_.result).getOrElse(post.text))
    val long = numLines > 9
    val cropped_s = if (long) " dw-x-s" else ""

    val score = statscalc.scoreFor(post.id)
    val ratStatsSorted = score.labelStatsSorted
    val rats = ratStatsSorted //.takeWhile(_.fractionLowerBound > 0.25)
    val ratsList =
      if (rats.isEmpty) Nil
      else
        <br/> ++ Text(rats.length +" ratings:") ++
        <ol class='dw-rats'>{
          // Don't change whitespace, or `editInfo' perhaps won't
          // be able to append a ',' with no whitespace in front.
          for ((tag: String, stats: LabelStats) <- rats) yield
          <li class="dw-rat" data-stats={
              ("lo: %.0f" format (100 * stats.fractionLowerBound)) +"%, "+
              "sum: "+ stats.sum}> {
            tag +" %.0f" format (100 * stats.fraction)}% </li>
        }</ol>
    val editInfo =
      // If closed: <span class='dw-cmt-re-cnt'>{count} replies</span>
      if (editApps.isEmpty) Nil
      else
        //<span class='dw-cmt-hdr-ed'>. <b>Edited</b> by {
        <div class='dw-cmt-hdr-ed'><b>Edited</b> by {
          if (editApps.map(a => debate.editsById(a.editId).by).
              distinct.length > 1)
            <a>various people</a>
          else
            <a class='dw-cmt-ed-by'>{
              debate.editsById(lastEditApp.get.editId).by
            }</a>
          }, <abbr class='dw-cmt-at dw-date' title={lastEditDate.get}>{
              lastEditDate.get}</abbr>
        </div>

    // the – on the next line is an `en dash' not a minus
    <a class='dw-cmt-x'>[–]</a>
    <div id={cssPostId} class={"dw-cmt-wrap dw-x-e" + cropped_s}>
      <div class='dw-cmt-hdr'>
        By <a class='dw-cmt-by'>{post.by}</a>,
        <abbr class='dw-cmt-at dw-date'
            title={dateCreated}>{dateCreated}</abbr>{
            ratsList }{
            editInfo } 
      </div>
      <div class='dw-cmt-bdy'>
        { xmlText }
      </div>
    </div>
    <a class='dw-cmt-act' href={'#'+ cssPostId}>React</a>
  }

/*
  private def postXml(p: Post): NodeSeq = {
    val cssPostId = "dw-post-"+ p.id
    val editApplications = debate.editsAppliedTo(p.id)
    val lastEditApplied = editApplications.headOption
    val (xmlText, numLines) = textToHtml(
                            lastEditApplied.map(_.result).getOrElse(p.text))
    val long = numLines > 9
    val cropped_s = if (long) " dw-cropped-s" else ""
    val date = toIso8601(lastEditApplied.map(_.date).getOrElse(p.date))
    val score = statscalc.scoreFor(p.id)
    <div id={cssPostId} class={"dw-post dw-cropped-e" + cropped_s}>
      <div class='dw-post-info'>
        <div class='dw-owner-info'>By&#160;<span class="dw-owner">{
            spaceToNbsp(p.by)
          }</span><br/>{
            // (TODO) If the original author has voted on all edits
            // proposed, write "<his/her-name> et al.". ("et al." suggests
            // that the original author *likes* the edits done.)
            if (editApplications.isEmpty) Nil
            else
              <span>Edited&#160;by&#160;</span>
              <span>{
                  if (editApplications.map(
                        a => debate.editsById(a.editId).by).distinct.length > 1)
                    <span>various people</span>
                  else
                    <span class="dw-owner">{
                      debate.editsById(lastEditApplied.get.editId).by
                    }</span>
              }</span>
          }
        </div>
        <span class="dw-post-liking">{score.liking}</span>
        <span class="dw-rat-count">{score.ratingCount}</span>
        <span class="dw-rat-valsum-max">{score.maxLabelSum}</span>
        <ul class='dw-rats'>{
          for ((tag: String, stats: LabelStats) <- score.labelStatsSorted)
          yield
            <li class="dw-rat">
              <span class="dw-rat-tag">{tag}</span>
              <span class="dw-rat-tag-frac">{
                  "%.0f" format (100 * stats.fraction) }%</span>
              <span class="dw-rat-tag-frac-min">{
                  "%.0f" format (100 * stats.fractionLowerBound) }%</span>
              <span class="dw-rat-tag-sum">{stats.sum}%</span>
            </li>
        }</ul>
        <ul class='dw-rats-non-weighted'>{
          // **Only for debugging**, css display is `none'.
          for ((tag: String, sum: Int) <- debate.ratingSumsFor(p.id)) yield
            <li class="dw-rat">
              <span class="dw-rat-tag">{tag}</span>
              <span class="dw-rat-tag-sum">{sum}</span>
            </li>
        }</ul>
        <div class="dw-last-changed">
          <abbr class="dw-date" title={date}>
            {/* Show date on one line (10 chars), time on another. */}
            {date.take(10)}<br/>at {date.drop(11)}</abbr>
        </div>
        {
          val num = debate.editsPendingFor(p.id).length
          if (num == 0) Nil
          else
            <div class="dw-edits">{
              num + (if (num == 1) " edit?" else " edits?")
            }</div>
        }
      </div>
      { xmlText }
    </div>
  }
*/

  def editForm(postId: String): NodeSeq = {
    val post = debate.post(postId).get
    val editInputId = "dw-fi-edit-"+ postId +"-text"
    val nameInputId = "dw-fi-edit-"+ postId +"-author"
    val editsPending = debate.editsPendingFor(postId).
                        sortBy(e => -statscalc.likingFor(e).lowerBound)
    val editsApplied = debate.editsAppliedTo(postId)

    def editsPendingStuff = {
      <a class='dw-show-edits-pending-btn'>Show edits suggested...</a>
      <form class='dw-edits-others-form'
          action={config.editAction}
          accept-charset='UTF-8'
          method='post'>
        <div class='dw-edits-lbl'>Vote on edits suggested:</div>
        <p>(If many people like a certain edit suggestion,
        it will be applied.)</p>
        <div class='dw-edits'>
          {
            for (e <- editsPending)
            yield editXml(e, applied = None)
          }
        </div>
        <div class='dw-submit-set'>
          <input class='dw-submit' type='submit' value='Submit votes'/>
          <input class='dw-cancel' type='button' value='Cancel'/>
          <input type='hidden' name='dw-fi-edit-post' value={postId}/>
          <input type='hidden' name='dw-fi-action' value='vote-on-edits'/>
        </div>
      </form>
    }

    def newSuggestionStuff = {
      <a class='dw-new-edit-btn'>New edit suggestion...</a>
      <form class='dw-new-edit-form'
          action={config.editAction}
          accept-charset='UTF-8'
          method='post'>
        <label for={editInputId}>Your new sugggestion:</label><br/>
        <textarea id={editInputId} name='dw-fi-edit-text' rows='10'/>
        <div class='dw-name-or-alias'>
          <label for={nameInputId}>Your name or alias:</label>
          <input id={nameInputId} type='text'
                name='dw-fi-by' value='Anonymous'/>
        </div>
        <div class='dw-submit-set'>
          <input class='dw-submit' type='submit' value='Submit suggestion'/>
          <input class='dw-cancel' type='button' value='Cancel'/>
          <input type='hidden' name='dw-fi-edit-post' value={postId}/>
          <input type='hidden' name='dw-fi-action' value='edit'/>
        </div>
      </form>
    }

    def editsAppliedStuff = {
      <a class='dw-show-edits-applied-btn'>Show edits applied...</a>
      <form class='dw-edits-applied-form'
          action={config.editAction}
          accept-charset='UTF-8'
          method='post'>
        <div class='dw-edits-lbl'
          >Edits already applied, most recent first:</div>
        <p>(If many people dislike the most recent edit,
        it will be reverted.) <i>Not implemented</i></p>
        <div class='dw-edits dw-edits-applied'>
          {
            for {
              ea <- editsApplied
              e = debate.editsById(ea.editId)
            } yield
                editXml(e, Some(ea))
          }
          <h4><a href='#'>Original text, by {post.by}</a></h4>
          <div>{textToHtml(post.text)._1}</div>
        </div>
        <div class='dw-submit-set'>
          <input class='dw-submit' type='submit' value='Submit votes'/>
          <input class='dw-cancel' type='button' value='Cancel'/>
          <input type='hidden' name='dw-fi-edit-post' value={postId}/>
          <input type='hidden' name='dw-fi-action' value='vote-on-edits'/>
        </div>
      </form>
    }

    <div class='dw-edit-forms'>
    {
      (if (editsPending.nonEmpty) editsPendingStuff else Nil) ++
      newSuggestionStuff ++
      (if (editsApplied.nonEmpty) editsAppliedStuff else Nil)
    }
    </div>
  }

  private def editXml(edit: Edit, applied: Option[EditApplied]): NodeSeq = {
    val appl = if (applied.isDefined) "applied-" else ""
    val likeId = "dw-fi-like-edit-"+ appl + edit.id
    val dissId = "dw-fi-diss-edit-"+ appl + edit.id
    val name = "dw-fi-vote-edit-"+ edit.id
    <h4><a href='#'>By {edit.by}</a></h4>
    <div>
      <div class='dw-edit-dates'>Submitted on { toIso8601(edit.date) +
          (if (applied.isDefined) ", applied on "+ applied.get.date
            else "")
      }</div>
      <div>{textToHtml(edit.text)._1}</div>
      <div class='dw-edit-vote-btns'>
        <input id={likeId} type='radio' name={name} value='1'/>
        <label for={likeId}>Like</label>
        <input id={dissId} type='radio' name={name} value='0'/>
        <label for={dissId}>Dislike</label>
      </div>
      {/*<a class='dw-show-edit-liking-stats'>Complicated statistics...</a>*/}
      <div class='dw-edit-liking-stats'>{
          val liking = statscalc.likingFor(edit)
          liking.voteCount +" votes, liking: "+
          (if (liking.voteCount == 0) "?"
           else "%.0f%%" format 100 * liking.frac) +
          ", 80%% confidence interval: %.0f%%...%.0f%%".format(
                100 * liking.lowerBound, 100 * liking.upperBound)
      }</div>
     </div>
  }

  val ccWikiLicense =
    <a rel="license" href="http://creativecommons.org/licenses/by/3.0/"
       target="_blank">
      Creative Commons Attribution 3.0 Unported License
    </a>

  private val submitButtonText = "Submit reply"

  /**
   *  Naming notes:
   *   - Form input names and ids always starts with "dw-fi-"
   *     ("fi" is for "form input").
   *  Security notes:
   *   - Only send [<form>s with side effects] using the POST
   *     method (never GET), to make XSRF attacks harder.
   */
  private def menus = {
    <div id="dw-hidden-templates">
      <div id='dw-action-menu'>
        <a class='dw-reply'>Reply</a>
        <a class='dw-rate'>Rate</a>
        <a class='dw-edit'>Edit</a>
      </div>
      <div class='dw-reply-template'>
        <form class='dw-reply-form'
            action={config.replyAction}
            accept-charset='UTF-8'
            method='post'>
          <input type='hidden' name='dw-fi-action' value='reply'/>
          <input type='hidden' name='dw-fi-post' value='?'/>
          <p>
            <label for='dw-fi-reply-text'>Your reply:</label><br/>
            <textarea id='dw-fi-reply-text' name='dw-fi-reply-text' rows='13'
              cols='38'/>
          </p>
          <p class='dw-name-or-alias'>
            <label for='dw-fi-reply-author'>Your name or alias:</label>
            <input id='dw-fi-reply-author' type='text'
                  name='dw-fi-by' value='Anonymous'/>
          </p>
          <p class='dw-user-contrib-license'>
            By clicking <i>{submitButtonText}</i>, you agree to license
            the text you submit under the {ccWikiLicense}.
          </p>
          <div class='dw-submit-set'>
            <input class='dw-submit' type='submit' value={submitButtonText}/>
            <input class='dw-cancel' type='button' value='Cancel'/>
          </div>
        </form>
      </div>
      <div class='dw-rat-template'>
        <form class='dw-rat-form'
            action={config.rateAction}
            accept-charset='UTF-8'
            method='post'>
          <input type='hidden' name='dw-fi-action' value='rate'/>
          <input type='hidden' name='dw-fi-post' value='?'/>
          {
            var boxCount = 1
            def rateBox(value: String) = {
              val name = "dw-fi-rat-tag"
              val id = name +"-"+ boxCount
              boxCount += 1
              <input id={id} type='checkbox' name={name} value={value} />
              <label for={id}>{value}</label>
            }
            {/* Don't show *all* available values immediately -- that'd
            be too many values, people can't keep them all in mind. Read this:
            en.wikipedia.org/wiki/The_Magical_Number_Seven,_Plus_or_Minus_Two
            although 3 - 5 items is probably much better than 7 - 9. */}
            <div>
              {/* temporary layout hack */}
              <div class='dw-rat-tag-set'>{
                rateBox("interesting") ++
                rateBox("funny")
              }</div>
              <div class='dw-rat-tag-set'>{
                rateBox("boring") ++
                rateBox("stupid")
              }</div>
              <a class='dw-show-more-rat-tags'>More...</a>
              <div class='dw-rat-tag-set dw-more-rat-tags'>{
                rateBox("off-topic") ++
                rateBox("spam") ++
                rateBox("troll")
              }</div>
            </div>
          }
          <div class='dw-submit-set'>
            <input class='dw-submit' type='submit' value='Submit ratings'/>
            <input class='dw-cancel' type='button' value='Cancel'/>
          </div>
        </form>
      </div>
    </div>
  }

  private def variables: NodeSeq =
    <script class='dw-js-variables'>{
      // TODO: Could this open for XSS attacks?
      optionToJsCookie(vars.lastPageVersion, "myLastPageVersion",
                          "expires: 370") +
      optionToJsCookie(lastChange, "myCurrentPageVersion") +
      optionToJsCookie(vars.newReply, "myNewReply")
    }</script>

}

