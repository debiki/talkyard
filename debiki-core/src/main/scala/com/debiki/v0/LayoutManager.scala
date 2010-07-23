// vim: ts=2 sw=2 et
/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

package com.debiki.v0

import java.{util => ju}
import collection.{mutable => mut, immutable => imm}
import _root_.scala.xml.{NodeSeq, Elem}
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
        date: Option[ju.Date]): Option[Object] = {

    def hasValues(arr: Array[String]) = arr != null && !arr.isEmpty

    // Check the form-input-action map entry, to find out how to interpret
    // other map entries.
    map.get("dw-fi-action") match {
      case Array("reply") =>
        val posts = map.get("dw-fi-post")
        val replyTexts = map.get("dw-fi-reply-text")
        val authors = map.get("dw-fi-by")
        require(hasValues(posts), "Found no reply-to post")
        require(posts.length == 1, "More than one reply-to post")
        require(hasValues(replyTexts), "Found no reply text")
        require(replyTexts.length == 1, "More than one reply text")
        require(userName.isDefined || hasValues(authors), "Found no author")
        require(userName.isDefined || authors.length == 1,
                "Found more than one author")
        Some(Post(
                id = "?", // illegal id, only a-z allowed
                parent = posts.head,
                date = date.getOrElse(new ju.Date),
                by = userName.orElse(Some(authors.head)),
                text = replyTexts.head))
      case Array("rate") =>
        val posts = map.get("dw-fi-post")
        val tags = map.get("dw-fi-rat-tag")
        val raters = map.get("dw-fi-by")
        require(hasValues(posts), "Found no post to rate")
        require(posts.length == 1, "Found more than one post to rate")
        require(hasValues(tags), "Found no rating tag")
        require(tags.length < 100, "Less than 100 rating tags") // safer?
        require(userName.isDefined || hasValues(raters), "Found no rater")
        require(userName.isDefined || raters.length == 1,
                "Found more than one rater")
        Some(Rating(
                postId = posts.head,
                by = raters.head,
                date = date.getOrElse(new ju.Date),
                tags = tags.toList))
      case Array(value) => illegalArg("Unknown dw-fi-action value: "+
                                      safe(value))
      case Array() => illegalArg("No dw-fi-action value")
      case Array(_, _, _*) => illegalArg("Too many dw-fi-action values")
      case null => None
      case x => illegalArg("Request map value is no array, it is a: "+
                          x.getClass.getSimpleName)
    }
  }

  /** Converts text to xml, returns (html, approx-line-count).
   */
  private[v0]
  def textToHtml(text: String, charsPerLine: Int = 80)
      : Tuple2[Elem, Int] = {
    var lines = 0
    val xml =
        <div class="dw-text">{
          // Two newlines ends a paragraph.
          for (par <- text.split("\n\n").toList)
          yield {
            lines += 1 + par.length / charsPerLine
            <p>{par}</p>
          }
        }
        </div>
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
      { _layoutChildren(0, debate.RootPostId) }
    </div>
  }

  private def _layoutChildren(depth: Int, post: String): NodeSeq = {
    val childPosts: List[Post] = debate.repliesTo(post)
    for {
      c <- childPosts.sortBy(p => -statscalc.scoreFor(p.id).liking)
      cssThreadId = "dw-thread-"+ c.id
      cssDepth = "dw-depth-"+ depth
    }
    yield
      <div id={cssThreadId} class={cssDepth + " dw-thread"}>
        { threadInfoXml(c) }
        { postXml(c) }
        { _layoutChildren(depth + 1, c.id) }
      </div>
  }

  private def threadInfoXml(post: Post): NodeSeq = {
    val count = debate.successorsTo(post.id).length + 1
    if (count == 1)
      <ul class="dw-thread-info">
        <li class="dw-post-count">1 reply</li>
      </ul>
    else
      <ul class="dw-thread-info">
        <li class="dw-post-count">{count} replies</li>
        <li class="dw-rat-tag">interesting</li>
        <li class="dw-rat-tag">funny</li>
      </ul>
  }

  private def postXml(p: Post): NodeSeq = {
    val cssPostId = "dw-post-"+ p.id
    val lastEditApplied = debate.editsAppliedTo(p.id).lastOption
    val (xmlText, numLines) = textToHtml(
                            lastEditApplied.map(_.result).getOrElse(p.text))
    val long = numLines > 9
    val cropped_s = if (long) " dw-cropped-s" else ""
    val date = toIso8601(p.date)
    val score = statscalc.scoreFor(p.id)
    <div id={cssPostId} class={"dw-post dw-cropped-e" + cropped_s}>
      <div class='dw-post-info'>
        <div class='dw-owner-info'>By&#160;<span class="dw-owner">{
            spaceToNbsp(p.by.getOrElse("whom?"))
          }</span>{
            // TODO: If the original author has voted on all edits
            // proposed, write "<his/her-name> et al.",
            // otherwise write "Various people"
            if (lastEditApplied.isDefined) <i> et al.</i> else ""
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
      </div>
      { xmlText }
    </div>
  }

  def editForm(postId: String): NodeSeq = {
    <form class='dw-edit-form'
        action={config.editAction}
        accept-charset='UTF-8'
        method='post'>
      <input type='hidden' name='dw-fi-action' value='edit'/>
      <div class='dw-edit-suggestions-label'>Edit suggestions:</div>
      <div class='dw-edit-suggestions'>
        {
          for (e <- debate.editsPendingFor(postId).
                sortBy(e => -statscalc.likingFor(e).lowerBound))
            yield editXml(e)
        }
        <h4 class='dw-hidden-new-edit'>
          <a href='#'>Your new sugggestion</a>
        </h4>
        <div class='dw-hidden-new-edit'><textarea rows='12'/></div>
      </div>
      <input class='dw-new-edit-btn' type='button'
            value='New edit suggestion...'/>
      <div class='dw-submit-set'>
        <input class='dw-submit' type='submit' value='Submit'/>
        <input class='dw-cancel' type='button' value='Cancel'/>
      </div>
    </form>
  }

  private def editXml(e: Edit): NodeSeq = {
    val likeId = "dw-like-edit-"+ e.id
    val dissId = "dw-dislike-edit-"+ e.id
    <h4><a href='#'>{e.by}</a></h4>
    <div>
      <div>{textToHtml(e.text)._1}</div>
      <input id={likeId} type='radio' name='todo' value='todo'/>
      <label for={likeId} >Like</label>
      <input id={dissId} type='radio' name='todo' value='todo'/>
      <label for={dissId} >Dislike</label>
      {/*<a class='dw-show-edit-liking-stats'>Complicated statistics...</a>*/}
      <pre class='dw-edit-liking-stats'>{
          val liking = statscalc.likingFor(e)
          "Votes: "+ liking.voteCount +
          (if (liking.voteCount == 0) ""
           else "\nLiking: %.0f%%" format 100 * liking.frac) +
          ("\nLower bound: %.0f%%" format 100 * liking.lowerBound) +
          ("\nUpper bound: %.0f%%" format 100 * liking.upperBound)
      }</pre>
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
              cols='38'>The cat was playing in the garden.</textarea>
          </p>
          <p>
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
          <input type='hidden' name='dw-fi-by' value='?'/> {/* for now */}
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
                rateBox("boring") ++
                rateBox("funny")
              }</div>
              <div class='dw-rat-tag-set'>{
                rateBox("insightful") ++
                rateBox("faulty")
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

