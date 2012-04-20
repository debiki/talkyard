/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import org.specs2.mutable._
import play.api.test._
import play.api.test.Helpers._
import xml._


class TemplateEngineSpec extends Specification {

  val N = Nil: NodeSeq

  /*
  // Calling this function, e.g.:
  //   replace(<title/>, <title/>) must ==/ ((<title/>, N))
  // from an example doesn't result in any test being run. No idea why.
  def testReplace(a: NodeSeq, b: NodeSeq, aAfter: NodeSeq, bAfter: NodeSeq)
        : org.specs2.specification.Example = {
    val (a2: NodeSeq,  b2: NodeSeq) = replace(a, b)

    <div>{a2}</div> must ==/(<div>{aAfter}</div>)
    <div>{b2}</div> must ==/(<div>{bAfter}</div>)

    // This:
    // a2 must_== aAfter
    // b2 must_== bAfter
    // Results in:
    // [error] Could not create an instance of debiki.TemplateEngineSpec
    // [error]   caused by org.specs2.execute.FailureException
    // [error]   org.specs2.matcher.ThrownExpectations$class
    //            .checkResultFailure(ThrownExpectations.scala:32)
  }
  */

  "TemplateEngine tag replacement functions" can {
    import TemplateEngine.{replaceMatchingHeadTags => replHead}
    import TemplateEngine.{replaceTagsWithSameId => replId}

    "handle empty lists and replace titles:" >> {
      "Nil, Nil -> unchanged" >> {
        var (r, l) = replHead(Nil, Nil)
        <x>{r}</x> must ==/(<x></x>)
        <x>{l}</x> must ==/(<x></x>)
      }

      "<title/>, Nil -> unchanged" >> {
        val (r, l) = replHead(<title/>, Nil)
        <x>{r}</x> must ==/(<x><title/></x>)
        <x>{l}</x> must ==/(<x></x>)
      }

      "Nil, <title/> -> unchanged" >> {
        val (r, l) = replHead(Nil, <title/>)
        <x>{r}</x> must ==/(<x></x>)
        <x>{l}</x> must ==/(<x><title/></x>)
      }

      "<title/>, <title/> -> <title/>, Nil" >> {
        val (r, l) = replHead(<title/>, <title/>)
        <x>{r}</x> must ==/(<x><title/></x>)
        <x>{l}</x> must ==/(<x></x>)
      }

      "<title>Aaa</title>, <title>Bbb</title> -> replaced" >> {
        val (r, l) = replHead(<title>Aaa</title>, <title>Bbb</title>)
        <x>{r}</x> must ==/(<x><title>Bbb</title></x>)
        <x>{l}</x> must ==/(<x></x>)
      }
    }

    "replace meta with same name:" >> {
      "<meta name='Y'>Aaa</meta>, <meta name='Z'>Bbb</meta> -> unchanged" >> {
        val (r, l) = replHead(<meta name='Y'>Aaa</meta>,
          <meta name='Z'>Bbb</meta>)
        <x>{r}</x> must ==/(<x><meta name='Y'>Aaa</meta></x>)
        <x>{l}</x> must ==/(<x><meta name='Z'>Bbb</meta></x>)
      }
      "<meta name='Y'>Aaa</meta>, <link name='Y'>Bbb</link> -> unchanged" >> {
        val (r, l) = replHead(<meta name='Y'>Aaa</meta>,
          <link name='Y'>Bbb</link>)
        <x>{r}</x> must ==/(<x><meta name='Y'>Aaa</meta></x>)
        <x>{l}</x> must ==/(<x><link name='Y'>Bbb</link></x>)
      }
      "<meta name='Y'>Aaa</meta>, <meta name='Y'>Bbb</meta> -> replaced" >> {
        val (r, l) = replHead(<meta name='Y'>Aaa</meta>,
          <meta name='Y'>Bbb</meta>)
        <x>{r}</x> must ==/(<x><meta name='Y'>Bbb</meta></x>)
        <x>{l}</x> must ==/(<x></x>)
      }
    }

    "replace if same id:" >> {
      "Nil, Nil -> unchanged" >> {
        var (r, l) = replId(Nil, Nil)
        <x>{r}</x> must ==/(<x></x>)
        <x>{l}</x> must ==/(<x></x>)
      }

      "Nil, <div/> -> unchanged" >> {
        val (r, l) = replId(Nil, <div/>)
        <x>{r}</x> must ==/(<x></x>)
        <x>{l}</x> must ==/(<x><div/></x>)
      }

      "<div/>, Nil -> unchanged" >> {
        val (r, l) = replId(<div/>, Nil)
        <x>{r}</x> must ==/(<x><div/></x>)
        <x>{l}</x> must ==/(<x></x>)
      }

      "<div/>, <div/> -> unchanged" >> {
        val (r, l) = replId(<div/>, <div/>)
        <x>{r}</x> must ==/(<x><div/></x>)
        <x>{l}</x> must ==/(<x><div/></x>)
      }

      "<id='Y'>Aaa</>, <id='Y'>Bbb</> -> replaced" >> {
        val (r, l) = replId(<div id='Y'>Aaa</div>, <div id='Y'>Bbb</div>)
        <x>{r}</x> must ==/(<x><div id='Y'>Bbb</div></x>)
        <x>{l}</x> must ==/(<x></x>)
      }

      "<id='Y'>Aaa</>, <id='Z'>Bbb</> -> unchanged" >> {
        val (r, l) = replId(<div id='Y'>Aaa</div>, <div id='Z'>Bbb</div>)
        <x>{r}</x> must ==/(<x><div id='Y'>Aaa</div></x>)
        <x>{l}</x> must ==/(<x><div id='Z'>Bbb</div></x>)
      }
    }

    "replace if same id, many tags:" >> {
      "<div/><div#Y/><div.lastP/>, <div/><div#Y><div.lastC/> -> replaced" >> {
        val (r,  l) = replId(
           <div/><div id='Y'>Aaa</div><div class='lastP'/>,
           <div/><div id='Y'>Bbb</div><div class='lastC'/>)

        <x>{r}</x> must ==/(
           <x><div/><div id='Y'>Bbb</div><div class='lastP'/></x>)
        <x>{l}</x> must ==/(
           <x><div/><div class='lastC'/></x>)
      }
    }

    "replace if same id, nested tags:" >> {
      "<div><div id='Y' ../></div>, <div id='Y'> -> inner replaced" >> {
        val (r,  l) = replId(<div><div id='Y'>Aaa</div></div>,
                             <div id='Y'>Bbb</div>)
        <x>{r}</x> must ==/(<x><div><div id='Y'>Bbb</div></div></x>)
        <x>{l}</x> must ==/(<x></x>)
      }

      "<div><span><div id='Y'../></span></div>, <div id='Y'> -> replaced" >> {
        val (r, l) = replId(<div><span><div id='Y'>Aa</div></span></div>,
                            <div id='Y'>Bb</div>)
        <x>{r}</x> must ==/(<x><div><span><div id='Y'>Bb</div></span></div></x>)
        <x>{l}</x> must ==/(<x></x>)
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

      <x>{r}</x> must ==/(<x/>)
      <x>{l}</x> must ==/(<x/>)
    }

    "replace and keep many body tags, some nested, at once" >> {
      val (r, l) = replHead(
        <div>LeftAsIs no-id</div> ++
        <div id='a'>LeftAsIs id-a</div> ++
        <div><div id='Q'>Nested and replaced</div></div> ++
        <div id='Y'>Replaced</div> ++
        <div id='Z'>Replaced by a span</div> ++
        <div>NoId_P2</div>
        ,
        <div id='Y'>Removed</div> ++
        <span id='Z'>Replaces a div</span> ++
        <div id='Q'>Replaces nested div</div> ++
        <div id='Y'>Replaces</div> ++
        <div id='b'>LeftAsIs id-b</div> ++
        <div>LeftAsIs no-id</div>)

      <x>{r}</x> must ==/(<x/>)
      <x>{l}</x> must ==/(<x/>)
    }
  }

}

