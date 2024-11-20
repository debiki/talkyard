/**
 * Copyright (c) 2023 Kaj Magnus Lindberg
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
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

package talkyard.server.search

import com.debiki.core._
import scala.collection.immutable.Seq
import Prelude._
import debiki.dao.ReadOnlySiteDao
import scala.collection.{immutable => imm}
import scala.util.matching.Regex


/**
  * GitHub uses:
  *    label:"bug","wip"        — for OR
  *    label:"bug" label:"wip"  — for AND
  * Talkyard uses:
  *    tag:bug,wip       — for OR
  *    tag:bug  tag:wip  — for AND, but not yet impl.
  * Talkyard's tags can have values, e.g.:
  *        tag:priority:desc>=3
  *    finds topic tagged with "priority" and priority values >= 3, sorts descending.
  *
  * GitHub uses "state", "type", "is":
  *    state:open/closed
  *    type:issue/discussion
  *    is:closed reason:completed   is:closed reason:"not planned"   is:draft
  * Talkyard at least for now uses "is" for all those: (simpler? always "is")
  *    is:question/idea/...  is:planned/started/done   is:solved  is:open/closed
  *
  * GitHub uses "review", review-requested::
  *    review:none/required/approved/changes_requested
  *    review-requested:octocat
  * Talkyard will use  "assigned-to"? maybe sth like "review-requested" later too?
  * or is that too specific, maybe should be some custome tag type instead?
  *
  * GitHub & Google etc:  '-' before filters out, e.g.:  -author:octocat
  * Talkyard: Mostly not implemented, only for tags ("-tag:...").
  *
  * Tests:
  *   - talkyard.server.search.SearchQueryParserSpec
  *   - indirectly via lots of e2e tests
  */
object SearchQueryParser {

  SECURITY // COULD these regexes be DoS attacked?
  UX; BUG // These regexs don't handle tags and category names with spaces, e.g.
  // "tags:Tag-With Spaces"  would search for just "Tag-With" and complain
  // that there's no such tag.  [search_q_param_space]
  // Regex syntax:
  // *? means * but non-greedy — but doesn't work, selects "ccc,ddd" in this:
  // "tags:aaa,bbb tags:ccc,ddd", why, wheird [4GPK032]
  // `(?>abc|a)` is a non-capture group that, if it finds what looks like a match ('abc'),
  // then won't bother backtracking to retry with an alternative match (just 'a')
  // even if what comes after the group, fails to match anything.
  // See:  https://stackoverflow.com/questions/50524/what-is-a-regex-independent-non-capturing-group
  // `(?:abc|a)` is a capture group that backtracks and retries with just 'a', if
  // 'abc' matched but turned out not to work with what comes after the group.
  private val TagNamesRegex =        """^(?:.*? )?(tags?):([^ ]*) *(?>.*)$""".r
  private val NotTagNamesRegex =     """^(?:.*? )?(-tags?):([^ ]*) *(?>.*)$""".r
  private val CatSlugsRegex =        """^(?:.*? )?(categor(?>y|ies)):([^ ]*) *(?>.*)$""".r
  private val SortRegex =            """^(?:.*? )?(sort(?>-by)?):([^ ]*) *(?>.*)$""".r
  private val AuthorsRegex =         """^(?:.*? )?(by):([^ ]*) *(?>.*)$""".r
  private val IsRegex =              """^(?:.*? )?(is):([^ ]*) *(?>.*)$""".r

  // Would  tags:"Tag-With Spaces=Value with Spaces,more-tags,maybe-value=123" work,
  // to support spaces? This regex:  [search_q_param_space]
  //    """^(?:.*? )?tags?:("[^"]*"|'[^']*'|`[^`]*`|[^"'`][^ ]*|) *(?>.*)$""".r
  // What about tag names or values with ','?  URL encode? Or maybe sth like ',,' or '\,'
  // or ';' instead (all ',' before a ';' could be interpreted as part of the tag
  // name or value)?

  // Detects any unsupported "...  param:value ...".  If present, we'll search for
  // "param:value" as plain text (no special interpretation), and show a
  // maybe-broken-query warning.
  // Match "-param" too, would mean "Don't include anything that matches 'param:...'.
  private val UnknownParamRegex =
        """^(?:.*? )?(-*[\w][\w-]*):.*$""".r

  // For parsing the text after "tags:", that is, tag names, any values to compare with, etc.
  // Let's use the same value comparison as CSS selectors? These:
  //   =    match exactly
  //   ^=   match from the start (Ty will support, later. Nice for folders or URLs?)
  //   $=   match at the end (Ty won't support, SE queries would be too slow, right)
  //   *=   match anywhere (Ty won't support initially. SQ queries could be slow.)
  //   ~=   match whole words anywhere, surrounded by spaces (or at the start or end)
  //   |=   match whole word anywhere, and it's ok with a hyphen '-' afterwards (unlike ~=)
  // Then, quoting values, makes sense [search_q_param_space] — CSS attribute selectors
  // do too:   [attribute="value"]
  // (See [all_symbols] in docs/tips.md for a list of all symbols.)
  private val SymbFirsChar = """!#$%&()*+,:;<=>?@\[\\\]^`{|}~""" // but not '-', common in tag names
  private val SymbMoreChars = SymbFirsChar + "+-"
  private val SymbLastChar = SymbFirsChar // not '+-', could be part of value
  private val NameSortCompValRegex = (
        "^" +
       s"([^$SymbFirsChar]+)" +  // tag name
        "(:asc|:desc)?" +  // sort order, optional — to sort by tag value
        "(?:" +  // we want a comparison operator *and* a value, or none of it
            s"([$SymbFirsChar](?:[$SymbMoreChars]*[$SymbLastChar])?)" +  // comparison op
            "(.+)" +  // value to compare with.  Another regex, TagNamesRegex,
                      // restricts what chars are allowed here — no spaces, currently.
        ")?" +
        "$").r


  def parseRawSearchQueryString(rawQuery: St, dao: ReadOnlySiteDao): SearchQuery = {
    // Tests:
    //  - controllers.SearchControllerSpec

    // Sync with parseSearchQueryInputText(text) in .ts [5FK8W2R] — Ooops now
    // the .ts version understands a lot less than this.

    // Warnings to show client side, e.g. tags or category names that don't match anything.
    val warnings = MutArrBuf[ErrMsgCode]()

    // Look for and replace "-tags" first, before "tags" (which would otherwise also match "-tags").
    val (remainingQuery2, notTagNames) =
          _parsePart(rawQuery, NotTagNamesRegex, warnings)
    val notTagIds =
          _parseNamesToIds("tag", notTagNames, dao.getTagTypesByNamesOrSlugs, warnings)

    // If tagNamesVals (below) is like:  some-tag=123  other-tag>=100,  we'll split on
    // '=', '>=' etc, and remember the tag and if its value should be = or >= etc something.
    val (remainingQuery3, tagNamesVals) =
          _parsePart(remainingQuery2, TagNamesRegex, warnings)
    val (tagTypeIds, tagValComps, sortByTags) =
          _parseTagsOrBadges("tag", tagNamesVals, dao.getTagTypesByNamesOrSlugs, warnings)

    // [search_hmm]
    UX; BUG // Continue & _find_all "tags:..."?  The regexps above handle just one, right?
    // This:  "tag:some-tag  tag:other-tag"  finds posts with *both* tags,
    // whilst this:  "tags:some-tag,other-tag"  finds posts with *any* of those tags
    // (but prefers posts with more matching tags).

    // Later: What if many sub communities, with the same cat slug? [4GWRQA28]
    // Then, could prefix with the community / forum-page name, when selecting category?
    // And if unspecified — search all cats w matching slug?
    // Maybe a sub community should always be under its own /url-path/?  [sub_communities]
    // And the sub community path could be in the search request URL path:
    //    /-/search/sub-com-name?q=...
    // And to search many, could:  /-/search/sub-com,other-sub-com?q=...
    // (Or a ?subCom=... query param, but doesn't look as nice?)
    // And cat slugs need to be unique only in their own sub com?
    //
    val (remainingQuery4, catNames) =
          _parsePart(remainingQuery3, CatSlugsRegex, warnings)
    val catIds =
          _parseNamesToIds("category", catNames, dao.getCatsBySlugs, warnings)

    val (remainingQuery5, authorUsernames) =
          _parsePart(remainingQuery4, AuthorsRegex, warnings)
    val authorIds =
          _parseNamesToIds("username", authorUsernames, dao.getMembersByUsernames, warnings)

    // This also won't _find_all. Need a loop
    val (remainingQuery6, isWhatStrs) =
          _parsePart(remainingQuery5, IsRegex, warnings)
    val isWhat: IsWhat =
          _parseIsWhat(isWhatStrs, warnings)

    // Format:  sort:[by-what][:opt-tag-name]:asc/desc ?
    //   e.g.:  sort:tagval:published-year:asc   // 'published-year' is a tag
    //     or:  sort:created-at:desc          // no value needed
    val (remainingQuery7, sortOrderStrs) =
          _parsePart(remainingQuery6, SortRegex, warnings)
    val sortOrders: Vec[SortHitsBy] =
          sortOrderStrs.flatMap(s => parseSortPart(s, dao, warnings))

    // BUG Doesn't this find just one unrecognized parameter? Should _find_all.
    UnknownParamRegex.findGroupIn(remainingQuery7) match {
      case Some(unkParam: St) =>
        // The query string includes some  "... param:value ..." that we don't recognize.
        // Pass it as is to ElasticSearch, maybe the user copy-pasted sth and just didn't
        // bother to remove any  ':'  and wants us to search anyway?
        //
        // What's a good warning message? It's not being ignored, instead, we're
        // passing it unchanged to ElasticSearch — but that's too technical?  For now:
        warnings.append(ErrMsgCode(
              // I18N, send error codes and include the error messages in the
              // language bundles instead? [err_codes_0_msgs]
              s"""Unsupported prameter:   "${unkParam}:…",   treating as plain text.""",
              "TyESEUNSUPARM_"))
      case None => // fine
    }

    SearchQuery(
          fullTextQuery = rawQuery.trim, // ignore weird unicode blanks for now
          queryWithoutParams = remainingQuery7.trim,
          isWhat = isWhat,
          tagTypeNames = tagNamesVals.toSet,
          tagTypeIds = tagTypeIds.toSet,
          tagValComps = tagValComps,
          notTagTypeNames = notTagNames.toSet,
          notTagTypeIds = notTagIds.toSet,
          catNames = catNames.toSet,
          catIds = catIds.toSet,
          authorUsernames = authorUsernames.toSet,
          authorIds = authorIds.toSet,
          sortOrder =
              // Let 'sort:...' have precedence over 'tags:tag-name:asc/desc' — 'sort:'
              // is more explicit, intentional?
              sortOrders ++ sortByTags,
          warnings = warnings.to(Vec))
  }


  /** Returns:  (Remaining-query, Name-Comparison-operator-Value strings)
    */
  private def _parsePart(query: St, regex: Regex, warnings: MutArrBuf[ErrMsgCode],
          ): (St, Vec[St]) = {

    // These regexs have two groups separated by ':', like:  "what:something,more,evenmore"
    regex.findTwoGroupsIn(query) match {
      case None =>
        (query, Vec.empty)
      case Some((partName: St, commaSepNames: St)) =>
        // `commaSepNames` is like:  "tag-name,other-tag=111,third-tag>100"
        //            or e.g. like:  "category-name,other-category",
        // that is, names, with optional comparison operators and values.
        // Currently, only tags can have comparison operators and values (categories
        // and usernames cannot).
        val remainingQuery = query.replaceAllLiterally(s"$partName:$commaSepNames", "")

        // Each `nameCompValStrs` item will be like:
        //         "tag-name",  or with a value:  "some-tag=123"  or  "some-tag<100".
        // Or like "user_name"  or  "category-slug"  without any `<=>123` comparison.
        val nameCompValStrs: Vec[St] =
              commaSepNames.split(',').to(Vec).map(_.trim).filter(_.nonEmpty)
        if (nameCompValStrs.isEmpty) {
          warnings.append(ErrMsgCode(
                s"""Incomplete sort parameter: There's   "${
                  partName}:"   but nothing after. Ignoring.""", "TyESEPARMEMPTY_"))
        }
        (remainingQuery, nameCompValStrs)
    }
  }


  private def _parseIsWhat(isWhatList: Vec[St], warnings: MutArrBuf[ErrMsgCode]): IsWhat = {
    // Might as well use  "is:something"  for all these?  Seems there won't be any
    // collision (ambiguous word).
    var isWhat = IsWhat.empty
    for (word <- isWhatList) word match {
      case "idea" => isWhat = isWhat.copy(pageType = Some(PageType.Idea))
      case "problem" => isWhat = isWhat.copy(pageType = Some(PageType.Problem))
      case "question" => isWhat = isWhat.copy(pageType = Some(PageType.Question))
      case "discussion" => isWhat = isWhat.copy(pageType = Some(PageType.Discussion))
      case "comments" => isWhat = isWhat.copy(pageType = Some(PageType.EmbeddedComments))

      // Is "undecided" really the right word? Oh well, for now.
      case "undecided" => isWhat = isWhat.copy(pageDoingStatus = Some(PageDoingStatus.Discussing))
      case "planned" => isWhat = isWhat.copy(pageDoingStatus = Some(PageDoingStatus.Planned))
      case "started" => isWhat = isWhat.copy(pageDoingStatus = Some(PageDoingStatus.Started))
      case "done" => isWhat = isWhat.copy(pageDoingStatus = Some(PageDoingStatus.Done))

      // For "not answered", can use:  "is:question is:open"
      case "answered" | "solved" => isWhat = isWhat.copy(pageSolved = Some(true))

      case "open" => isWhat = isWhat.copy(pageOpen = Some(true))
      case "closed" => isWhat = isWhat.copy(pageOpen = Some(false))

      case x =>
        warnings.append(ErrMsgCode(
              s"""Unsupported 'is:' value:   "$x",   ignoring""", "TyESEINVISVAL"))
    }
    isWhat
  }


  /** Looks up each thing name to find its id,  e.g. a category id.
    * Adds a warning if not found.
    */
  private def _parseNamesToIds(partName: St, names: Vec[St],
           namesToIdsFn: Iterable[St] => imm.Seq[Opt[HasInt32Id]],
           warnings: MutArrBuf[ErrMsgCode],
          ): Seq[i32] = {
    val anyIds = namesToIdsFn(names).map(_.map(_.id))
    val result = anyIds.flatten
    if (result.length != names.length) {
      // Some ids not found.
      names.zip(anyIds) foreach { case (name, anyId) =>
        if (anyId.isEmpty) {
          warnings.append(ErrMsgCode(
                s"Unknown $partName:   '$name'.   Ignoring.", "TyESEUNKPART_"))

        }
      }
    }
    result
  }


  /** Returns:  (Tags without value comparisons,
    *              Tags to compare with values  e.g. =abcd  or >=100,
    *                Any sort-by-tag-value).
    */
  private def _parseTagsOrBadges(partName: St, nameCompValStrs: Vec[St],
          tagNamesToTypesFn: Iterable[St] => imm.Seq[Opt[TagType]],
          warnings: MutArrBuf[ErrMsgCode],
          ): (Vec[TagTypeId], Vec[(TagType, CompOpVal)], Vec[SortHitsBy.TagVal]) = {

  // Each vec item is:  (Tag name,  Sort order: asc = true,  Comparison symbol & value).
  val nameSortOpStrs: Vec[(St, Opt[Bo], Opt[(CompOp, St)])] =
            nameCompValStrs map { nameCompVal => nameCompVal match {
      case NameSortCompValRegex(
              name, // a tag name
              ascDesc, // ":asc" or ":desc",
              compSymbolOrNull, // a comparison symbol e.g. '=' or '<=' or null
              valueOrNull, // a value, e.g. "abcd" or "1234", or null
              ) => {
        // The regex finds both or none.
        dieIf((compSymbolOrNull eq null) != (valueOrNull eq null), "TyESEREGEX0538")
        val compVal:  Opt[(CompOp, St)] =
              if (valueOrNull eq null) None
              else CompOp.fromStr(compSymbolOrNull) match {
                case None =>
                  warnings.append(ErrMsgCode(  // I18N,  [err_codes_0_msgs]
                        s"""Invalid tag value comparison:  "${nameCompVal
                        }",   unknown symbol:   "${compSymbolOrNull
                        }".   I'll just search for the tag:   "${name}".""",
                        "TyESECMPSYMB_"))
                  None
                case Some(op) =>
                  val opAndVal = (op, valueOrNull)
                  Some(opAndVal)
              }
        // (If not ':asc', we know it's ':desc', because of the regex.)
        val optAsc = if (ascDesc eq null) None else Some(ascDesc == ":asc")

        (name, optAsc, compVal)
      }
      case nameAndSymbols: St =>
        // The NameSortCompValRegex regex won't match texts like:  "tag:tag-name<>!="
        // that is, ends with symbols, but nothing after the symbols.  Show a warning
        // and search for any such tags anyway.
        warnings.append(ErrMsgCode(  // I18N,  [err_codes_0_msgs]
              s"""Weird tag name:   "${nameAndSymbols
              }",   symbols like:  "${SymbFirsChar
              }"  should not be in tag search queries.   ${""
              } Can you use the tag's URL slug instead?  (if any)   ${""
              } Anyway, I'll try searching for a tag with such a name ...""",
              "TyESETAGINCLSYMB_"))
        (nameAndSymbols, None, None)
    }}

    // Look up tag type for each tag name.
    val names: Vec[St] = nameSortOpStrs.map(_._1)
    val anyTypes: imm.Seq[Opt[TagType]] = tagNamesToTypesFn(names)

    // Fill in tag types (instead of names) in any comparisons to be done, and
    // comparison values of the correct value types (Int32, Flt64 etc).

    val idsNoVals = MutArrBuf[i32]()  // no comparisons for these tags (tag types)
    val sortBy = MutArrBuf[SortHitsBy.TagVal]()  // if any "tag-name:asc/desc"
    val typesWithCompVals: Vec[(TagType, CompOpVal)] =
            nameSortOpStrs.zip(anyTypes)
                  .flatMap { case (nameSortOpStr, anyType) =>

      val name: St = nameSortOpStr._1
      val anySortAsc: Opt[Bo] = nameSortOpStr._2
      val anyCompOpStr: Opt[(CompOp, St)] = nameSortOpStr._3

      anyType match {
        case None =>
          warnings.append(ErrMsgCode(
              // Later: I18N,  [err_codes_0_msgs]
              s"""Unknown $partName:   "$name",   ignoring.""", "TyMSEUNKNAME_"))
          None

        case Some(tagType: TagType) =>
          anySortAsc foreach { sortAsc =>
            // Let's [skip_sort_if_tag_type_cant_have_values].
            // Ignore TagType.wantsValue though. [no_wantsValue]
            if (tagType.valueType.isEmpty) {
              warnings.append(ErrMsgCode(
                    s"""Can't sort by value of $partName   "${name
                    }":   That $partName can't have values.""", "TyESESORT0VAL01_"))
              // Continue below, so the tag gets added to idsNoVals.
            }
            else {
              sortBy.append(
                    SortHitsBy.TagVal(tagType, asc = sortAsc))
            }
          }

          anyCompOpStr match {
            case None =>
              // There's no comp-op & value for this tag. E.g. just:  "tag-name"
              // but not:  "tag-name=123".
              idsNoVals.append(tagType.id)
              None
            case Some(compOpStr: (CompOp, St)) =>
              // We got e.g.  "tag-name=abcd"  or "tag-name>=100".  We'll interpet the
              // compStr (the value) differently, depending on the tag value type.
              val compOp: CompOp = compOpStr._1
              val compStr: St = compOpStr._2
              def warning(notWhat: St): St =
                    // I18N,  [err_codes_0_msgs] — and "notWhat" too.
                    s"""Can't compare value of tag   "${name
                    }"   with something that is not $notWhat:   "${compStr
                    }".   Ignoring, I'll just search for the tag instead."""

              // Let's [skip_tag_comps_if_tag_type_cant_have_values] — or what else?
              if (tagType.valueType.isEmpty) {
                warnings.append(ErrMsgCode(
                      s"""Tag   "$name"   can't have values. """ +
                      "I'll just search for that tag instead.",  "TyESECMPCANT_"))
                idsNoVals.append(tagType.id)
                None
              }
              else tagType.valueType flatMap {
                case TypeValueType.Int32 =>
                  compStr.toIntOption map { i =>
                    tagType -> CompOpVal(compOp, CompVal.Int32(i))
                  } orElse {
                    warnings.append(ErrMsgCode(warning("an integer number"), "TyESECMP0I32_"))
                    idsNoVals.append(tagType.id)
                    None
                  }
                case TypeValueType.Flt64 =>
                  compStr.toFloat64Option map { f =>
                    tagType -> CompOpVal(compOp, CompVal.Flt64(f))
                  } orElse {
                    warnings.append(ErrMsgCode(warning("a number"), "TyESECMP0F64_"))
                    idsNoVals.append(tagType.id)
                    None
                  }
                case TypeValueType.StrKwd =>
                  Some(tagType -> CompOpVal(compOp, CompVal.StrKwd(compStr)))
                case _ =>
                  die("TyESETAGTYP0275", s"Bug: Forgot to handle tag value type: ${
                        tagType.valueType}")
              }
          }
      }
    }

    (idsNoVals.to(Vec), typesWithCompVals, sortBy.to(Vec))
  }



  def parseSortPart(part: St, dao: ReadOnlySiteDao, warnings: MutArrBuf[ErrMsgCode])
          : Opt[SortHitsBy] = {
    // The sort order would be like:  "sort-how[:sort-what][:asc/desc]", so split on ';'.
    // E.g.:  sort-by:tag-value:tag-name:desc
    //                   ^– how     ^— what
    //   Or:  sort:publish-date
    //   Or:  sort:publish-date:desc
    // For now, we support tag values only.
    val parts = part.split(':')
    val sortHow = parts.headOption getOrElse {
      // Happens if the search query is "sort::" or "sort:::...:::" (why ever?).
      warnings.append(ErrMsgCode(s"Invalid sort parameter:  '$part'", "TyESEINVSORT01_"))
      return None
    }

    val result: SortHitsBy = sortHow match {
      // It's nice to support a read friendly param name ("tag-value") and a shorter
      // finger friendly? Like short and long command line param names?
      case "tagval" | "tag-value" =>
        // "tag-value:tag-name:asc/desc"  is at most 3 parts, when split on ':'.
        if (parts.length > 3) {
          warnings.append(ErrMsgCode(s"Too many ':' in sort-by:  '$part'", "TyESEINVSORT02_"))
          return None
        }
        var asc = true
        if (parts.length == 3) {
          val ascOrDesc = parts(2)
          if (ascOrDesc == "desc") asc = false
          else if (ascOrDesc != "asc") {
            warnings.append(ErrMsgCode(
                  s"Bad order, should be 'asc' or 'desc':  '$part'", "TyESEINVSORTORD_"))
            return None
          }
        }
        if (parts.length == 1) {
          warnings.append(ErrMsgCode(
                s"Tag name missing:  '$part'", "TyESEINVSORT0TAGPART_"))
          return None
        }
        val tagTypeName = parts(1)
        val tagType: TagType = dao.getTagTypesByNamesOrSlugs(Vec(tagTypeName)).head getOrElse {
          warnings.append(ErrMsgCode(
                s"Cannot sort by tag  '$tagTypeName':   No such tag", "TyESEINVSORT0TAG_"))
          return None
        }
        // Let's [skip_sort_if_tag_type_cant_have_values].
        // But don't require TagType.wantsValue [no_wantsValue] — maybe nice to search for
        // old values of tags that no longer need values.
        if (tagType.valueType.isEmpty) {
          warnings.append(ErrMsgCode(
                s"""Can't sort by value of tag   "${tagTypeName
                    }":  That tag can't have values.""", "TyESESORT0VAL02_"))
          return None
        }

        SortHitsBy.TagVal(tagType, asc = asc)

      case _ =>
        warnings.append(ErrMsgCode(
              s"Bad sort method:   '$sortHow',  ignoring", "TyESEINVSORTMTD_"))
        return None
    }

    Some(result)
  }
}
