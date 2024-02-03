package talkyard.server.api

import com.debiki.core._
import com.debiki.core.Prelude.classNameOf
import java.util.{Map => j_Map}
import debiki.JsonUtils._
import play.api.libs.json.{JsValue, JsArray, JsObject}



/** Does *not* do any access control. Anyone can specify that they want to see all
  * fields. So, even if `refId` is true, ref ids should not necessarily be included
  * in the server's response.
  *
  * (Access control depends on too many things (e.g. category, who's the
  * page author, one's groups and trust levels) and the caller, who has access
  * to everything, should do that instead.)
  */
object InclFieldsParSer {

  def parsePageFields(jOb: JsObject): InclPageFields = {
    InclPageFields(
          id = parseOrFalse(jOb, "id"),
          refId = parseOrFalse(jOb, "refId"),
          urlPath = parseOrFalse(jOb, "urlPath"),
          categoryId = parseOrFalse(jOb, "categoryId"),
          categoryRefId = parseOrFalse(jOb, "categoryRefId"),
          categoriesMainFirst = parseOrFalse(jOb, "categoriesMainFirst"), // later: fields?
          pageType = parseOrFalse(jOb, "pageType"),
          answerPostId = parseOrFalse(jOb, "answerPostId"),
          doingStatus = parseOrFalse(jOb, "doingStatus"),
          closedStatus = parseOrFalse(jOb, "closedStatus"),
          deletedStatus = parseOrFalse(jOb, "deletedStatus"),
          numOpDoItVotes = parseOrFalse(jOb, "numOpDoItVotes"),
          numOpDoNotVotes = parseOrFalse(jOb, "numOpDoNotVotes"),
          numOpLikeVotes = parseOrFalse(jOb, "numOpLikeVotes"),
          numTotRepliesVisible = parseOrFalse(jOb, "numTotRepliesVisible"),
          title = parseOrFalse(jOb, "title"),
          excerpt = parseOrFalse(jOb, "excerpt"),
          origPost = parseOrFalse(jOb, "origPost"), // later: InclPostFields,
          author = parseOrFalse(jOb, "author"),
          posts = parseOrFalse(jOb, "posts"), // later: Opt[InclPosts] = None,
          tags = parseOrFalse(jOb, "tags"), // later:  Opt[InclTagFields] = None,
          )
  }


}
