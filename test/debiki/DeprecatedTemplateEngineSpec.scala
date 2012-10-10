/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import org.specs2.mutable._
import play.api.test._
import play.api.test.Helpers._
import xml._
import DeprecatedTemplateEngine.{replaceMatchingHeadTags => replHead}
import DeprecatedTemplateEngine.{replaceTagsWithMatchingId => replId}
import DeprecatedTemplateEngine.transform


class DeprecatedTemplateEngineSpec extends Specification {

  val N = Nil: NodeSeq


  "DeprecatedTemplateEngine tag replacement functions" can {

    "transform tags" >> {

      "Nil to Nil" >> {
        transform(Nil, replacements = Map()) must beEmpty
        transform(Nil, replacements = Map("X" -> Nil)) must beEmpty
      }

      "a tag to Nil" >> {
        transform(<div id='X'/>, replacements = Map("X" -> Nil)) must beEmpty
      }

      "a tag to many tags" >> {
        val t: NodeSeq = <div>a</div> ++ <div>b</div>
        transform(<div id='X'/>, replacements = Map("X" -> t)) must be_==/(t)
      }

      "a nested tag to many" >> {
        val t: NodeSeq = (<div>a</div><div>b</div>)
        transform(<span><div id='X'/></span>, replacements = Map("X" -> t)
        ) must be_==/(<span>{t}</span>)
      }

      "two at once: <#X><#Y><#Z> to <>a</><>b</><#Z>" >> {
        val a = <div>a</div>
        val b = <div>b</div>
        val z = <div id='Z'>z</div>
        transform(<div id='X'/><div id='Y'/> ++ z,
          replacements = Map("X" -> a, "Y" -> b)) must be_==/(a ++ b ++ z)
      }
    }


    "handle empty lists and replace titles:" >> {

      "Nil, Nil -> unchanged" >> {
        var (r, l) = replHead(Nil, Nil)
        r must beEmpty
        l must beEmpty
      }

      "<title/>, Nil -> unchanged" >> {
        val (r, l) = replHead(<title/>, Nil)
        r must ==/(<title/>)
        l must beEmpty
      }

      "Nil, <title/> -> unchanged" >> {
        val (r, l) = replHead(Nil, <title/>)
        r must beEmpty
        l must ==/(<title/>)
      }

      "<title/>, <title/> -> <title/>, Nil" >> {
        val (r, l) = replHead(<title/>, <title/>)
        r must ==/(<title/>)
        l must beEmpty
      }

      "<title>Aaa</title>, <title>Bbb</title> -> replaced" >> {
        val (r, l) = replHead(<title>Aaa</title>, <title>Bbb</title>)
        r must ==/(<title>Bbb</title>)
        l must beEmpty
      }
    }


    "replace meta with same name:" >> {
      "<meta name='Y'>Aaa</meta>, <meta name='Z'>Bbb</meta> -> unchanged" >> {
        val (r, l) = replHead(<meta name='Y'>Aaa</meta>,
          <meta name='Z'>Bbb</meta>)
        r must ==/(<meta name='Y'>Aaa</meta>)
        l must ==/(<meta name='Z'>Bbb</meta>)
      }
      "<meta name='Y'>Aaa</meta>, <link name='Y'>Bbb</link> -> unchanged" >> {
        val (r, l) = replHead(<meta name='Y'>Aaa</meta>,
          <link name='Y'>Bbb</link>)
        r must ==/(<meta name='Y'>Aaa</meta>)
        l must ==/(<link name='Y'>Bbb</link>)
      }
      "<meta name='Y'>Aaa</meta>, <meta name='Y'>Bbb</meta> -> replaced" >> {
        val (r, l) = replHead(<meta name='Y'>Aaa</meta>,
          <meta name='Y'>Bbb</meta>)
        r must ==/(<meta name='Y'>Bbb</meta>)
        l must beEmpty
      }
    }


    "replace if same id:" >> {

      "Nil, Nil -> unchanged" >> {
        var (r, l) = replId(Nil, Nil)
        r must beEmpty
        l must beEmpty
      }

      "Nil, <div/> -> unchanged" >> {
        val (r, l) = replId(Nil, <div/>)
        r must beEmpty
        l must ==/(<div/>)
      }

      "<div/>, Nil -> unchanged" >> {
        val (r, l) = replId(<div/>, Nil)
        r must ==/(<div/>)
        l must beEmpty
      }

      "<div/>, <div/> -> unchanged" >> {
        val (r, l) = replId(<div/>, <div/>)
        r must ==/(<div/>)
        l must ==/(<div/>)
      }

      "<id='Y'/>, <r#Y/> -> replaced" >> {
        val p = <div id='Y'>Aaa</div>
        val c = <div data-replace='#Y'>Bbb</div>
        val (r, l) = replId(p, c)
        r must ==/(c)
        l must beEmpty
      }

      "<#Y/>, <r#Z/> -> unchanged" >> {
        val p = <div id='Y'>Aaa</div>
        val c = <div data-replace='#Z'>Bbb</div>
        val (r, l) = replId(p, c)
        r must ==/(p)
        l must ==/(c)
      }
    }


    "replace if same id, many tags:" >> {
      "</><#Y/><.lastP/>, </><r#Y><.lastC/> -> #Y replaced" >> {
        val (r,  l) = replId(
           <div/><div id='Y'>Aaa</div><div class='lastP'/>,
           <div/><div data-replace='#Y'>Bbb</div><div class='lastC'/>)
        r must ==/(<div/><div data-replace='#Y'>Bbb</div><div class='lastP'/>)
        l must ==/(<div/><div class='lastC'/>)
      }
    }


    "replace if same id, nested tags:" >> {
      "<><#Y/></>, <r#Y> -> inner replaced" >> {
        val p = <div><div id='Y'>Aaa</div></div>
        val c = <div data-replace='#Y'>Bbb</div>
        val (r,  l) = replId(p, c)
        r must ==/(<div>{c}</div>)
        l must beEmpty
      }

      "<><span><#Y/></span></>, <r#Y> -> #Y replaced" >> {
        val p = <div><span><div id='Y'>Aa</div></span></div>
        val c = <div data-replace='#Y'>Bb</div>
        val (r, l) = replId(p, c)
        r must ==/(<div><span>{c}</span></div>)
        l must beEmpty
      }
    }


    "replace and keep many head tags at once" >> {
      val (r, l) = replHead(
         <title>Replaced</title> ++
         <meta name='Y'>Replaced</meta> ++
         <meta name='Y2'>LeftAsIs name-y2</meta>
          ,
         <title>Removed</title> ++
         <meta name='Y3'>LefAsIs name-y3</meta> ++
         <title>Replaces</title> ++  // overwrites both TitleA and TitleB
         <meta name='Y'>Replaces</meta>)

      r must ==/(
         <title>Replaces</title> ++
         <meta name='Y'>Replaces</meta> ++
         <meta name='Y2'>LeftAsIs name-y2</meta>)
      l must ==/(
        <meta name='Y3'>LefAsIs name-y3</meta>)
    }


    "replace and keep many body tags, some nested, at once" >> {
      val (r, l) = replId(
        <div>LeftAsIs no-id</div> ++
        <div id='a'><i>LeftAsIs id-a</i></div> ++
        <div><div id='Q'>Nested and replaced</div><i>Kept</i></div> ++
        <div id='Y'>Replaced</div> ++
        <div id='Z'>Replaced by a span</div> ++
        <div>NoId_P2</div>
        ,
        // <div data-replace='#Y'>Removed</div> ++  ?? what would happen
        <span data-replace='#Z'>Replaces a div</span> ++
        <div>LeftAsIs indeed</div> ++
        <div data-replace='#Q'>Replaces nested</div> ++
        <div data-replace='#Y'>ReplaceS</div> ++
        <div id='b'>LeftAsIs id-b</div> ++
        <div data-replace='#missing'>Nothing to replace</div> ++
        <div>LeftAsIs no-id</div>)

      r must ==/(
        <div>LeftAsIs no-id</div> ++
        <div id='a'><i>LeftAsIs id-a</i></div> ++
        <div><div data-replace='#Q'>Replaces nested</div><i>Kept</i></div> ++
        <div data-replace='#Y'>ReplaceS</div> ++
        <span data-replace='#Z'>Replaces a div</span> ++
        <div>NoId_P2</div>)
      l must ==/(
        <div>LeftAsIs indeed</div> ++
        <div id='b'>LeftAsIs id-b</div> ++
        <div data-replace='#missing'>Nothing to replace</div> ++
        <div>LeftAsIs no-id</div>)
    }
  }

}

