/**
 * Copyright (c) 2013 Kaj Magnus Lindberg (born 1979)
 */

package com.debiki.v0

import java.{util => ju}


case class FullTextSearchResult(
  hits: Seq[FullTextSearchHit],
  pageMetaByPageId: Map[PageId, PageMeta])


case class FullTextSearchHit(post: Post, score: Float)

