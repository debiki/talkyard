/**
 * Copyright (c) 2013 Kaj Magnus Lindberg (born 1979)
 */

package com.debiki.core

import java.{util => ju}


case class FullTextSearchResult(
  hits: Seq[FullTextSearchHit],
  pageMetaByPageId: Map[PageId, PageMeta]) {

  def isEmpty = hits.isEmpty

}


object FullTextSearchResult {
  val empty = FullTextSearchResult(Nil, Map.empty)
}


/**
 * @param safeHighlightsHtml A list of strings with HTML tags removed,
 *  except for <mark> and </mark>, which wraps the text that was found.
 *  There must be no other HTML stuff! Otherwise XSS attacks are
 *  possible.
 */
case class FullTextSearchHit(
  post: Post,
  score: Float,
  safeHighlightsHtml: List[String])

