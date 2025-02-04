/**
 * Copyright (C) 2016, 2023 Kaj Magnus Lindberg
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
import CompOp.{Eq, Gt, Gte, Lt, Lte}
import CompVal.{Flt64, Int32, StrKwd}
import com.debiki.core.Prelude.IfBadDie
import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.must
import org.mockito.Mockito._
import org.mockito.Mockito
import scala.collection.{immutable => imm}


class SearchQueryParserSpec extends AnyFreeSpec with must.Matchers {

  val TagTypeOneId = 101 // wants value: Int32
  val TagTypeTwoId = 102 //
  val TagTypeThreeId = 103
  val UnderTagTypeId = 104
  val ValueLessTagId = 107

  val Float64TagTypeId = 121    // wants value: Flt64
  val Float64TwoTagTypeId = 122 //

  val StrKwdTagTypeId = 131    // wants value: StrKwd
  val StrKwdTwoTagTypeId = 132 //

  val TagTypeOne = TagType(
        id = TagTypeOneId,
        refId = None,
        canTagWhat = TagType.CanTagAllPosts,
        urlSlug = Some("tag-one"),
        dispName = "tagOne",
        createdById = NoUserId,
        wantsValue = Some(NeverAlways.AlwaysButCanContinue),
        valueType = Some(TypeValueType.Int32))(IfBadDie)

  val TagTypeTwo = TagType(
        id = TagTypeTwoId,
        refId = None,
        canTagWhat = TagType.CanTagAllPosts,
        urlSlug = Some("tag-two"),
        dispName = "tagTwo",
        createdById = NoUserId,
        wantsValue = Some(NeverAlways.AlwaysButCanContinue),
        valueType = Some(TypeValueType.Int32))(IfBadDie)

  val TagTypeThree = TagType(
        id = TagTypeThreeId,
        refId = None,
        canTagWhat = TagType.CanTagAllPosts,
        urlSlug = None,
        dispName = "tagThree",
        createdById = NoUserId,
        wantsValue = Some(NeverAlways.AlwaysButCanContinue),
        valueType = Some(TypeValueType.Flt64))(IfBadDie)

  val UnderTagType = TagType(
        id = UnderTagTypeId,
        refId = None,
        canTagWhat = TagType.CanTagAllPosts,
        urlSlug = None,
        dispName = "under_tag",
        createdById = NoUserId,
        wantsValue = Some(NeverAlways.AlwaysButCanContinue),
        valueType = Some(TypeValueType.Int32))(IfBadDie)

  val dao = new TestDao()

  class TestDao extends debiki.dao.TestReadOnlySiteDao {

    override def getTagTypesByNamesOrSlugs(tagNames: Iterable[St]): imm.Seq[Opt[TagType]] = {
      tagNames.to(Vec) map { tagName =>
        (tagName match {
          case "tagOne" => Some(TagTypeOne)  // 101, by display name
          case "tag-one" => Some(TagTypeOne) // 101, by url slug
          case "tagTwo" => Some(TagTypeTwo)  // 102, by display name
          case "tag-two" => Some(TagTypeTwo) // 102, by slug
          case "tagThree" => Some(TagTypeThree)  // 103, by display name (there's no slug)
          case "under_tag" => Some(UnderTagType) // 104,  –''–
          case _ =>
            // Using mocks instead, for legacy reasons.
            val anyTagTypeId = tagName match {
              case "dash-tag" => Some(105)
              case "dot.tag" => Some(106)
              case "valueLessTag" => Some(ValueLessTagId)
              case "f64Tag" => Some(Float64TagTypeId)
              case "f64TagTwo" => Some(Float64TwoTagTypeId)
              case "strKwdTag" => Some(StrKwdTagTypeId)
              case "strKwdTagTwo" => Some(StrKwdTwoTagTypeId)
              case "tag-w-value" => Some(201)
              case "tag-w-otr-val" => Some(202)
              case _ => None
            }
            val anyValueType: Opt[TypeValueType] = anyTagTypeId flatMap {
              case TagTypeOneId | TagTypeTwoId => Some(TypeValueType.Int32)
              case Float64TagTypeId | Float64TwoTagTypeId => Some(TypeValueType.Flt64)
              case StrKwdTagTypeId | StrKwdTwoTagTypeId => Some(TypeValueType.StrKwd)
              case _ => None
            }
            anyTagTypeId map { tagTypeId =>
              val tagMock = Mockito.mock(classOf[TagType])
              when(tagMock.id).thenReturn(tagTypeId)
              when(tagMock.wantsValue).thenReturn(Some(NeverAlways.Allowed))
              when(tagMock.valueType).thenReturn(anyValueType)
              tagMock
            }
        }).asInstanceOf[Opt[TagType]]
      }
    }

    override def getCatsBySlugs(catNames: Iterable[St]): imm.Seq[Opt[Cat]] =
      catNames.to(Vec) map { catName =>
        categorySlugToId(catName) map { catId =>
          val catMock = Mockito.mock(classOf[Category])
          when(catMock.id).thenReturn(catId)
          catMock
        }
      }

    override def getMembersByUsernames(usernames: Iterable[Username]): imm.Seq[Opt[Member]] = {
      usernames.to(Vec) map { un =>
        val anyPatId = un match {
          case "userOne" => Some(10001)
          case "userTwo" => Some(10002)
          case _ => None
        }
        anyPatId map { patId =>
          val patMock = Mockito.mock(classOf[Member])
          when(patMock.id).thenReturn(patId)
          patMock
        }
      }
    }
  }

  def categorySlugToId(slug: String): Option[CategoryId] = slug match {
    case "catOne" => Some(1)
    case "catTwo" => Some(2)
    case "catThree" => Some(3)
    case "aa" => Some(11)
    case "bb" => Some(22)
    case "cc" => Some(33)
    case "dd" => Some(44)
    case "ee" => Some(55)
    case "ff" => Some(66)
    case "xx" => Some(77)
    case "yy" => Some(88)
    case "zz" => Some(99)
    case "cat-with" => Some(304)
    case "ma-ny-hyphens" => Some(20207)
    case _ => None
  }


  "SearchController can" - {

    // Avoids typos.
    val categories = "categories"
    val category = "category"
    val tags = "tags"
    val tag = "tag"

    import SearchQueryParser.parseRawSearchQueryString

    "parse raw query strings" - {
      "parse plain text" in {
        var query = parseRawSearchQueryString("", dao)
        query.isEmpty mustBe true

        query = parseRawSearchQueryString("hello", dao)
        query.isEmpty mustBe false
        query.fullTextQuery mustBe "hello"
        query.queryWithoutParams mustBe "hello"

        query = parseRawSearchQueryString("hello world", dao)
        query.isEmpty mustBe false
        query.fullTextQuery mustBe "hello world"
        query.queryWithoutParams mustBe "hello world"
      }

      "trim" in {
        var query = parseRawSearchQueryString("  me love spaces \n\r\t ", dao)
        query.isEmpty mustBe false
        query.fullTextQuery mustBe "me love spaces"
        query.queryWithoutParams mustBe "me love spaces"

        query = parseRawSearchQueryString("  ", dao)
        query.isEmpty mustBe true
        query.fullTextQuery mustBe ""
        query.queryWithoutParams mustBe ""

        query = parseRawSearchQueryString("\n\r\t", dao)
        query.isEmpty mustBe true
      }

      "warn if there's any unsupported  'parameter:...' in the query string" in {
        var query = parseRawSearchQueryString("what-is-this:", dao)
        query.isEmpty mustBe false
        query.fullTextQuery mustBe "what-is-this:"
        query.queryWithoutParams mustEqual "what-is-this:"
        query.warnings.head.code mustEqual "TyESEUNSUPARM_"
        query.warnings.head.message must include("what-is-this:")
        query.warnings.length mustEqual 1

        // Warns only about the first, currently.
        query = parseRawSearchQueryString("funny: funnier:", dao)
        query.warnings.head.code mustEqual "TyESEUNSUPARM_"
        query.warnings.length mustEqual 1
        query.warnings.head.message must include("funn")  // either "funny:" or "funnier:"
      }

      "parse is:..." - {
        "parse is:something" in {
          var query = parseRawSearchQueryString(s"is:idea", dao)
          query.isWhat.pageType mustBe Some(PageType.Idea)
          query = parseRawSearchQueryString(s"is:question", dao)
          query.isWhat.pageType mustBe Some(PageType.Question)
          query = parseRawSearchQueryString(s"is:problem", dao)
          query.isWhat.pageType mustBe Some(PageType.Problem)
          query = parseRawSearchQueryString(s"is:discussion", dao)
          query.isWhat.pageType mustBe Some(PageType.Discussion)
          query = parseRawSearchQueryString(s"is:comments", dao)
          query.isWhat.pageType mustBe Some(PageType.EmbeddedComments)
          //query = parseRawSearchQueryString(s"is:bookmark", dao)  [is_bokm]
          //query.isWhat.pageType mustBe Some(PageType.Bookmark)

          query = parseRawSearchQueryString(s"is:open", dao)
          query.isWhat.pageOpen mustBe Some(true)

          query = parseRawSearchQueryString(s"is:closed", dao)
          query.isWhat.pageOpen mustBe Some(false)

          query = parseRawSearchQueryString(s"is:answered", dao)
          query.isWhat.pageSolved mustBe Some(true)

          query = parseRawSearchQueryString(s"is:solved", dao)
          query.isWhat.pageSolved mustBe Some(true)

          query = parseRawSearchQueryString(s"is:undecided", dao)
          query.isWhat.pageDoingStatus mustBe Some(PageDoingStatus.Discussing)
          query = parseRawSearchQueryString(s"is:planned", dao)
          query.isWhat.pageDoingStatus mustBe Some(PageDoingStatus.Planned)
          query = parseRawSearchQueryString(s"is:started", dao)
          query.isWhat.pageDoingStatus mustBe Some(PageDoingStatus.Started)
          query = parseRawSearchQueryString(s"is:done", dao)
          query.isWhat.pageDoingStatus mustBe Some(PageDoingStatus.Done)
        }

        "parse is:many,things" in {
          var query = parseRawSearchQueryString("is:question,answered", dao)
          query.isWhat.pageType mustBe Some(PageType.Question)
          query.isWhat.pageSolved mustBe Some(true)

          query = parseRawSearchQueryString("is:idea,started", dao)
          query.isWhat.pageType mustBe Some(PageType.Idea)
          query.isWhat.pageDoingStatus mustBe Some(PageDoingStatus.Started)
        }

        "parse  is:...  plus text" in {
          val query = parseRawSearchQueryString("aa is:discussion,open zz", dao)
          query.queryWithoutParams mustBe "aa  zz"
          query.isWhat.pageType mustBe Some(PageType.Discussion)
          query.isWhat.pageOpen mustBe Some(true)
        }
      }

      "parse tags" in {
        var query = parseRawSearchQueryString(s"$tags:", dao)
        query.isEmpty mustBe true

        query = parseRawSearchQueryString(s"$tags:tagOne", dao)
        query.isEmpty mustBe false
        query.tagTypeNames mustBe Set("tagOne")

        query = parseRawSearchQueryString(s"$tags:tagOne,tagTwo", dao)
        query.tagTypeNames mustBe Set("tagOne", "tagTwo")
        query.tagTypeIds mustBe Set(101, 102)
      }

      "lookup tags by slug too" in {
        var query = parseRawSearchQueryString(s"$tags:tag-two", dao)
        query.isEmpty mustBe false
        query.tagTypeNames mustBe Set("tag-two")
        query.tagTypeIds mustBe Set(102)
        query.warnings mustBe empty

        // 'tagOne' and 'tagTwo' is by name — can be combined with 'tag-two', by slug.
        query = parseRawSearchQueryString(s"$tags:tagOne,tag-two,tagTwo", dao)
        query.tagTypeNames mustBe Set("tagOne", "tag-two", "tagTwo")
        query.tagTypeIds mustBe Set(101, 102)
        query.warnings mustBe empty
      }

      "'tag' instead of 'tags' works too" in {
        val query = parseRawSearchQueryString(s"$tag:tagOne", dao)
        query.tagTypeIds mustEqual Set(101)
        query.isEmpty mustBe false
      }

      "combine identical tags" in {
        var query = parseRawSearchQueryString(s"$tags:aa,aa", dao)
        query.tagTypeNames mustBe Set("aa")
      }

      "ignore a 2nd extra tags:..." in {
        val query = parseRawSearchQueryString(s"$tags:aaa,bbb $tags:ccc,ddd", dao)
        // This doesn't totally work, a regex ignores "aaa,bbb" [4GPK032]. Weird.
        // For now, just check that the size is 2, instead.
        // query.tagTypeNames mustBe Set("aaa", "bbb") // skip for now
        query.tagTypeNames.size mustBe 2
      }

      "parse tags with colon and slash" in {
        var query = parseRawSearchQueryString(s"$tags:tagWith:colon", dao)
        query.tagTypeNames mustBe Set("tagWith:colon")

        query = parseRawSearchQueryString(s"$tags:with/slash", dao)
        query.tagTypeNames mustBe Set("with/slash")

        query = parseRawSearchQueryString(s"$tags:tagWith:colon,with/slash", dao)
        query.tagTypeNames mustBe Set("tagWith:colon", "with/slash")

        query = parseRawSearchQueryString(s"$tags:tagWith:colonAnd/slash", dao)
        query.tagTypeNames mustBe Set("tagWith:colonAnd/slash")
      }

      "parse categories" in {
        /* Empty or not? Hmm
        var query = parseRawSearchQueryString(s"$categories:", dao)
        query.isEmpty mustBe true

        query = parseRawSearchQueryString(s"$category:", dao)
        query.isEmpty mustBe true
         */

        var query = parseRawSearchQueryString(s"$categories:catOne", dao)
        query.catIds mustEqual Set(1)
        query.isEmpty mustBe false

        query = parseRawSearchQueryString(s"$categories:catOne,catTwo,catThree", dao)
        query.catIds mustEqual Set(1, 2, 3)

        query = parseRawSearchQueryString(s"$categories:cat-with,ma-ny-hyphens", dao)
        query.catIds mustEqual Set(304, 20207)
      }

      "'category' instead of 'categories' works too" in {
        val query = parseRawSearchQueryString(s"$category:catOne", dao)
        query.catIds mustEqual Set(1)
        query.isEmpty mustBe false
      }

      "warn if unknown category" in {
        var query = parseRawSearchQueryString(s"$categories:does-not-exist", dao)
        query.isEmpty mustBe true
        query.warnings.head.code mustEqual "TyESEUNKPART_"

        query = parseRawSearchQueryString("tex category:unk-cat", dao)
        query.catIds mustBe empty
        query.warnings.head.message must include("unk-cat")
        query.warnings.head.code mustEqual "TyESEUNKPART_"

        // 2 bad and 1 ok cats:
        query = parseRawSearchQueryString("tex category:bad-cat,catOne,unk-cat", dao)
        query.catIds mustEqual Set(1)
        query.warnings.head.message must include("bad-cat")
        query.warnings.head.code mustEqual "TyESEUNKPART_"
        query.warnings.last.message must include("unk-cat")
        query.warnings.last.code mustEqual "TyESEUNKPART_"
        query.warnings.length mustEqual 2
      }

      "combine identical categories" in {
        var query = parseRawSearchQueryString(s"$categories:cc,cc", dao)
        query.catIds mustBe Set(33)
      }

      "ignore 2nd extra categories:..." in {
        val query = parseRawSearchQueryString(
          s"$categories:aa,bb $categories:cc,dd", dao)
        // A regex incorrectly chooses "ccc,ddd" instead [4GPK032], so just check the size.
        // query.catIds mustBe Set("aaa", "bbb")
        query.catIds.size mustBe 2
      }

      "parse tags and text" in {
        var query = parseRawSearchQueryString("abc tags:tagA,tagB", dao)
        query.queryWithoutParams mustBe "abc"
        query.tagTypeNames mustBe Set("tagA", "tagB")
        query.catIds mustBe empty

        query = parseRawSearchQueryString("tags:tagA,tagB xyz", dao)
        query.queryWithoutParams mustBe "xyz"
        query.tagTypeNames mustBe Set("tagA", "tagB")
        query.catIds mustBe empty

        query = parseRawSearchQueryString("aa tags:tag zz", dao)
        query.queryWithoutParams mustBe "aa  zz"
        query.tagTypeNames mustBe Set("tag")
        query.catIds mustBe empty
      }

      "parse cats and text" in {
        var query = parseRawSearchQueryString("abc categories:aa,bb", dao)
        query.queryWithoutParams mustBe "abc"
        query.tagTypeNames mustBe empty
        query.catIds mustBe Set(11, 22)

        query = parseRawSearchQueryString("categories:aa,bb xyz", dao)
        query.queryWithoutParams mustBe "xyz"
        query.tagTypeNames mustBe empty
        query.catIds mustBe Set(11, 22)

        query = parseRawSearchQueryString("aa categories:cc zz", dao)
        query.queryWithoutParams mustBe "aa  zz"
        query.tagTypeNames mustBe empty
        query.catIds mustBe Set(33)
      }

      "parse both tags and cats at once" in {
        var query = parseRawSearchQueryString(
          " abc tags:t,t2 def categories:aa,bb xyz ", dao)
        query.isEmpty mustBe false
        query.queryWithoutParams mustBe "abc  def  xyz"
        query.tagTypeNames mustBe Set("t", "t2")
        query.catIds mustBe Set(11, 22)

        query = parseRawSearchQueryString("abc def ghi tags:ttt categories:cc", dao)
        query.isEmpty mustBe false
        query.queryWithoutParams mustBe "abc def ghi"
        query.tagTypeNames mustBe Set("ttt")
        query.catIds mustBe Set(33)

        query = parseRawSearchQueryString("abc def ghi categories:cc tags:ttt", dao)
        query.isEmpty mustBe false
        query.queryWithoutParams mustBe "abc def ghi"
        query.tagTypeNames mustBe Set("ttt")
        query.catIds mustBe Set(33)
      }

      "parse tag value comparisons with integers,  Int32" - {
        "simple int comparisons:  tags:some-tag=123" in {
          var query = parseRawSearchQueryString("tags:tagOne=123", dao)
          query.queryWithoutParams mustBe ""
          query.catIds mustBe empty
          query.tagTypeNames mustBe Set("tagOne=123")
          query.typeIdComps mustBe Vec(101 -> CompOpVal(Eq, Int32(123)))

          query = parseRawSearchQueryString("tags:tagOne=111,tagTwo<222", dao)
          query.queryWithoutParams mustBe ""
          query.catIds mustBe empty
          query.tagTypeNames mustBe Set("tagOne=111", "tagTwo<222")
          query.typeIdComps mustBe Vec(101 -> CompOpVal(Eq, Int32(111)),
                                        102 -> CompOpVal(Lt, Int32(222)))
        }

        "warn if the integer tag's value is not a number" in {
          val query = parseRawSearchQueryString("tags:tagOne=abcd", dao)
          query.tagTypeNames mustBe Set("tagOne=abcd")
          query.tagTypeIds mustBe Set(TagTypeOneId)
          query.typeIdComps mustBe empty
          query.warnings.head.message must include("tagOne")
          query.warnings.head.code mustEqual "TyESECMP0I32_"
        }

        "warn if the integer tag's value is not an integer number" in {
          val query = parseRawSearchQueryString("tags:tagOne=12.345", dao)
          query.tagTypeNames mustBe Set("tagOne=12.345")
          query.tagTypeIds mustBe Set(TagTypeOneId)
          query.typeIdComps mustBe empty
          query.warnings.head.message must include("tagOne")
          query.warnings.head.code mustEqual "TyESECMP0I32_"
        }

        "warn if comparing a tag that can't have values" in {
          val query = parseRawSearchQueryString("tags:valueLessTag=123", dao)
          query.queryWithoutParams mustBe ""
          query.warnings.head.code mustEqual "TyESECMPCANT_"
          query.warnings.head.message must include("valueLessTag")
          query.warnings.length mustEqual 1
          query.sortOrder mustBe empty
          query.tagTypeIds mustBe Set(ValueLessTagId) // just searching for tag, instead
          query.tagValComps mustBe empty
        }
      }

      "parse tag value comparison symbols with many chars: '<=', '>=',  Int32" in {
        var query = parseRawSearchQueryString("tags:tagOne>=111", dao)
        query.queryWithoutParams mustBe ""
        query.catIds mustBe empty
        query.tagTypeNames mustBe Set("tagOne>=111")
        query.typeIdComps mustBe Vec(101 -> CompOpVal(Gte, Int32(111)))

        query = parseRawSearchQueryString("tags:tagTwo<=222", dao)
        query.queryWithoutParams mustBe ""
        query.catIds mustBe empty
        query.tagTypeNames mustBe Set("tagTwo<=222")
        query.typeIdComps mustBe Vec(102 -> CompOpVal(Lte, Int32(222)))
      }

      "parse tag float-64 comparisons" - {
        "simple float-64:  tags:some-tag=12.345  Flt64" in {
          var query = parseRawSearchQueryString("tags:f64Tag=12.345", dao)
          query.queryWithoutParams mustBe ""
          query.catIds mustBe empty
          query.tagTypeNames mustBe Set("f64Tag=12.345")
          query.typeIdComps mustBe Vec(Float64TagTypeId -> CompOpVal(Eq, Flt64(12.345)))

          query = parseRawSearchQueryString("tags:f64Tag>=10.10,f64TagTwo<20.20", dao)
          query.queryWithoutParams mustBe ""
          query.catIds mustBe empty
          query.tagTypeNames mustBe Set("f64Tag>=10.10", "f64TagTwo<20.20")
          query.typeIdComps mustBe Vec(Float64TagTypeId -> CompOpVal(Gte, Flt64(10.10)),
                                        Float64TwoTagTypeId -> CompOpVal(Lt, Flt64(20.20)))
        }

        "compare tags with big & tiny Float64 numbers" - {
          "Javascript Number.MIN_VALUE" in {
            val query = parseRawSearchQueryString("tags:f64Tag=5e-324", dao)
            query.tagTypeNames mustBe Set("f64Tag=5e-324")
            query.typeIdComps mustBe Vec(
                      Float64TagTypeId -> CompOpVal(Eq, Flt64(5e-324)))
          }
          "Javascript Number.MAX_VALUE" in {
            val query = parseRawSearchQueryString("tags:f64Tag=1.7976931348623157e+308", dao)
            query.tagTypeNames mustBe Set("f64Tag=1.7976931348623157e+308")
            query.typeIdComps mustBe Vec(
                      Float64TagTypeId -> CompOpVal(Eq, Flt64(1.7976931348623157e+308)))
          }
          "Javascript Number.MIN_SAFE_INTEGER" in {
            val query = parseRawSearchQueryString("tags:f64Tag=-9007199254740991", dao)
            query.tagTypeNames mustBe Set("f64Tag=-9007199254740991")
            query.typeIdComps mustBe Vec(
                      Float64TagTypeId -> CompOpVal(Eq, Flt64(-9007199254740991d)))
          }
          "Javascript Number.MAX_SAFE_INTEGER" in {
            val query = parseRawSearchQueryString("tags:f64Tag=9007199254740991", dao)
            query.tagTypeNames mustBe Set("f64Tag=9007199254740991")
            query.typeIdComps mustBe Vec(
                      Float64TagTypeId -> CompOpVal(Eq, Flt64(9007199254740991d)))
          }
        }

        "warn if the Float64 tag's value is not a number" in {
          val query = parseRawSearchQueryString("tags:f64Tag=abcd", dao)
          query.tagTypeNames mustBe Set("f64Tag=abcd")
          query.tagTypeIds mustBe Set(Float64TagTypeId)
          query.typeIdComps mustBe empty
          query.warnings.head.message must include("f64Tag")
          query.warnings.head.code mustEqual "TyESECMP0F64_"
        }
      }

      "parse tag text comparisons" - {
        "parse tag text comparisons:  tags:some-tag=abcd,  StrKwd" in {
          var query = parseRawSearchQueryString("tags:strKwdTag=abcd", dao)
          query.queryWithoutParams mustBe ""
          query.catIds mustBe empty
          query.tagTypeNames mustBe Set("strKwdTag=abcd")
          query.typeIdComps mustBe Vec(StrKwdTagTypeId -> CompOpVal(Eq, StrKwd("abcd")))

          query = parseRawSearchQueryString("tags:strKwdTag>aaa,strKwdTagTwo<=123-abc", dao)
          query.queryWithoutParams mustBe ""
          query.catIds mustBe empty
          query.tagTypeNames mustBe Set("strKwdTag>aaa", "strKwdTagTwo<=123-abc")
          query.typeIdComps mustBe Vec(StrKwdTagTypeId -> CompOpVal(Gt, StrKwd("aaa")),
                                       StrKwdTwoTagTypeId -> CompOpVal(Lte, StrKwd("123-abc")))
        }

        "parse numbers as text, when tag value type is text" in {
          val query = parseRawSearchQueryString("tags:strKwdTag=1234", dao)
          query.tagTypeNames mustBe Set("strKwdTag=1234")
          query.typeIdComps mustBe Vec(StrKwdTagTypeId -> CompOpVal(Eq, StrKwd("1234")))
          query.warnings mustBe empty
        }
      }

      "tag slugs (instead of tag names) and comparisons work" in {
        // 'tagTwo' is by name,  'tag-two' and '-one' is by slug.
        val query = parseRawSearchQueryString(s"$tags:tag-one<=701,tag-two>=702,tagTwo=703", dao)
        query.isEmpty mustBe false
        query.tagTypeNames mustBe Set("tag-one<=701", "tag-two>=702", "tagTwo=703")
        query.typeIdComps mustBe Vec(
              101 -> CompOpVal(Lte, Int32(701)),
              102 -> CompOpVal(Gte, Int32(702)),
              102 -> CompOpVal(Eq, Int32(703)))
        query.warnings mustBe empty
      }

      "tags plus free text" - {
        "parse tag value comparisons plus more text:  aaa tags:some-tag=123 bbb" in {
          var query = parseRawSearchQueryString("aaa tags:tagOne=123 bbb", dao)
          query.queryWithoutParams mustBe "aaa  bbb"
          query.catIds mustBe empty
          query.tagTypeNames mustBe Set("tagOne=123")
          query.typeIdComps mustBe Vec(101 -> CompOpVal(Eq, Int32(123)))
        }

        "parse i32, f64 and str-kwd, all in the same tags:... expr, plus free text" in {
          val query = parseRawSearchQueryString(
                "free_ tags:tagOne<123,f64Tag=12.34,strKwdTag>=ijk,tagTwo _text", dao)
          query.queryWithoutParams mustBe "free_  _text"
          query.tagTypeNames mustBe Set("tagOne<123", "f64Tag=12.34", "strKwdTag>=ijk", "tagTwo")
          query.tagTypeIds mustBe Set(TagTypeTwoId)
          query.typeIdComps mustBe Vec(
                  TagTypeOneId -> CompOpVal(Lt, Int32(123)),
                  Float64TagTypeId -> CompOpVal(Eq, Flt64(12.34)),
                  StrKwdTagTypeId -> CompOpVal(Gte, StrKwd("ijk")))
        }
      }

      "parse tag values, free 'te xt' and categories" in {
        var query = parseRawSearchQueryString("tex category:catOne t tags:tagOne>1111", dao)
        query.queryWithoutParams mustBe "tex  t"
        query.catIds mustBe Set(1)
        query.tagTypeNames mustBe Set("tagOne>1111")
        query.typeIdComps mustBe Vec(101 -> CompOpVal(Gt, Int32(1111)))

        query = parseRawSearchQueryString("category:catOne te tags:tagTwo=2222 xt", dao)
        query.queryWithoutParams mustBe "te  xt"
        query.catIds mustBe Set(1)
        query.tagTypeNames mustBe Set("tagTwo=2222")
        query.typeIdComps mustBe Vec(102 -> CompOpVal(Eq, Int32(2222)))
      }

      "warn if unknown tags" in {
        var query = parseRawSearchQueryString("tags:unk-tag", dao)
        query.catIds mustBe empty
        query.tagTypeIds mustBe empty
        query.typeIdComps mustBe empty
        query.warnings.head.message must include("unk-tag")
        query.warnings.head.code mustEqual "TyMSEUNKNAME_"
        query.warnings.length mustEqual 1
      }

      "warn if symbils, e.g.:  'tag:<>=!tag-name'" in {
        val query = parseRawSearchQueryString("tag:<>=!tag-name", dao)
        query.warnings.head.code mustEqual "TyESETAGINCLSYMB_"
        query.tagTypeNames mustBe Set("<>=!tag-name")
        query.tagTypeIds mustBe empty  // no such tag
      }

      "parse custom sort order" - {

        "understand both  'sort-by:tag-value:tag-name'  and  'sort:tagval:...'" in {
          var query = parseRawSearchQueryString("sort-by:tag-value:tagOne", dao)
          query.queryWithoutParams mustBe ""
          query.catIds mustBe empty
          query.tagTypeNames mustBe empty
          query.typeIdComps mustBe empty
          query.sortOrder mustBe Vec(SortHitsBy.TagVal(TagTypeOne, asc = true))

          query = parseRawSearchQueryString("te sort:tagval:tagOne:desc,tag-value:tagTwo xt", dao)
          query.queryWithoutParams mustBe "te  xt"
          query.catIds mustBe empty
          query.tagTypeNames mustBe empty
          query.authorUsernames mustBe empty
          query.sortOrder mustBe Vec(
                SortHitsBy.TagVal(TagTypeOne, asc = false),  // ':desc' above
                SortHitsBy.TagVal(TagTypeTwo, asc = true))
        }

        "combine tags and sort order:  tags:some-tag:asc" in {
          var query = parseRawSearchQueryString("tags:tagOne:asc", dao)
          query.tagTypeNames mustBe Set("tagOne:asc")
          query.tagTypeIds mustBe Set(TagTypeOneId)
          query.typeIdComps mustBe empty
          query.sortOrder mustBe Vec(
                  SortHitsBy.TagVal(TagTypeOne, asc = true))

          query = parseRawSearchQueryString("tags:tagTwo:desc,tagOne:asc,tagThree:desc", dao)
          query.tagTypeNames mustBe Set("tagOne:asc", "tagTwo:desc", "tagThree:desc")
          query.tagTypeIds mustBe Set(TagTypeOneId, TagTypeTwoId, TagTypeThreeId)
          query.typeIdComps mustBe empty
          query.sortOrder mustBe Vec(
                  SortHitsBy.TagVal(TagTypeTwo, asc = false),
                  SortHitsBy.TagVal(TagTypeOne, asc = true),
                  SortHitsBy.TagVal(TagTypeThree, asc = false))
        }

        "warn if unknown sort method" in {
          val query = parseRawSearchQueryString("sort:unknown_287694", dao)
          query.warnings.head.code mustEqual "TyESEINVSORTMTD_"
          query.warnings.head.message must include("unknown_287694")
          query.warnings.length mustEqual 1
          query.sortOrder mustBe empty
        }

        "warn if no sort method" in {
          val query = parseRawSearchQueryString("sort:", dao)
          query.warnings.head.code mustEqual "TyESEPARMEMPTY_"
          query.sortOrder mustBe empty
        }

        "warn if too many ':' separated parts" in {
          // It's  sort:tagval:tag-name:asc/desc,  that's three parts after 'sort:'.
          val query = parseRawSearchQueryString("sort:tagval:two:three:four", dao)
          query.warnings.head.code mustEqual "TyESEINVSORT02_"
          query.sortOrder mustBe empty
        }

        "warn if sth else than  ':asc'  or ':desc'" in {
          val query = parseRawSearchQueryString("sort:tagval:tagOne:bad-asc-desc", dao)
          query.sortOrder mustBe empty
          query.isEmpty mustBe true
          query.warnings.head.code mustEqual "TyESEINVSORTORD_"
          query.warnings.head.message must include("bad-asc-desc")
          query.warnings.length mustEqual 1
        }

        "warn if sorting by non-existing tag" in {
          val query = parseRawSearchQueryString("sort:tagval:no-such-tag", dao)
          query.warnings.head.code mustEqual "TyESEINVSORT0TAG_"
          query.warnings.head.message must include("no-such-tag")
          query.warnings.length mustEqual 1
          query.sortOrder mustBe empty
        }

        "warn if tag name forgotten  (when sorting by tag value)" in {
          var query = parseRawSearchQueryString("sort:tagval:", dao)
          query.warnings.head.code mustEqual "TyESEINVSORT0TAGPART_"
          query.sortOrder mustBe empty

          query = parseRawSearchQueryString("sort:tagval", dao)
          query.warnings.head.code mustEqual "TyESEINVSORT0TAGPART_"
          query.sortOrder mustBe empty
        }

        "warn if 'sort::'" in {
          val query = parseRawSearchQueryString("sort::", dao)
          query.warnings.head.code mustEqual "TyESEINVSORT01_"
          query.sortOrder mustBe empty
        }

        "warn if sorting by tag type that lacks values" - {
          "'sort:tagval:...'-sorting" in {
            val query = parseRawSearchQueryString("sort:tagval:valueLessTag", dao)
            query.queryWithoutParams mustBe ""
            query.warnings.head.code mustEqual "TyESESORT0VAL02_"
            query.warnings.head.message must include("valueLessTag")
            query.warnings.length mustEqual 1
            query.sortOrder mustBe empty
            query.tagTypeIds mustBe empty
            query.tagValComps mustBe empty
          }

          "'tags:...:asc/desc'-sorting — should warn, but still search for tag" in {
            val query = parseRawSearchQueryString("tags:valueLessTag:desc", dao)
            query.warnings.head.code mustEqual "TyESESORT0VAL01_"
            query.warnings.head.message must include("valueLessTag")
            query.warnings.length mustEqual 1
            query.sortOrder mustBe empty
            query.tagTypeIds mustBe Set(ValueLessTagId)
            query.tagValComps mustBe empty
          }
        }
      }

      "combine tags, sort order and comparisons:  tags:some-tag:asc>=min" in {
        val query = parseRawSearchQueryString("tags:tagOne:asc>=1010", dao)
        query.tagTypeNames mustBe Set("tagOne:asc>=1010")
        query.tagTypeIds mustBe empty
        query.typeIdComps mustBe Vec(TagTypeOneId -> CompOpVal(Gte, Int32(1010)))
        query.sortOrder mustBe Vec(
              SortHitsBy.TagVal(TagTypeOne, asc = true))
      }

      "combine 'tags:...:asc/desc  sort:...' — and 'sort:' order has precedence" in {
        val query = parseRawSearchQueryString(
              "tee tags:tagThree,tagOne:desc<98 xx sort:tagval:tagTwo:asc,tagval:under_tag tt",
              dao)
        query.queryWithoutParams mustEqual "tee  xx  tt"
        query.catIds mustBe empty
        query.catNames mustBe empty
        query.tagTypeNames mustBe Set("tagThree", "tagOne:desc<98")
        query.tagTypeIds mustBe Set(TagTypeThreeId)
        query.typeIdComps mustBe Vec(TagTypeOneId -> CompOpVal(Lt, Int32(98)))
        query.sortOrder mustBe Vec(
              // 'sort:...' has priority over ...
              SortHitsBy.TagVal(TagTypeTwo, asc = true),
              SortHitsBy.TagVal(UnderTagType, asc = true),
              // ... 'tags:some-tag:asc/desc'  — also if 'sort:..' is at the end
              // of the query string).
              SortHitsBy.TagVal(TagTypeOne, asc = false))
      }

      "warn if not ':asc' or 'desc' as order:  tags:some-tag:deeesc" in {
        // Talkyard assumes ':deeesc' is part of the tag name, but tag not found
        // — oh, no, instead, Ty thinks ':' is a comparison operator,
        // and warns about it being unsupported.
        val query = parseRawSearchQueryString("tags:tagOne:deeesc", dao)
        query.tagTypeNames mustBe Set("tagOne:deeesc")
        query.tagTypeIds mustBe Set(TagTypeOneId)
        query.warnings.length mustEqual 1
        query.warnings.head.message must include(":") // the unknown symbol, not '=' or '>=' etc
        query.warnings.head.message must include("unknown symbol")
        query.warnings.head.code mustEqual "TyESECMPSYMB_"
      }

      "parse author usernames" in {
        var query = parseRawSearchQueryString("by:userOne", dao)
        query.queryWithoutParams mustBe ""
        query.catIds mustBe empty
        query.tagTypeNames mustBe empty
        query.typeIdComps mustBe empty
        query.authorUsernames mustBe Set("userOne")
        query.authorIds mustBe Set(10001)

        query = parseRawSearchQueryString("by:userOne,userTwo", dao)
        query.queryWithoutParams mustBe ""
        query.catIds mustBe empty
        query.tagTypeNames mustBe empty
        query.typeIdComps mustBe empty
        query.authorIds mustBe Set(10001, 10002)
      }

      "parse author usernames plus more text:  aaa by:userTwo bbb" in {
        var query = parseRawSearchQueryString("aaa by:userTwo bbb", dao)
        query.queryWithoutParams mustBe "aaa  bbb"
        query.catIds mustBe empty
        query.tagTypeNames mustBe empty
        query.typeIdComps mustBe empty
        query.authorIds mustBe Set(10002)
      }

      "warn if unknown usernames" in {
        var query = parseRawSearchQueryString("by:no_one", dao)
        query.isEmpty mustBe true
        query.warnings.head.message must include("no_one")
        query.warnings.head.code mustEqual "TyESEUNKPART_"
        query.warnings.length mustEqual 1
      }
    }

  }

}

