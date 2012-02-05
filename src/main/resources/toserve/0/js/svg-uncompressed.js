/*
Copyright (c) 2009 Google Inc. (Brad Neuberg, http://codinginparadise.org)

Portions Copyright (c) 2009 Rick Masters
Portions Copyright (c) 2009 Others (see COPYING.txt for details on
third party code)

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
*/

/**
  SVG Web brings SVG to browsers that don't have it, such as on Internet
  Explorer, using Flash. SVG Web supports both static and dynamic SVG files
  scripted by JavaScript, giving the 'illusion' that SVG is truly supported
  by a browser. This means that JavaScript in the same page 'sees' the SVG
  as a real-part of the browser and can script it using the standard DOM, even
  when we are emulating SVG support using Flash. SVG Web targets 
  SVG 1.1 Full. 
  
  SVG Web brings SVG support from roughly a ~30% installed base to close to 
  100% with a library that is roughly 70K in size, giving developers a retained 
  mode API for applications where the HTML5 Canvas tag's immediate mode API 
  might not be appropriate, such as where DOM tracking, import/export, 
  acessibility, and scalable vector images are needed. Retained and 
  immediate mode graphics APIs have different tradeoffs and are appropriate for
  different use-cases.
  
  From a high-level SVG Web consists of two types of handlers, either
  the NativeHandler which uses the native SVG browser support if present 
  (Firefox, Safari, etc.) or the FlashHandler which uses Flash and various 
  JavaScript tricks to provide SVG support. 
  
  The entry point for the system is the static JavaScript singleton 'svgweb'
  class. This does many things, including: ensuring SVG Web is loaded before
  the window onload event fires; waiting for the onDOMContentLoaded event
  to fire; grabbing any SVG either directly embedded into a page or embedded 
  using the OBJECT tag; normalizing and cleaning up our SVG; and finally 
  determining the capabilities of the platform and creating the correct 
  handler. At this point the svgweb class hands off work to the specific 
  handler created (NativeHandler or FlashHandler).
  
  The handlers and the svgweb singleton depend on a few support classes and
  methods to get their job done, including:
    * Utility functions such as 'extend', 'hitch', and 'mixin' to make defining
    JavaScript classes and callbacks be a bit more compact and readable. 
    Other utility functions include methods such as 'parseXML', 'xpath', and 
    'xhrObj' to ease cross-browser XML, XPath, and XHR handling, respectively
    * RenderConfig class - Helps determine the rendering capabilities of the 
    browser and whether the page itself is overriding and forcing a particular 
    render handler, such as through a META tag or query variables.
    * FlashInfo class - Helps determine whether Flash is installed, and if so, 
    which version.
    * FlashInserter class - Inserts our Flash into the page in a consistent way.
    
  Moving on, the NativeHandler and FlashHandler decompose as follows. Let's
  start with the NativeHandler, since its the most straightforward.
  
  The NativeHandler essentially shims through and uses the native browser 
  support. For various reasons, however, the NativeHandler must still patch 
  various parts of the browser's SVG implementation to provide a consistent 
  SVG experience where reasonable. We are careful to do this minimally and 
  only where absolutely necessary; we don't, for example, attempt to shim
  in SMIL support on Firefox as that would be overkill. Some reasons for 
  the patching we do need include:
    * Firefox, for example, does not support setting SVG style values using
    the standard HTML idiom, such as myCircle.style.fill = 'red'. SVG Web
    adds this in for consistency.
    * Some browsers have various bugs that are serious enough that a simple
    patch on SVG Web's part can make life simpler for programmers.
    * While SVG Web mostly supports the SVG standard, some small divergences
    are necessary to accomodate various limitations that the FlashHandler
    requires; we patch the native SVG implementation to match these divergences
    in order to have API consistency between all the handlers for
    end-developers.
    
  The FlashHandler is more complicated, obviously. It essentially consists
  of a Flash portion plus JavaScript to simulate native support. Note that
  we support having the FlashHandler do its magic not only on Internet 
  Explorer but Safari, Firefox, and Chrome as well. This is useful for two
  reasons: it significantly aides debugging and testing of the FlashHandler
  and also makes it possible to optionally use the FlashHandler to 'go beyond'
  the native capabilities of a browser if needed.
  
  For the FlashHandler let's begin with the Flash side. All of the Flash
  is written in ActionScript 3 and is located in src/org/svgweb. Much of the
  Flash side consists of ActionScript classes that essentially simulate and
  render all the various SVG node types, such as SVGCircleNode.as for the
  SVG Circle tag. The entry point for the Flash is the 
  org.svgweb.SVGViewerWeb class, which mediates all interaction between
  the JavaScript and Flash side of things. The JavaScript invokes various
  methods on the SVGViewerWeb class to get things done, and the Flash
  messages back various things, such as rendering being done, events, etc.
  We use Flash's ExternalInterface to do this communication but things are
  more complex unfortunately due to this part of the system being one of the
  primary bottlenecks, requiring complicated optimizations. See the
  SVGViewerWeb class for details on this aspect.
  
  The FlashHandler uses the Flash side to do its rendering, but it also must
  handle two other significant cases:
  * handle disconnected nodes (i.e. nodes not attached to anything yet)
  * give the illusion of a real DOM and hand back SVG nodes that 'feel real'
  
  Various design constraints require that the JavaScript side be relatively
  sophisticated and also do tracking, rather than pushing everything to the 
  Flash ActionScript. The first primary reason includes the fact that 
  essentially only basic strings and types are pushed over the Flash/JS 
  boundry, rather than object references -- this is difficult since SVG is
  essentially a tree, making it hard to do operations on specific nodes. The 
  second primary reason has to do with dealing with disconnected trees, 
  since you can build up a complicated DOM tree that is not attached to 
  any rendered document and therefore has no Flash associated with it.
  
  Generally patching the browser is taboo. Since SVG Web is an emulation
  environment rather than a new API we must patch the browser to give the
  illusion of a real SVG implementation. We attempt to do this without
  impacting or slowing down non-SVG use-cases. Methods such as 
  getElementById, getElementsByTagNameNS, or createElementNS are patched in 
  to short-circuit for the non-SVG cases.
  
  The real magic, though, begins when these methods are called for SVG nodes.
  Instead of returning real DOM nodes we actually return 'fake' DOM nodes.
  Looking through this file you will see various 'fake' DOM implementations
  preceded with underscores, such as _Node, _Element, _Document, 
  _DocumentFragment, etc. These JavaScript classes basically implement the
  DOM interfaces, such as nodeName, appendChild, childNodes, etc. When an 
  external developer 'calls' on one of our fake SVG nodes, they are actually 
  interacting with a fake JavaScript class rather than a real DOM node; we
  just work to give the illusion that it's a real DOM class.
  
  Inside our fake SVG DOM node classes, we track each node with a __guid that
  helps us do tracking and registration with the Flash side. If you change
  the property of an SVG Circle, for example, we would simply send the __guid
  over to Flash and the new values. Using the __guid essentially gives us the
  object references we don't get with Flash's ExternalInterface. Every 
  fake node also keeps an internal reference to it's parsed XML so that it
  can change and store the values on the JavaScript side as well. Some
  complexity is involved in also tracking DOM TextNodes stored in our SVG
  tree so that we can consistently return the 'same' DOM TextNode when fetched
  rather than searching by text value, which would fail if there are many
  DOM TextNodes with the same value. To handle this we internally store
  DOM TextNodes as a node called '__text' and add a tracking __guid. This adds
  some internal complexity but allows external developers to have what feels
  more like a real DOM.
  
  In some ways you can think of the FlashHandler as having a 'peer node' on
  its side for each SVG node rendered on the Flash side. We obviously don't
  want to do this for every node, however, which would slow down page load
  and bloat memory, so we only create our FlashHandler's
  JavaScript fake 'peer node' on demand when fetched through the DOM, such
  as through getElementById or by calling childNodes or firstChild on an
  SVG DOM node. Once fetched the first time we cache our JavaScript fake 
  peer class ready to be re-served on demand again.
  
  Let's look at the fake SVG nodes we return to developers to interact with.
  On modern browsers we can easily simulate magic getters and setters such as
  myCircle.style.fill = 'red' or someGroup.childNodes[0] using facilities
  like __defineGetter__. On those browsers when you call 
  someGroup.childNodes[0], for example, our magic getter would get invoked;
  we would see if a fake peer JavaScript node exists for this and return it
  if so, and if not, we would create it on-demand and return it. On IE, 
  however, we have to get our magic getters and setters and propery change 
  events using a different mechanism, known as Microsoft Behaviors.
  
  Microsoft Behaviors, or HTCs (HTML Components) are a powerful but relatively 
  esoteric browser technology that have been around since IE 5.0. They 
  essentially allow JavaScript to tie directly into Internet Explorer's 
  rendering engine and add new tags. They are defined in an HTC file, in our 
  case svg.htc.
  
  HTCs give us the hooks we need to define magic getters and setters for IE
  as well as gives us something called onpropertychange necessary to support
  style accesses like myGroup.style.fillColor = 'green'. On IE, whenever
  we return a result that a developer will manipulate, such as the results
  of getElementsByTagNameNS, we instead return our HTC proxy node -- you
  will see methods such as node._getProxyNode() in the source that returns
  our standard JavaScript _Node or _Element class on all browsers but IE, where
  we return our HTC node instead. 
  
  If you look at the svg.htc file you will see that it has very little code
  in it. This is for two reasons:
  * The primary performance bottleneck for HTCs is the amount of code they
  have; limiting their code has a huge affect on memory and performance
  * We want to have a similar architecture for the FlashHandler independent
  of the browser to ease maintenence.
  
  For this reason a given HTC node delegates all of its work to its
  'fake node', which would be the _Node or _Element that it is tracking.
  You will see calls such as node._getFakeNode() in the source which gets
  our fake JavaScript class to work with. For example, if you called
  node.appendChild(someNode), internally we would call someNode._getFakeNode()
  to make sure we have our JavaScript _Node or _Element class and not the
  HTC node. Now we can work with our fake SVG node in a consistent way.  
  
  @author Brad Neuberg (http://codinginparadise.org)
*/

(function(){ // hide everything externally to avoid name collisions
 
// expose namespaces globally to ease developer authoring
window.svgns = 'http://www.w3.org/2000/svg';
window.xlinkns = 'http://www.w3.org/1999/xlink';

// Firefox and Safari will incorrectly turn our internal parsed XML
// for the Flash Handler into actual SVG nodes, causing issues. This is
// a workaround to prevent this problem.
svgnsFake = 'urn:__fake__internal__namespace'; 
 
// browser detection adapted from Dojo
var isOpera = false, isSafari = false, isMoz = false, isIE = false, 
    isAIR = false, isKhtml = false, isFF = false, isXHTML = false,
    isChrome = false, hasDOMParser = false, hasXMLSerializer = false;
    
function _detectBrowsers() {
  var n = navigator,
      dua = n.userAgent,
      dav = n.appVersion,
      tv = parseFloat(dav);

  if (dua.indexOf('Opera') >= 0) { isOpera = tv; }
  // safari detection derived from:
  //    http://developer.apple.com/internet/safari/faq.html#anchor2
  //    http://developer.apple.com/internet/safari/uamatrix.html
  var index = Math.max(dav.indexOf('WebKit'), dav.indexOf('Safari'), 0);
  if (index) {
    // try to grab the explicit Safari version first. If we don't get
    // one, look for 419.3+ as the indication that we're on something
    // "Safari 3-ish". Lastly, default to "Safari 2" handling.
    isSafari = parseFloat(dav.split('Version/')[1]) ||
      (parseFloat(dav.substr(index + 7)) > 419.3) ? 3 : 2;
  }
  if (dua.indexOf('AdobeAIR') >= 0) { isAIR = 1; }
  if (dav.indexOf('Konqueror') >= 0 || isSafari) { isKhtml =  tv; }
  if (dua.indexOf('Gecko') >= 0 && !isKhtml) { isMoz = tv; }
  if (isMoz) {
    isFF = parseFloat(dua.split('Firefox/')[1]) || undefined;
  }
  if (document.all && !isOpera) {
    isIE = parseFloat(dav.split('MSIE ')[1]) || undefined;
  }
  if (dua.indexOf('Chrome') >= 0) { isChrome = 1; }

  // compatMode deprecated on IE8 in favor of documentMode
  if (document.documentMode) {
    isStandardsMode = (document.documentMode > 5);
  } else {
    isStandardsMode = (document.compatMode == 'CSS1Compat');
  }
  
  // are we in an XHTML page?
  if (document.contentType == 'application/xhtml+xml') { /* FF */
    isXHTML = true;
  } else if (typeof XMLDocument != 'undefined' 
             && document.constructor == XMLDocument) { /* Safari */
    isXHTML = true;
  }

  // Do not use a DOMParser unless you can also use the XPathEvaluator
  // and XML Serializer as well. 
  // On IE up to IE 9, while DOMParser does exists, XPathEvaluator does
  // not exist and XMLSerializer does not work in all cases, but xmlDoc.xml
  // does. So, we need to use MSXML on IE until all of that works.
  // The only exception is IE 9 native mode, in which case we use DOMParser
  // in order to produce a DOM tree that can be imported.
  if (typeof DOMParser != 'undefined'
     && typeof(XPathEvaluator) != 'undefined'
     && typeof(XMLSerializer) != 'undefined') {
    hasDOMParser = true;
    hasXMLSerializer = true;
  }
  
}

_detectBrowsers();

// end browser detection


// be able to have debug output when there is no Firebug
// see if debugging is turned on
function doDebugging() {
  var debug = false;
  var scripts = document.getElementsByTagName('script');
  for (var i = 0; i < scripts.length; i++) {
    if (/svg(?:\-uncompressed)?\.js/.test(scripts[i].src)) {
      var debugSetting = scripts[i].getAttribute('data-debug');
      debug = (debugSetting === 'true' || debugSetting === true) ? true : false;
    }
  }
  
  return debug;
}
var debug = doDebugging();

if (typeof console == 'undefined' || !console.log) {
  var queue = [];
  console = {};
  if (!debug) {
    console.log = function() {};
  } else {
    console.log = function(msg) {
      var body = null;
      var delay = false;
    
      // IE can sometimes throw an exception if document.body is accessed
      // before the document is fully loaded
      try { 
        body = document.getElementsByTagName('body')[0]; 
      } catch (exp) {
        delay = true;
      }
    
      // IE will sometimes have the body object but we can get the dreaded
      // "Operation Aborted" error if we try to do an appendChild on it; a 
      // workaround is that the doScroll method will throw an exception before 
      // we can truly use the body element so we can detect this before
      // any "Operation Aborted" errors
      if (isIE) {
        try {
          document.documentElement.doScroll('left');
        } catch (exp) {
          delay = true;
        }
      }

      if (delay) {
        queue.push(msg);
        return;
      }
       
      var p;
      while (queue.length) {
        var oldMsg = queue.shift();
        p = document.createElement('p');
        p.appendChild(document.createTextNode(oldMsg));
        body.appendChild(p);
      }
    
      // display new message now
      p = document.createElement('p');
      p.appendChild(document.createTextNode(msg));
      body.appendChild(p);
    };
    
    // IE has an unfortunate issue; under some situations calling
    // document.body.appendChild can throw an Operation Aborted error,
    // such as when there are many SVG OBJECTs on a page. This is a workaround
    // to print out any queued messages until the page has truly loaded.
    if (isIE) {
      function flushQueue() {
        while (queue.length) {
          var oldMsg = queue.shift();
          p = document.createElement('p');
          p.appendChild(document.createTextNode(oldMsg));
          document.body.appendChild(p);
        }
      }

      var debugInterval = window.setInterval(function() {
        if (document.readyState == 'complete') {
          flushQueue();
          window.clearTimeout(debugInterval);
        }
      }, 50);
    }
  }
}
// end debug output methods

/*
  Quick way to define prototypes that take up less space and result in
  smaller file size; much less verbose than standard 
  foobar.prototype.someFunc = function() lists.

  @param f Function object/constructor to add to.
  @param addMe Object literal that contains the properties/methods to
    add to f's prototype.
*/
function extend(f, addMe) {
  for (var i in addMe) {
    f.prototype[i] = addMe[i];
  }
}

/**
  Mixes an object literal of properties into some instance. Good for things 
  that mimic 'static' properties.
  
  @param f Function object/contructor to add to
  @param addMe Object literal that contains the properties/methods to add to f.
*/
function mixin(f, addMe) {
  for (var i in addMe) {
    f[i] = addMe[i];
  } 
}

/** Utility function to do XPath cross browser.

    @param doc Either HTML or XML document to work with.
    @param context DOM node context to restrict the xpath executing 
    against; can be null, which defaults to doc.documentElement.
    @param expr String XPath expression to execute.
    @param namespaces Optional; an array that contains prefix to namespace
    lookups; see the _getNamespaces() methods in this file for how this
    data structure is setup.
    
    @returns Array with results, empty array if there are none. */
function xpath(doc, context, expr, namespaces) {
  if (!context) {
    context = doc.documentElement;
  }

  if (typeof XPathEvaluator != 'undefined') { // non-IE browsers
    var evaluator = new XPathEvaluator();
    var resolver = doc.createNSResolver(context);
    var result = evaluator.evaluate(expr, context, resolver, 0, null);
    var found = createNodeList(), current;
    while (current = result.iterateNext()) {
      found.push(current);
    }

    return found;
  } else { // IE
    doc.setProperty('SelectionLanguage', 'XPath');
    
    if (namespaces) {
      var allNamespaces = '';
      // IE throws an error if the same namespace is present multiple times,
      // so remove duplicates
      var foundNamespace = {};
      for (var i = 0; i < namespaces.length; i++) {
        var namespaceURI = namespaces[i];
        var prefix = namespaces['_' + namespaceURI];

        // seen before?
        if (!foundNamespace['_' + namespaceURI]) {
          if (prefix == 'xmlns') {
            allNamespaces += 'xmlns="' + namespaceURI + '" ';
          } else {
            allNamespaces += 'xmlns:' + prefix + '="' + namespaceURI + '" ';
          }
          
          foundNamespace['_' + namespaceURI] = namespaceURI;
        }
      }
      doc.setProperty('SelectionNamespaces',  allNamespaces);
    }
    
    var found = context.selectNodes(expr);
    if (found === null || typeof found == 'undefined') {
      found = createNodeList();
    }
    
    // found is not an Array; it is a NodeList -- turn it into an Array
    var results = createNodeList();
    for (var i = 0; i < found.length; i++) {
      results.push(found[i]);
    }
    
    return results;
  }
}

/** Parses the given XML string and returns the document object.

    @param xml XML String to parse.
    @param preserveWhiteSpace Whether to parse whitespace in the XML document
    into their own nodes. Defaults to false. Controls Internet Explorer's
    XML parser only.
    
    @returns XML DOM document node.
*/
var parseXMLCache = {};
function parseXML(xml, preserveWhiteSpace) {
  if (preserveWhiteSpace === undefined) {
    preserveWhiteSpace = false;
  }
  
  // Issue 421: Reuse XML ActiveX object on Internet Explorer
  // http://code.google.com/p/svgweb/issues/detail?id=421
  var cachedXML = parseXMLCache[preserveWhiteSpace + xml];
  if (cachedXML) {
    return cachedXML.cloneNode(true);
  }
    
  var xmlDoc;
  if (hasDOMParser) { // non-IE browsers
    // parse the SVG using an XML parser
    var parser = new DOMParser();
    try { 
      xmlDoc = parser.parseFromString(xml, 'application/xml');
    } catch (e) {
      throw e;
    }
    
    var root = xmlDoc.documentElement;
    if (root.nodeName == 'parsererror') {
      throw new Error('There is a bug in your SVG: '
                      + (hasXMLSerializer ? (new XMLSerializer().serializeToString(root)) : root.xml));
    }
  } else { // IE
    // only use the following two MSXML parsers:
    // http://blogs.msdn.com/xmlteam/archive/2006/10/23/using-the-right-version-of-msxml-in-internet-explorer.aspx
    var versions = [ 'Msxml2.DOMDocument.6.0', 'Msxml2.DOMDocument.3.0' ];
    
    var xmlDoc;
    for (var i = 0; i < versions.length; i++) {
      try {
        xmlDoc = new ActiveXObject(versions[i]);
        if (xmlDoc) {
          break;
        }
      } catch (e) {}
    }
    
    if (!xmlDoc) {
      throw new Error('Unable to instantiate XML parser');
    }
    
    try {
      xmlDoc.preserveWhiteSpace = preserveWhiteSpace;
      // IE will attempt to resolve external DTDs (i.e. the SVG DTD) unless 
      // we add the following two flags
      xmlDoc.resolveExternals = false;
      xmlDoc.validateOnParse = false;
      // MSXML 6 breaking change (Issue 138):
      // http://code.google.com/p/sgweb/issues/detail?id=138
      xmlDoc.setProperty('ProhibitDTD', false);
      xmlDoc.async = 'false';
      
      var successful = xmlDoc.loadXML(xml);
      
      if (!successful || xmlDoc.parseError.errorCode !== 0) {
        throw new Error(xmlDoc.parseError.reason);
      }
    } catch (e) {
      console.log(e.message);
      throw new Error('Unable to parse SVG: ' + e.message);
    }
  }
  
  // cache parsed XML to speed up performance (Issue 421)
  try {
    parseXMLCache[preserveWhiteSpace + xml] = xmlDoc.cloneNode(true);
  } catch (e) {
    // Opera at v10.10 cannot clone a Document
  }
  
  return xmlDoc;
}

/** Transforms the given node and all of its children into an XML string,
    suitable for us to send over to Flash for adding to the document. 
    
    @param node Either a real DOM node to turn into a string or one of our
    fake _Node or _Elements.
    @param namespaces Optional. A namespace lookup table that we will use to 
    add our namespace declarations onto the serialized XML.
    
    @returns XML String suitable for sending to Flash. */
function xmlToStr(node, namespaces) {
  var nodeXML = (node._nodeXML || node);
  var xml;
  
  if (hasXMLSerializer) { // non-IE browsers
    xml = (new XMLSerializer().serializeToString(nodeXML));
  } else {
    if (nodeXML.xml) {
      xml = nodeXML.xml;
    } else if (typeof (XMLSerializer) != 'undefined') {
      // This handles IE 9 with a native SVG element, not an
      // MSXML node. We need to serialize with XMLSerializer.
      // Remember, we are stll using MSXML for IE 9 because
      // DOMParser/XMLSerializer was not working in all cases.
      xml = (new XMLSerializer().serializeToString(nodeXML));
    }
  }
  
  // Firefox and Safari will incorrectly turn our internal parsed XML
  // for the Flash Handler into actual SVG nodes, causing issues. We added
  // a fake SVG namespace earlier to prevent this from happening; remove that
  // now
  xml = xml.replace(/urn\:__fake__internal__namespace/g, svgns);
  
  // add our namespace declarations
  var nsString = '';
  if (xml.indexOf('xmlns=') == -1) {
    nsString = 'xmlns="' + svgns + '" ';
  }
  if (namespaces) {
    for (var i = 0; i < namespaces.length; i++) {
      var uri = namespaces[i];
      var prefix = namespaces['_' + uri];
    
      // ignore our fake SVG namespace string
      if (uri == svgnsFake) {
        uri = svgns;
      }
    
      var newNS;
      if (prefix != 'xmlns') {
        newNS = 'xmlns:' + prefix + '="' + uri + '"';
      } else {
        newNS = 'xmlns' + '="' + uri + '"';
      }
      
      // FIXME: Will this break if single quotes are used around namespace
      // declaration?
      if (xml.indexOf(newNS) == -1) {
        nsString += newNS + ' ';
      }
    }
  }

  xml = xml.replace(/<([^ ]+) /, '<$1 ' + nsString);
  
  return xml;
}

/*
  Useful for closures and event handlers. Instead of having to do
  this:
  
  var self = this;
  window.onload = function(){
      self.init();
  }
  
  you can do this:
  
  window.onload = hitch(this, 'init');
  
  @param context The instance to bind this method to.
  @param method A string method name or function object to run on context.
*/
function hitch(context, method) {
  if (typeof method == 'string') {
    method = context[method];
  }
  
  // this method shows up in the style string on IE's HTC object since we
  // use it to extend the HTC element's style object with methods like
  // item(), setProperty(), etc., so we want to keep it short. The performance
  // of an HTC/Microsoft Behavior is very sensitive to the length of its
  // JavaScript methods so we want to keep them short.
  return function() { return method.apply(context, (arguments.length) ? arguments : []); };
}

/* 
  Internet Explorer's list of standard XHR PROGIDS. 
*/
var XHR_PROGIDS = [
  'MSXML2.XMLHTTP.6.0', 'MSXML2.XMLHTTP.3.0', 'MSXML2.XMLHTTP',
  'Microsoft.XMLHTTP'
];

/*
  Standard way to grab XMLHttpRequest object.
*/
function xhrObj() {
  if (typeof XMLHttpRequest != 'undefined') {
    return new XMLHttpRequest();
  } else if (ActiveXObject) {
    var xhr = null;
    var i; // save the good PROGID for quicker access next time
    for (i = 0; i < XHR_PROGIDS.length && !xhr; ++i) {
      try {
        xhr = new ActiveXObject(XHR_PROGIDS[i]);
      } catch(e) {}
    }

    if (!xhr) {
      throw new Error('XMLHttpRequest object not available on this platform');
    }

    return xhr;
  }
}

// We just use an autoincrement counter to ensure uniqueness for our node 
// tracking, which is fine for our situation and produces much smaller GUIDs;
// GUIDs are used to track individual SVG nodes between our JavaScript and
// Flash.
var guidCounter = 0;
function guid() {
  return '_' + guidCounter++;
}


/** 
  Our singleton object that acts as the primary entry point for the library. 
  Gets exposed globally as 'svgweb'.
*/
function SVGWeb() {
  //start('SVGWeb_constructor');
  // is SVG Web being hosted cross-domain?
  this._setXDomain();
  
  // grab any configuration that might exist on where our library resources
  // are
  this.libraryPath = this._getLibraryPath();
  
  // see if there is an optional HTC filename being used, such as svg-htc.php;
  // these are used to have the server automatically send the correct MIME
  // type for HTC files without having to fiddle with MIME type settings
  this.htcFilename = this._getHTCFilename();
  
  // prepare IE by inserting special markup into the page to have the HTC
  // be available
  if (isIE && !Object.defineProperty) {
    FlashHandler._prepareBehavior(this.libraryPath, this.htcFilename);
  }
  
  // make sure we can intercept onload listener registration to delay onload 
  // until we are done with our internal machinery
  this._interceptOnloadListeners();
  
  // wait for our page's DOM content to be available
  this._initDOMContentLoaded();
  //end('SVGWeb_constructor');
}

extend(SVGWeb, {
  // path to find library resources
  libraryPath: './',
  // RenderConfig object of which renderer (native or Flash) to use
  config: null,
  pageLoaded: false,
  handlers: [],
  totalLoaded: 0,
  
  /** Every element (including text nodes) has a unique GUID. This lookup
      table allows us to go from a GUID taken from an XML node to a fake 
      node (_Element or _Node) that might have been instantiated already. */
  _guidLookup: [],
  
  /** Onload page load listeners. */
  _loadListeners: [],
  
  /** A data structure that we used to keep track of removed nodes, necessary
      so we can clean things up and prevent memory leaks on IE on page unload.
      Unfortunately we have to keep track of this at the global 'svgweb'
      level rather than on individual handlers because a removed node
      might have never been associated with a real DOM or a real handler. */
  _removedNodes: [],

  /** Used to lookup namespaces **/
  _allSVGNamespaces: [],
  
  /** Adds an event listener to know when both the page, the internal SVG
      machinery, and any SVG SCRIPTS or OBJECTS are finished loading.
      
      @param listener Function that will get called when page and all
      embedded SVG is loaded and rendered.
      @param fromObject Optional. If true, then we are calling this from
      inside an SVG OBJECT file.
      @param objectWindow Optional. Provided when called from inside an SVG
      OBJECT file; this is the window object inside the SVG OBJECT. */
  addOnLoad: function(listener, fromObject, objectWindow) {
    if (fromObject) { // addOnLoad called from an SVG file embedded with OBJECT
      var obj;
      if (objectWindow.frameElement) {
        obj = objectWindow.frameElement;
      } else {
        // IE 9 does not appear to support frameElement for svg object elements
        var h;
        for (h=0; h < this.handlers.length; h++) {
          if (this.handlers[h]._objNode &&
              this.handlers[h]._objNode.contentDocument &&
              this.handlers[h]._objNode.contentDocument.defaultView == objectWindow) {
            obj =  this.handlers[h]._objNode;
          }
        }
      }
      
      // if we are being called from an SVG OBJECT tag and are the Flash
      // renderer than just execute the onload listener now since we know
      // the SVG file is done rendering.
      if (fromObject && this.getHandlerType() == 'flash') {
        listener.apply(objectWindow);
      } else {
        // NOTE: some browsers will fire the onload of the SVG file _before_ our
        // NativeHandler is done (Firefox); others will do it the opposite way
        // (Safari). We set variables pointing between the OBJECT and its
        // NativeHandler to handle this.
        if (obj._svgHandler) { // NativeHandler already constructed
          obj._svgHandler._onObjectLoad(listener, objectWindow);
        } else {
          // NativeHandler not constructed yet; store a reference for later
          // handling
          obj._svgWindow = objectWindow;
          obj._svgFunc = listener;
        }
      }
    } else { // normal addOnLoad request from containing HTML page
      this._loadListeners.push(listener);
    }
    
    // fire the onsvgload event immediately if the page was done
    // loading earlier
    if (this.pageLoaded) {
      this._fireOnLoad();
    }
  },
  
  /** Returns a string for the given handler for this platform, 'flash' if
      flash is being used or 'native' if the native capabilities are being
      used. */
  getHandlerType: function() {
    if (this.renderer == FlashHandler) {
      return 'flash';
    } else if (this.renderer == NativeHandler) {
      return 'native';
    }
  },
  
  /** Appends a dynamically created SVG OBJECT or SVG root to the page.
      See the section "Dynamically Creating and Removing SVG OBJECTs and 
      SVG Roots" in the User Guide for details.
      
      @node Either an 'object' created with 
      document.createElement('object', true) or an SVG root created with
      document.createElementNS(svgns, 'svg')
      @parent An HTML DOM parent to attach our SVG OBJECT or SVG root to.
      This DOM parent must already be attached to the visible DOM. */
  appendChild: function(node, parent) {
    //console.log('appendChild, node='+node+', parent='+parent);
    if (node.nodeName.toLowerCase() == 'object'
        && node.getAttribute('type') == 'image/svg+xml') {
      // dynamically created OBJECT tag for an SVG file
      this.totalSVG++;
      this._svgObjects.push(node);
      
      if (this.getHandlerType() == 'native') {
        node.onload = node.onsvgload;
        parent.appendChild(node);
      }
      
      var placeHolder = node;
      if (this.getHandlerType() == 'flash') {
        // register onloads
        if (node.onsvgload) {
          node.addEventListener('SVGLoad', node.onsvgload, false);
        }
        
        // Turn our OBJECT into a place-holder DIV attached to the DOM, 
        // copying over our properties; this will get replaced by the 
        // Flash OBJECT. We need to do this because we need a real element
        // in the DOM to 'replace' later on for IE which uses outerHTML, 
        // and the DIV will act as that place-holder element.
        var div = document._createElement('div');
        for (var j = 0; j < node.attributes.length; j++) {
          var attr = node.attributes[j];
          var attrName = attr.nodeName;
          var attrValue = attr.nodeValue;
          
          // trim out 'empty' attributes with no value
          if (!attrValue && attrValue !== 'true') {
            continue;
          }
          
          div.setAttribute(attrName, attrValue);
        }

        parent.appendChild(div);

        // copy over internal event listener info
        div._onloadListeners = node._onloadListeners;
        
        placeHolder = div;
      }
              
      // now handle this SVG OBJECT
      var objID = this._processSVGObject(placeHolder);
      
      // add the ID to our original SVG OBJECT node as a private member;
      // we will later use this if svgweb.removeChild is called to remove
      // the node in order to remove the SVG OBJECT from our
      // handler._svgObjects array
      node._objID = objID;
    } else if (node.nodeName.toLowerCase() == 'svg') {
      // dynamic SVG root
      this.totalSVG++;
      
      // copy over any node.onsvgload listener
      if (node.onsvgload) {
        node.addEventListener('SVGLoad', node.onsvgload, false);
      }
      
      if (isIE && node._fakeNode) {
        node = node._fakeNode;
      }
      
      // serialize SVG into a string
      var svgStr = xmlToStr(node);
      
      // nest the SVG into a SCRIPT tag and add to the page; we do this
      // so that we hit the same code path for dynamic SVG roots as you would
      // get if the SCRIPT + SVG were already in the page on page load
      var svgScript = document.createElement('script');
      svgScript.type = 'image/svg+xml';
      if (!isXHTML) { 
        try {
          svgScript.appendChild(document.createTextNode(svgStr));
        } catch (ex) {
          // NOTE: only script.text works for IE; other ways of changing value
          // throws 'Unknown Runtime Error' on that wonderful browser
          svgScript.text = svgStr;
        }
      } else { // XHTML; no innerHTML here
        svgScript.appendChild(document.createTextNode(svgStr));
      }
      this._svgScripts.push(svgScript);
      parent.appendChild(svgScript);
      
      // preserve our SVGLoad addEventListeners on the script object
      svgScript._onloadListeners = node._detachedListeners /* flash renderer */
                                      || node._onloadListeners /* native */;
      
      // now process the SVG as we would normal SVG embedded into the page
      // with a SCRIPT tag
      this._processSVGScript(svgScript);
    }
  },
  
  /** Removes a dynamically created SVG OBJECT or SVG root to the page.
      See the section "Dynamically Creating and Removing SVG OBJECTs and 
      SVG Roots" for details.
      
      @node OBJECT or EMBED tag for the SVG OBJECT to remove.
      @parent The parent of the node to remove. */
  removeChild: function(node, parent) {
    //console.log('svgweb.removeChild, node='+node.nodeName+', parent='+parent.nodeName);
    var name = node.nodeName.toLowerCase();

    var nodeID, nodeHandler;
    
    if (name == 'object' || name == 'embed' || name == 'svg') {
      this.totalSVG = this.totalSVG == 0 ? 0 : this.totalSVG - 1;
      this.totalLoaded = this.totalLoaded == 0 ? 0 : this.totalLoaded - 1;
      
      // remove from our list of handlers
      nodeID = node.id;
      nodeHandler = this.handlers[nodeID];
      var newHandlers = [];
      for (var i = 0; i < this.handlers.length; i++) {
        var currentHandler = this.handlers[i];
        if (currentHandler != nodeHandler) {
          newHandlers[currentHandler.id] = currentHandler;
          newHandlers.push(currentHandler);
        } 
      }
      this.handlers = newHandlers;
    }
    
    if (name == 'object' || name == 'embed') {
      // nodeHandler might not have a fake 'document' object; this can happen
      // if loading of the SVG OBJECT is 'interrupted' by a rapid removeChild
      // before it ever had a chance to even finish loading. If there is no
      // fake document then skip trying to remove timing functions and event
      // handlers below
      if (this.getHandlerType() == 'flash' 
          && nodeHandler.document
          && nodeHandler.document.defaultView) {
        // remove any setTimeout or setInterval functions that might have
        // been registered inside this object; see _SVGWindow.setTimeout
        // for details
        var iframeWin = nodeHandler.document.defaultView;
        if (iframeWin._intervalIDs) {
          for (var i = 0; i < iframeWin._intervalIDs.length; i++) {
            iframeWin.clearInterval(iframeWin._intervalIDs[i]);
          }
        }
        if (iframeWin._timeoutIDs) {
          for (var i = 0; i < iframeWin._timeoutIDs.length; i++) {
            iframeWin.clearTimeout(iframeWin._timeoutIDs[i]);
          }
        }
      
        // remove keyboard event handlers; we added a record of these for
        // exactly this reason in _Node.addEventListener()
        for (var i = 0; i < nodeHandler._keyboardListeners.length; i++) {
          var l = nodeHandler._keyboardListeners[i];
          if (isIE) {
            document.detachEvent('onkeydown', l);
            document.detachEvent('onkeyup', l);
          } else {
            // we aren't sure whether the event listener is a useCapture or
            // not; just try to remove both
            document.removeEventListener('keydown', l, true);
            document.removeEventListener('keydown', l, false);
            document.removeEventListener('keyup', l, true);
            document.removeEventListener('keyup', l, false);
          }
        }
      }
      
      // remove the original SVG OBJECT node from our handlers._svgObjects
      // array
      var objID;
      if (typeof node._objID != 'undefined') { // native handler
        objID = node._objID;
      } else if (typeof node.contentDocument != 'undefined') { // IE
        // node is a Flash node; get a reference to our fake _Document
        // and then use that to get our Flash Handler
        objID = node.contentDocument._handler.id;
      } else {
        objID = node._handler.id;
      }
      for (var i = 0; i < svgweb._svgObjects.length; i++) {
        if (svgweb._svgObjects[i]._objID === objID) {
          svgweb._svgObjects.splice(i, 1);
          break;
        }
      }
      
      // remove from the page
      parent.removeChild(node);

      if (this.getHandlerType() == 'flash') {
        // delete the HTC container and all HTC nodes that belong to this
        // SVG OBJECT
        var container = document.getElementById('__htc_container');
        if (container) {
          for (var i = 0; i < container.childNodes.length; i++) {
            var child = container.childNodes[i];
            if (typeof child.ownerDocument != 'undefined'
                && child.ownerDocument == nodeHandler._svgObject.document) {
              if (typeof child._fakeNode != 'undefined'
                  && typeof child._fakeNode._htcNode != 'undefined') {
                child._fakeNode._htcNode = null;
              }
              child._fakeNode = null;
              child._handler = null;
              container.removeChild(child);
            }
          }
        }

        // clear out the guidLookup table for nodes that belong to this
        // SVG OBJECT
        for (var guid in svgweb._guidLookup) {
          var child = svgweb._guidLookup[guid];
          if (child._fake && child.ownerDocument === nodeHandler.document) {
            delete svgweb._guidLookup[guid];
          }
        }

        // remove various properties to prevent IE memory leaks
        nodeHandler.flash.contentDocument = null;
        nodeHandler.flash = null;
        nodeHandler._xml = null;
        // nodeHandler.window might not be present if this SVG OBJECT is being
        // removed before it was even finished loading
        if (nodeHandler.window) {
          nodeHandler.window._scope = null;
          nodeHandler.window = null;
        }

        var svgObj = nodeHandler._svgObject;
        var svgDoc = svgObj.document;
        svgDoc._nodeById = null;
        svgDoc._xml = null;
        svgDoc.defaultView = null;
        svgDoc.documentElement = null;
        svgDoc.rootElement = null;
        svgDoc.defaultView = null;
        svgDoc = null;  
        svgObj._svgNode = null;
        svgObj._handler = null;

        if (iframeWin) {
          iframeWin._setTimeout = null;
          iframeWin.setTimeout = null;
          iframeWin._setInterval = null;
          iframeWin.setInterval = null;
        }

        nodeHandler._svgObject = null;
        svgObj = null;
        nodeHandler = null;
        iframeWin = null;
      } // end if (this.getHandlerType() == 'flash')
    } else if (name == 'svg') {
      // dynamicly created SVG roots
      
      // remove the original SVG SCRIPT node from our handlers._svgScripts
      // array
      for (var i = 0; i < svgweb._svgScripts.length; i++) {
        if (svgweb._svgScripts[i] == nodeHandler._scriptNode) {
          svgweb._svgScripts.splice(i, 1);
          break;
        }
      }
      
      if (isIE && this.getHandlerType() == 'flash' && node._fakeNode) {
        node = node._fakeNode;
      }
      
      // remove from the page
      var removeMe;
      if (this.getHandlerType() == 'native') {
        removeMe = node;
      } else {
        removeMe = node._handler.flash;
      }
      // IE will sometimes throw an exception if we don't do this on a timeout
      if (!isIE) {
        parent.removeChild(removeMe);
      } else {
        // FIXME: Analyze whether this will sometimes lead to race conditions;
        // I haven't found any and could not find another workaround on IE
        window.setTimeout(
          function(parent, removeMe) {
            return function() { 
              parent.removeChild(removeMe);
              // IE memory leaks
              parent = null;
              removeMe = null;
            }
          }(parent, removeMe) /* prevent IE closure memory leaks */, 1);
      }
      
      if (this.getHandlerType() == 'flash') {
        // indicate we are unattached
        node._setUnattached();
        
        // clear out the guidLookup table for nodes that belong to this
        // SVG root
        for (var guid in svgweb._guidLookup) {
          var child = svgweb._guidLookup[guid];
          if (child._fake && child._getFakeNode() === nodeHandler) {
            delete svgweb._guidLookup[guid];
          }
        }

        // remove various properties to prevent IE memory leaks
        nodeHandler._scriptNode = null;
        nodeHandler.flash.documentElement = null;
        nodeHandler.flash = null;
        nodeHandler._xml = null;
        nodeHandler = null;
      } // end if (this.getHandlerType() == 'flash')
    }
  },
  
  /** Sets up an onContentLoaded listener */
  _initDOMContentLoaded: function() {
    // code adapted from Dean Edwards/Matthias Miller/John Resig/others
  
    var self = this;
    if (document.addEventListener) {
      // DOMContentLoaded natively supported on Opera 9/Mozilla/Safari 3
      document.addEventListener('DOMContentLoaded', function() {
        self._onDOMContentLoaded();
      }, false);
    } else { // Internet Explorer
      // id is set to be __ie__svg__onload rather than __ie_onload so
      // we don't have name collisions with other scripts using this
      // code as well
      document.write('<script id="__ie__svg__onload" defer '
                      + 'src=//0><\/script>');
      var script = document.getElementById('__ie__svg__onload');
      script.onreadystatechange = function() {
        if (this.readyState == 'complete') {
          // all the DOM content is finished loading -- continue our internal
          // execution now
          self._onDOMContentLoaded();
        }
      }
      
      // needed to intercept window.onload when page loaded first time
      // (i.e. not in cache); see details above in script.onreadystatechange
      var documentReady = function() {
        if (window.onload) {
          self._saveWindowOnload();
          document.detachEvent('onreadystatechange', documentReady);
        }
      };
      document.attachEvent('onreadystatechange', documentReady);
    }
  },
  
  /** Determines whether SVG Web is being hosted cross-domain (Issue 285,
      "For Wikipedia: Be able to host bulk of SVG Web on a different domain",
      http://code.google.com/p/svgweb/issues/detail?id=285). We determine
      this by seeing if the svg.js or svg-uncompressed.js files are being
      hosted on a different domain than the current page. */
  _setXDomain: function() {
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      if (/svg(?:\-uncompressed)?\.js/.test(scripts[i].src)
          && /^https?/.test(scripts[i].src)) {
        // strip out svg.js filename
        var url = scripts[i].src.replace(/svg(?:\-uncompressed)?\.js/, '');
        
        // get just protocol/hostname/port portion
        var loc = url.match(/https?\:\/\/[^\/]*/)[0];
        
        // get the protocol/hostname/port portion of our current web page
        var ourLoc = window.location.protocol.replace(/:|\//g, '') + '://' 
                     + window.location.host;
      
        // are they different?
        if (loc != ourLoc) {
          this.xDomainURL = url;
          this._isXDomain = true;
          return;
        }
      }
    }
    
    this._isXDomain = false;
  },
  
  /** Gets any data-path value that might exist on the SCRIPT tag
      that pulls in our svg.js or svg-uncompressed.js library to configure 
      where to find library resources like SWF files, HTC files, etc. 
      You can also use a META tag with the name 'svg.config.data-path'
      and the content property set to the data path. */
  _getLibraryPath: function() {
    // determine the path to our HTC and Flash files
    var libraryPath = null;
    
    var meta = document.getElementsByTagName('meta');
    for (var i = 0; i < meta.length; i++) {
      if (meta[i].name == 'svg.config.data-path'
          && meta[i].content.length > 0) {
        libraryPath = meta[i].content;
      }
    }
    
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      if (/svg(?:\-uncompressed)?\.js/.test(scripts[i].src)) {
        if (scripts[i].getAttribute('data-path')) {
          libraryPath = scripts[i].getAttribute('data-path');
        } else if (libraryPath === null) {
          var fullPath = scripts[i].getAttribute('src');
          var parts = fullPath.split('/');
          parts.length = parts.length - 1;
          libraryPath = parts.join('/');
        }
        break;
      }
    }

    if (libraryPath === null) {
        libraryPath = './';
    }
    
    if (libraryPath.charAt(libraryPath.length - 1) != '/') {
      libraryPath += '/';
    }
    
    return libraryPath;
  },
  
  /** Gets an optional data-htc-filename value that might exist on the SCRIPT
      tag. If present, this holds a different filename for where to grab the
      HTC file from, such as svg-htc.php or svg-htc.asp. This is a trick to
      help support those in environments where they can't manually add new
      MIME types, so we have an ASP, JSP, or PHP file set the MIME type for the
      HTC file automatically. */
  _getHTCFilename: function() {
    var htcFilename = 'svg.htc';
    
    // see if one of our three predefined file names is given in the query
    // string as the query parameter 'svg.htcFilename'; we do whitelisting 
    // rather than directly copying this value in to prevent XSS attacks
    var loc = window.location.toString();
    if (loc.indexOf('svg.htcFilename=svg-htc.php') != -1) {
      return 'svg-htc.php';
    } else if (loc.indexOf('svg.htcFilename=svg-htc.jsp') != -1) {
      return 'svg-htc.jsp';
    } else if (loc.indexOf('svg.htcFilename=svg-htc.asp') != -1) {
      return 'svg-htc.asp';
    }
    
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      if (/svg(?:\-uncompressed)?\.js/.test(scripts[i].src)
          && scripts[i].getAttribute('data-htc-filename')) {
        htcFilename = scripts[i].getAttribute('data-htc-filename');
        break;
      }
    }
    
    return htcFilename;
  },
  
  /** Fires when the DOM content of the page is ready to be worked with. */
  _onDOMContentLoaded: function() {
    //console.log('onDOMContentLoaded');
    //start('DOMContentLoaded');
    
    // quit if this function has already been called
    if (arguments.callee.done) {
      return;
    }
    
    // flag this function so we don't do the same thing twice
    arguments.callee.done = true;
    
    // start tracking total startup time
    this._startTime = new Date().getTime();
    
    // cleanup onDOMContentLoaded handler to prevent memory leaks on IE
    var listener = document.getElementById('__ie__svg__onload');
    if (listener) {
      listener.parentNode.removeChild(listener);
      listener.onreadystatechange = null;
      listener = null;
    }
    
    // save any window.onsvgload listener that might be present
    this._saveWindowOnload();
    
    // determine what renderers (native or Flash) to use for which browsers
    this.config = new RenderConfig();
    
    // sign up for the onunload event on IE to clean up references that
    // can cause memory leaks
    if (isIE) {
      this._watchUnload();
    }

    // extract any SVG SCRIPTs or OBJECTs from the page
    this._svgScripts = this._getSVGScripts();
    this._svgObjects = this._getSVGObjects();

    this.totalSVG = this._svgScripts.length + this._svgObjects.length;
    
    // do various things we must do early on in the page load process
    // around cleaning up SVG OBJECTs on the page
    this._cleanupSVGObjects();
    
    // handle a peculiarity for Safari (see method for details)
    this._handleHTMLTitleBug();
    
    // see if we can even support SVG in any way
    if (!this.config.supported) {
      // no ability to use SVG in any way
      this._displayNotSupported(this.config.reason);
      this._fireOnLoad();
      return;
    }
    
    // setup which renderer we will use
    if (this.config.use == 'flash') {
      this.renderer = FlashHandler;
    } else if (this.config.use == 'native') {
      this.renderer = NativeHandler;
    }
    
    // patch the document and style objects with bug fixes for the 
    // NativeHandler and actual implementations for the FlashHandler
    this.renderer._patchBrowserObjects(window, document);

    // Issue 573: Unless we keep this reference, IE 9 seems to garbage collect
    // the 'document' object and the patches to it are lost.
    this.renderer.documentRef = document;

    // there may be objects added later, so add our resize listener before
    // checking for whether there is any SVG content
    if (this.config.use == 'flash') {
      // Attach window resize listener to adjust SVG size when % is used
      // on the SVG width and height
      this._createResizeListener();
      this._attachResizeListener();
    }
    
    // no SVG - we're done
    if (this.totalSVG === 0) {
      this._fireOnLoad();
      return;
    }
  
    // now process each of the SVG SCRIPTs and SVG OBJECTs
    var self = this;
    for (var i = 0; i < this._svgScripts.length; i++) {
      this._processSVGScript(this._svgScripts[i]);
    }
    
    for (var i = 0; i < this._svgObjects.length; i++) {
      var objID = this._processSVGObject(this._svgObjects[i]);
      
      // add the ID to our original SVG OBJECT node as a private member;
      // we will later use this if svgweb.removeChild is called to remove
      // the node in order to remove the SVG OBJECT from our
      // handler._svgObjects array
      this._svgObjects[i]._objID = objID;
    }
    //end('DOMContentLoaded');
    
    // wait until all of them have done their work, then fire onload
  },

  _createResizeListener: function() {
    var self = this;
    if (isIE) {
      this._resizeFunc =
          (function(self) {
            return function() {
              self._onWindowResize();
            };
          })(this); // prevent IE memory leaks
    } else {
      this._resizeFunc = hitch(this, function() {
          this._onWindowResize();
      });
    }
  },

  _attachResizeListener: function() {
    if (isIE) {
      window.attachEvent('onresize', this._resizeFunc);
    } else {
      window.addEventListener('resize', this._resizeFunc, false);
    }
  },

  _detachResizeListener: function() {
    if (isIE) {
      window.detachEvent('onresize', this._resizeFunc);
    } else {
      window.removeEventListener('resize', this._resizeFunc, false);
    }  
  },

  _onWindowResize: function() {
    if (!this.pageLoaded) {
      return;
    }
    this._detachResizeListener();
    for (var i = 0; i < this.handlers.length; i++) {
      var handler = this.handlers[i];
      if (!handler._inserter || !handler.flash || !handler._loaded) {
        // Flash still being rendered
        continue;
      }
      
      var size = handler._inserter._determineSize();
      //console.log("svg #"+i+": flash resize: " 
      //            + size.width + "," + size.height + " "
      //            + size.pixelsWidth + "," + size.pixelsHeight);
      handler.flash.width = size.width;
      handler.flash.height = size.height;
      handler.sendToFlash('jsHandleResize',
                          [ /* objectWidth */ size.pixelsWidth,
                            /* objectHeight */ size.pixelsHeight ]);
    }
    this._attachResizeListener();
  },
  
  /** Gets any SVG SCRIPT blocks on the page. */
  _getSVGScripts: function() {
    var scripts = document.getElementsByTagName('script');
    var results = [];
    for (var i = 0; i < scripts.length; i++) {
      if (scripts[i].type == 'image/svg+xml') {
        results.push(scripts[i]);
      }
    }
    
    return results;
  },

  /** Gets any SVG OBJECTs on the page. */
  _getSVGObjects: function() {
    // Note for IE: Unfortunately we have to use @classid to carry our MIME 
    // type instead of @type for IE. Here's why: on IE, you must have 
    // either @classid or @type present on your OBJECT tag. If there is 
    // _any_ fallback content inside of the OBJECT tag, IE will erase the 
    // OBJECT from the DOM and replace it with the fallback content if the 
    // @type attribute is set to an unknown MIME type; this makes it 
    // impossible for us to then get the OBJECT from the DOM below. If we 
    // don't have a @classid this will also happen, so we just set it to 
    // the string 'image/svg+xml' which is arbitrary. If both @type and 
    // @classid are present, IE will still look at the type first and 
    // repeat the same incorrect fallback behavior for our purposes.
    var objs = document.getElementsByTagName('object');
    var results = [];
    for (var i = 0; i < objs.length; i++) {
      if (objs[i].getAttribute('classid') == 'image/svg+xml') {
        results.push(objs[i]);
      } else if (objs[i].getAttribute('type') == 'image/svg+xml') {
        results.push(objs[i]);
      }
    }
    
    return results;
  },
  
  /** Displays not supported messages. 
  
      @param reason String containing why this browser is not supported. */
  _displayNotSupported: function(reason) {
    // write the reason into the OBJECT tags if nothing is already present
    for (var i = 0; i < this._svgObjects.length; i++) {
      var obj = this._svgObjects[i];
      // ignore whitespace children
      if (!obj.childNodes.length || 
          (obj.childNodes.length == 1 && obj.childNodes[0].nodeType == 3
            && /^[ ]*$/m.test(obj.childNodes[0].nodeValue))) {
        var span = document.createElement('span');
        span.className = 'svg-noscript';
        span.appendChild(document.createTextNode(reason));
        obj.parentNode.replaceChild(span, obj);
      }
    }
    
    // surface any adjacent NOSCRIPTs that might be adjacent to our SVG
    // SCRIPTs; if none present, write out our reason
    for (var i = 0; i < this._svgScripts.length; i++) {
      var script = this._svgScripts[i];
      var output = document.createElement('span');
      output.className = 'svg-noscript';
      
      var sibling = script.nextSibling;
      // jump past everything until we hit our first Element
      while (sibling && sibling.nodeType != 1) {
        sibling = sibling.nextSibling;
      }
      
      if (sibling && sibling.nodeName.toLowerCase() == 'noscript') {
        var noscript = sibling;
        output.innerHTML = noscript.innerHTML;
      } else {
        output.appendChild(document.createTextNode(reason));
      }
      
      script.parentNode.insertBefore(output, script);
    }
  },
  
  /** Fires any addOnLoad() listeners that were registered by a developer. */
  _fireOnLoad: function() {
    //console.log('svgweb._fireOnLoad');
    // see if all SVG OBJECTs are done loading; if so, fire final onload
    // event for any externally registered SVG
    if (this.handlers.length < this._svgObjects.length) {
      // not even done constructing all our Native Handlers yet
      return;
    }

    var allLoaded = true;
    for (var i = 0; i < this.handlers.length; i++) {
      var h = this.handlers[i];
      if (!h._loaded) {
        allLoaded = false;
        break;
      }
    }

    if (!allLoaded) {
      return;
    }

    // the page is truly finished loading
    this.pageLoaded = true;
    
    // report total startup time
    this._endTime = new Date().getTime();
    // FIXME: Get these times to be more accurate; I think they are off
    //console.log('Total JS plus Flash startup time: ' 
    //                + (this._endTime - this._startTime) + 'ms');
    
    if (this._loadListeners.length) {
      // we do a slight timeout so that if exceptions get thrown inside the
      // developers onload methods they will correctly show up and get reported
      // to the developer; otherwise since the fireOnLoad method is called 
      // from Flash and an exception gets called it can get 'squelched'
      var self = this;
      window.setTimeout(function() {
        //console.log('svgweb._fireOnLoad timeout');
        // make a copy of our listeners and then clear them out _before_ looping
        // and calling each one; this is to handle the following edge condition: 
        // one of the listeners might dynamically create an SVG OBJECT _inside_ 
        // of it, which would then add a new listener, and we would then 
        // incorrectly get it in our list of listeners as we loop below!
        var listeners = self._loadListeners;
        self._loadListeners = [];
        this.totalLoaded = 0;
        for (var i = 0; i < listeners.length; i++) {
          try {
            listeners[i]();
          } catch (exp) {
            console.log('Error while firing onload: ' + (exp.message || exp));
          }
        }
      }, 1);
    }
  },
  
  /** Cleans up some SVG in various ways (adding IDs, etc.)
  
      @param svg SVG string to clean up.
      @param addMissing If true, we add missing
      XML doctypes, SVG namespace, etc. to make working with SVG a bit easier
      when doing direct embed; if false, we require the XML to be
      well-formed and correct (primarily for independent .svg files). 
      @param normalizeWhitespace If true, we try to remove whitespace between 
      nodes to make the DOM more similar to Internet Explorer's 
      ignoreWhiteSpace, mostly used when doing direct embed of SVG into an 
      HTML page; if false, we leave things alone (primarily for independent 
      .svg files). 
      
      @returns Returns an object with two values:
        svg: cleaned up SVG as a String
        xml: parsed SVG as an XML object
  */
  _cleanSVG: function(svg, addMissing, normalizeWhitespace) {
    // if this was directly embedded SVG into a SCRIPT block on an XHTML page,
    // but on IE, then it will be surrounded with a CDATA block; remove this
    if (/^\s*<\!\[CDATA\[/.test(svg)) {
      svg = svg.replace(/^\s*<\!\[CDATA\[/, '');
      svg = svg.replace(/\]\]>\s*/, '');
    }

    // expand ENTITY definitions
    // Issue 221: "DOCTYPE ENTITYs not expanded on certain 
    // browsers (safari, opera)"
    // http://code.google.com/p/svgweb/issues/detail?id=221
    // NOTE: entity expansion is performance sensitive; see 
    // Issue 218 for details 
    // (http://code.google.com/p/svgweb/issues/detail?id=218)
    RegExp.lastIndex = 0;
    var match;
    var entityRE = /<!ENTITY\s+(\S+)\s+"([^"]*)"/g;
    while ((match = entityRE.exec(svg)) != null) {
      var entityName = RegExp.$1;
      var entityValue = RegExp.$2;
      svg = svg.split('&' + entityName + ';').join(entityValue);
    }
    
    if (addMissing) {
      // add any missing things (XML declaration, SVG namespace, etc.)
      if (/\<\?xml/m.test(svg) == false) { // XML declaration
        svg = '<?xml version="1.0"?>\n' + svg;
      }
      // add xlink namespace if it is not present
      // Add the xlink first so that it is not prepended later before the xmlns attr.
      // IE 9 does not tolerate the xlink namespace declaration prior to the
      // xmlns declaration.
      if (/xmlns:[^=]+=['"]http:\/\/www\.w3\.org\/1999\/xlink['"]/.test(svg) == false) {
        svg = svg.replace('<svg', '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
      }
      
      // add SVG namespace declaration
      if (/xmlns\=['"]http:\/\/www\.w3\.org\/2000\/svg['"]/.test(svg) == false) {
        svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      }     
    }
    
    // remove leading whitespace before XML declaration
    if (svg.charAt(0) != '<') {
      svg = svg.replace(/\s*<\?xml/, '<?xml');
    }
    
    if (normalizeWhitespace) {
      // remove whitespace between tags to normalize the DOM between IE
      // and other browsers
      svg = svg.replace(/\>\s+\</gm, '><');
    }
    
    // transform text nodes into 'fake' elements so that we can track them
    // with a GUID
    if (this.renderer == FlashHandler) {
      // strip out <!-- --> style comments; these cause a variety of problems:
      // 1) We don't parse comments into our DOM, 2) when we add our
      // <__text> sections below they can get incorrectly nested into multi
      // line comments; stripping them out is a simple solution for now.
      
      // this is preferable and more readable but most browsers and JavaScript
      // do not support a Single Line Mode (i.e. .* matches everything
      // _including_ new lines)
      //svg = svg.replace(/<!\-\-.*?\-\->/gm, '');
      svg = svg.replace(/<!\-\-[\s\S]*?\-\->/g, '');
      
      // We might have nested <svg> elements; we want to make sure we don't
      // incorrectly think these are SVG root elements. To do this, temporarily
      // rename the SVG root element, then rename nested <svg> root elements
      // to a temporary token that we will restore at the end of this method
      svg = svg.replace(/<svg/, '<SVGROOT'); // root <svg> element
      svg = svg.replace(/<svg/g, '<NESTEDSVG'); // nested <svg>
      svg = svg.replace(/<SVGROOT/, '<svg');
      
      // break SVG string into pieces so that we don't incorrectly add our
      // <__text> fake text nodes outside the SVG root tag
      var separator = svg.match(/<svg/)[0];
      var pieces = svg.split(/<svg/);
      
      // extract CDATA sections temporarily so that we don't end up
      // adding double <__text> blocks
      var hasCData = (pieces[1].indexOf('<![CDATA[') != -1);
      if (hasCData) {
        RegExp.lastIndex = 0; // reset global exec()
        var cdataRE = /<\!\[CDATA\[/g;
        match = cdataRE.exec(pieces[1]);
        var cdataBlocks = [];
        i = 0;
        while (match && RegExp.rightContext) {
          var startIdx = cdataRE.lastIndex - '<![CDATA['.length;
          var context = RegExp.rightContext;
          var endIdx = cdataRE.lastIndex + context.indexOf(']]>') + 2;
          var section = context.substring(0, context.indexOf(']]>'));
        
          // save this CDATA section for later
          section = '<![CDATA[' + section + ']]>';
          cdataBlocks.push(section);
        
          // change the CDATA section into a token that we will replace later
          var before = pieces[1].substring(0, startIdx);
          var after = pieces[1].substring(endIdx + 1, pieces[1].length);
          pieces[1] = before + '__SVG_CDATA_TOKEN_' + i + after;
        
          // find next match
          match = cdataRE.exec(pieces[1]);
          i++;
        }
      }
      
      // capture anything between > and < tags
      pieces[1] = pieces[1].replace(/>([^<]+)</g, '><__text>$1</__text><');
      
      // re-assemble our CDATA blocks
      if (hasCData) {
        for (var i = 0; i < cdataBlocks.length; i++) {
          pieces[1] = pieces[1].replace('__SVG_CDATA_TOKEN_' + i, cdataBlocks[i]);
        }
      }
             
      // paste the pieces back together
      svg = pieces[0] + separator + pieces[1];
      for (var i = 2; i < pieces.length; i++) {
        svg = svg + pieces[i];
      }
    }
    
    // earlier we turned nested <svg> elements into a temporary token; restore
    // them
    svg = svg.replace(/<NESTEDSVG/g, '<svg');
                 
    if (this.renderer == FlashHandler) {
      // handle Flash encoding issues
      svg = FlashHandler._encodeFlashData(svg);
      
      // Firefox and Safari will parse any nodes in the SVG namespace into 'real'
      // SVG nodes when using the Flash handler, which we don't want 
      // (they take up more memory, and can mess up our return results in some 
      // cases). To get around this, we change the SVG namespace in our XML into
      // a temporary different one to prevent this from happening.
      svg = svg.replace(/xmlns(\:[^=]*)?=['"]http\:\/\/www\.w3\.org\/2000\/svg['"]/g, 
                        'xmlns$1="' + svgnsFake + '"');
    }
        
    // add guids and IDs to all elements and get the root SVG elements ID;
    // this also has the side effect of also parsing our SVG into an actual
    // XML tree we can use later; we do it here so that we don't have to
    // parse the XML twice for performance reasons
    var xml = this._addTracking(svg, normalizeWhitespace);
    if (hasXMLSerializer) { // non-IE browsers
      svg = (new XMLSerializer()).serializeToString(xml);
    } else { // IE
      svg = xml.xml;
    }
    
    // remove the fake SVG namespace we added as a workaround right above now 
    // that we are parsed
    if (this.renderer == FlashHandler) {
      svg = svg.replace(new RegExp(svgnsFake, 'g'), svgns);
    }
    
    return {svg: svg, xml: xml};
  },
  
  /** Extracts SVG from the script, cleans it up, adds GUIDs to all elements, 
      and then creates the correct Flash or Native handler to do 
      the hard work. 
      
      @param script SCRIPT node to get the SVG from. */
  _processSVGScript: function(script) {
    //console.log('processSVGScript, script='+script);
    var origSVG;
    if (!isXHTML) {
      origSVG = script.innerHTML;
    } else { // XHTML document
      // Safari/Native has an unusual bug; sometimes, when fetching the
      // SVG text content inside of a SCRIPT tag, it will break it up into
      // multiple CDATA sections, corrupting the source if we fetch it
      // with innerHTML above. Instead loop through and get the CDATA text.
      origSVG = '';
      for (var i = 0; i < script.childNodes.length; i++) {
        origSVG += script.childNodes[i].textContent;
      }
    }

    var results = this._cleanSVG(origSVG, true, true);
    var svg = results.svg;
    var xml = results.xml;
    var rootID = xml.documentElement.getAttribute('id');
    var rootOnload = xml.documentElement.getAttribute('onload');
    if (rootOnload) {
      // turn the textual onload handler into a real function
      var defineEvtCode =
        'var evt = { target: document.getElementById("' + rootID + '") ,' +
                    'currentTarget: document.getElementById("' + rootID + '") ,' +
                    'preventDefault: function() { this.returnValue=false; }' +
                  '};';
      rootOnload = new Function(defineEvtCode + rootOnload);
      
      // return a function that makes the 'this' keyword apply to
      // the SVG root; wrap in another anonymous closure as well to prevent
      // IE memory leaks
      var f = (function(rootOnload, rootID) {
        return function() {
          // get our SVG root so we can set the 'this' reference correctly
          var handler = svgweb.handlers[rootID];
          var root;
          if (svgweb.getHandlerType() == 'flash') {
            root = handler.document.documentElement._getProxyNode();
          } else { // native
            // Safari/Native has a bizarre bug; earlier we save a reference
            // to our handler._svgRoot variable, but it won't match what
            // is returned by document.getElementById(rootID). We use that
            // instead to have correct object identity.
            root = document.getElementById(rootID);
          }

          return rootOnload.apply(root);
        };
      })(rootOnload, rootID);
      
      // add to our list of page-level onload listeners
      this._loadListeners.push(f);
    }
    
    // create the correct handler
    var handler = new this.renderer({type: 'script', 
                                     svgID: rootID,
                                     xml: xml, 
                                     svgString: svg,
                                     origSVG: origSVG,
                                     scriptNode: script});

    // NOTE: FIXME: If someone chooses a rootID that starts with a number
    // this will break
    this.handlers[rootID] = handler;
    this.handlers.push(handler);
    
    // have the handler do its thing
    handler.start();   
  },
  
  /** Extracts or autogenerates an ID for the object and then creates the
      correct Flash or Native handler to do the hard work. 
      
      @returns The ID for the object, either what was specified or what was
      autogenerated. */
  _processSVGObject: function(obj) {
    //console.log('processSVGObject');
    var objID = obj.getAttribute('id');
    // extract an ID from the OBJECT tag; generate a random ID if needed
    if (!objID) {
      obj.setAttribute('id', svgweb._generateID('__svg__random__', '__object'));
      objID = obj.getAttribute('id');
    }

    // create the correct handler
    var handler = new this.renderer({type: 'object', 
                                     objID: objID,
                                     objNode: obj});
                                      
    // NOTE: FIXME: If someone chooses an objID that starts with a number
    // this will break
    this.handlers[objID] = handler;
    this.handlers.push(handler);
    
    // have the handler do its thing
    handler.start();
    
    return objID;
  },
  
  /** Generates a random SVG ID. It is recommended that you use the prefix
      and postfix.
      
      @param prefix An optional string to add to the beginning of the ID.
      @param postfix An optional string to add to the end of the ID. */
  _generateID: function(prefix, postfix) {
    // generate an ID for this element
    if (!postfix) {
      postfix = '';
    }
    
    if (!prefix) {
      prefix = '';
    }
    
    return prefix + guid() + postfix;
  },
  
  /** Walks the SVG DOM, adding automatic generated GUIDs to all elements.
      Generates an ID for the SVG root if one is not present.
      
      @param normalizeWhitespace If true, then when parsing we ignore
      whitespace, acting more like normal HTML; if false, then we keep
      whitespace as independent nodes more like XML.
      @returns Parsed DOM XML Document of the SVG with all elements having 
      an ID and a GUID. */
  _addTracking: function(svg, normalizeWhitespace) {
    var parseWhitespace = !normalizeWhitespace;
                    
    // parse the SVG
    var xmlDoc = parseXML(svg, parseWhitespace);
    var root = xmlDoc.documentElement;
    
    // make sure the root has an ID
    if (root && !root.getAttribute('id')) {
      root.setAttribute('id', this._generateID('__svg__random__', null));
    }
    
    if (this.getHandlerType() != 'flash') {
      return xmlDoc;
    }
    
    // now walk the parsed DOM; we do this iteratively rather than 
    // recursively as this was found to be a performance bottleneck and
    // 'unrolling' the recursive algorithm sped things up.
    var current = root;
    while (current) {
      if (current.nodeType == _Node.ELEMENT_NODE) {
        current.setAttribute('__guid', guid());
      }
      
      if (current.nodeType == _Node.ELEMENT_NODE 
          && !current.getAttribute('id')) {
        // generate a random ID, since the Flash backend needs IDs for certain
        // scenarios (such as tracking dependencies around redraws for USE
        // nodes, for example)
        // FIXME: TODO: can we eliminate having to generate these for all nodes
        // by changing the Flash backend to use GUIDs for these scenarios?
        current.setAttribute('id', svgweb._generateID('__svg__random__', null));
      }
      
      var next = current.firstChild;
      if (next) {
        current = next;
        continue;
      }
      
      while (current) {
        if (current != root) {
          next = current.nextSibling;
          if (next) {
            current = next;
            break;
          }
        }
        if (current == root) {
          current = null;
        } else {
          current = current.parentNode;
          if (current.nodeType != 1) {
            current = null;
          }
        }
      }
    }
    
    return xmlDoc;
  },
  
  /** Called when an SVG SCRIPT or OBJECT is done loading. If we are finished
      loading every SVG item then we fire window onload and also indicate to
      each handler that the page is finished loading so that handlers can
      take further action, such as executing any SVG scripts that might be
      inside of an SVG file loaded in an SVG OBJECT. 
      
      @param ID of either the SVG root element inside of an SVG SCRIPT or 
      the SVG OBJECT that has finished loading.
      @param type Either 'script' for an SVG SCRIPT or 'object' for an
      SVG OBJECT.
      @param handler The Flash or Native Handler that is done loading.
      */
  _handleDone: function(id, type, handler) {
    //console.log('svgweb._handleDone, id='+id+', type='+type);
    this.totalLoaded++;
    
    // fire any onload listeners that were registered with a dynamically
    // created SVG root
    if (type == 'script' && handler._scriptNode._onloadListeners) {
      for (var i = 0; i < handler._scriptNode._onloadListeners.length; i++) {
        var f = handler._scriptNode._onloadListeners[i];
        if (svgweb.getHandlerType() == 'flash') {
          f = f.listener;
        } else {
          // Firefox has a frustrating bug around addEventListener (see
          // NativeHandler._patchAddEventListener for details). Repatch
          // addEventListener on our SVG Root element if our changes have 
          // been lost.
          var methodStr = handler._svgRoot.addEventListener.toString();
          if (methodStr.indexOf('[native code]') != -1) {
            NativeHandler._patchAddEventListener(handler._svgRoot);
          }
        }

        try {
          // every root has an ID, whether autogenerated or not;
          // fetch the root so that our 'this' context correctly
          // points to the root node inside of our onload function
          var root = document.getElementById(handler.id);
          if (isOpera) {
            // Opera 10.53 does not like this thread, probably because
            // it originated from flash. Strange problems occur, like the
            // thread just stops in various places. setTimeout seems to
            // set up a better thread. This is the same workaround as
            // in _SVGObject._executeScript().
            setTimeout(function() { f.apply(root);f=null;root=null; }, 1);
          } else {
            f.apply(root);
          }
        } catch (exp) {
          console.log('Error while firing onload listener: ' 
                      + exp.message || exp);
        }
      }
      handler._scriptNode._onloadListeners = [];
    }
    
    // page-level onload listeners or dynamically created SVG OBJECTs
    if (this.totalLoaded >= this.totalSVG) {
      // we are finished
      this._fireOnLoad();
    }
  },
  
  /** Safari 3 has a strange bug where if you have no HTML TITLE element,
      it will interpret the first SVG TITLE as the HTML TITLE and change
      the browser's title at the top of the title bar; this only happens
      with the native handler, but for consistency we insert an empty
      HTML TITLE into the page if none is present for all handlers
      which solves the issue. */
  _handleHTMLTitleBug: function() {
    var head = document.getElementsByTagName('head')[0];
    var title = head.getElementsByTagName('title');
    if (title.length === 0) {
      title = document.createElement('title');
      head.appendChild(title);
    }
  },
  
  /** This method is a hook useful for unit testing; unit testing can
      override it to be informed if an error occurs inside the Flash
      so that we can stop the unit test and report the error. */
  _fireFlashError: function(logString) {
  },
  
  /** Add an .id attribute for non-SVG and non-HTML nodes for the Native
      Handler, which don't have them by default in order to have parity with the
      Flash viewer. We have this here instead of on the Native Handlers
      themselves because the method is called by our patched 
      document.getElementByTagNameNS and we don't want to do any closure
      magic there to prevent memory leaks. */
  _exportID: function(node) {
    node.__defineGetter__('id', function() {
      return node.getAttribute('id');
    });
    node.__defineSetter__('id', function(newValue) {
      return node.setAttribute('id', newValue);
    });
  },
  
  /** Sign up for the onunload event on IE to clean up references that
      can cause memory leaks. */
  _watchUnload: function() {
    window.attachEvent('onunload', function(evt) {
      // detach this anonymous listener
      window.detachEvent('onunload', arguments.callee);
      
      // do all the onunload work now
      svgweb._fireUnload();
    });
  },
  
  /** Called when window unload event fires; putting this in a separate
      function helps us with unit testing. */
  _fireUnload: function() {
    if (!isIE) { // helps with unit testing
      return;
    }

    // clean up SVG OBJECTs
    for (var i = 0; i < svgweb.handlers.length; i++) {      
      if (svgweb.handlers[i].type == 'object') {
        var removeMe = svgweb.handlers[i].flash;
        if (removeMe && removeMe.parentNode) { // attachment may have been interrupted
          svgweb.removeChild(removeMe, removeMe.parentNode);
        }
      } else {
        // null out reference to root
        svgweb.handlers[i].document.documentElement = null;
      }
    }

    // delete the HTC container and all HTC nodes
    var container = document.getElementById('__htc_container');
    if (container) {
      for (var i = 0; i < container.childNodes.length; i++) {
        var child = container.childNodes[i];
        // remove style handling
        if (child.nodeType == 1 && child.namespaceURI == svgns) {
          child.detachEvent('onpropertychange', 
                           child._fakeNode.style._changeListener);
          child.style.item = null;
          child.style.setProperty = null;
          child.style.getPropertyValue = null;
        }
        
        // remove other references
        if (child._fakeNode) {
            child._fakeNode._htcNode = null;
        }
        child._fakeNode = null;
        child._handler = null;
      }
      container.parentNode.removeChild(container);
      container = null;
    }

    // for all the handlers, remove their reference to the Flash object
    for (var i = 0; i < svgweb.handlers.length; i++) {
      var handler = svgweb.handlers[i];
      handler.flash = null;
    }
    svgweb.handlers = null;

    // clean up any nodes that were removed in the past
    for (var i = 0; i < svgweb._removedNodes.length; i++) {
      var node = svgweb._removedNodes[i];
      if (node._fakeNode) {
        node._fakeNode._htcNode = null;
      }
      node._fakeNode = null;
      node._handler = null;
    }
    svgweb._removedNodes = null;

    // cleanup document patching
    document.getElementById = document._getElementById;
    document._getElementById = null;
    
    document.getElementsByTagNameNS = document._getElementsByTagNameNS;
    document._getElementsByTagNameNS = null;
    
    document.createElementNS = document._createElementNS;
    document._createElementNS = null;
    
    document.createElement = document._createElement;
    document._createElement = null;
    
    document.createTextNode = document._createTextNode;
    document._createTextNode = null;
    
    document._importNodeFunc = null;
    
    document.createDocumentFragment = document._createDocumentFragment;
    document._createDocumentFragment = null;
    
    window.addEventListener = null;
    window._addEventListener = null;
    
    window.attachEvent = window._attachEvent;
    window._attachEvent = null;
    
    // cleanup parsed XML cache
    parseXMLCache = null;
  },
  
  /** Does certain things early on in the page load process to cleanup
      any SVG objects on our page, such as making them hidden, etc. */
  _cleanupSVGObjects: function() {
    // if this browser has native SVG support, do some tricks to take away
    // control from it for the Flash renderer early in the process
    if (this.config.use == 'flash' && this.config.hasNativeSVG()) {
      for (var i = 0; i < this._svgObjects.length; i++) {
        // replace the SVG OBJECT with a DIV
        var obj = this._svgObjects[i];
        var div = document.createElement('div');
        for (var j = 0; j < obj.attributes.length; j++) {
          var attr = obj.attributes[j];
          div.setAttribute(attr.nodeName, attr.nodeValue);
        }
        // bring over fallback content
        var fallback = obj.innerHTML;
        div.innerHTML = fallback;
        obj.parentNode.replaceChild(div, obj);
        this._svgObjects[i] = div;
      }
    }
    
    // make any SVG objects have visibility hidden early in the process
    // to prevent IE from showing scroll bars
    for (var i = 0; i < this._svgObjects.length; i++) {
      this._svgObjects[i].style.visibility = 'hidden';
    }
  },
  
  /** Intercepts setting up window.onload events so we can delay firing
      them until we are done with our internal work. */
  _interceptOnloadListeners: function() {
    if (window.addEventListener) {
      window._addEventListener = window.addEventListener;
      window.addEventListener = function(type, f, useCapture) {
        if (type.toLowerCase() == 'svgload') {
          svgweb.addOnLoad(f);
        } else {
          return window._addEventListener(type, f, useCapture);
        }
      }
    } else {
      // patch in addEventListener for IE!
      window.addEventListener = function(type, f, useCapture) {
        if (type.toLowerCase() == 'svgload') {
          svgweb.addOnLoad(f);
        } else {
          if (isIE && window.attachEvent) {
            return window.attachEvent('on' + type, f);
          }
        }
      }
    }
    
    if (isIE && window.attachEvent) {
      window._attachEvent = window.attachEvent;
      window.attachEvent = function(type, f) {
        if (type.toLowerCase() == 'onsvgload') {
          svgweb.addOnLoad(f);
        } else {
          return window._attachEvent(type, f);
        }
      }
    }

  },
  
  _saveWindowOnload: function() {
    // intercept and save window.onsvgload or <body onsvgload="">
    var onsvgload = window.onsvgload;
    // browsers will replace any previous window.onload listeners
    // with a <body onload=""> listener; simulate this for onsvgload
    if (document.getElementsByTagName('body')) {
      var body = document.getElementsByTagName('body')[0];
      if (body.getAttribute('onsvgload')) {
        callbackStr = body.getAttribute('onsvgload');
        onsvgload = (function(callbackStr) {
          // FIXME: What should 'this' refer to when body.onload
          // is simulated? The body tag? The window object?
          return function() {
            eval(callbackStr);
          }
        })(callbackStr);
      }
    }
    
    if (onsvgload) {
      // preserve IE's different behavior of firing window.onload 
      // behavior _before_ everything else; other browsers don't necessarily
      // give preferential treatment to window.onload. Even though we
      // now use window.onsvgload instead of window.onload preserve
      // this behavior.
      if (isIE) {
        this._loadListeners.splice(0, 0, onsvgload);
      } else {
        this._loadListeners.push(onsvgload);
      }
      window.onsvgload = onsvgload = null;
    }
  }
});


/** A class that sees if there is a META tag to force Flash rendering 
    for all browsers. Also determines if the browser supports native SVG or 
    Flash and the correct Flash version. Determines the best renderer 
    to use. */
function RenderConfig() {
  // see if there is a META tag for 'svg.render.forceflash' or a query
  // value in the URL
  if (!this._forceFlash()) {
    // if not, see if this browser natively supports SVG
    if (this.hasNativeSVG()) {
      this.supported = true;
      this.use = 'native';
      return;
    }
  } else {
    console.log('Forcing Flash SVG viewer for this browser');
  }
  
  // if not, see if this browser has Flash and the correct Flash version (9+)
  var info = new FlashInfo();
  if (info.capable) {
    if (info.isVersionOrAbove(10, 0, 0)) {
      this.supported = true;
      this.use = 'flash';
    } else { // has Flash but wrong version
      this.supported = false;
      this.reason = 'Flash 10+ required';
    }
  } else { // no Flash present
    this.supported = false;
    this.reason = 'Flash 10+ or a different browser required';
  }
}

extend(RenderConfig, {
  /** Boolean on whether the given browser is supported. */
  supported: false,
  
  /* String on why the given browser is not supported. */
  reason: null,
  
  /** String on which renderer to use: flash or native. */
  use: null,
  
  /** Determines if there is the META tag 'svg.render.forceflash' set to
      true or a URL query value with 'svg.render.forceflash' given. */
  _forceFlash: function() {
    var results = false;
    var hasMeta = false;
    
    var meta = document.getElementsByTagName('meta');
    for (var i = 0; i < meta.length; i++) {
      if (meta[i].name == 'svg.render.forceflash' &&
          meta[i].content.toLowerCase() == 'true') {
        results = true;
        hasMeta = true;
      }
    }
    
    if (window.location.search.indexOf('svg.render.forceflash=true') != -1) {
      results = true;
    } else if (hasMeta
               && window.location.search.indexOf(
                                        'svg.render.forceflash=false') != -1) {
      // URL takes precedence
      results = false;
    }
    
    return results;
  },
  
  /** Determines whether this browser supports native SVG. */
  hasNativeSVG: function() {
    if (document.implementation && document.implementation.hasFeature) {
      return document.implementation.hasFeature(
            'http://www.w3.org/TR/SVG11/feature#BasicStructure', '1.1');
    } else {
      return false;
    }
  }
});


// adapted from Dojo Flash dojox.flash.Info
function FlashInfo(){
	// summary: A class that helps us determine whether Flash is available.
	// description:
	//	A class that helps us determine whether Flash is available,
	//	it's major and minor versions, and what Flash version features should
	//	be used for Flash/JavaScript communication. Parts of this code
	//	are adapted from the automatic Flash plugin detection code autogenerated 
	//	by the Macromedia Flash 8 authoring environment.

	this._detectVersion();
}

FlashInfo.prototype = {
	// version: String
	//		The full version string, such as "8r22".
	version: -1,
	
	// versionMajor, versionMinor, versionRevision: String
	//		The major, minor, and revisions of the plugin. For example, if the
	//		plugin is 8r22, then the major version is 8, the minor version is 0,
	//		and the revision is 22. 
	versionMajor: -1,
	versionMinor: -1,
	versionRevision: -1,
	
	// capable: Boolean
	//		Whether this platform has Flash already installed.
	capable: false,
	
	isVersionOrAbove: function(
							/* int */ reqMajorVer, 
							/* int */ reqMinorVer, 
							/* int */ reqVer){ /* Boolean */
		// summary: 
		//	Asserts that this environment has the given major, minor, and revision
		//	numbers for the Flash player.
		// description:
		//	Asserts that this environment has the given major, minor, and revision
		//	numbers for the Flash player. 
		//	
		//	Example- To test for Flash Player 7r14:
		//	
		//	info.isVersionOrAbove(7, 0, 14)
		// returns:
		//	Returns true if the player is equal
		//	or above the given version, false otherwise.
		
		// make the revision a decimal (i.e. transform revision 14 into
		// 0.14
		reqVer = parseFloat("." + reqVer);
		
		if (this.versionMajor >= reqMajorVer && this.versionMinor >= reqMinorVer
			 && this.versionRevision >= reqVer) {
			return true;
		} else {
			return false;
		}
	},
	
	_detectVersion: function(){
		var versionStr;
		
		// loop backwards through the versions until we find the newest version	
		for (var testVersion = 25; testVersion > 0; testVersion--) {
			if (isIE) {
				var axo;
				try {
					if (testVersion > 6) {
						axo = new ActiveXObject("ShockwaveFlash.ShockwaveFlash." 
																		+ testVersion);
					} else {
						axo = new ActiveXObject("ShockwaveFlash.ShockwaveFlash");
					}
					if (typeof axo == "object") {
						if (testVersion == 6) {
							axo.AllowScriptAccess = "always";
						}
						versionStr = axo.GetVariable("$version");
					}
				} catch(e) {
					continue;
				}
			} else {
				versionStr = this._JSFlashInfo(testVersion);		
			}
				
			if (versionStr == -1 ) {
				this.capable = false; 
				return;
			} else if (versionStr !== 0) {
				var versionArray;
				if (isIE) {
					var tempArray = versionStr.split(" ");
					var tempString = tempArray[1];
					versionArray = tempString.split(",");
				} else {
					versionArray = versionStr.split(".");
				}
					
				this.versionMajor = versionArray[0];
				this.versionMinor = versionArray[1];
				this.versionRevision = versionArray[2];
				
				// 7.0r24 == 7.24
				var versionString = this.versionMajor + "." + this.versionRevision;
				this.version = parseFloat(versionString);
				
				this.capable = true;
				
				break;
			}
		}
	},
	 
	// JavaScript helper required to detect Flash Player PlugIn version 
	// information.
	_JSFlashInfo: function(testVersion){
		// NS/Opera version >= 3 check for Flash plugin in plugin array
		if (navigator.plugins !== null && navigator.plugins.length > 0) {
			if (navigator.plugins["Shockwave Flash 2.0"] || 
				 navigator.plugins["Shockwave Flash"]) {
				var swVer2 = navigator.plugins["Shockwave Flash 2.0"] ? " 2.0" : "";
				var flashDescription = navigator.plugins["Shockwave Flash" + swVer2].description;
				var descArray = flashDescription.split(" ");
				var tempArrayMajor = descArray[2].split(".");
				var versionMajor = tempArrayMajor[0];
				var versionMinor = tempArrayMajor[1];
				var tempArrayMinor = (descArray[3] || descArray[4]).split("r");
				var versionRevision = tempArrayMinor[1] > 0 ? tempArrayMinor[1] : 0;
				var version = versionMajor + "." + versionMinor + "." + versionRevision;
											
				return version;
			}
		}
		
		return -1;
	}
};


/** Creates a FlashHandler that will embed the given SVG into the page using
    Flash. Pass in an object literal with the correct arguments. Once the
    handler is setup call start() to have it kick off doing its work.
    
    If dealing with an SVG SCRIPT tag these arguments are:
    
    type - The string 'script'.
    svgID - A unique ID for the SVG root tag.
    xml - XML Document object for parsed SVG.
    svgString - The SVG content as a String.
    origSVG - The original, pre-cleaned up SVG. Useful so that we can
    provide the original SVG for 'View Source' functionality. Only used
    by the FlashHandler.
    scriptNode - The DOM element for the SVG SCRIPT block.
    
    If dealing with an SVG OBJECT tag these arguments are:
    
    type - The string 'object'.
    objID - A unique ID for the SVG OBJECT tag.
    objNode - DOM OBJECT pointing to an SVG URL to handle.
  */
function FlashHandler(args) {
  this.type = args.type;
  
  // we keep a record of all keyboard listeners added by any of our nodes;
  // this is necessary so that if the containing SVG document is removed from
  // the DOM we can clean up keyboard listeners, which are actually registered
  // on the document object
  this._keyboardListeners = [];
  
  // helps us with suspendRedraw operations
  this._redrawManager = new _RedrawManager(this);
  
  if (this.type == 'script') {
    this.id = args.svgID;
    this._xml = args.xml;
    this._svgString = args.svgString;
    this._origSVG = args.origSVG;
    this._scriptNode = args.scriptNode;
  } else if (this.type == 'object') {
    this.id = args.objID;
    this._objNode = args.objNode;
  }
}

// Track keyboard listeners on the top level document in case
// flash traps any keyboard events.
FlashHandler._keyboardListeners = [];

// start of 'static' singleton functions and properties

// when someone calls createElementNS or createTextNode we are not attached
// to a handler yet; we need an XML document object in order to generate things
// though, so this single unattached XML document object serves that purpose
FlashHandler._unattachedDoc = parseXML('<?xml version="1.0"?>\n'
                                       + '<svg xmlns="' + svgns + '"></svg>',
                                       false);

/** Prepares the svg.htc behavior for IE. */
FlashHandler._prepareBehavior = function(libraryPath, htcFilename) {
  // Adapted from Mark Finkle's SVG using VML project

  // add the SVG namespace to the page in a way IE can use
  var ns = null;
  for (var i = 0; i < document.namespaces.length; i++) {
    if (document.namespaces.item(i).name == 'svg') {
      ns = document.namespaces.item(i);
      break;
    }
  }
  
  if (ns === null) {
    ns = document.namespaces.add('svg', svgns);
  }
  
  // attach SVG behavior to the page
  ns.doImport(libraryPath + htcFilename);
};

/** Fetches an _Element or _Node or creates a new one on demand using the 
    given parsed XML and handler.
    
    @param nodeXML XML or HTML DOM node for the element to use when 
    constructing the _Element or _Node.
    @param handler Optional. A FlashHandler to associate with this node if
    the node is attached to a real DOM.
    
    @returns If IE, returns the HTC proxy for the node (i.e. node._htcNode) so
    that external callers can manipulate it and have getter/setter magic happen; 
    if other browsers, returns the _Node or _Element itself. */
FlashHandler._getNode = function(nodeXML, handler) {
  //console.log('getNode, nodeXML='+nodeXML+', nodeName='+nodeXML.nodeName+', handler='+handler);
  var node;
  
  // if we've created an _Element or _Node for this XML before, we
  // stored a reference to it by GUID so we could get it later
  node = svgweb._guidLookup['_' + nodeXML.getAttribute('__guid')];

  // NOTE: We represent text nodes using an XML Element node in order to do
  // tracking, so we have to catch this fact below
  var fakeTextNode = false;
  if (!node && nodeXML.nodeName == '__text') {
    fakeTextNode = true;
  }
  
  if (!node && !fakeTextNode && nodeXML.nodeType == _Node.ELEMENT_NODE) {
    // never seen before -- we'll have to create a new _Element now
    node = new _Element(nodeXML.nodeName, nodeXML.prefix, 
                        nodeXML.namespaceURI, nodeXML, handler);
  } else if (!node && (nodeXML.nodeType == _Node.TEXT_NODE || fakeTextNode)) {
    node = new _Node('#text', _Node.TEXT_NODE, null, null, nodeXML,
                     handler);
  } else if (!node) {
    throw new Error('Unknown node type given to _getNode: ' 
                    + nodeXML.nodeType);
  }

  return node._getProxyNode();
};

/** Patches the document object to also use the Flash backend. */
FlashHandler._patchBrowserObjects = function(win, doc) {
  if (doc._getElementById) { // already patched
    return;
  }
  
  // We don't capture the original document functions as a closure, 
  // as Firefox doesn't like this and will fail to run the original. 
  // Instead, we capture the original versions on the document object
  // itself but with a _ prefix.
  
  doc._getElementById = doc.getElementById;
  doc.getElementById = FlashHandler._getElementById;
  
  doc._getElementsByTagNameNS = doc.getElementsByTagNameNS;
  doc.getElementsByTagNameNS = FlashHandler._getElementsByTagNameNS;
  
  doc._createElementNS = doc.createElementNS;
  doc.createElementNS = FlashHandler._createElementNS;
  
  doc._createElement = doc.createElement;
  doc.createElement = FlashHandler._createElement;
    
  doc._createTextNode = doc.createTextNode;
  doc.createTextNode = FlashHandler._createTextNode;
  
  doc._importNodeFunc = FlashHandler._importNodeFunc;
  
  doc._createDocumentFragment = doc.createDocumentFragment;
  doc.createDocumentFragment = FlashHandler._createDocumentFragment;

  doc._addEventListener = doc.addEventListener;
  doc.addEventListener = FlashHandler._addEventListener;
};


/** Patches the fake window and document object "inside" an SVG loaded with object tag */
/* Implemented for FlashHandler only */
FlashHandler._patchFakeObjects = function(win, doc) {
  doc._addEventListener = doc.addEventListener;
  doc.addEventListener = FlashHandler._addEventListener;
};


FlashHandler._addEventListener = function(type, listener, useCapture) {

  if (type.substring(0,3) == 'key') {
    // prevent closure by using an inline method
    var wrappedListener = (function(listener) {
                              return function(evt) {
                                // shim in preventDefault function for IE
                                if (!evt.preventDefault) {
                                  evt.preventDefault = function() {
                                    this.returnValue = false;
                                    evt = null;
                                  }
                                }
                                // call the developer's listener now
                                if (typeof listener == 'object') {
                                  listener.handleEvent.call(listener, evt);
                                } else {
                                  listener(evt);
                                }
                              }
                            })(listener);
    // persist information about this listener so we can easily remove
    // it later
    wrappedListener.__type = type;
    wrappedListener.__listener = listener;
    wrappedListener.__useCapture = useCapture; 
    
    // save keyboard listeners for later so we can clean them up
    // later if the parent SVG document is removed from the DOM
    if (this._handler) {
      this._handler._keyboardListeners.push(wrappedListener);
    } else {
      FlashHandler._keyboardListeners.push(wrappedListener);
    }
  }
  if (this._addEventListener) {
    this._addEventListener(type, listener, useCapture);
  } else if (this.attachEvent) {
    this.attachEvent('on' + type, listener);
  }
}


/** Our implementation of getElementById, which we patch into the 
    document object. We do it here to prevent a closure and therefore
    a memory leak on IE. Note that this function runs in the global
    scope, so 'this' will not refer to our object instance but rather
    the window object. */
FlashHandler._getElementById = function(id) {
  var result = document._getElementById(id);
  if (result !== null) { // Firefox doesn't like 'if (result)'
    return result;
  }

  // loop through each of the handlers and see if they have the element with
  // this ID
  for (var i = 0; i < svgweb.handlers.length; i++) {
    if (svgweb.handlers[i].type == 'script') {
      result = svgweb.handlers[i].document.getElementById(id);
    }
    
    if (result) {
      return result;
    }
  }
  
  return null;
};

/** Our implementation of getElementsByTagNameNS, which we patch into the 
    document object. We do it here to prevent a closure and therefore
    a memory leak on IE. Note that this function runs in the global
    scope, so 'this' will not refer to our object instance but rather
    the window object. */
FlashHandler._getElementsByTagNameNS = function(ns, localName) {
  //console.log('FlashHandler._getElementsByTagNameNS, ns='+ns+', localName='+localName);
  var results = createNodeList();
  
  // NOTE: can't use Array.concat to combine our arrays below because 
  // document._getElementsByTagNameNS results aren't a real Array, they
  // are DOM NodeLists
  
  if (document._getElementsByTagNameNS) {
    var matches = document._getElementsByTagNameNS(ns, localName);
    
    for (var j = 0; j < matches.length; j++) {
      results.push(matches[j]);
    }
  }
  
  for (var i = 0; i < svgweb.handlers.length; i++) {
    if (svgweb.handlers[i].type == 'script') {
      var doc = svgweb.handlers[i].document;
      var matches = doc.getElementsByTagNameNS(ns, localName);
      for (var j = 0; j < matches.length; j++) {
        results.push(matches[j]);
      }
    }
  }

  return results;
};

/** Our implementation of createElementNS, which we patch into the 
    document object. We do it here to prevent a closure and therefore
    a memory leak on IE. Note that this function runs in the global
    scope, so 'this' will not refer to our object instance but rather
    the window object. */
FlashHandler._createElementNS = function(ns, qname, forSVG) {
  //console.log('createElementNS, ns='+ns+', qname='+qname);
  if (forSVG === undefined) {
     forSVG = false;
  }
  if (ns === null || ns == 'http://www.w3.org/1999/xhtml') {
    if (isIE) {
      return document.createElement(qname);
    } else {
      return document._createElementNS(ns, qname);
    }
  }
  
  var namespaceFound = false;

  // Firefox and Safari will incorrectly turn our internal parsed XML
  // for the Flash Handler into actual SVG nodes, causing issues. This is
  // a workaround to prevent this problem.
  if (ns == svgns) {
    ns = svgnsFake;
    namespaceFound = true;
  }

  // someone might be using this library on an XHTML page;
  // only use our overridden createElementNS if they are using
  // a namespace we have never seen before
  if (!isIE && !forSVG) {
    // Check namespaces from unattached svg elements
    if (svgweb._allSVGNamespaces['_' + ns]) {
      namespaceFound = true;
    }
    for (var i = 0; !namespaceFound && i < svgweb.handlers.length; i++) {
      if (svgweb.handlers[i].type == 'script'
          && svgweb.handlers[i].document._namespaces['_' + ns]) {
        namespaceFound = true;
        break;
      }
    }

    if (!namespaceFound) {
      return document._createElementNS(ns, qname);
    }
  }
  
  var prefix;
  // Check namespaces from unattached svg elements
  if (svgweb._allSVGNamespaces['_' + ns]) {
    prefix = svgweb._allSVGNamespaces['_' + ns];
  } else {
    // Check attached svg elements
    for (var i = 0; i < svgweb.handlers.length; i++) {
      if (svgweb.handlers[i].type == 'script') {
        prefix = svgweb.handlers[i].document._namespaces['_' + ns];
        if (prefix) {
          break;
        }
      }
    }
  }
  
  if (prefix == 'xmlns' || !prefix) { // default SVG namespace
    // If this is a new namespace, we may have to assume the
    // prefix from the qname
    if (qname.indexOf(':') != -1) {
      prefix=qname.substring(0, qname.indexOf(':'))
    }
    else {
      prefix = null;
    }
  }

  var node = new _Element(qname, prefix, ns);
  
  return node._getProxyNode(); 
};

/** Our implementation of createElement, which we patch into the 
    document object. We do it here to prevent a closure and therefore
    a memory leak on IE. Note that this function runs in the global
    scope, so 'this' will not refer to our object instance but rather
    the window object. 
    
    We patch createElement to have a second boolean argument that controls 
    how we handle the nodeName, in particular for 'object'. This flags to
    us that this object will be used as an SVG object so that we can 
    keep track of onload listeners added through addEventListener.
    
    @param nodeName The node name, such as 'div' or 'object'.
    @param forSVG Optional boolean on whether the node is an OBJECT that
    will be used as an SVG OBJECT. Defaults to false. */
FlashHandler._createElement = function(nodeName, forSVG) {
  if (!forSVG) {
    return document._createElement(nodeName);
  } else if (forSVG && nodeName.toLowerCase() == 'object') {
    var obj = document._createElement('object');
    obj._onloadListeners = [];
    
    // capture any original addEventListener method
    var addEventListener = obj.addEventListener;
    // Do a trick to form a mini-closure here so that we don't capture
    // the objects above and form memory leaks on IE. We basically patch
    // addEventListener for just this object to build up our list of
    // onload listeners; for other event types we delegate to the browser's
    // native way to attach event listeners.
    (function(_obj, _addEventListener){
      _obj.addEventListener = function(type, listener, useCapture) {
        // handle onloads special
        // NOTE: 'this' == our SVG OBJECT
        if (type.toLowerCase() == 'svgload') {
          this._onloadListeners.push(listener);
        } else if (!addEventListener) { // IE
          this.attachEvent('on' + type, listener);
        } else { // W3C
          _addEventListener(type, listener, useCapture);
        }  
      };
    })(obj, addEventListener); // pass in object and native addEventListener
    
    return obj;
  }
};

/** Our implementation of createTextNode, which we patch into the 
    document object. We do it here to prevent a closure and therefore
    a memory leak on IE. Note that this function runs in the global
    scope, so 'this' will not refer to our object instance but rather
    the window object. 
    
    We patch createTextNode to have a second boolean argument that controls 
    whether the resulting text node will be appended within our SVG tree. 
    We need this so we can return one of our magic _Nodes instead of a native
    DOM node for later appending and tracking. 
    
    @param data Text String.
    @param forSVG Optional boolean on whether node will be attached to
    SVG sub-tree. Defaults to false. */
FlashHandler._createTextNode = function(data, forSVG) {
  if (!forSVG) {
    return document._createTextNode(data);
  } else {
    // we create a DOM Element instead of a DOM Text Node so that we can
    // assign it a _guid and do tracking on it; we assign the data value
    // to a DOM Text Node that is a child of our fake DOM Element. Note
    // that since we are unattached we use an XML document object we
    // created earlier (FlashHandler._unattachedDoc) in order to
    // generate things.
    var doc = FlashHandler._unattachedDoc;
    var nodeXML;
    if (isIE) {
      nodeXML = doc.createElement('__text');
    } else {
      nodeXML = doc.createElementNS(svgnsFake, '__text');
    }
    nodeXML.appendChild(doc.createTextNode(data));
    var textNode = new _Node('#text', _Node.TEXT_NODE, null, null, nodeXML);
    textNode._nodeValue = data;
    textNode.ownerDocument = document;
    
    return textNode._getProxyNode();
  }
};

/** IE doesn't support the importNode function. We define it on the
    document object as _importNodeFunc. Unfortunately we need it there
    since it is a recursive function and needs to call itself, and we
    don't want to do this on an object instance to avoid memory leaks
    from closures on IE. Note that this function runs in the global scope
    so 'this' will point to the Window object. 
    
    @param doc The document object to work with.
    @param node An XML node to import
    @param allChildren Whether to import the node's children as well. */
FlashHandler._importNodeFunc = function(doc, node, allChildren) {
  switch (node.nodeType) {
    case 1: // ELEMENT NODE
      var newNode = doc.createElement(node.nodeName);

      // does the node have any attributes to add?
      if (node.attributes && node.attributes.length > 0) {
        for (var i = 0; i < node.attributes.length; i++) {
          var attrName = node.attributes[i].nodeName;
          var attrValue = node.getAttribute(attrName);
          newNode.setAttribute(attrName, attrValue);
        }
      }

      // are we going after children too, and does the node have any?
      if (allChildren && node.childNodes && node.childNodes.length > 0) {
        for (var i = 0; i < node.childNodes.length; i++) {
          newNode.appendChild(
              document._importNodeFunc(doc, node.childNodes[i], allChildren));
        }
      }

      return newNode;
      break;
    case 3: // TEXT NODE
      return doc.createTextNode(node.nodeValue);
      break;
  }
};

/** Our implementation of createDocumentFragment, which we patch into the 
    document object. We do it here to prevent a closure and therefore
    a memory leak on IE. Note that this function runs in the global
    scope, so 'this' will not refer to our object instance but rather
    the window object. 
    
    @param forSVG Optional boolean value. If true, then we return a fake
    _DocumentFragment suitable for adding SVG nodes into. If false or not
    present, then this is a normal browser native DocumentFragment. */
FlashHandler._createDocumentFragment = function(forSVG) {
  if (forSVG) {
    return new _DocumentFragment(document)._getProxyNode();
  } else {
    return document._createDocumentFragment();
  }
};

/** Flash has a number of encoding issues when talking over the Flash/JS
    boundry. This method encapsulates fixing these issues. 
    
    @param str String before fixing encoding issues.
    
    @returns String suitable for sending to Flash. */
FlashHandler._encodeFlashData = function(str) {
  // Flash has a surprising bug: backslashing certain characters will
  // cause an 'Illegal Character' error. For example, if I have a SCRIPT
  // inside my SVG OBJECT as follows: var temp = "\"\"" then I will get
  // this exception. To handle this we double encode back slashes.
  str = str.toString().replace(/\\/g, '\\\\');
  
  // Flash barfs on entities, such as &quot;. To get around this, tokenize
  // our & characters into our own special string which we will then 
  // replace on the Flash side inside SVGViewerWeb.
  str = str.replace(/&/g, '__SVG__AMPERSAND');
  
  return str;
};

// end static singleton functions

// methods that every FlashHandler instance will have
extend(FlashHandler, {
  /** The Flash object's ID; set by _SVGSVGElement. */
  flashID: null, 
  
  /** The Flash object; set by _SVGSVGElement. */
  flash: null,
  
  /** Has this handler kick off doing its work. */
  start: function() {
    if (this.type == 'script') {
      this._handleScript();
    } else if (this.type == 'object') {
      this._handleObject();
    }
  },
  
  /** Turns the string results from Flash back into an Object. The HTC, unlike
      our Flash, returns an Object, so we detect that and simply return 
      it unchanged if so. */
  _stringToMsg: function(msg) {
    if (msg == null || typeof msg != 'string') {
      return msg;
    }
    
    var results = {};
          
    // our delimiter is a custom token: __SVG__DELIMIT
    var tokens = msg.split(/__SVG__DELIMIT/g);
    for (var i = 0; i < tokens.length; i++) {
        // each token is a propname:propvalue pair
        var cutAt = tokens[i].indexOf(':');
        var propName = tokens[i].substring(0, cutAt);
        var propValue = tokens[i].substring(cutAt + 1);
        if (propValue === 'true') {
            propValue = true;
        } else if (propValue === 'false') {
            propValue = false;
        } else if (propValue === 'null') {
            propValue = null;
        } else if (propValue === 'undefined') {
            propValue = undefined;
        }
                        
        results[propName] = propValue;
    }
    
    return results;
  },
  
  /**
    Stringifies the msg object sent back from the Flash SVG renderer or 
    from the HTC file to help with debugging.
  */
  debugMsg: function(msg) {
    if (msg === undefined) {
      return 'undefined';
    } else if (msg === null) {
      return 'null';
    }

    var result = [];
    for (var i in msg) {
      result.push(i + ':' + msg[i]);
    }
    result = result.join(', ');

    return '{' + result + '}';
  },
  
  /** Sends a message to the Flash object rendering this SVG. 
  
      @param invoke Flash method to invoke, such as jsSetAttribute. 
      @param args Array of values to pass to the Flash method. */
  sendToFlash: function(invoke, args) {
    //console.log('sendToFlash, invoke='+invoke);
    // Performance testing found that Flash/JS communication is one of the
    // primary bottlenecks. Two workarounds were found to make this faster:
    // 1) Send over giant strings instead of Objects and 2) minimize
    // our own custom marshaling code. To accomodate this, we take all
    // of our arguments and turn them into a giant string, delimited with
    // __SVG__DELIMIT. We then call individual Flash methods exposed through
    // ExternalInterface on the Flash side for each method (given by 'invoke');
    // each of these methods knows how to deal with their arguments, so we
    // can minimize our marshaling code and keep it from being too generic
    // and slow
    
    // note that 'this.flash' is set by the FlashInserter class after we 
    // create a Flash object there
    
    var message = args.join('__SVG__DELIMIT');
    
    // batch things up if we are in the middle of a suspendRedraw operation
    if (this._redrawManager.isSuspended()) {
      this._redrawManager.batch(invoke, message);
    } else {
      // send things over to Flash
      try {
        // Flash callback functions may disappear on IE 9
        if (typeof (this.flash[invoke]) == 'undefined') {
          __flash__addCallback(this.flash, invoke);
        }
        return this.flash[invoke](message);
      } catch(exp) {
        // This code is for crashing exception in Opera
        // that occurs with scripts running in relation
        // to an object that is unloaded.
        console.log("Call to flash but flash is not present! " +
                    invoke + ": " + this.debugMsg(message) + ": "+exp);
      }
    }
  },
  
  /** The method is the primary entry-point called by Flash when it has results
      ready for us to use. This method then dispatches the message to other
      methods based on the type of the message (whether it is an event, 
      logging, a script encountered in an SVG OBJECT, etc.).
      
      Note that this method is also called by the HTC file to tell us when
      events have happened, such as the HTC file being finished loading.
  
      @param msg The HTC sends us an Object populated with various values;
      for Flash, we send over string values instead since we found that
      performance is roughly twice as fast when passing strings. */
  onMessage: function(msg) {
    msg = this._stringToMsg(msg);
    //console.log('onMessage, msg='+this.debugMsg(msg));
    if (msg.type == 'event') {
      this._onEvent(msg);
      return;
    } else if (msg.type == 'log') {
      this._onLog(msg);
      return;
    } else if (msg.type == 'script') {
      this._onObjectScript(msg);
      return;
    } else if (msg.type == 'viewsource') {
      this._onViewSource();
      return;
    } else if (msg.type == 'viewsourceDynamic') {
      this._onViewSourceDynamic(msg);
      return;
    } else if (msg.type == 'error') {
      this._onFlashError(msg);
    }
  },
  
  /** Called by _SVGSVGElement or _SVGObject when we are loaded and rendered. 
  
      @param id The ID of the SVG element.
      @param type The type of element that is finished loading,
      either 'script' or 'object'. */
  fireOnLoad: function(id, type) {
    //console.log('FlashHandler.fireOnLoad');
    
    // indicate that we are done with this handler
    svgweb._handleDone(id, type, this);
  },
  
  /** Handles SVG embedded into the page with a SCRIPT tag. */
  _handleScript: function() {
    // create proxy objects representing the Document and SVG root; these
    // kick off creating the Flash internally
    this.document = new _Document(this._xml, this);
    // Note that documentElement starts off as a fake node and transforms
    // to a proxy node in onRenderingFinished.
    this.document.documentElement = 
            new _SVGSVGElement(this._xml.documentElement, this._svgString,
                               this._scriptNode, this);
  },
  
  /** Handles SVG embedded into the page with an OBJECT tag. */
  _handleObject: function() {
    // transform the SVG OBJECT into a Flash one; the _SVGObject class
    // will handle embedding the Flash asychronously; see there for 
    // where the code continues after the Flash is done loading
    this._svgObject = new _SVGObject(this._objNode, this);
    this._objNode = null;
  },
  
  _onLog: function(msg) {
    console.log('FLASH: ' + msg.logString);
  },
  
  _onEvent: function(msg) {
    //console.log('onEvent, msg='+this.debugMsg(msg));
    if (msg.eventType.substr(0, 5) == 'mouse' || msg.eventType == 'click') {
      this._onMouseEvent(msg);
      return;
    } else if (msg.eventType.substr(0,3) == 'key') {
      this._onKeyboardEvent(msg);
      return;
    } else if (msg.eventType == 'onRenderingFinished') {
      if (this.type == 'script') {
        this.document.documentElement._onRenderingFinished(msg);
      } else if (this.type == 'object') {
        this._svgObject._onRenderingFinished(msg);
      }
      return;
    } else if (msg.eventType == 'onFlashLoaded') {
      if (this.type == 'script') {
        this.document.documentElement._onFlashLoaded(msg);
      } else if (this.type == 'object') {
        this._svgObject._onFlashLoaded(msg);
      }
      return;
    }
  },
  
  _onMouseEvent: function(msg) {
    //console.log('_onMouseEvent, msg='+this.debugMsg(msg));
    var target = this._getElementByGuid(msg.targetGUID);
    var currentTarget = this._getElementByGuid(msg.currentTargetGUID);

    // TODO: FIXME:
    // The stageX,Y mouse coordinates delivered from flash are
    // relative to the flash object.
    // In native implementations, mouse event coordinates are
    // relative to the browser content viewport (clientX, clientY)
    // and to the actual physical screen pixels (screenX, screenY).
    // AFAICT, flash does not have access to this positioning information,
    // so for now we provide mouse coordinates which assume the flash
    // object is located at the viewport origin and that the viewport
    // origin is at the screen origin, which of course is not accurate.
    // 
    // However, SVG developers who take no interest as to what
    // location the SVG file has been placed within the browser viewport
    // or screen should be OK.
    // 
    // This logic should remain consistent with the implementation
    // of getScreenCTM. Native implementations implement getScreenCTM
    // relative to the browser viewport, not the actual screen,
    // which is confusing because that differs from screenX,Y in
    // mouse events. In fact, getScreenCTM must be implemented consistent
    // with clientX,clientY mouse event coordinates! There are SVG
    // scripting examples which depend on this.
    // In our case, that means getScreenCTM should return a transform
    // assuming the flash object is located at the browser origin,
    // which is what flash provides as node.transform.concatenatedMatrix.
    var evt = { target: target._getProxyNode(),
                currentTarget: currentTarget._getProxyNode(),
                type: msg.eventType,
                clientX: Math.round(new Number(msg.stageX)),
                clientY: Math.round(new Number(msg.stageY)),
                screenX: Math.round(new Number(msg.stageX)),
                screenY: Math.round(new Number(msg.stageY)),
                altKey: msg.altKey,
                ctrlKey: msg.ctrlKey,
                shiftKey: msg.shiftKey,
                button: 0, // flash only supports left button
                preventDefault: function() { this.returnValue=false; },
                stopPropagation: function() { /* TODO */ }
              };
              
    var handlers = currentTarget._listeners[msg.eventType];
    if (handlers) {
        for (var i = 0; i < handlers.length; i++) {
          var handler = handlers[i];
          var listener = handler.listener;
          // TODO: See Issue 208
          // If the element is in an svg in an object,
          // then the function needs to be called in the 
          // proper sandbox (see below).
          // See tests/browser-tests/test_events.html tests 10, 38
          if (typeof listener == 'object') {
            listener.handleEvent.call(listener, evt);
          } else {
            listener.call(evt.currentTarget, evt);
          }
        }
    }
    if (msg.scriptCode != null) {
      if (this.type == 'object') {
        var defineEvtCode = 
        'var evt = { target: document.getElementById("' + 
                      target._getProxyNode().getAttribute('id') + '") ,\n' +
                    'currentTarget:document.getElementById("' +
                      currentTarget._getProxyNode().getAttribute('id') + '") ,\n' +
                    'type: "' + msg.eventType + '",\n' +
                    'clientX: ' + Math.round(new Number(msg.stageX)) + ',\n' +
                    'clientY: ' + Math.round(new Number(msg.stageY)) + ',\n' +
                    'screenX: ' + Math.round(new Number(msg.stageX)) + ',\n' +
                    'screenY: ' + Math.round(new Number(msg.stageY)) + ',\n' +
                    'altKey: ' + msg.altKey + ',\n' +
                    'ctrlKey: ' + msg.ctrlKey + ',\n' +
                    'shiftKey: ' + msg.shiftKey + ',\n' +
                    'button: 0,\n' +
                    'preventDefault: function() { this.returnValue=false; },\n' +
                    'stopPropagation: function() { }\n' +
                  '};\n';

        // prepare the code for the correct object context.
        var executeInContext = ';(function (evt) { ' + msg.scriptCode + '; }' +
                                    ').call(evt.currentTarget, evt);\n';
        // execute the code within the correct window context.
        this.sandbox_eval(this._svgObject._sandboxedScript(defineEvtCode + executeInContext));
      } else {
        var eventFunc = new Function(msg.scriptCode);
        eventFunc.call(evt.currentTarget, evt);
      }
    }
  },

  _onKeyboardEvent: function(msg) {
    //console.log('_onKeyEvent, msg='+this.debugMsg(msg));
    var target = this._getElementByGuid(msg.targetGUID);
    var currentTarget = this._getElementByGuid(msg.currentTargetGUID);
    var evt = { target: target._getProxyNode(),
                currentTarget: currentTarget._getProxyNode(),
                type: msg.eventType,
                keyCode: Number(msg.keyCode),
                altKey: msg.altKey,
                ctrlKey: msg.ctrlKey,
                shiftKey: msg.shiftKey,
                preventDefault: function() { this.returnValue=false; },
                stopPropagation: function() { /* TODO */ }
              };

    // Under this circumstance, the browser also passes the keystroke
    // to any document listener, so we do not need to simulate it.
    // In other words, flash does not eat the keystroke here.
    // IE does not bubble the event, so call object listeners below.
    // Best practice: Subscribe to top level document event and any svg object's
    // document's event. SVG Web will make sure only one event is dispatched.
    if ( (isFF || isChrome) && 
         this.flash.getAttribute('wmode') == 'transparent' ) {
         return;
    }

    // If the svg is inline, call all the top document level
    // keyboard listeners 
    if (this.type == 'script') {
      for (var i = 0; i < FlashHandler._keyboardListeners.length; i++) {
        var listener = FlashHandler._keyboardListeners[i];
        if (listener.__type == evt.type) {
          listener.call(evt.currentTarget, evt);
        }
      }
    }
    // Call any svg document or element keyboard listeners.
    var listeners = this._keyboardListeners;
    for (var i = 0; i < listeners.length; i++) {
      var listener = listeners[i];
      if (listener.__type == evt.type) {
        listener.call(evt.currentTarget, evt);
      }
    }
  },


  // This is used by elements that listen to the keyboard.
  // Documents that listen use the FlashHandler.addKeyboardListener
  addKeyboardListener: function(type, listener, useCapture) {
      // prevent closure by using an inline method
      var wrappedListener = (function(listener) {
                                return function(evt) {
                                  // shim in preventDefault function for IE
                                  if (!evt.preventDefault) {
                                    evt.preventDefault = function() {
                                      this.returnValue = false;
                                      evt = null;
                                    }
                                  }
                                  // call the developer's listener now
                                  if (typeof listener == 'object') {
                                    listener.handleEvent.call(listener, evt);
                                  } else {
                                    listener(evt);
                                  }
                                }
                              })(listener);
      // persist information about this listener so we can easily remove
      // it later
      wrappedListener.__type = type;
      wrappedListener.__listener = listener;
      wrappedListener.__useCapture = useCapture; 
      
      // save keyboard listeners for later so we can clean them up
      // later if the parent SVG document is removed from the DOM
      this._keyboardListeners.push(wrappedListener);
      return;
  },

  _getElementByGuid: function(guid) {
    var node = svgweb._guidLookup['_' + guid];
    if (node) {
        return node;
    }
    
    var results;
    if (this.type == 'script') {
      results = xpath(this._xml, null, '//*[@__guid="' + guid + '"]');
    } else if (this.type == 'object') {
      results = xpath(this._svgObject._xml, null, '//*[@__guid="' + guid + '"]');
    }

    var nodeXML, node;
    
    if (results.length) {
      nodeXML = results[0];
    } else {
      return null;
    }
    
    // create or get an _Element for this XML DOM node for node
    node = FlashHandler._getNode(nodeXML, this);

    // _guidLookup holds _Nodes, so if this is an HTC node, get the _Node instead
    if(isIE && node._fakeNode) {
        node = node._fakeNode;
    }
    // _getElementByGuid is called for mouse events, assume element is attached
    node._attached = true;
    
    return node;
  },

  /** Calls if the Flash encounters an error. */
  _onFlashError: function(msg) {
    this._onLog(msg);
    svgweb._fireFlashError('FLASH: ' + msg.logString);
    throw new Error('FLASH: ' + msg.logString);
  },
  
  /** Stores any SCRIPT that might be inside an SVG file embedded through
      an SVG OBJECT to be executed at a later time when are done
      loading the Flash and HTC infrastructure. */
  _onObjectScript: function(msg) {
    //console.log('onObjectScript, msg='+this.debugMsg(msg));
    
    // batch for later execution
    this._svgObject._scriptsToExec.push(msg.script);
  },

  /** View XML source for svg. Invoked from flash context menu. */
  _onViewSource: function() {
    var origSVG = this._origSVG;

    if (!origSVG) { // dynamically created SVG objects and roots
      origSVG = 'SVG Source Not Available';
    }
    
    // escape tags
    origSVG = origSVG.replace(/>/g,'&gt;').replace(/</g,'&lt;');

    // place source in a new window
    var w = window.open('', '_blank');
    w.document.write('<html><body><pre>' + origSVG + '</pre></body></html>');
    w.document.close();
  },

  _onViewSourceDynamic: function(msg) {
    // add xml tag if not present
    if (msg.source.indexOf('<?xml') == -1) {
      msg.source='<?xml version="1.0"?>\n' + msg.source;
    }

    // remove svg web artifacts
    msg.source=msg.source.replace(/<svg:([^ ]+) /g, '<$1 ');
    msg.source=msg.source.replace(/<\/svg:([^>]+)>/g, '<\/$1>');
    msg.source=msg.source.replace(/\n\s*<__text[^\/]*\/>/gm, '');
    msg.source=msg.source.replace(/<__text[^>]*>([^<]*)<\/__text>/gm, '$1');
    msg.source=msg.source.replace(/<__text[^>]*>/g, '');
    msg.source=msg.source.replace(/<\/__text>/g, '');
    msg.source=msg.source.replace(/\s*__guid="[^"]*"/g, '');
    msg.source=msg.source.replace(/ id="__svg__random__[^"]*"/g, '');
    msg.source=msg.source.replace(/>\n\n/g, '>\n');
    
    // escape tags
    msg.source=msg.source.replace(/>/g, '&gt;');
    msg.source=msg.source.replace(/</g, '&lt;');
    
    // place source in a new window
    var w = window.open('', '_blank');
    w.document.write('<body><pre>' + msg.source + '</pre></body>');
    w.document.close();
  }

});

/** Creates a NativeHandler that will embed the given SVG into the page using
    native SVG support. Pass in an object literal with the correct arguments.
    Once the handler is setup call start() to have it kick off doing its work.
    
    If dealing with an SVG SCRIPT tag these arguments are:
    
    type - The string 'script'.
    svgID - A unique ID for the SVG root tag.
    xml - XML Document object for parsed SVG.
    svgString - The SVG content as a String.
    origSVG - The original, pre-cleaned up SVG. Useful so that we can
    provide the original SVG for 'View Source' functionality. Only used
    by the FlashHandler.
    scriptNode - The DOM element for the SVG SCRIPT block.
    
    If dealing with an SVG OBJECT tag these arguments are:
    
    type - The string 'object'.
    objID - A unique ID for the SVG OBJECT tag.
    objNode - DOM OBJECT pointing to an SVG URL to handle.
  */
function NativeHandler(args) {
  this.type = args.type;
  
  this._xml = args.xml;
  
  if (this.type == 'object') {
    // these are mostly handled by the browser
    this.id = args.objID;
    this._objNode = args.objNode;
  } else if (this.type == 'script') {
    this.id = args.svgID;
    this._svgString = args.svgString;
    this._scriptNode = args.scriptNode;
  }
}

// start of 'static' singleton functions, mostly around patching the 
// document object with some bug fixes
NativeHandler._patchBrowserObjects = function(win, doc) {
  if (doc._getElementById) {
    // already defined before
    return;
  }
  
  // we have to patch getElementById because getting a node by ID
  // if it is namespaced to something that is not XHTML or SVG does
  // not work natively; we build up a lookup table in _processSVGScript
  // that we can work with later
  // FIXME: explore actually removing support for this, as it's 'correct'
  // behavior according to the XML specification and would save file size
  // and simplify the NativeHandler code significantly
  
  // getElementById
  doc._getElementById = doc.getElementById;
  doc.getElementById = function(id) {
    var result = doc._getElementById(id);
    if (result !== null) { // Firefox doesn't like 'if (result)'
      // This is to solve an edge bug on Safari 3;
      // if you do a replaceChild on a non-SVG, non-HTML node,
      // the element is still returned by getElementById!
      // The element has a null parentNode.
      // TODO: FIXME: Track down whether this is caused by a memory
      // leak of some kind
      if (result.parentNode === null) {
        return null;
      } else {
        return result;
      }
    }
    
    // The id attribute for namespaced, non-SVG and non-HTML nodes
    // does not get picked up by getElementById, such as 
    // <sodipodi:namedview id="someID"/>, so we have to use an XPath 
    // expression
    result = xpath(doc, null, '//*[@id="' + id + '"]');
    if (result.length) {
      var node = result[0];
      
      // add an .id attribute for non-SVG and non-HTML nodes, which
      // don't have them by default in order to have parity with the
      // Flash viewer; note Firefox doesn't like if (node.namespaceURI)
      // rather than (node.namespaceURI !== null)
      if (node.namespaceURI !== null && node.namespaceURI != svgns
          && node.namespaceURI != 'http://www.w3.org/1999/xhtml') {
        svgweb._exportID(node);
      }
      
      return node;
    } else {
      return null;
    }
  };
  
  // we also have to patch getElementsByTagNameNS because it does 
  // not seem to work consistently with namepaced content in an HTML
  // context, I believe due to casing issues (i.e. if the local name
  // were RDF rather than rdf it won't work)
  
  // getElementsByTagNameNS
  doc._getElementsByTagNameNS = doc.getElementsByTagNameNS;
  doc.getElementsByTagNameNS = function(ns, localName) {
    var result = doc._getElementsByTagNameNS(ns, localName);
    
    // firefox doesn't like if (result)
    if (result !== null && result.length !== 0) {
      if (ns !== null && ns != 'http://www.w3.org/1999/xhtml' && ns != svgns) {
        // add an .id attribute for non-SVG and non-HTML nodes, which
        // don't have them by default in order to have parity with the
        // Flash viewer
        for (var i = 0; i < result.length; i++) {
          var node = result[i];
          svgweb._exportID(node);
        }
        
        return result;
      }
      
      return result;
    }
    
    if (result === null || result.length === 0) {
      result = createNodeList();
    }
    
    var xpathResults;
    for (var i = 0; i < svgweb.handlers.length; i++) {
      var handler = svgweb.handlers[i];
      
      if (handler.type == 'object') {
        continue;
      }
      
      var prefix = handler._namespaces['_' + ns];
      if (!prefix) {
        continue;
      }
      
      var expr;
      if (prefix == 'xmlns') { // default SVG namespace
        expr = "//*[namespace-uri()='" + svgns + "' and name()='" 
               + localName + "']";
      } else if (prefix) {
        expr = '//' + prefix + ':' + localName;
      } else {
        expr = '//' + localName;
      }
      
      xpathResults = xpath(doc, handler._svgRoot, expr, handler._namespaces);
      if (xpathResults !== null && xpathResults !== undefined
          && xpathResults.length > 0) {
        for (var j = 0; j < xpathResults.length; j++) {
          var node = xpathResults[j];
          
          // add an .id attribute for non-SVG and non-HTML nodes, which
          // don't have them by default in order to have parity with the
          // Flash viewer; note Firefox doesn't like if (node.namespaceURI)
          // rather than (node.namespaceURI !== null)
          if (node.namespaceURI !== null && node.namespaceURI != svgns
              && node.namespaceURI != 'http://www.w3.org/1999/xhtml') {
            svgweb._exportID(node);
          }
          
          result.push(node);
        }
        
        return result;
      }
    }
    
    return createNodeList();
  };
  
  // When dynamically creating SVG roots that we add to a page, we need to
  // have them fire an onload event to handle the asynchronous nature of the
  // Flash handler. In order to have similar code we patch the Native Handler
  // as well. In a sane world we could just change 
  // SVGSVGElement.prototype.addEventListener when working with this, but
  // Firefox doesn't seem to allow us to over ride that (Safari does). To
  // get around this we do a small patch to createElementNS to slightly
  // patch addEventListener.
  doc._createElementNS = doc.createElementNS;
  doc.createElementNS = function(ns, localName) {
    if (ns != svgns || localName != 'svg') {
      return doc._createElementNS(ns, localName);
    }
    
    // svg root
    var svg = doc._createElementNS(ns, localName);
    
    // patch addEventListener
    svg = NativeHandler._patchAddEventListener(svg);
    
    return svg;
  }
  
  // Native browsers will fire the load event for SVG OBJECTs; we need to
  // intercept event listeners for these so that they don't get fired in
  // the wrong order
  doc._createElement = doc.createElement;
  doc.createElement = function(name, forSVG) {
    if (!forSVG) {
      return doc._createElement(name);
    }
    
    if (forSVG && name == 'object') {
      // patch addEventListener
      var obj = doc._createElement(name);
      obj = NativeHandler._patchAddEventListener(obj);
      return obj;
    } else {
      throw 'Unknown createElement() call for SVG: ' + name;
    }
  }
  
  // cloneNode needs some help or it loses our reference to the patched
  // addEventListener
  NativeHandler._patchCloneNode();
  
  // Firefox/Native needs some help around svgElement.style.* access; see
  // NativeHandler._patchStyleObject for details
  if (isFF) {
    NativeHandler._patchStyleObject(win);
  }
  
  // make sure that calls to window.addEventListener('SVGLoad', ...) or
  // window.onsvgload made from external SVG files works if done _after_
  // the normal window.onload call has fired
  var rootElement = doc.rootElement;
  if (rootElement && rootElement.localName == 'svg'
      && rootElement.namespaceURI == svgns) {
    NativeHandler._patchSvgFileAddEventListener(win, doc);
  }
};

/** If someone calls cloneNode, our patched addEventListener method goes away;
    we need to ensure this doesn't happen. */
NativeHandler._patchCloneNode = function() {
  var proto;
  if (typeof SVGSVGElement != 'undefined') { // Firefox
    proto = SVGSVGElement.prototype;
  } else { // Webkit
    proto = document.createElementNS(svgns, 'svg').__proto__;
  }
  
  if (proto._cloneNode) { // already patched
    return;
  }
  
  proto._cloneNode = proto.cloneNode;
  proto.cloneNode = function(deepClone) {
    var results = this._cloneNode(deepClone);
    NativeHandler._patchAddEventListener(results);
    return results;
  }
}

/** Adds a bit of magic we need on addEventListener so we can
    fire SVGLoad events for dynamically created SVG nodes and load events
    for SVG OBJECTS. Unfortunately Firefox has a frustrating bug where we 
    can't simple override the prototype for addEventListener:
    https://bugzilla.mozilla.org/show_bug.cgi?id=456151
    As a workaround, we have to patch each individual SVG root instance or
    SVG OBJECT instance.
*/
NativeHandler._patchAddEventListener = function(root) {
  //console.log('patchAddEventListener, root='+root.getAttribute('id'));
  
  // Firefox has a bizare bug; if I call createElement('object') then
  // replace it's addEventListener method with our own, _then_ call
  // createElement('object') to create another object, _that_ object's
  // addEventListener is changed as well! This bug is tracked here in Firefox's
  // bugzilla:
  // https://bugzilla.mozilla.org/show_bug.cgi?id=528392
  // Even though the addEventListener method is 'shared', inside the method it
  // is correctly bound to each separate instance, so 'this' is correct.
  // In order to get around the bug, we 'cache' the real addEventListener once
  // as an instance on NativeHandler. Interestingly, this truly is a shared
  // method so pre-patched obj1.addEventListener === obj2.addEventListener,
  // so we can re-use this method (this is probably the source of the issue).
  // We later use this NativeHandler._objectAddEventListener cached instance 
  // inside of our custom addEventListener.
  if (root.nodeName.toLowerCase() == 'object' && !NativeHandler._objectAddEventListener) {
    NativeHandler._objectAddEventListener = root.addEventListener;
  }
  if (root.nodeName.toLowerCase() == 'object') {
    root._addEventListener = NativeHandler._objectAddEventListener;
  } else {
    root._addEventListener = root.addEventListener
  }
  root._onloadListeners = [];
  root.addEventListener = (function(self) {
    return function(type, f, useCapture) {
      if (type.toLowerCase() == 'svgload') {
        this._onloadListeners.push(f);
      } else {
        root._addEventListener(type, f, useCapture);
      }
    }
  })();
    
  return root;
};

/** Surprisingly, Firefox doesn't work when setting svgElement.style.property! 
    For example, if you set myCircle.style.fill = 'red', nothing happens. You 
    have to do myCircle.style.setProperty('fill', 'red', null). This issue is 
    independent of the fact that we are running in a text/html situation,
    and happens in self-contained SVG files as well. To fix this, we have
    to patch in the ability to use the svgElement.style.* syntax. Note that
    Safari, Opera, Chrome, and others all natively support the 
    svgElement.style.* syntax so we don't have to patch anything there.
    
    @param window The owner window to patch.
*/
NativeHandler._patchStyleObject = function(win) {
  // Unfortunately, trying to set SVGElement.prototype.style = to our own
  // custom object that then defines all of our getters and setters doesn't
  // work; somehow that is a 'magical' prototype that doesn't stick. Instead,
  // the trick we have to use is to modify the CSSStyleDeclaration prototype.
  
  // TODO: Test whether adding extra members to CSSStyleDeclaration has
  // a memory impact because it also affects HTML elements; probably not since
  // prototypes are singletons shared by all instances
  
  // prototype definitions are 'window' specific
  var patchMe = win.CSSStyleDeclaration;
  
  // define getters and setters for SVG CSS property names
  for (var i = 0; i < _Style._allStyles.length; i++) {
    var styleName = _Style._allStyles[i];
  
    // convert camel casing (i.e. strokeWidth becomes stroke-width)
    var stylePropName = styleName.replace(/([A-Z])/g, '-$1').toLowerCase();
  
    // Do a trick so that we can have a separate closure for each
    // iteration of the loop and therefore each separate style name; 
    // closures are function-level, so doing an anonymous inline function 
    // will force the closure into just being what we pass into it. If we 
    // don't do this then the closure will actually always simply be the final 
    // index position when the for loop finishes.
    (function(styleName, stylePropName) {
      patchMe.prototype.__defineSetter__(styleName, 
        function(styleValue) {
          return this.setProperty(stylePropName, styleValue, null);
        }
      );
      patchMe.prototype.__defineGetter__(styleName, 
        function() {
          return this.getPropertyValue(stylePropName);
        }
      );
    })(styleName, stylePropName); // pass closure values
  }
};

/**
  This method is meant to address the following edge condition. If we
  have an external SVG file that we have brought in using an SVG
  OBJECT tag, such as foobar.svg, inside _that_ external SVG file
  there might be nested calls to know when SVG Web is done loading
  _after_ the page has loaded:
  
  foobar.svg:
  <svg>
    <script>
      window.addEventListener('load', function() {
        // be able to handle this!
        window.addEventListener('SVGLoad', function() {
          // this should fire
        }, false);
      }, false);
    </script>
  </svg>
  
  @param win The owner window to patch.
  @param doc The owner document to work with.

  Note that there are different possible ways script code might get into a
  patched window.addEventListener:
     If it is called during onload or script tag code, then the script is
  likely patched to run __svgHandler.window.addEventListener where
  __svgHandler.window is a fake _SVGWindow object with a fake addEventListener.
     If the script gets a hold of the real window object, it calls in the
  patched 'real window' method. The following code is the code that patches
  the real window.
*/
NativeHandler._patchSvgFileAddEventListener = function(win, doc) {
  var _addEventListener = win.addEventListener;
  win.addEventListener = function(type, listener, useCapture) {
    if (type.toLowerCase() != 'svgload') {
      _addEventListener(type, listener, useCapture);
    } else {
      if (typeof listener == 'object') {
        listener.handleEvent.call(listener, undefined);
      } else {
        listener();
      }
    }
  }
  if (Object.defineProperty) {
    Object.defineProperty(win, 'onsvgload',
                          { get : function() {
                                    return this.__onsvgload;
                                  },
                            set : function(listener) {
                                    this.__onsvgload = listener;
                                    this.addEventListener('SVGLoad', listener, false);
                                  }
                          });
  } else {
    win.__defineGetter__('onsvgload', function() {
      return this.__onsvgload;
    });
    win.__defineSetter__('onsvgload', function(listener) {
      this.__onsvgload = listener;
      this.addEventListener('SVGLoad', listener, false);
    });
  }
};

// end of static singleton functions

// methods that every NativeHandler instance has
extend(NativeHandler, {
  /** Has this handler kick off its work. */
  start: function() {
    //console.log('start');
    if (this.type == 'object') {
      this._handleObject();
    } else if (this.type == 'script') {
      this._handleScript();
    }
  },
  
  /** Handles SVG embedded into the page with a SCRIPT tag. */
  _handleScript: function() {
    // build up a list of namespaces, used by our patched getElementsByTagNameNS
    this._namespaces = this._getNamespaces();
    
    // replace the SCRIPT node with some actual SVG
    this._processSVGScript(this._xml, this._svgString, this._scriptNode);
    
    // indicate that we are done
    this._loaded = true;
    svgweb._handleDone(this.id, 'script', this);
  },
  
  /** Handles SVG embedded into the page with an OBJECT tag. */
  _handleObject: function() {
    //console.log('handleObject');
    
    // needed so that Firefox doesn't display scroll bars on SVG content
    // (Issue 164: http://code.google.com/p/svgweb/issues/detail?id=164)
    // FIXME: Will this cause issues if someone wants to override default
    // overflow behavior?
    this._objNode.style.overflow = 'hidden';
        
    // make the object visible again
    this._objNode.style.visibility = 'visible';
    
    // at this point we wait for our SVG OBJECTs to call svgweb.addOnLoad
    // so we can know they have loaded. Some browsers however will fire the 
    // onload of the SVG file _before_ our NativeHandler is done depending
    // on whether they are loading from the cache or not; others will do it the 
    // opposite way (Safari). If the onload was fired and therefore 
    // svgweb.addOnLoad was called, then we stored a reference to the SVG file's 
    // Window object there.
    if (this._objNode._svgWindow) {
      this._onObjectLoad(this._objNode._svgFunc, this._objNode._svgWindow);
    } else {    
      // if SVG Window isn't there, then we need to wait for svgweb.addOnLoad
      // to get called by the SVG file itself. Store a reference to ourselves
      // to be used there.
      this._objNode._svgHandler = this;
      
      // if this is a purely static SVG file and it's the only one on the page
      // then we need to manually see when it loads for Firefox; Safari
      // correctly fires our onload listener but not Firefox.
      // Issue 219: "body.onload not fired for SVG OBJECT"
      // http://code.google.com/p/svgweb/issues/detail?id=219
      var self = this;
      // Our OBJECT node could have come about in two ways:
      // * It was dynamically created with createElement - in this case 
      // make sure to call the original, unpatched version of
      // addEventListener (notice that it is _addEventListener below)! We
      // patched this in NativeHandler._patchAddEventListener().
      // * It was in the markup of the page on page load - use the standard
      // unpatched addEventListener
      var loadFunc = function() {
        // svgweb.removeChild might have been called before we are fired
        if (!self._objNode.contentDocument) {
          return;
        }
        var win = self._objNode.contentDocument.defaultView;
        self._onObjectLoad(self._objNode._svgFunc, win);
      };
      if (this._objNode._addEventListener) {
        this._objNode._addEventListener('load', loadFunc, false);
      } else {
        // Issue 599 - Opera 11 on Win XP (and other reported versions) does
        // not fire the object listener for objects in markup if the cache is clear.
        // It was found that if you have an onload="..." listener in the object
        // markup, the load event is fired. So, the workaround is only
        // used when there is no such handler in place.
        // The workaround is to remove the object from the DOM and append it
        // back to the page. This appears to "reactivate" the object so the load
        // event is fired.
        // Since this is potentially disruptive, care is taken to do this
        // only for Opera and to make sure the object is added back in the proper
        // position. If this workaround causes a problem for you, try
        // adding onload="" to your object markup which is less disruptive.
        if (isOpera && this._objNode.onload == null) {
          var parentNode = this._objNode.parentNode;
          var nextSibling = this._objNode.nextSibling;
          parentNode.removeChild(this._objNode);
          this._objNode.addEventListener('load', loadFunc, false);
          if (nextSibling) {
             parentNode.insertBefore(this._objNode, nextSibling);
          } else {
             parentNode.appendChild(this._objNode);
          }
        } else {
          this._objNode.addEventListener('load', loadFunc, false);
        }
      }
    }
  },
  
  /** Called by svgweb.addOnLoad() or our NativeHandler function constructor
      after an SVG OBJECT has loaded to tell us that we have loaded. We require 
      that script writers manually tell us when they have loaded; see 
      'Knowing When Your SVG Is Loaded' section in the documentation.
      
      @param func The actual onload function to fire inside the SVG file
      (i.e. this is the function the end developer wants run when the SVG
      file is done loading).
      @param win The Window object inside the SVG OBJECT */
  _onObjectLoad: function(func, win) {
    //console.log('onObjectLoad');
    
    // we might have already been called before
    if (this._loaded) {
      // If we are being called by addOnLoad, we still need to run the
      // onload listener being added, even if the object has already loaded.
      // This behavior only appears to occur on IE 9, which has been
      // observed firing the object load event before the svg onload event.
      if (func) {
        func.apply(win);
      }
      return;
    }
    
    // flag that we are loaded
    this._loaded = true;
    
    // patch various browser objects to correct some browser bugs and 
    // to have more consistency between the Flash and Native handlers
    var doc = win.document;    
    NativeHandler._patchBrowserObjects(win, doc);
    
    // make the SVG root currentTranslate property work like the FlashHandler,
    // which slightly diverges from the standard due to limitations of IE
    var root = doc.rootElement;
    if (root) {
      this._patchCurrentTranslate(root);
    }
    
    // expose the svgns and xlinkns variables inside in the SVG files 
    // Window object
    win.svgns = svgns;
    win.xlinkns = xlinkns;
    
    // build up list of namespaces so that getElementsByTagNameNS works with
    // foreign namespaces
    this._namespaces = this._getNamespaces(doc);
    
    // execute the actual SVG onload that the developer wants run
    if (func) {
      func.apply(win);
    }
    
    // execute any cached onload listeners that might been registered with
    // addEventListener on the SVG OBJECT
    for (var i = 0; this._objNode._onloadListeners 
                    && i < this._objNode._onloadListeners.length; i++) {
      func = this._objNode._onloadListeners[i];
      func.apply(this._objNode);
    }
    
    // try to fire the page-level onload event; the svgweb object will check
    // to make sure all SVG OBJECTs are loaded
    svgweb._fireOnLoad();
  },
  
  /** Inserts the SVG back into the HTML page with the correct namespace. */
  _processSVGScript: function(xml, svgString, scriptNode) {
   var xml, importedSVG;
   try {
     importedSVG = document.importNode(xml.documentElement, true);
   } catch (e) {
     // IE 9 cannot import an MSXML node, so create a standards based
     // XML node to adopt, using DOMParser.
     if (typeof DOMParser != 'undefined') {
       xml = (new DOMParser()).parseFromString(svgString, 'application/xml');
       importedSVG = document.adoptNode(xml.documentElement, true);
     }
   }
   scriptNode.parentNode.replaceChild(importedSVG, scriptNode);
   this._svgRoot = importedSVG;
   
   // make the SVG root currentTranslate property work like the FlashHandler,
   // which slightly diverges from the standard due to limitations of IE
   this._patchCurrentTranslate(this._svgRoot);
  },
  
  /** Extracts any namespaces we might have, creating a prefix/namespaceURI
      lookup table.
      
      NOTE: We only support namespace declarations on the root SVG node
      for now.
      
      @param doc Optional. If present, then we retrieve the list of namespaces
      from the SVG inside of the object. This is the document object inside the
      SVG file.
      
      @returns An object that associates prefix to namespaceURI, and vice
      versa. */
  _getNamespaces: function(doc) {
    var results = [];
    
    var attrs;
    if (doc) {
      attrs = doc.documentElement.attributes;
    } else {
      attrs = this._xml.documentElement.attributes;
    }
    
    for (var i = 0; i < attrs.length; i++) {
      var attr = attrs[i];
      if (/^xmlns:?(.*)$/.test(attr.nodeName)) {
        var m = attr.nodeName.match(/^xmlns:?(.*)$/);
        var prefix = (m[1] ? m[1] : 'xmlns');
        var namespaceURI = attr.nodeValue;
        
        // don't add duplicates
        if (!results['_' + prefix]) {
          results['_' + prefix] = namespaceURI;
          results['_' + namespaceURI] = prefix;
          results.push(namespaceURI);
        }
      }
    }
    
    return results;
  },
  
  /** We patch native browsers to use our getter/setter syntax for 
      currentTranslate (we have to use formal methods like
      currentTranslate.setX() for the Flash renderer instead of 
      currentTranslate.x = 3 due to limitations in Internet Explorer)

      @root The SVG Root on which we are going to patch the 
      currentTranslate property. */
  _patchCurrentTranslate: function(root) {
    //console.log('patchCurrentTranslate, root='+root);

    // we have to unfortunately do this at runtime for each SVG OBJECT
    // since for Firefox/Native the SVGPoint prototype doesn't seem to correctly
    // extend the currentTranslate property; Safari likes us to extend
    // the prototype which DOES work there (and FF doesn't), while FF wants
    // us to extend the actual currentTranslate instance (which Safari
    // doesn't like)
    var t;
    if (typeof SVGRoot != 'undefined') { // FF
      t = root.currentTranslate;
    } else if (typeof root.currentTranslate.__proto__ != 'undefined') {
      // Safari
      t = root.currentTranslate.__proto__;
    } else if (typeof SVGPoint != 'undefined') { // Opera
      // Issue 358:
      // "Opera throws exception on patch to currentTranslate"
      // http://code.google.com/p/svgweb/issues/detail?id=358
      t = SVGPoint.prototype;
    }
    
    t.setX = function(newValue) { return this.x = newValue; }
    t.getX = function() { return this.x; }
    t.setY = function(newValue) { return this.y = newValue; }
    t.getY = function() { return this.y; }
    // custom extension in SVG Web to aid performance for Flash renderer
    t.setXY = function(newValue1, newValue2) {
      this.x = newValue1;
      this.y = newValue2;
    }    
  }
  
});

/** Utility class that helps us keep track of any suspendRedraw operations
    that might be in effect. The FlashHandler.sendToFlash() method is the
    primary point at which we check to see if things are suspended; if they
    are, then we batch them up internally. When things are unsuspended we
    send them all over in one shot to Flash.
    
    @param handler The handler associated with this _RedrawManager */
function _RedrawManager(handler) {
  this._handler = handler;
  
  // we batch all the methods and messages into an array
  this._batch = [];
  
  // the next available suspend ID; we increment this each time so we don't
  // get duplicate suspend IDs
  this._nextID = 1;
  
  // array of our suspend IDs
  this._ids = [];
  
  // a lookup table going from suspend ID to a window.setTimeout ID
  this._timeoutIDs = {};
}

extend(_RedrawManager, {
  /** Returns true if redrawing is suspended. */
  isSuspended: function() {
    return (this._ids.length > 0);
  },
  
  /** Batches up the given Flash method and message for later execution
      when things are unsuspended. 
      
      @param method Flash method to invoke
      @param message Message to send to Flash method. */
  batch: function(method, message) {
    // turn into a single string
    this._batch.push(method + ':' + message);
  },
  
  suspendRedraw: function(ms, notifyFlash) {
    if (ms === undefined) {
      throw 'Not enough arguments to suspendRedraw';
    }
    if (notifyFlash === undefined) {
      notifyFlash = true;
    }
    
    // generate an ID
    var id = this._nextID; /* technically should be unsigned long */
    this._nextID++;
    
    // kick off a timer to cancel if not unsuspended by developer in time
    var self = this;
    var timeoutID = window.setTimeout(function() {
      self.unsuspendRedraw(id);
      delete self._timeoutIDs['_' + id];
    }, ms);
    
    // store an entry
    this._ids.push(id);
    this._timeoutIDs['_' + id] = timeoutID;
    
    // tell Flash to stop rendering
    // there is a chance that suspendRedraw is called while the page
    // is unloading from a setTimout interval; surround everything with a 
    // try/catch block to prevent an exception from blocking page unload
    if (notifyFlash) {
      try {
        // Flash callback functions may disappear on IE 9
        if (typeof(this._handler.flash.jsSuspendRedraw) == 'undefined') {
          __flash__addCallback(this._handler.flash, 'jsSuspendRedraw');
        }
        this._handler.flash.jsSuspendRedraw();
      } catch (exp) {
        console.log("suspendRedraw exception: " + exp);
      }
    }
      
    return id;
  },
  
  unsuspendRedraw: function(id, notifiedFlash) {
    if (notifiedFlash === undefined) {
      notifiedFlash = true;
    }
    
    var idx = -1;
    for (var i = 0; i < this._ids.length; i++) {
      if (this._ids[i] == id) {
        idx = i;
        break;
      }
    }
    if (idx == -1) {
      throw 'Unknown id passed to unsuspendRedraw: ' + id;
    }
  
    // clear timeout if still in effect
    if (this._timeoutIDs['_' + id] != undefined) {
      window.clearTimeout(this._timeoutIDs['_' + id]);
    }
  
    // clear entry
    this._ids.splice(idx, 1);
    delete this._timeoutIDs['_' + id];
  
    // other suspendRedraws in effect or nothing to do?
    // Even if the length is zero, if flash was notified of the suspension
    // then it needs to be notified of the unsuspension. If the caller
    // knows flash was never notified of the suspension, they pass notifyFlash=false
    // and we are free to exit here if there is no suspended work.
    if (this.isSuspended() || (this._batch.length == 0 && !notifiedFlash)) {
      return;
    }
  
    // Send over everything to Flash now. We call jsUnsuspendRedrawAll and
    // send over everything as a giant string. This string is setup as follows.
    // method:message__SVG__METHOD__DELIMIT
    // Basically, we have the method name, followed by a colon, followed
    // by the message to send to that method (which might have __SVG__DELIMITs
    // in it). Each method is separated by the __SVG__METHOD__DELIMIT
    // delimiter.
    var sendMe = this._batch.join('__SVG__METHOD__DELIMIT');
    this._batch = [];
    
    // there is a chance that unsuspendRedraw is called while the page
    // is unloading from a setTimout interval; surround everything with a 
    // try/catch block to prevent an exception from blocking page unload
    try {
      // Flash callback functions may disappear on IE 9
      if (typeof(this._handler.flash.jsUnsuspendRedrawAll) == 'undefined') {
        __flash__addCallback(this._handler.flash, 'jsUnsuspendRedrawAll');
      }
      this._handler.flash.jsUnsuspendRedrawAll(sendMe);
    } catch (exp) {
      console.log('unsuspendRedraw exception: ' + exp);
    }
  },
  
  unsuspendRedrawAll: function() {
    for (var i = 0; i < this._ids.length; i++) {
      this.unsuspendRedraw(this._ids[i]);
    }
  },
  
  forceRedraw: function() {
    // not implemented
  }
});    


/*
  The SVG 1.1 spec requires DOM Level 2 Core and Events support.
  
  DOM Level 2 Core spec: http://www.w3.org/TR/DOM-Level-2-Core/
  DOM Level 2 Events spec: 
  http://www.w3.org/TR/DOM-Level-2-Events/events.html#Events-Registration-interfaces
  
  The following DOM 2 Core interfaces are not supported:
  NamedNodeMap, Attr, Text, Comment, CDATASection, 
  DocumentType, Notation, Entity, EntityReference,
  ProcessingInstruction

  We underscore our DOM interface names below so that they don't collide 
  with the browser's implementations of these (for example, Firefox exposes 
  the DOMException, Node, etc. interfaces as well)
*/

function _DOMImplementation() {}

extend(_DOMImplementation, {
  hasFeature: function(feature /* String */, version /* String */) /* Boolean */ {
    // TODO
  }
  
  // Note: createDocumentType and createDocument left out
});


// Note: Only element, text nodes, document nodes, and document fragment nodes
// are supported for now. We don't parse and retain comments, processing 
// instructions, etc. CDATA nodes are turned into text nodes.
function _Node(nodeName, nodeType, prefix, namespaceURI, nodeXML, handler) {
  if (nodeName === undefined && nodeType === undefined) {
    // prototype subclassing
    return;
  }
  
  this.nodeName = nodeName;
  this._nodeXML = nodeXML;
  this._handler = handler;
  this._listeners = {};
  this._detachedListeners = [];
  this.fake = true;
  
  // Firefox and Safari will incorrectly turn our internal parsed XML
  // for the Flash Handler into actual SVG nodes, causing issues. This is
  // a workaround to prevent this problem.
  if (namespaceURI == svgnsFake) {
    namespaceURI = svgns;
  }
  
  // handle nodes that were created with createElementNS but are not yet
  // attached to the document yet
  if (nodeType == _Node.ELEMENT_NODE && !this._nodeXML) {
    // build up an empty XML node for this element
    var xml = '<?xml version="1.0"?>\n';
    if (namespaceURI == svgns && !prefix) {
      // we use a fake namespace for SVG to prevent Firefox and Safari
      // from incorrectly making these XML nodes real SVG objects!
      // Add the xlink so that it is not prepended later before the xmlns attr.
      // IE 9 does not tolerate the xlink namespace declaration prior to the
      // xmlns declaration.
      xml += '<' + nodeName + ' xmlns="' + svgnsFake + '" xmlns:xlink="http://www.w3.org/1999/xlink"/>';
    } else {
      xml += '<' + nodeName + ' xmlns:' + prefix + '="' + namespaceURI + '"/>';
    }
            
    this._nodeXML = parseXML(xml).documentElement;
  } else if (nodeType == _Node.DOCUMENT_FRAGMENT_NODE) {
    var xml = '<?xml version="1.0"?>\n'
              + '<__document__fragment></__document__fragment>';
    this._nodeXML = parseXML(xml).documentElement;
  }
  
  // handle guid tracking
  if (nodeType != _Node.DOCUMENT_NODE && this._nodeXML) {
    if (!this._nodeXML.getAttribute('__guid')) {
      this._nodeXML.setAttribute('__guid', guid());
    }
    this._guid = this._nodeXML.getAttribute('__guid');
    
    // store a reference to the new node so that later fetching of this
    // node will respect object equality
    svgweb._guidLookup['_' + this._guid] = this;
  }
  
  if (nodeType == _Node.ELEMENT_NODE) {
    if (nodeName.indexOf(':') != -1) {
      this.localName = nodeName.match(/^[^:]*:(.*)$/)[1];
    } else {
      this.localName = nodeName;
    }
  }
  
  if (nodeType) {
    this.nodeType = nodeType;
  } else {
    this.nodeType = _Node.ELEMENT_NODE;
  }
    
  if (nodeType == _Node.ELEMENT_NODE 
      || nodeType == _Node.DOCUMENT_NODE
      || nodeType == _Node.DOCUMENT_FRAGMENT_NODE) {
    this.prefix = prefix;
    this.namespaceURI = namespaceURI;
    this._nodeValue = null;
  } else if (nodeType == _Node.TEXT_NODE) {
    // We store the actual text node value as a child of our 'fake' DOM
    // Element. We have to use a DOM Element so that we have access to
    // setAttribute to store a fake __guid attribute to track the text node. 
    this._nodeValue = this._nodeXML.firstChild.nodeValue;
    
    // browsers return null instead of undefined; match their behavior
    this.prefix = null;
    this.namespaceURI = null;
    if (this._nodeValue === undefined) {
      this._nodeValue = null;
    }
  }
  
  // even when not attached native behavior for ownerDocument is to be
  // set to 'document'
  this.ownerDocument = document;
  // if we are an SVG OBJECT set to our fake pseudo _Document
  if (this._handler && this._handler.type == 'object') {
    this.ownerDocument = this._handler.document;
  }
  
  // create empty stub methods for certain methods to help IE's HTC be
  // smaller, which has a very strong affect on performance
  if (isIE) {
    this._createEmptyMethods();
  }
  
  this._childNodes = this._createChildNodes();
    
  // we use an XML Element rather than an XML Text Node to 'track' our
  // text nodes; indicate as such using an attribute
  if (nodeType == _Node.TEXT_NODE) {
    this._nodeXML.setAttribute('__fakeTextNode', true);
  }
  
  // prepare the getter and setter magic for non-IE browsers
  if (!isIE) {
    this._defineNodeAccessors();
  } else if (isIE && this.nodeType != _Node.DOCUMENT_NODE) {
    // If we are IE, we must use a behavior in order to get onpropertychange
    // and override core DOM methods. We only do this for normal SVG elements
    // and DocumentFragments and not for the DOCUMENT element.
    this._createHTC();
  }
}

mixin(_Node, {
  ELEMENT_NODE: 1,
  TEXT_NODE: 3,
  DOCUMENT_NODE: 9,
  DOCUMENT_FRAGMENT_NODE: 11
  
  // Note: many other node types left out here
});

extend(_Node, {
  /* Event listeners; this is an object hashtable that keys the event name,
     such as 'mousedown', with an array of functions to execute when this 
     event happens. This second level array is also used as an object
     hashtable to associate the function + useCapture with the listener so
     that we can implement removeListener at a later point. We only add to
     this table if the node is attached to the DOM. Example:
     
     _listeners['mousedown'] --> array of listeners
     _listeners['mousedown'][0] --> first mousedown listener, a function
     _listeners['mousedown']['_' + someListener + ':' + useCapture] --> 
                                  getting listener by function reference for
                                  mouse down event 
  */
  _listeners: null,
  
  /* An array that we use to store addEventListener requests for detached nodes, 
     where each array entry is an object literal with the following values:
     
     type - The type of the event
     listener - The function object to execute
     useCapture - Whether to use capturing or not. */
  _detachedListeners: null,
  
  insertBefore: function(newChild /* _Node */, refChild /* _Node */) {
    //console.log('insertBefore, newChild='+newChild.id+', refChild='+refChild.id);
    
    if (this.nodeType != _Node.ELEMENT_NODE
        && this.nodeType != _Node.DOCUMENT_FRAGMENT_NODE) {
      throw 'Not supported';
    }
    
    // Issue 296: existing child should not be added again
    if (newChild.parentNode) {
      newChild.parentNode.removeChild(newChild);
    }
    
    // if the children are DOM nodes, turn them into _Node or _Element
    // references
    newChild = this._getFakeNode(newChild);
    refChild = this._getFakeNode(refChild);
    
    // flag that indicates that the child is a _DocumentFragment (keeps
    // the overall code smaller); we have to treat these differently since
    // we are importing all of the DocumentFragment's children rather than
    // just one new child
    var isFragment = (newChild.nodeType == _Node.DOCUMENT_FRAGMENT_NODE);
    var fragmentChildren;
    if (isFragment) {
      fragmentChildren = newChild._getChildNodes(true /* get fake nodes */);
    }
    
    // are we an empty DocumentFragment?
    if (isFragment && fragmentChildren.length == 0) {
      // nothing to do
      newChild._reset(); // clean out DocumentFragment
      return newChild._getProxyNode();
    }
    
    // get an index position for where refChild is
    var findResults = this._findChild(refChild);
    if (findResults === null) {
      // TODO: Throw the correct DOM error instead
      throw new Error('Invalid child passed to insertBefore');
    }
    var position = findResults.position;
    
    // import the newChild or all of the _DocumentFragment children into 
    // ourselves, insert it into our XML, and process the newChild and all 
    // its descendants
    var importMe = [];
    if (isFragment) {
      for (var i = 0; i < fragmentChildren.length; i++) {
        importMe.push(fragmentChildren[i]);
      }
    } else {
      importMe.push(newChild);
    }
    for (var i = 0; i < importMe.length; i++) {
      var importedNode = this._importNode(importMe[i], false);
      this._nodeXML.insertBefore(importedNode, refChild._nodeXML);
      this._processAppendedChildren(importMe[i], this, this._attached);
    }
    
    // inform Flash about the change
    if (this._attached && this._passThrough) {
      var xmlString = FlashHandler._encodeFlashData(
                          xmlToStr(newChild, this._handler.document._namespaces));
      this._handler.sendToFlash('jsInsertBefore',
                                [ refChild._guid, this._guid, position, xmlString ]);
    }
    
    if (!isIE) {
      // _childNodes is an object literal instead of an array
      // to support getter/setter magic for Safari
      for (var i = 0; i < importMe.length; i++) {
        this._defineChildNodeAccessor(this._childNodes.length);
        this._childNodes.length++;
      }
    }
    
    // clear out the child if it is a DocumentFragment
    if (newChild.nodeType == _Node.DOCUMENT_FRAGMENT_NODE) {
      newChild._reset();
    } else {
      newChild._attached = this._attached;
    }

    return newChild._getProxyNode();
  },
  
  replaceChild: function(newChild /* _Node */, oldChild /* _Node */) {
    //console.log('replaceChild, newChild='+newChild.nodeName+', oldChild='+oldChild.nodeName);
    
    if (this.nodeType != _Node.ELEMENT_NODE
        && this.nodeType != _Node.DOCUMENT_FRAGMENT_NODE) {
      throw 'Not supported';
    }
    
    // Issue 296: existing child should not be added again
    if (newChild.parentNode) {
      newChild.parentNode.removeChild(newChild);
    }
    
    // the children could be DOM nodes; turn them into something we can
    // work with, such as _Nodes or _Elements
    newChild = this._getFakeNode(newChild);
    oldChild = this._getFakeNode(oldChild);
    
    // flag that indicates that the child is a _DocumentFragment (keeps
    // the overall code smaller); we have to treat these differently since
    // we are importing all of the DocumentFragment's children rather than
    // just one new child
    var isFragment = (newChild.nodeType == _Node.DOCUMENT_FRAGMENT_NODE);
    var fragmentChildren;
    if (isFragment) {
      fragmentChildren = newChild._getChildNodes(true /* get fake nodes */);
    }
    
    // are we an empty DocumentFragment?
    if (isFragment && fragmentChildren.length == 0) {
      // nothing to do
      newChild._reset(); // clean out DocumentFragment
      return newChild._getProxyNode();
    }
    
    // in our XML, find the index position of where oldChild used to be
    var findResults = this._findChild(oldChild);
    if (findResults === null) {
      // TODO: Throw the correct DOM error instead
      throw new Error('Invalid child passed to replaceChild');
    }
    var position = findResults.position;
    
    // remove oldChild
    this.removeChild(oldChild);
    
    // import the newChild or all of the _DocumentFragment children into 
    // ourselves, insert it into our XML, and process the newChild and all 
    // its descendants
    var importMe = [];
    if (isFragment) {
      for (var i = 0; i < fragmentChildren.length; i++) {
        importMe.push(fragmentChildren[i]);
      }
    } else {
      importMe.push(newChild);
    }
    
    if (!isIE) {
      for (var i = 0; i < importMe.length; i++) {
        // _childNodes is an object literal instead of an array
        // to support getter/setter magic for Safari
        this._defineChildNodeAccessor(this._childNodes.length);
        this._childNodes.length++;
      }
    }
    
    var addToEnd = false;
    if (position >= this._nodeXML.childNodes.length) {
      addToEnd = true;
    }
    var insertAt = position;
    for (var i = 0; i < importMe.length; i++) {    
      // import newChild into ourselves, telling importNode not to do an
      // appendChild since we will handle things ourselves manually later on
      var importedNode = this._importNode(importMe[i], false);

      // now bring the imported child into our XML where the oldChild used to be
      if (addToEnd) {
        // old node was at the end -- just do an appendChild
        this._nodeXML.appendChild(importedNode);
      } else {
        // old node is somewhere in the middle or beginning; jump one ahead
        // from the old position and do an insertBefore
        var placeBefore = this._nodeXML.childNodes[insertAt];
        this._nodeXML.insertBefore(importedNode, placeBefore);
        insertAt++;
      }
    }
    
    // tell Flash about the newly inserted child
    if (this._attached && this._passThrough) {
      var xmlString = FlashHandler._encodeFlashData(
                            xmlToStr(newChild, this._handler.document._namespaces));
      this._handler.sendToFlash('jsAddChildAt',
                                [ this._guid, position, xmlString ]);
    }
    
    // now process the newChild's node
    this._processAppendedChildren(newChild, this, this._attached);
    
    // recursively set the removed node to be unattached and to not
    // pass through changes to Flash anymore
    oldChild._setUnattached();
    
    // track this removed node so we can clean it up on page unload
    svgweb._removedNodes.push(oldChild._getProxyNode());
    
    // clear out the child if it is a DocumentFragment
    if (newChild.nodeType == _Node.DOCUMENT_FRAGMENT_NODE) {
      newChild._reset();
    } else {
      newChild._attached = this._attached;
    }
    
    return oldChild._getProxyNode();
  },
  
  removeChild: function(child /* _Node or DOM Node */) {
    //console.log('removeChild, child='+child.nodeName+', this='+this.nodeName);
    if (this.nodeType != _Node.ELEMENT_NODE
        && this.nodeType != _Node.DOCUMENT_FRAGMENT_NODE) {
      throw 'Not supported';
    }
    
    if (child.nodeType != _Node.ELEMENT_NODE 
        && child.nodeType != _Node.TEXT_NODE) {
      throw 'Not supported';    
    }
    
    // the child could be a DOM node; turn it into something we can
    // work with, such as a _Node or _Element
    child = this._getFakeNode(child);

    // remove child from our list of XML
    var findResults = this._findChild(child);
    if (findResults === null) {
      // TODO: Throw the correct DOM error instead
      throw new Error('Invalid child passed to removeChild');
    }
    var position = findResults.position;
    
    this._nodeXML.removeChild(findResults.nodeXML);

    // remove from our nodeById lookup table
    if (child.nodeType == _Node.ELEMENT_NODE) {
      var childID = child._getId();
      if (childID && this._attached) {
        this._handler.document._nodeById['_' + childID] = undefined;
      }
    }
    
    // TODO: FIXME: Note that we don't remove the node from the GUID lookup
    // table; this is because developers might still be working with the
    // node while detached, and we want object equality to hold. This means
    // that memory will grow over time however. Find a good solution to this
    // issue without having to have the complex unattached child node structure
    // we had before.    
    //svgweb._guidLookup['_' + child._guid] = undefined;
    
    // persist event listeners if this node is later reattached
    child._persistEventListeners();
    
    // remove the getter/setter for this childNode for non-IE browsers
    if (!isIE) {
      // just remove the last getter/setter, since they all resolve
      // to a dynamic function anyway
      delete this._childNodes[this._childNodes.length - 1];
      this._childNodes.length--;
    } else {
      // for IE, remove from _childNodes data structure
      this._childNodes.splice(position, 1);
    }
    
    // inform Flash about the change
    if (this._attached && this._passThrough) {
      this._handler.sendToFlash('jsRemoveChild', [ child._guid ]);
    }
    
    // recursively set the removed node to be unattached and to not
    // pass through changes to Flash anymore
    child._setUnattached();
    
    // track this removed node so we can clean it up on page unload
    svgweb._removedNodes.push(child._getProxyNode());
    
    return child._getProxyNode();  
  },
  
  /** Appends the given child. The child can either be _Node, an
      actual DOM Node, or a Text DOM node created through 
      document.createTextNode. We return either a _Node or an HTC reference
      depending on the browser. */
  appendChild: function(child /* _Node or DOM Node */) {
    //console.log('appendChild, child='+child.nodeName+', this.nodeName='+this.nodeName);
    if (this.nodeType != _Node.ELEMENT_NODE
        && this.nodeType != _Node.DOCUMENT_FRAGMENT_NODE) {
      throw 'Not supported';
    }
    
    // Issue 296: existing child should not be added again
    if (child.parentNode) {
      child.parentNode.removeChild(child);
    }
    
    // the child could be a DOM node; turn it into something we can
    // work with, such as a _Node or _Element
    child = this._getFakeNode(child);
    
    // flag that indicates that the child is a _DocumentFragment (keeps
    // the overall code smaller); we have to treat these differently since
    // we are importing all of the DocumentFragment's children rather than
    // just one new child
    var isFragment = (child.nodeType == _Node.DOCUMENT_FRAGMENT_NODE);
    var fragmentChildren;
    if (isFragment) {
      fragmentChildren = child._getChildNodes(true /* get fake nodes */);
    }
    
    // are we an empty DocumentFragment?
    if (isFragment && fragmentChildren.length == 0) {
      // nothing to do
      child._reset(); // clean out DocumentFragment
      return child._getProxyNode();
    }
    
    // add the child's XML to our own
    if (isFragment) {
      for (var i = 0; i < fragmentChildren.length; i++) {
        this._importNode(fragmentChildren[i]);
      }
    } else {
      this._importNode(child);
    }
    
    if (isIE) {
      // _childNodes is a real array on IE rather than an object literal
      // like other browsers
      if (isFragment) {
        for (var i = 0; i < fragmentChildren.length; i++) {
          this._childNodes.push(fragmentChildren[i]._htcNode);
        }
      } else {
        this._childNodes.push(child._htcNode);
      }
    } else {
      // _childNodes is an object literal instead of an array
      // to support getter/setter magic for Safari
      if (isFragment) {
        for (var i = 0; i < fragmentChildren.length; i++) {
          this._defineChildNodeAccessor(this._childNodes.length);
          this._childNodes.length++;
        }
      } else {
        this._defineChildNodeAccessor(this._childNodes.length);
        this._childNodes.length++;
      }
    }

    // serialize this node and all its children into an XML string and
    // send that over to Flash
    if (this._attached && this._passThrough) {  
      // note that if the child is a DocumentFragment that we simply send
      // the <__document__fragment> tag over to Flash so it knows what it is
      // dealing with
      var xmlString = FlashHandler._encodeFlashData(
                        xmlToStr(child, this._handler.document._namespaces));
      this._handler.sendToFlash('jsAppendChild', [ this._guid, xmlString ]);
    }

    // process the children (cache important info, add a handler, etc.)
    this._processAppendedChildren(child, this, this._attached);

    // clear out the child if it is a DocumentFragment
    if (child.nodeType == _Node.DOCUMENT_FRAGMENT_NODE) {
      child._reset();
    } else {
      child._attached = this._attached;
    }

    return child._getProxyNode();
  },
  
  hasChildNodes: function() /* Boolean */ {
    return (this._getChildNodes().length > 0);
  },
  
  // Note: cloneNode and normalize not supported
  
  isSupported: function(feature /* String */, version /* String */) {
    if (version == '2.0') {
      if (feature == 'Core') {
        // NOTE: There are a number of things we don't yet support in Core,
        // but we support the bulk of it
        return true;
      } else if (feature == 'Events' || feature == 'UIEvents'
                 || feature == 'MouseEvents') {
        // NOTE: We plan on supporting most of these interfaces, but not
        // all of them
        return true;
      }
    } else {
      return false;
    }
  },
  
  hasAttributes: function() /* Boolean */ {
    if (this.nodeType == _Node.ELEMENT_NODE) {
      for (var i in this._attributes) {
        // if this is an XMLNS declaration, don't consider it a valid
        // attribute for hasAttributes
        if (/^_xmlns/i.test(i)) {
          continue;
        }
        
        // if there is an ID attribute, but it's one of our randomly generated
        // ones, then don't consider this a valid attribute for hasAttributes
        if (i == '_id' && /^__svg__random__/.test(this._attributes[i])) {
          continue;
        }
        
        // ignore our internal __guid and __fakeTextNode attributes;
        // note that we have an extra _ before our attribute name when we
        // store it internally, so __guid becomes ___guid
        if (i == '___guid' && /^__guid/.test(this._attributes[i])) {
          continue;
        }
        if (i == '___fakeTextNode' 
            && /^__fakeTextNode/.test(this._attributes[i])) {
          continue;
        }
        
        // our attributes start with an underscore
        if (/^_.*/.test(i) && this._attributes.hasOwnProperty(i)) {
          return true;
        }
      }
      
      return false;
    } else {
      return false;
    }
  },
  
  /*
    DOM Level 2 EventTarget interface methods.
  
    Note: dispatchEvent not supported. Technically as well this interface
    should not appear on SVG elements that don't have any event dispatching,
    such as the SVG DESC element, but in our implementation they still appear.
    We also don't support the useCapture feature for addEventListener and
    removeEventListener.
  */
  
  /* @param _adding Internal boolean flag used when we are adding this node
     to a real DOM, so that we can replay and send our addEventListener 
     request over to Flash. */
  addEventListener: function(type, listener /* Function */, useCapture, 
                             _adding /* Internal -- Boolean */) {
    //console.log('addEventListener, type='+type+', listener='+listener+', useCapture='+useCapture+', _adding='+_adding);
    // NOTE: capturing not supported
    
    if (this.nodeType != _Node.ELEMENT_NODE
        && this.nodeType != _Node.TEXT_NODE
        && (this.nodeType != _Node.DOCUMENT_NODE || type.substring(0,3) != 'key')) {
      throw 'Not supported';
    }
    
    if (!_adding && !this._attached) {
      // add to a list of event listeners that will get truly registered when
      // we get attached in _Node._processAppendedChildren()
      this._detachedListeners.push({ type: type, listener: listener, useCapture: useCapture });
      return;
    }
    
    // add to our list of event listeners
    if (this._listeners[type] === undefined) {
      this._listeners[type] = [];
    }
    this._listeners[type].push({ type: type, listener: listener, 
                                 useCapture: useCapture });
    this._listeners[type]['_' + listener.toString() + ':' + useCapture] = listener;
                                        
    if (type.substring(0,3) == 'key') {
      this._handler.addKeyboardListener(type, listener, useCapture);
    } else {
      this._handler.sendToFlash('jsAddEventListener', [ this._guid, type ]);
    }
  },
  
  removeEventListener: function(type, listener /* Function */, useCapture) {
    // NOTE: capturing not supported
    
    if (this.nodeType != _Node.ELEMENT_NODE
        && this.nodeType != _Node.TEXT_NODE) {
      throw 'Not supported';
    }
    
    var pos;
    
    if (!this._attached) {
      // remove from our list of event listeners that we keep around until
      // _Node._processAppendedChildren() is called
      pos = this._findListener(this._detachedListeners, type, listener, useCapture);
      if (pos !== null) {
        this._detachedListeners.splice(pos,1);
      }
      return;
    }

    // remove from our list of event listeners
    if (this._listeners[type]) {
      pos = this._findListener(this._listeners[type], type, listener, useCapture);
      if (pos !== null) {
        // FIXME: Ensure that if identical listeners are added twice that they collapse to
        // just one entry or else this will fail to delete more than the first one.
        this._listeners[type].splice(pos,1);
        delete this._listeners[type]['_' + listener.toString() + ':' + useCapture];
      }
    }
    
    if (type.substring(0,3) == 'key') {
      // FIXME: We really need to remove keypress logic from being handled by us
      pos = this._findListener(this._keyboardListeners, type, listener, useCapture);
      if (pos !== null) {
        // FIXME: Ensure that if identical listeners are added twice that they collapse to
        // just one entry or else this will fail to delete more than the first one.
        this._keyboardListeners.splice(pos,1);
      }
    }
    
    this._handler.sendToFlash('jsRemoveEventListener', [ this._guid, type ]);
  },

  getScreenCTM: function() {
    if (this._handler) {
      var msg = this._handler.sendToFlash('jsGetScreenCTM', [ this._guid ]); 
      msg = this._handler._stringToMsg(msg);
      return new _SVGMatrix(new Number(msg.a), new Number(msg.b), new Number(msg.c),
                            new Number(msg.d), new Number(msg.e), new Number(msg.f),
                            this._handler);
    } else {
      return new _SVGMatrix(1,0,0,1,0,0);
    }
  },

  getCTM: function() {
    return this.getScreenCTM();
  },
  
  /** Clones the given node.
  
      @param deepClone Whether this is a shallow clone or a deep clone copying
      all of our children. */
  cloneNode: function(deepClone) {
    //console.log('cloneNode, ns='+this.namespaceURI+', nodeName='+this.nodeName);
    
    var clone;
    // if we are a non-SVG, non-HTML node, such as a namespaced node inside
    // of an SVG metadata node, handle this a bit differently
    if (this.nodeType == _Node.ELEMENT_NODE && this.namespaceURI != svgns) {
      clone = new _Element(this.nodeName, this.prefix, this.namespaceURI);
    } else if (this.nodeType == _Node.ELEMENT_NODE) {
      clone = document.createElementNS(this.namespaceURI, this.nodeName);
    } else if (this.nodeType == _Node.TEXT_NODE) {
      clone = document.createTextNode(this._nodeValue, true);
    } else if (this.nodeType == _Node.DOCUMENT_FRAGMENT_NODE) {
      clone = document.createDocumentFragment(true);
    } else {
      throw 'cloneNode not supported for nodeType: ' + this.nodeType;
    }
    
    clone = this._getFakeNode(clone);
    
    // copy over our attributes
    var attrs = this._nodeXML.attributes;
    for (var i = 0; i < attrs.length; i++) {
      var attr = attrs.item(i);
      // IE doesn't have localName or prefix; they are munged together
      var m = attr.name.match(/([^:]+):?(.*)/);
      var ns = attr.namespaceURI;
      // Safari doesn't like setting xmlns declarations with createAttributeNS;
      // we have to do it this way unfortunately
      if (isSafari && attr.name.indexOf('xmlns') != -1) {
        clone._nodeXML.setAttribute(attr.name, attr.nodeValue);
      } else { // browsers other than Safari
        // IE doesn't have namespace aware setAttribute methods
        var attrNode;
        var doc = clone._nodeXML.ownerDocument;
        if (isIE) {
          attrNode = doc.createNode(2, attr.name, ns);
        } else {
          attrNode = doc.createAttributeNS(ns, attr.name);
        }
        attrNode.nodeValue = attr.nodeValue;
        if (isIE) {
          clone._nodeXML.setAttributeNode(attrNode);
        } else {
          clone._nodeXML.setAttributeNodeNS(attrNode);
        }
      }
    }
    
    // make sure our XML has our correct new cloned GUID
    clone._nodeXML.setAttribute('__guid', clone._guid);
    
    // for IE, copy over cached style values
    if (isIE) {
      var copyStyle = this._htcNode.style;
      for (var i = 0; i < copyStyle.length; i++) {
        var styleName = copyStyle.item(i);
        var styleValue = copyStyle.getPropertyValue(styleName);
        // bump the length on our real style object and on our fake one
        try {
          clone._htcNode.style.length++;
        } catch (ex) {
          // IE 9 does not allow the above.
        }
        clone.style.length++;
        // add the new style to our real style object and ignore style
        // changes temporarily so we don't end up in an infinite loop of
        // asynchronous style updates from onpropertychange events
        clone.style._ignoreStyleChanges = true;
        clone._htcNode.style[styleName] = styleValue;
        clone.style._ignoreStyleChanges = false;
      }
    }
    
    // update internal attributes table as well on the clone
    if (clone.nodeType == _Node.ELEMENT_NODE) {
      clone._importAttributes(clone, clone._nodeXML);
    }
    
    // clone each of the children and add them
    if (deepClone 
        && (clone.nodeType == _Node.ELEMENT_NODE
            || clone.nodeType == _Node.DOCUMENT_FRAGMENT_NODE)) {
      var children = this._getChildNodes();
      for (var i = 0; i < children.length; i++) {
        var childClone = children[i].cloneNode(true);
        clone.appendChild(childClone);
      }
    }
    
    // make sure our ownerDocument is right
    clone.ownerDocument = this.ownerDocument;
    
    return clone._getProxyNode();
  },

  toString: function() {
    if (this.namespaceURI == svgns) {
      return '[_SVG' + this.localName.charAt(0).toUpperCase()
             + this.localName.substring(1) + ']';
    } else if (this.prefix) {
      return '[' + this.prefix + ':' + this.localName + ']';
    } else if (this.localName) {
      return '[' + this.localName + ']';
    } else {
      return '[' + this.nodeName + ']';
    }
  },
  
  /** Adds an event cross platform. 
  
      @param obj Obj to add event to.
      @param type String type of event.
      @param fn Function to execute when event happens. */
  _addEvent: function(obj, type, fn) {
    if (obj.addEventListener) {
      obj.addEventListener(type, fn, false);
    }
    else if (obj.attachEvent) { // IE
      obj['e'+type+fn] = fn;
      // do a trick to prevent closure over ourselves, which can lead to
      // IE memory leaks
      obj[type+fn] = (function(obj, type, fn) { 
        return function(){ obj['e'+type+fn](window.event) }; 
      })(obj, type, fn);
      obj.attachEvent('on'+type, obj[type+fn]);
    }
  },
  
  // NOTE: technically the following attributes should be read-only, 
  // raising DOMExceptions if set, but for simplicity we make them 
  // simple JS properties instead. If set nothing will happen.
  nodeName: null,
  nodeType: null,
  ownerDocument: null, /* Document or _Document depending on context. */
  namespaceURI: null,
  localName: null,
  prefix: null, /* Note: in the DOM 2 spec this is settable but not for us */
  
  // getter/setter attribute methods
  
  // nodeValue defined as getter/setter
  // textContent and data defined as getters/setters for TEXT_NODES
  // childNodes defined as getter/setter
  
  _getParentNode: function() {
    if (this.nodeType == _Node.DOCUMENT_NODE
        || this.nodeType == _Node.DOCUMENT_FRAGMENT_NODE) {
      return null;
    }
    
    // are we the root SVG node when being embedded by an SVG SCRIPT?
    // If _handler is not set, this element is a detached svg element.
    if (this._attached && this._handler &&
        this._getProxyNode() == this._handler.document.rootElement) {
      if (this._handler.type == 'script') {
        return this._handler.flash.parentNode;
      } else if (this._handler.type == 'object') {
        // if we are the root SVG node and are embedded by an SVG OBJECT, then
        // our parent is a #document object
        return this._handler.document;
      }
    }
    
    var parentXML = this._nodeXML.parentNode;
    // unattached nodes might have an XML document as their parentNode
    if (parentXML === null || parentXML.nodeType == _Node.DOCUMENT_NODE) {
      return null;
    }
    
    var node = FlashHandler._getNode(parentXML, this._handler);
    this._getFakeNode(node)._attached = this._attached;
    
    return node;
  },
  
  _getFirstChild: function() {
    if (this.nodeType == _Node.TEXT_NODE) {
      return null;
    }
    
    var childXML = this._nodeXML.firstChild;
    if (childXML === null) {
      return null;
    }
    
    var node = FlashHandler._getNode(childXML, this._handler);
    this._getFakeNode(node)._attached = this._attached;
        
    return node;
  },
  
  _getLastChild: function() {
    if (this.nodeType == _Node.TEXT_NODE) {
      return null;
    }
    
    var childXML = this._nodeXML.lastChild;
    if (childXML === null) {
      return null;
    }
    
    var node = FlashHandler._getNode(childXML, this._handler);
    this._getFakeNode(node)._attached = this._attached;
    
    return node;
  },
  
  _getPreviousSibling: function() {
    if (this.nodeType == _Node.DOCUMENT_NODE
        || this.nodeType == _Node.DOCUMENT_FRAGMENT_NODE) {
      return null;
    }
    
    // are we the root SVG object when being embedded by an SVG SCRIPT?
    // If _handler is not set, this element is a nested svg element.
    if (this._attached && this._handler &&
        this._getProxyNode() == this._handler.document.rootElement
                      && this._handler.type == 'script') {
      var sibling = this._handler.flash.previousSibling;
      // is our previous sibling also an SVG object?
      if (sibling && sibling.nodeType == 1 && sibling.className 
          && sibling.className.indexOf('embedssvg') != -1) {
        var rootID = sibling.getAttribute('id').replace('_flash', '');
        var node = svgweb.handlers[rootID].document.documentElement;
        return node._getProxyNode();
      } else {
        return sibling;
      }
    }
    
    var siblingXML = this._nodeXML.previousSibling;
    // unattached nodes will sometimes have an XML Processing Instruction
    // as their previous node (type=7)
    if (siblingXML === null || siblingXML.nodeType == 7) {
      return null;
    }
    
    var node = FlashHandler._getNode(siblingXML, this._handler);
    this._getFakeNode(node)._attached = this._attached;
    
    return node;
  },
  
  _getNextSibling: function() {
    if (this.nodeType == _Node.DOCUMENT_NODE
        || this.nodeType == _Node.DOCUMENT_FRAGMENT_NODE) {
      return null;
    }
      
    // are we the root SVG object when being embedded by an SVG SCRIPT?
    // If _handler is not set, this element is a nested svg element.
    if (this._attached && this._handler &&
        this._getProxyNode() == this._handler.document.rootElement
                      && this._handler.type == 'script') {
      var sibling = this._handler.flash.nextSibling;
      
      // is our previous sibling also an SVG object?
      if (sibling && sibling.nodeType == 1 && sibling.className 
          && sibling.className.indexOf('embedssvg') != -1) {
        var id = sibling.getAttribute('id').replace('_flash', '');
        var node = this._handler.document._nodeById['_' + id];
        return node._getProxyNode();
      } else {
        return sibling;
      }
    }
    
    var siblingXML = this._nodeXML.nextSibling;
    if (siblingXML === null) {
      return null;
    }
    
    var node = FlashHandler._getNode(siblingXML, this._handler);
    this._getFakeNode(node)._attached = this._attached;

    return node;
  },
  
  // Note: 'attributes' property not supported since we don't support
  // Attribute DOM Node types
  
  // TODO: It would be nice to support the ElementTraversal spec here as well
  // since it cuts down on code size:
  // http://www.w3.org/TR/ElementTraversal/


  /** A flag used to supress events to flash. **/
  _passThrough: true,
  
  /** The attached flag indicates whether this node is attached to a live
      DOM yet. For example, if you call createElementNS, you can set
      values on this node before actually appending it using appendChild
      to a node that is connected to the actual visible DOM, ready to
      be rendered. */
  _attached: false,
  
  /** A flag we put on our _Nodes and _Elements to indicate they are fake;
      useful if someone wants to 'break' the abstraction and see if a node
      is a real DOM node or not (which won't have this flag). */
  _fake: true,
  
  /** Do the getter/setter magic for our attributes for non-IE browsers. */
  _defineNodeAccessors: function() {
    // readonly properties
    this.__defineGetter__('parentNode', hitch(this, this._getParentNode));
    this.__defineGetter__('firstChild', hitch(this, this._getFirstChild));
    this.__defineGetter__('lastChild', hitch(this, this._getLastChild));
    this.__defineGetter__('previousSibling', 
                          hitch(this, this._getPreviousSibling));
    this.__defineGetter__('nextSibling', hitch(this, this._getNextSibling));
    
    // childNodes array -- define and execute an inline function so that we 
    // only get closure over the 'self' variable rather than all the 
    // __defineGetter__ calls above. Note that we are forced to have our
    // childNodes variable be an object literal rather than array, since this
    // is the only way we can do getter/setter magic on each indexed position
    // for Safari.
    this.__defineGetter__('childNodes', (function(self) {
      return function() { return self._childNodes; };
    })(this));
    
    // We represent Text nodes internally using XML Element nodes in order
    // to support tracking; just set our child nodes to be zero to simulate
    // Text nodes having no children
    if (this.nodeName == '#text') {
      this._childNodes.length = 0;
    } else {    
      var children = this._nodeXML.childNodes;
      this._childNodes.length = children.length; 
      for (var i = 0; i < children.length; i++) {
        // do the defineGetter in a different method so the closure gets
        // formed correctly (closures can be tricky in loops if you are not
        // careful); we also need the defineChildNodeAccessor method anyway
        // since we need the ability to individually define new accessors
        // at a later point (such as in insertBefore(), for example).
        this._defineChildNodeAccessor(i);
      }
    }
    
    // read/write properties
    if (this.nodeType == _Node.TEXT_NODE) {
      this.__defineGetter__('data', (function(self) { 
        return function() { return self._nodeValue; };
      })(this));
      this.__defineSetter__('data', (function(self) {
        return function(newValue) { return self._setNodeValue(newValue); };
      })(this));
      
      this.__defineGetter__('textContent', (function(self) {
        return function() { return self._nodeValue; }; 
      })(this));
      this.__defineSetter__('textContent', (function(self) {
        return function(newValue) { return self._setNodeValue(newValue); };
      })(this));
    } else { // ELEMENT and DOCUMENT nodes
      // Firefox and Safari return '' for textContent for non-text nodes;
      // mimic this behavior
      this.__defineGetter__('textContent', (function() {
        return function() { return ''; };
      })());
    }
    
    this.__defineGetter__('nodeValue', (function(self) {
      return function() { return self._nodeValue; };
    })(this));
    this.__defineSetter__('nodeValue', (function(self) {
      return function(newValue) { return self._setNodeValue(newValue); };
    })(this));
  },
  
  /** Creates a getter/setter for a childNode at the given index position.
      We define each one in a separate function so that we don't pull
      the wrong things into our closure. See _defineNodeAccessors() for
      details. */
  _defineChildNodeAccessor: function(i) {
    var self = this;
    
    this._childNodes.__defineGetter__(i, function() {
      var childXML = self._nodeXML.childNodes[i];
      var node = FlashHandler._getNode(childXML, self._handler);
      node._attached = self._attached;
      return node;
    });
  },
  
  /** For IE we have to do some tricks that are a bit different than
      the other browsers; we can't know when a particular
      indexed member is called, such as childNodes[1], so instead we
      return the entire _childNodes array; what is nice is that IE applies
      the indexed lookup _after_ we've returned things, so this works. This
      requires us to instantiate all the children, however, when childNodes
      is called. This method is called by the HTC file.
      
      @param returnFakeNodes Optional. If true, then we return our fake
      nodes; if false, then we return the HTC proxy for IE. Defaults to false.
      
      @returns An array of either the HTC proxies for our nodes if IE,
      or an array of _Element and _Nodes for other browsers. */
  _getChildNodes: function(returnFakeNodes) {
    if (!isIE) {
      return this._childNodes;
    }
    
    if (returnFakeNodes === undefined) {
      returnFakeNodes = false;
    }
    
    // NOTE: for IE we return a real full Array, while for other browsers
    // our _childNodes array is an object literal in order to do
    // our __defineGetter__ magic in _defineNodeAccessors. It turns out
    // that on IE a full array can be returned from the getter, and _then_
    // the index can get applied (i.e. our array is returned, and then 
    // [2] might get applied to that array).
    var results = createNodeList();
    
    // We represent our text nodes using an XML Element node instead of an
    // XML Text node in order to do tracking; we store our actual text value
    // as a further XML Text node child. Don't return this though.
    if (this.nodeName == '#text') {
      return results;
    }
    
    if (this._nodeXML.childNodes.length == this._childNodes.length
        && !returnFakeNodes) {
      // we've already processed our childNodes before
      return this._childNodes;
    } else {
      for (var i = 0; i < this._nodeXML.childNodes.length; i++) {
        var childXML = this._nodeXML.childNodes[i];
        var node = FlashHandler._getNode(childXML, this._handler);
        node._fakeNode._attached = this._attached;
        if (returnFakeNodes) {
          node = node._fakeNode;
        }
        results.push(node);
      }
      
      this._childNodes = results;
      return results;
    }
  },
  
  /** If we are IE, we must use an HTC behavior in order to get onpropertychange
      and override core DOM methods. */
  _createHTC: function() {
    //console.log('createHTC');
    
    if (Object.defineProperty) {
      this._htcNode = document.createElement('div');
      this._htcNode.appendChild = function (c) { return this._fakeNode.appendChild(c); }
      this._htcNode.addEventListener = function (t, l, u) { return this._fakeNode.addEventListener(t, l, u); }
      this._htcNode.beginElement = function () { return this._fakeNode.beginElement(); }
      this._htcNode.beginElementAt = function (o) { return this._fakeNode.beginElementAt(o); }
      this._htcNode.endElement = function () { return this._fakeNode.endElement(); }
      this._htcNode.endElementAt = function (o) { return this._fakeNode.endElementAt(o); }
      this._htcNode._cloneNode = this._htcNode.cloneNode;
      this._htcNode.cloneNode = function (d) { return this._fakeNode.cloneNode(d); }
      this._htcNode.createSVGPoint = function () { return this._fakeNode.createSVGPoint(); }
      this._htcNode.createSVGRect = function () { return this._fakeNode.createSVGRect(); }
      this._htcNode.getAttribute = function(n) { return this._fakeNode.getAttribute(n); }
      this._htcNode.getAttributeNS = function (ns, l) { return this._fakeNode.getAttributeNS(ns, l); }  
      this._htcNode.getScreenCTM = function () { return this._fakeNode.getScreenCTM(); }
      this._htcNode.getBBox = function () { return this._fakeNode.getBBox(); }
      this._htcNode.getCTM = function () { return this._fakeNode.getCTM(); }
      this._htcNode.getElementsByTagNameNS = function (n, l) { return this._fakeNode.getElementsByTagNameNS(n, l); }
      this._htcNode.hasChildNodes = function () { return this._fakeNode.hasChildNodes(); }
      this._htcNode.hasAttributes = function () { return this._fakeNode.hasAttributes(); }
      this._htcNode.hasAttribute = function (l) { return this._fakeNode.hasAttribute(l); }
      this._htcNode.hasAttributeNS = function (ns, l) { return this._fakeNode.hasAttributeNS(ns, l); }
      this._htcNode.insertBefore = function (n, o) { return this._fakeNode.insertBefore(n, o); }
      this._htcNode.isSupported = function (f, v) { return this._fakeNode.isSupported(f, v); }
      this._htcNode.setAttribute = function (n, v) { return this._fakeNode.setAttribute(n, v); }  
      this._htcNode.setAttributeNS = function (ns, qName, v) { return this._fakeNode.setAttributeNS(ns, qName, v); }
      this._htcNode.removeChild = function (c) { return this._fakeNode.removeChild(c); }
      this._htcNode.replaceChild = function (n, o) { return this._fakeNode.replaceChild(n, o); }
      this._htcNode.removeAttribute = function (l) { return this._fakeNode.removeAttribute(l); }
      this._htcNode.removeAttributeNS = function (ns, l) { return this._fakeNode.removeAttributeNS(ns, l); }
      this._htcNode.removeEventListener = function (t, l, u) { return this._fakeNode.removeEventListener(t, l, u); }
      this._htcNode.get = function (a) { return this._fakeNode.get(a); }
      this._htcNode.set = function (a,o) { return this._fakeNode.set(a,o); }
      this._htcNode.create = function (e,a,n,f,o) { return this._fakeNode.create(e,a,n,f,o); }
      this._htcNode.createChild = function (e,a,i,n,f) { return this._fakeNode.createChild(e,a,i,n,f); }
      this._htcNode.addChild = function (c,i) { return this._fakeNode.addChild(c,i); }
  
      this._htcNode._getNodeName = function () { return this._fakeNode.nodeName; }
      this._htcNode._getNodeType = function () { return this._fakeNode.nodeType; }
      this._htcNode._getLocalName = function () { return this._fakeNode.localName; }
      this._htcNode._getPrefix = function () { return this._fakeNode.prefix; }
      this._htcNode._getNamespaceURI = function () { return this._fakeNode.namespaceURI; }
    
      this._htcNode._getChildNodes = function () { return this._fakeNode._getChildNodes(); }
    
      this._htcNode._getParentNode = function () { return this._fakeNode._getParentNode(); }
      this._htcNode._getFirstChild = function () { return this._fakeNode._getFirstChild(); }
      this._htcNode._getLastChild = function () { return this._fakeNode._getLastChild(); }
      this._htcNode._getPreviousSibling = function () { return this._fakeNode._getPreviousSibling(); }
      this._htcNode._getNextSibling = function () { return this._fakeNode._getNextSibling(); }
    
      this._htcNode._getNodeValue = function () { return this._fakeNode._nodeValue; }
      this._htcNode._setNodeValue = function (v) { return this._fakeNode._setNodeValue(v); }
    
      this._htcNode._getTextContent = function () { return this._fakeNode._getTextContent(); }  
      this._htcNode._setTextContent = function (v) { return this._fakeNode._setTextContent(v); }
      this._htcNode._getData = function () { return this._fakeNode._getData(); }  
      this._htcNode._setData = function (v) { return this._fakeNode._setData(v); }
    
      this._htcNode._getOwnerDocument = function () { return this._fakeNode.ownerDocument; }
    
      this._htcNode._getId = function () { return this._fakeNode._getId(); }
      this._htcNode._setId = function (v) { return this._fakeNode._setId(v); }
    
      this._htcNode._getX = function () { return this._fakeNode._getX(); }  
      this._htcNode._getY = function () { return this._fakeNode._getY(); }  
      this._htcNode._getWidth = function () { return this._fakeNode._getWidth(); }
      this._htcNode._getHeight = function () { return this._fakeNode._getHeight(); }
      this._htcNode._getCurrentScale = function () { return this._fakeNode._getCurrentScale(); }
      this._htcNode._setCurrentScale = function (v) { return this._fakeNode._setCurrentScale(v); }
      this._htcNode._getCurrentTranslate = function () { return this._fakeNode._getCurrentTranslate(); }
  
      Object.defineProperty(this._htcNode, "currentScale", {
          get : function () {
              return this._getCurrentScale();
          },
          set : function (val) {
              this._setCurrentScale(val);
          }
      });
      Object.defineProperty(this._htcNode, "currentTranslate", {
          get : function () {
              return this._getCurrentTranslate();
          },
          set : function (val) {
          }
      });
      Object.defineProperty(this._htcNode, "nodeName", {
          get : function () {
              return this._getNodeName();
          },
          set : function (val) {
          }
      });
      Object.defineProperty(this._htcNode, "nodeType", {
          get : function () {
              return this._getNodeType();
          },
          set : function (val) {
          }
      });
      Object.defineProperty(this._htcNode, "localName", {
          get : function () {
              return this._getLocalName();
          },
          set : function (val) {
          }
      });
      Object.defineProperty(this._htcNode, "prefix", {
          get : function () {
              return this._getPrefix();
          },
          set : function (val) {
          }
      });
      Object.defineProperty(this._htcNode, "namespaceURI", {
          get : function () {
              return this._getNamespaceURI();
          },
          set : function (val) {
          }
      });
      Object.defineProperty(this._htcNode, "childNodes", {
          get : function () {
              return this._getChildNodes();
          },
          set : function (val) {
          }
      });
      Object.defineProperty(this._htcNode, "parentNode", {
          get : function () {
              return this._getParentNode();
          },
          set : function (val) {
          }
      });
      Object.defineProperty(this._htcNode, "firstChild", {
          get : function () {
              return this._getFirstChild();
          },
          set : function (val) {
          }
      });
      Object.defineProperty(this._htcNode, "id", {
          get : function () {
              return this._getId();
          },
          set : function (val) {
              this._setId(val);
          }
      });
      Object.defineProperty(this._htcNode, "lastChild", {
          get : function () {
              return this._getLastChild();
          },
          set : function (val) {
          }
      });
      Object.defineProperty(this._htcNode, "previousSibling", {
          get : function () {
              return this._getPreviousSibling();
          },
          set : function (val) {
          }
      });
      Object.defineProperty(this._htcNode, "nextSibling", {
          get : function () {
              return this._getNextSibling();
          },
          set : function (val) {
          }
      });
      Object.defineProperty(this._htcNode, "nodeValue", {
          get : function () {
              return this._getNodeValue();
          },
          set : function (val) {
              this._setNodeValue(val);
          }
      });
      Object.defineProperty(this._htcNode, "textContent", {
          get : function () {
              return this._getTextContent();
          },
          set : function (val) {
              this._setTextContent(val);
          }
      });
      Object.defineProperty(this._htcNode, "data", {
          get : function () {
              return this._getData();
          },
          set : function (val) {
              this._setData(val);
          }
      });
      Object.defineProperty(this._htcNode, "ownerDocument", {
          get : function () {
              return this._getOwnerDocument();
          },
          set : function (val) {
          }
      });
      Object.defineProperty(this._htcNode, "x", {
          get : function () {
              return this._getX();
          },
          set : function (val) {
          }
      });
      Object.defineProperty(this._htcNode, "y", {
          get : function () {
              return this._getY();
          },
          set : function (val) {
          }
      });
      Object.defineProperty(this._htcNode, "width", {
          get : function () {
              return this._getWidth();
          },
          set : function (val) {
          }
      });
      Object.defineProperty(this._htcNode, "height", {
          get : function () {
              return this._getHeight();
          },
          set : function (val) {
          }
      });
      this._htcNode._fakeNode = this;
      this._htcNode._handler = this._handler;
    } else {
      // we store our HTC nodes into a hidden container located in the
      // BODY of the document; either get it now or create one on demand
      if (!this._htcContainer) {
        this._htcContainer = document.getElementById('__htc_container');
        if (!this._htcContainer) {
          // NOTE: Strangely, onpropertychange does _not_ fire for HTC elements
          // that are in the HEAD of the document, which is where we used
          // to put the htc_container. Instead, we have to put it into the BODY
          // of the document and position it offscreen.
          var body = document.getElementsByTagName('body')[0];
          var c = document.createElement('div');
          c.id = '__htc_container';
          // NOTE: style.display = 'none' does not work
          c.style.position = 'absolute';
          c.style.top = '-5000px';
          c.style.left = '-5000px';
          body.appendChild(c);
          this._htcContainer = c;
        }
      }
    
      // now store our HTC UI node into this container; we will intercept
      // all calls through the HTC, and implement all the real behavior
      // inside ourselves (inside _Element)
      // Note: we do svg: even if we are dealing with a non-SVG node on IE,
      // such as sodipodi:namedview; this is necessary so that our svg.htc
      // file gets invoked for all these nodes, which is by necessity bound to 
      // the svg: namespace
      this._htcNode = document.createElement('svg:' + this.nodeName);
      this._htcNode._fakeNode = this;
      this._htcNode._handler = this._handler;
      this._htcContainer.appendChild(this._htcNode);
    }
  },
    
  _setNodeValue: function(newValue) {
    //console.log('setNodeValue, newValue='+newValue);
    if (this.nodeType != _Node.TEXT_NODE) {
      return newValue;
    }
    
    this._nodeValue = newValue;
    
    // we store the real text value as a child of our fake text node,
    // which is actually a DOM Element so that we can do tracking
    this._nodeXML.firstChild.nodeValue = newValue;
    
    if (this._attached && this._passThrough) {
      var flashStr = FlashHandler._encodeFlashData(newValue);
      var parentGUID = this._nodeXML.parentNode.getAttribute('__guid');
      this._handler.sendToFlash('jsSetText',
                                [ parentGUID, this._guid, flashStr ]);
    }

    return newValue;
  },
  
  /** For functions like appendChild, insertBefore, removeChild, etc.
      outside callers can pass in DOM nodes, etc. This function turns
      this into something we can work with, such as a _Node or _Element. */
  _getFakeNode: function(node) {
    if (!node) {
      node = this;
    }
    
    // Was an HTC node passed in for IE? If so, get its _Node
    if (isIE && node._fakeNode) {
      node = node._fakeNode;
    }
    
    return node;
  },
  
  /** We do a bunch of work in this method in order to append a child to
      ourselves, including: Walking over the child and all of it's children; 
      setting it's handler; setting that it is both attached and
      can pass through it's values; informing Flash about the newly
      created element; and updating our list of namespaces if there is a node
      with a new namespace in the appended children. This method gets called 
      recursively for the child and all of it's children.
      
      @param child _Node to work with.
      @param parent The parent of this child.
      @param attached Boolean on whether we are attached or not yet. */
  _processAppendedChildren: function(child, parent, attached) {
    //console.log('processAppendedChildren, this.nodeName='+this.nodeName+', child.nodeName='+child.nodeName+', attached='+attached);
    // walk the DOM from the child using an iterative algorithm, which was 
    // found to be faster than a recursive one; for each node visited we will
    // store some important reference information
    var current;
    var suspendID;
    if (child.nodeType == _Node.DOCUMENT_FRAGMENT_NODE) {
      current = this._getFakeNode(child._getFirstChild());
    } else {
      current = child;
    }
    // turn on suspendRedraw so adding our event handlers happens in one go
    if (attached) {
      suspendID = this._handler._redrawManager.suspendRedraw(10000, false);
    }

    while (current) {
      //console.log('current, nodeName='+current.nodeName);
      // visit this node
      var currentXML = current._nodeXML;

      // set its handler
      current._handler = this._handler;

      // store a reference to our node so we can return it in the future
      var id = currentXML.getAttribute('id');
      if (attached && current.nodeType == _Node.ELEMENT_NODE && id) {
        this._handler.document._nodeById['_' + id] = current;
      }

      // set the ownerDocument based on how we were embedded
      if (attached) {
        if (this._handler.type == 'script') {
          current.ownerDocument = document;
        } else if (this._handler.type == 'object') {
          current.ownerDocument = this._handler.document;
        }
        current._attached = true;

        // register and send over any event listeners that were added while
        // this node was detached
        for (var i = 0; i < current._detachedListeners.length; i++) {
          var addMe = current._detachedListeners[i];
          if (addMe) {
            current.addEventListener(addMe.type, addMe.listener, 
                                   addMe.useCapture, true);
          }
        }
        current._detachedListeners = [];
      }
          
      // now continue visiting other nodes
      var lastVisited = current;
      var children = current._getChildNodes();
      var next = (children && children.length > 0) ? children[0] : null;
      if (next) {
        current = next;
        if (isIE) {
          current = current._fakeNode;
        }
      }
      
      while (!next && current) {
        if (current != child) {
          next = current._getNextSibling();
          if (next) {
            current = next;
            if (isIE) {
              current = current._fakeNode;
            }
            break;
          }
        }

        if (current == child) {
          current = null;
        } else {
          current = current._getParentNode();
          if (current && isIE) {
            current = current._fakeNode;
          }

          // Do not traverse non-elements or retrace up past the root
          if (current && ((current.nodeType != 1)
              || (current._handler
                  && current._getProxyNode() == current._handler.document.rootElement ))) { 
            current = null;
          }
        }
      }
    }
    
    // turn off suspendRedraw. all event handlers should shoot through now
    if (attached) {
      this._handler._redrawManager.unsuspendRedraw(suspendID, false);
    }
  },
  
  /** Imports the given child and all it's children's XML into our XML. 
  
      @param child _Node to import.
      @param doAppend Optional. Boolean on whether to actually append
      the child once it is imported. Useful for functions such as
      replaceChild that want to do this manually. Defaults to true if not
      specified.
      
      @returns The imported node. */
  _importNode: function(child, doAppend) {
    //console.log('importNode, child='+child.nodeName+', doAppend='+doAppend);
    if (typeof doAppend == 'undefined') {
      doAppend = true;
    }
    
    // try to import the node into our _Document's XML object
    var doc;
    if (this._attached) {
      doc = this._handler.document._xml;
    } else {
      doc = this._nodeXML.ownerDocument;
    }

    // IE does not support document.importNode, even on XML documents, 
    // so we have to define it ourselves.
    // Adapted from ALA article:
    // http://www.alistapart.com/articles/crossbrowserscripting
    var importedNode;
    if (typeof doc.importNode == 'undefined') {
      // import the node for IE
      importedNode = document._importNodeFunc(doc, child._nodeXML, true);
    } else { // non-IE browsers
      importedNode = doc.importNode(child._nodeXML, true);
    }

    // complete the import into ourselves
    if (doAppend) {
      this._nodeXML.appendChild(importedNode);
    }
    
    // replace all of the children's XML with our copy of it now that it 
    // is imported
    child._importChildXML(importedNode);

    return importedNode;
  },
  
  /** Recursively replaces the XML inside of our children with the given
      new XML to ensure that each node's reference to it's own internal
      _nodeXML pointer all points to the same tree, but in different
      locations. Called after we are importing a node into ourselves with 
      appendChild. */
  _importChildXML: function(newXML) {
    this._nodeXML = newXML;
    var children = this._getChildNodes();
    for (var i = 0; i < children.length; i++) {
      var currentChild = children[i];
      if (isIE && currentChild._fakeNode) { // IE
        currentChild = currentChild._fakeNode;
      } 
      
      currentChild._nodeXML = this._nodeXML.childNodes[i];
      currentChild._importChildXML(this._nodeXML.childNodes[i]);
    }
  },
  
  /** Tries to find the given child in our list of child nodes.
      
      @param child A _Node or _Element to search for in our list of
      childNodes. 
      @param ignoreTextNodes Optional, defaults to false. If true, then we
      ignore any text nodes when looking for the child, as if all we have
      are element nodes.
      
      @returns Null if nothing found, otherwise an object literal with 2 values:
         position The index position of where the child is located.
         nodeXML The found XML node.
         
      If the child is not found then null is returned instead. */
  _findChild: function(child, ignoreTextNodes) {
    //console.log('findChild, child='+child.nodeName);
    if (ignoreTextNodes === undefined) {
      ignoreTextNodes = false;
    }
    
    var results = {};

    var elementIndex = 0;
    for (var i = 0; i < this._nodeXML.childNodes.length; i++) {
      var currentXML = this._nodeXML.childNodes[i];
      if (currentXML.nodeType != _Node.ELEMENT_NODE 
          && currentXML.nodeType != _Node.TEXT_NODE) {
        // FIXME: What about CDATA nodes?
        // FIXME: If there are other kinds of nodes, how does this impact
        // our elementIndex variable?
        continue;
      }
      
      // skip text nodes?
      if (ignoreTextNodes
                    && (currentXML.getAttribute('__fakeTextNode')
                        || currentXML.nodeType == _Node.TEXT_NODE)) {
        continue;
      }

      if (currentXML.nodeType == _Node.ELEMENT_NODE) {
        elementIndex++;
      }
            
      if (currentXML.nodeType == _Node.ELEMENT_NODE
          && currentXML.getAttribute('__guid') == child._guid) {
        results.position = (ignoreTextNodes) ? elementIndex : i;
        results.nodeXML = currentXML;
        return results;
      }
    }
    
    return null;
  },
  
  /** After a node is unattached, such as through a removeChild, this method
      recursively sets _attached to false on this node
      and all of its children.  */
  _setUnattached: function() {   
    // set each child to be unattached
    var children = this._getChildNodes();
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      if (isIE) {
        child = child._fakeNode;
      }
      child._setUnattached();
    }
    this._attached = false;
    this._handler = null;
  },
  
  /** When we return results to external callers, such as appendChild,
      we can return one of our fake _Node or _Elements. However, for IE,
      we have to return the HTC 'proxy' through which callers manipulate
      things. The HTC is what allows us to override core DOM methods and
      know when property and style changes have happened, for example. */
  _getProxyNode: function() {
    if (!isIE) {
      return this;
    } else {
      // for IE, the developer will manipulate things through the UI/HTC
      // proxy facade so that we can know about property changes, etc.
      return this._htcNode;
    }
  },
  
  /** Creates our childNodes data structure in a different way for different
      browsers. We have this in a separate method so that we avoid forming
      a closure of elements that could lead to a memory leak in IE. */
  _createChildNodes: function() {
    var childNodes;
    
    if (!isIE) {
      // NOTE: we make _childNodes an object literal instead of an Array; if
      // it is an array we can't do __defineGetter__ on each index position on
      // Safari
      childNodes = {};
      
      // add the item() method from NodeList to our childNodes instance
      childNodes.item = function(index) {
        if (index >= this.length) {
          return null; // DOM Level 2 spec says return null
        } else {
          return this[index];
        }
      };
    } else { // IE
      childNodes = createNodeList();
    }
    
    return childNodes;
  },
  
  // the following getters and setters for textContent and data are called
  // by the HTC; we put them here to minimize the size of the HTC which
  // has a very strong correlation with performance
  
  _getTextContent: function() {
    if (this.nodeType == _Node.TEXT_NODE) {
      return this._nodeValue;
    } else {
      return ''; // Firefox and Safari return empty strings for .textContent
    }
  },
  
  _setTextContent: function(newValue) {
    if (this.nodeType == _Node.TEXT_NODE) { 
      return this._setNodeValue(newValue);
    } else {
      return ''; // Firefox and Safari return empty strings for .textContent
    }
  },
  
  _getData: function() {
    if (this.nodeType == _Node.TEXT_NODE) {
      return this._nodeValue;
    } else {
      return undefined;
    }
  },
  
  _setData: function(newValue) {
    if (this.nodeType == _Node.TEXT_NODE) {
      return this._setNodeValue(newValue);
    } else {
      return undefined;
    }
  },
  
  /** For Internet Explorer, the length of the script in our HTC is a major
      determinant in the amount of time it takes to create a new HTC element.
      In order to minimize the size of this code, we have many 'no-op'
      implementations of some methods so that we can just safely call
      them from the HTC without checking the type of the node inside the
      HTC. */
  _createEmptyMethods: function() {
    if (this.nodeType == _Node.TEXT_NODE) {
      this.getAttribute 
          = this.getAttributeNS
          = this.setAttribute 
          = this.setAttributeNS
          = this.removeAttribute
          = this.removeAttributeNS
          = this.hasAttribute
          = this.hasAttributeNS
          = this.getElementsByTagNameNS
          = this._getId
          = this._setId
          = this._getX
          = this._getY
          = this._getWidth
          = this._getHeight
          = this._getCurrentScale
          = this._setCurrentScale
          = this._getCurrentTranslate
          = this.createSVGRect
          = this.createSVGPoint
          = function() { return undefined; };
    }
  },
  
  /** When a node is removed from the DOM, we make sure that all of its 
      event listener information (and all of the event info for its children)
      is persisted if it is later reattached to the DOM. */
  _persistEventListeners: function() {
    // persist all the listeners for ourselves
    for (var eventType in this._listeners) {
      for (var i = 0; i < this._listeners[eventType].length; i++) {
        var l = this._listeners[eventType][i];
        this._detachedListeners.push({ type: l.type, 
                                       listener: l.listener, 
                                       useCapture: l.useCapture });
      }
    }
    this._listeners = [];
    
    // visit each of our children
    var children = this._getChildNodes();
    for (var i = 0; i < children.length; i++) {
      var c = children[i];
      if (c._fakeNode) { // IE
        c = c._fakeNode;
      }
      c._persistEventListeners();
    }
  },
  
  /** Finds a listener in the given listenerArray using the given type, listener, and useCapture
      values, returning the index position. Returns null the listener is not found. */
  _findListener: function(listenerArray, type, listener, useCapture) {
    for (var i = 0; i < listenerArray.length; i++) {
      var l = listenerArray[i];
      if (l.listener == listener && l.type == type && l.useCapture == useCapture) {
        return i;
      }
    }
    
    return null;
  }
});


/** Our DOM Element for each SVG node.

    @param nodeName The node name, such as 'rect' or 'sodipodi:namedview'.
    @param prefix The namespace prefix, such as 'svg' or 'sodipodi'.
    @param namespaceURI The namespace URI. If undefined, defaults to null.
    @param nodeXML The parsed XML DOM node for this element.
    @param handler The FlashHandler rendering this node. 
    element 'pass through' and cause changes in the Flash renderer. */                 
function _Element(nodeName, prefix, namespaceURI, nodeXML, handler) {
  if (nodeName === undefined && namespaceURI === undefined 
      && nodeXML === undefined && handler === undefined) {
    // prototype subclassing
    return;
  }
  
  // superclass constructor
  _Node.apply(this, [nodeName, _Node.ELEMENT_NODE, prefix, namespaceURI, 
                     nodeXML, handler]);
                     
  // setup our attributes
  this._attributes = {};
  this._attributes['_id'] = ''; // default id is empty string on FF and Safari
  this._importAttributes(this, this._nodeXML);
  
  // define our accessors if we are not IE; IE does this by using the HTC
  // file rather than doing it here
  if (!isIE) {
    this._defineAccessors();
  }
  
  if (this.namespaceURI == svgns) {
    // track .style changes; 
    if (isIE 
        && this._attached 
        && this._handler
        && this._handler.type == 'script' 
        && this.nodeName == 'svg') {
      // do nothing now -- if we are IE and are being embedded with an
      // SVG SCRIPT tag, don't setup the style object for the SVG root now; we
      // do that later in _SVGSVGElement
    } else {
      this.style = new _Style(this);
    }
    
    // handle style changes for HTCs
    if (isIE 
        && this._attached
        && this._handler
        && this._handler.type == 'script' 
        && this.nodeName == 'svg') {
      // do nothing now - if we are IE we delay creating the style property
      // until later in _SVGSVGElement
    } else if (isIE) {
      this.style._ignoreStyleChanges = false;
    }
  }
}

// subclasses _Node
_Element.prototype = new _Node;

extend(_Element, {
  getAttribute: function(attrName) /* String */ {
    return this.getAttributeNS(null, attrName, true);
  },
  
  /** Namespace aware function to get an attribute from a node.
  
      @param ns The namespace.
      @param localName The local name of the attribute, without the prefix.
      Note, though, that Webkit and Firefox allow the prefix form to be
      passed in as well, which will cause a namespace lookup to happen.
      @param _forceNull Internal boolean flag used by our fake 
      getAttribute() method. Needed to match the native browser behavior of 
      returning attributes that don't exist; see the comment near the end of 
      the function for details. */
  getAttributeNS: function(ns, localName, _forceNull) /* String */ {
    //console.log('getAttributeNS, ns='+ns+', localName='+localName+', this.nodeName='+this.nodeName);
    var value;
    
    // ignore internal __guid property
    if (ns == null && localName == '__guid') {
      return null;
    }

    // Make sure we are attached and aren't in the middle of a 
    // suspendRedraw operation.
    if (this._attached && this._passThrough 
        && !this._handler._redrawManager.isSuspended()) {
      value = this._handler.sendToFlash('jsGetAttribute',
                                          [ this._guid, false, false, ns, 
                                            localName, true ]);
    } else {
      if (!isIE) { 
        value = this._nodeXML.getAttributeNS(ns, localName);
      } else if (isIE) { // IE has no getAttributeNS
        if (!ns) {
          value = this._nodeXML.getAttribute(localName);
        } else {
          // IE has funky namespace support; we possibly have no prefix at this
          // point so we will have to enumerate all attributes to find the one
          // we want
          for (var i = 0; i < this._nodeXML.attributes.length; i++) {
            var attr = this._nodeXML.attributes.item(i);
            // IE has no localName property; it munges the prefix:localName
            // together
            var attrName = new String(attr.name).match(/[^:]*:?(.*)/)[1];
            if (attr.namespaceURI && attr.namespaceURI == ns 
                && attrName == localName) {
              value = attr.nodeValue;
              break;
            }
          }
        }
      }
    }
    
    // id property is special; we return an empty string instead of null
    // to mimic native behavior on Firefox and Safari
    if (ns == 'null' && localName == 'id' && !value) {
      return '';
    }
    
    // Firefox and Webkit both return null when getAttribute() is called
    // on unknown element, but return '' when getAttributeNS() is called
    // on empty element; match this behavior. We pass in a boolean 
    // '_forceNull' flag when calling getAttributeNS from our own fake
    // getAttribute method.
    if (value === undefined || value === null || /^[ ]*$/.test(value)) {
      return (_forceNull) ? null : '';
    }

    return value;
  },
  
  removeAttribute: function(name) /* void */ {
    /* throws DOMException */
    this.removeAttributeNS(null, name);
  },
  
  removeAttributeNS: function(ns, localName) /* void */ {
      /* throws DOMException */
    //console.log('removeAttributeNS, ns='+ns+', localName='+localName);
      
    // if id then change node lookup table (only if we are attached to
    // the DOM however)
    if (localName == 'id' && this._attached && this.namespaceURI == svgns) {
      var doc = this._handler.document;
      var elementId = this._nodeXML.getAttribute('id');

      // old lookup
      doc._nodeById['_' + elementId] = undefined;
    }
    
    // we might not be able to get a prefix to namespace mapping if we are
    // disconnected; loop through our attributes until we find the matching
    // attribute node
    var attrNode;
    if (!ns) {
      attrNode = this._nodeXML.getAttributeNode(localName);
    } else {
      for (var i = 0; i < this._nodeXML.attributes.length; i++) {
        var current = this._nodeXML.attributes.item(i);
        // IE has no localName property; it munges the prefix:localName
        // together
        var m = new String(current.name).match(/([^:]+:)?(.*)/);
        var prefix, attrName;
        if (current.name.indexOf(':') != -1) {
          prefix = m[1];
          attrName = m[2];
        } else {
          attrName = m[1];
        }
        if (current.namespaceURI && current.namespaceURI == ns 
            && attrName == localName) {
          attrNode = current;
          break;
        }
      }
    }
    
    if (!attrNode) {
      console.log('No attribute node found for: ' + localName
                  + ' in the namespace: ' + ns);
      return;
    }
        
    // remove from our XML
    this._nodeXML.removeAttributeNode(attrNode);
    
    // remove from our attributes list
    var qName = localName;
    if (ns) {
      qName = prefix + ':' + localName;
    }
    this._attributes['_' + qName] = undefined;

    // send to Flash
    if (this._attached && this._passThrough) {
      this._handler.sendToFlash('jsRemoveAttribute', 
                                [ this._guid, ns, localName ]);
    }
  },
  
  setAttribute: function(attrName, attrValue /* String */) /* void */ {
    //console.log('setAttribute, attrName='+attrName+', attrValue='+attrValue);
    this.setAttributeNS(null, attrName, attrValue);
  },

  setAttributeNS: function(ns, qName, attrValue /* String */) /* void */ {
    //console.log('setAttributeNS, ns='+ns+', qName='+qName+', attrValue='+attrValue+', this.nodeName='+this.nodeName);
    
    // Issue 428: 
    // "setAttribute gives error for undefined or null attribute value 
    // (Flash renderer)"
    // http://code.google.com/p/svgweb/issues/detail?id=428
    if (attrValue === null || typeof attrValue == 'undefined') {
      attrValue = '';
    }
    
    // parse out local name of attribute
    var localName = qName;
    if (qName.indexOf(':') != -1) {
      localName = qName.split(':')[1];
    }

    // if id then change node lookup table (only if we are attached to
    // the DOM however)
    if (this._attached && qName == 'id') {
      var doc = this._handler.document;
      var elementId = this._nodeXML.getAttribute('id');

      // old lookup
      doc._nodeById['_' + elementId] = undefined;
      if (elementId === 0 || elementId) {
        // new lookup
        doc._nodeById['_' + attrValue] = this;
      }
    }
    
    /* Safari has a wild bug; If you have an element inside of a clipPath with
       a style string:
    
       <clipPath id="clipPath11119">
          <rect width="36.416" height="36.416" ry="0" x="247" y="-157"
                style="opacity:1;fill:#6b6b6b;"
                id="rect11121" />
        </clipPath>
        
       Then calling setAttribute('style', '') on our nodeXML causes the
       browser to crash! The workaround is to temporarily remove nodes
       that have a clipPath parent, set their style, then
       reattach them (!) */
    if (isSafari
        && localName == 'style'
        && this._nodeXML.parentNode !== null 
        && this._nodeXML.parentNode.nodeName == 'clipPath') {
      // save our XML position information for later re-inserting
      var addBeforeXML = this._nodeXML.nextSibling;
      var origParent = this._nodeXML.parentNode;
      // remove the node and set style; doing this prevents crash when 
      // setting style string      
      this._nodeXML.parentNode.removeChild(this._nodeXML);
      this._nodeXML.setAttribute('style', attrValue);
      // re-attach ourselves before our old sibling
      if (addBeforeXML) {
        origParent.insertBefore(this._nodeXML, addBeforeXML);
      } else { // node was at end originally
        origParent.appendChild(this._nodeXML);
      }
    } else { // we are an attrname other than style, or on a non-Safari browser
      // update our XML
      if (ns && isIE) {
        // MSXML has its own custom funky way of dealing with namespaces,
        // so we have to do it this way
        var attrNode = this._nodeXML.ownerDocument.createNode(2, qName, ns);
        attrNode.nodeValue = attrValue;
        this._nodeXML.setAttributeNode(attrNode);
      } else if (isIE) {
        this._nodeXML.setAttribute(qName, attrValue);
      } else {
        this._nodeXML.setAttributeNS(ns, qName, attrValue);
      }
    }

    // If this is a namespace attribute, add it to the global
    // list of SVG related namespaces so that we know whether
    // to create fake elements or native elements for that
    // namespace. See Issue 507.
    if (/^xmlns:?(.*)$/.test(qName)) {
      var m = qName.match(/^xmlns:?(.*)$/);
      var prefix = (m[1] ? m[1] : 'xmlns');
      var namespaceURI = attrValue;

      // don't add duplicates
      if (!svgweb._allSVGNamespaces['_' + prefix]) {
        svgweb._allSVGNamespaces['_' + prefix] = namespaceURI;
        svgweb._allSVGNamespaces['_' + namespaceURI] = prefix;
      }
    }

    // update our internal set of attributes
    this._attributes['_' + qName] = attrValue;

    // send to Flash
    if (this._attached && this._passThrough) {
      var flashStr = FlashHandler._encodeFlashData(attrValue);
      this._handler.sendToFlash('jsSetAttribute', 
                                [ this._guid, false, ns, localName, flashStr ]);
    }

    // Issue 427: Dynamically resize the flash control when the root element size changes
    if (this._handler && this._handler.type == 'script' && this._attached &&
        this._getProxyNode() == this._handler.document.rootElement &&
        (localName == 'width' || localName == 'height') ) {
        svgweb._onWindowResize();
    }
  },
  
  hasAttribute: function(localName) /* Boolean */ {
    return this.hasAttributeNS(null, localName);
  },

  hasAttributeNS: function(ns, localName) /* Boolean */ {
    //console.log('hasAttributeNS, ns='+ns+', localName='+localName);
    if (!ns && !isIE) {
      return this._nodeXML.hasAttribute(localName);
    } else {
      if (!isIE) {
        return this._nodeXML.hasAttributeNS(ns, localName);
      } else {
        // IE doesn't have hasAttribute or hasAttributeNS
        var attrNode = null;
        for (var i = 0; i < this._nodeXML.attributes.length; i++) {
          var current = this._nodeXML.attributes.item(i);
          // IE has no localName property; it munges the prefix:localName
          // together
          var m = new String(current.name).match(/(?:[^:]+:)?(.*)/);
          var attrName = m[1];
          var currentNS = current.namespaceURI;
          if (currentNS == '') { // IE returns null namespace as ''
            currentNS = null;
          }
          if (ns == currentNS && attrName == localName) {
            attrNode = current;
            break;
          }
        }
      
        return (attrNode != null);
      }
    } 
  },
  
  getElementsByTagNameNS: function(ns, localName) /* _NodeList */ {
    //console.log('_Element.getElementsByTagNameNS, ns='+ns+', localName='+localName);
    var results = createNodeList();
    var matches;
    // DOM Level 2 spec details:
    // if ns is null or '', return elements that have no namespace
    // if ns is '*', match all namespaces
    // if localName is '*', match all tags in the given namespace
    if (ns == '') {
      ns = null;
    }
    
    // we internally have to mess with the SVG namespace a bit to avoid
    // an issue with Firefox and Safari
    if (ns == svgns) {
      ns = svgnsFake;
    }

    // get DOM nodes with the given tag name
    if (this._nodeXML.getElementsByTagNameNS) { // non-IE browsers
      results = this._nodeXML.getElementsByTagNameNS(ns, localName);
    } else { // IE
      // we use XPath instead of xml.getElementsByTagName because some versions
      // of MSXML have namespace glitches with xml.getElementsByTagName
      // (Issue 183: http://code.google.com/p/svgweb/issues/detail?id=183)
      // and the namespace aware xml.getElementsByTagNameNS is not supported
      var namespaces = null;
      if (this._attached) {
        namespaces = this._handler.document._namespaces;
      }
      
      // figure out prefix
      var prefix = 'xmlns';
      if (ns && ns != '*' && namespaces) {
        prefix = namespaces['_' + ns];
        
        if (prefix === undefined) {
          return createNodeList(); // empty []
        }
      }
      
      // determine correct xpath query; 
      // MSXML incorrectly evaluates XPath expressions on the _whole_ XML DOM
      // document rather than restricting things to our context. In order to
      // provide support for contextual getElementsByTagNameNS we use the
      // following 'hack': we get all of our nodes, but then do a node test
      // along the ancestor axis to make sure we are rooted under the 
      // node that has the GUID of our context
      var query;
      if (ns == '*' && localName == '*') {
        query = "//*[ancestor::*[@__guid = '" + this._guid + "']]";
      } else if (ns == '*') {
        // NOTE: IE does not support wild carding just the namespace; see
        // http://svgweb.googlecode.com/svn/trunk/docs/UserManual.html#known_issues6
        // for details
        query = "//*[namespace-uri()='*' and local-name()='" + localName + "'"
                + " and ancestor::*[@__guid = '" + this._guid + "']]";
      } else if (localName == '*') {
        query = "//*[namespace-uri()='" + ns + "'"
                + " and ancestor::*[@__guid = '" + this._guid + "']]";
      } else {
        // Wonderful IE bug: some versions of MSXML don't seem to 'see'
        // the default XML namespace with XPath, forcing you to pretend like 
        // an element has no namespace: '//circle'
        // _Other_ versions of MSXML won't work like this, and _do_ see the
        // default namespace, forcing you to fully specify it:
        // //*[namespace-uri()='http://my-namespace' and local-name()='circle']
        // To accomodate these we run both and use an XPath Union Operator
        // to combine the results. One is the MSXML default in Windows XP,
        // the other is an updated MSXML component installed by 
        // Microsoft Office.
        query = "//" + localName + "[ancestor::*[@__guid = '" + this._guid + "']]"
                + "| //*[namespace-uri()='" + ns 
                + "' and local-name()='" + localName + "'"
                + " and ancestor::*[@__guid = '" + this._guid + "']]";
      }
            
      matches = xpath(this._nodeXML.ownerDocument, this._nodeXML, query, 
                      namespaces);
      if (matches !== null && matches !== undefined && matches.length > 0) {
        for (var i = 0; i < matches.length; i++) {
          // IE will incorrectly return the context node under some 
          // conditions; filter that out
          if (matches[i] === this._nodeXML) {
            continue;
          }
          results.push(matches[i]);
        }
      }
    }
    
    // When doing wildcards on local name and namespace text nodes
    // can also sometimes be included; filter them out
    if ((ns == '*' || ns == svgnsFake) && localName == '*') {
      var temp = [];
      for (var i = 0; i < results.length; i++) {
        if (results[i].nodeType == _Node.ELEMENT_NODE
            && results[i].nodeName != '__text') {
          temp.push(results[i]);
        }
      }
      results = temp;
    }

    // now create or fetch _Elements representing these DOM nodes
    var nodes = createNodeList();
    for (var i = 0; i < results.length; i++) {
      var elem = FlashHandler._getNode(results[i], this._handler);
      this._getFakeNode(elem)._attached = this._attached;
      nodes.push(elem);
    }
    
    return nodes;
  },

  beginElement: function() {
    this.beginElementAt(0);
  },

  endElement: function() {
    this.endElementAt(0);
  },

  beginElementAt: function(offset) {
    if (this._attached && this._passThrough) {
      this._handler.sendToFlash('jsBeginElementAt', [ this._guid, offset ]);
    }
  },

  endElementAt: function(offset) {
    if (this._attached && this._passThrough) {
      this._handler.sendToFlash('jsEndElementAt', [ this._guid, offset ]);
    }
  },

  /*
    Note: DOM Level 2 getAttributeNode, setAttributeNode, removeAttributeNode,
    getElementsByTagName, getAttributeNodeNS, setAttributeNodeNS not supported
  */
  
  // SVGStylable interface
  style: null, /** Note: technically should be read only; _Style instance */
  
  _setClassName: function(className) {
    // TODO: Implement
  },
  
  // Note: we return a normal String instead of an SVGAnimatedString
  // as dictated by the SVG 1.1 standard
  _getClassName: function() {
    // TODO: Implement
  },
  
  // Note: getPresentationAttribute not supported
  
  // SVGTransformable; takes an _SVGTransform
  _setTransform: function(transform) {
    // TODO: Implement
  },
  
  // Note: we return a JS Array of _SVGTransforms instead of an 
  // SVGAnimatedTransformList as dictated by the SVG 1.1 standard
  _getTransform: function() /* readonly; returns Array */ {
    // TODO: Implement
  },
  
  // SVGFitToViewBox
  // Note: only supported for root SVG element for now
  _getViewBox: function() { /* readonly; SVGRect */
    // Note: We return an _SVGRect instead of an SVGAnimatedRect as dictated
    // by the SVG 1.1 standard
    // TODO: Implement
  },
  
  // SVGElement
  _getId: function() {
    // note: all attribute names are prefixed with _ to prevent attribute names
    // starting numbers from being interpreted as array indexes
    if (this._attributes['_id']) {
      return this._attributes['_id'];
    } else {
      // id property is special; we return empty string instead of null
      // to mimic native behavior on Firefox and Safari
      return '';
    }
  },
  
  _setId: function(id) {
    return this.setAttribute('id', id);
  },
  
  ownerSVGElement: null, /* Note: technically readonly */
  
  // not supported: xmlbase, viewportElement
  
  // SVGSVGElement and SVGUseElement readonly
  
  _getX: function() { /* SVGAnimatedLength */
    var value = this._trimMeasurement(this.getAttribute('x'));
    return new _SVGAnimatedLength(new _SVGLength(new Number(value)));
  },
  
  _getY: function() { /* SVGAnimatedLength */
    var value = this._trimMeasurement(this.getAttribute('y'));
    return new _SVGAnimatedLength(new _SVGLength(new Number(value)));
  },
  
  _getWidth: function() { /* SVGAnimatedLength */
    var value = this._trimMeasurement(this.getAttribute('width'));
    return new _SVGAnimatedLength(new _SVGLength(new Number(value)));
  },
  
  _getHeight: function() { /* SVGAnimatedLength */
    var value = this._trimMeasurement(this.getAttribute('height'));
    return new _SVGAnimatedLength(new _SVGLength(new Number(value)));
  },

  _getCurrentScale: function() { /* float */
    return this._currentScale;
  },
  
  _setCurrentScale: function(newScale /* float */) {
    if (newScale !== this._currentScale) {
      this._currentScale = newScale;
      
      this._handler.sendToFlash('jsSetCurrentScale', [ newScale ]);
    }
    
    return newScale;
  },

  _getCurrentTranslate: function() { /* SVGPoint */
    return this._currentTranslate;
  },
  
  createSVGPoint: function() {
    return new _SVGPoint(0, 0);
  },
  
  createSVGRect: function() {
    return new _SVGRect(0, 0, 0, 0);
  },

  getBBox: function() {
    if (this._handler) {
      var msg = this._handler.sendToFlash('jsGetBBox', [ this._guid ]);
      msg = this._handler._stringToMsg(msg);
      return new _SVGRect(new Number(msg.x), new Number(msg.y),
                          new Number(msg.width), new Number(msg.height));
    } else {
      return new _SVGRect(0,0,0,0);
    }
  },

  /** Extracts the unit value and trims off the measurement type. For example, 
      if you pass in 14px, this method will return 14. Null will return null. */
  _trimMeasurement: function(value) {
    if (value !== null) {
      value = value.replace(/[a-z]/gi, '');
    }
    return value;
  },
  
  // many attributes and methods from these two interfaces not here
  
  // defacto non-standard attributes
  
  _getInnerHTML: function() {
    // TODO: Implement; NativeHandler will require this as well, since 
    // innerHTML not natively supported there
  },
  
  _setInnerHTML: function(newValue) {
    // TODO: Implement; NativeHandler will require this as well, since 
    // innerHTML not natively supported there
  },
  
  // SVG 1.1 inline event attributes:
  // http://www.w3.org/TR/SVG/script.html#EventAttributes
  // Note: Technically not all elements have all these events; also
  // technically the SVG spec requires us to support the DOM Mutation
  // Events, which we do not.
  // We use this array to build up our getters and setters .
  // TODO: Gauge the performance impact of making this dynamic
  _allEvents: [
    'onfocusin', 'onfocusout', 'onactivate', 'onclick', 'onmousedown',
    'onmouseup', 'onmouseover', 'onmousemove', 'onmouseout', 'onload',
    'onunload', 'onabort', 'onerror', 'onresize', 'onscroll', 'onzoom',
    'onbegin', 'onend', 'onrepeat'
  ],
  
  _handleEvent: function(evt) {
    // called from the IE HTC when an event is fired, as well as from
    // one of our getter/setters for non-IE browsers
  },
  
  _prepareEvents: function() {
    // for non-IE browsers, make the getter/setter magic using the
    // _allEvents array
  },
  
  // SVGTests, SVGLangSpace, SVGExternalResourcesRequired
  // not supported
  
  // contains any attribute set with setAttribute; object literal of
  // name/value pairs
  _attributes: null,
  
  // copies the attributes from the XML DOM node into target
  _importAttributes: function(target, nodeXML) {
    for (var i = 0; i < nodeXML.attributes.length; i++) {
      var attr = nodeXML.attributes[i];
      this._attributes['_' + attr.nodeName] = attr.nodeValue;
    }
  },
  
  /** Does all the getter/setter magic for attributes, so that external
      callers can do something like myElement.innerHTML = 'foobar' or
      myElement.id = 'test' and our getters and setters will intercept
      these to do the correct behavior with the Flash viewer.*/
  _defineAccessors: function() {
    var props;
    var self = this;
    
    // innerHTML
    /* // TODO: Not implemented yet
    this.__defineGetter__('innerHTML', function() {
      return self._getInnerHTML();
    });
    this.__defineSetter__('innerHTML', function(newValue) {
      return self._setInnerHTML(newValue);
    });
    */
    
    // SVGSVGElement and SVGUseElement readyonly props
    if (this.nodeName == 'svg' || this.nodeName == 'use') {
      this.__defineGetter__('x', function() { return self._getX(); });
      this.__defineGetter__('y', function() { return self._getY(); });
      this.__defineGetter__('width', function() { return self._getWidth(); });
      this.__defineGetter__('height', function() { return self._getHeight(); });
    }
    
    if (this.nodeName == 'svg') {
      // TODO: Ensure that currentTranslate and currentScale only show up
      // on root SVG node and not nested SVG nodes
      this.__defineGetter__('currentTranslate', function() {
        return self._getCurrentTranslate();
      });
      
      this.__defineGetter__('currentScale', function() {
        return self._getCurrentScale();
      });
      this.__defineSetter__('currentScale', function(newScale) {
        return self._setCurrentScale(newScale);
      });
    }
    
    // id property
    this.__defineGetter__('id', hitch(this, this._getId));
    this.__defineSetter__('id', hitch(this, this._setId));
  },
  
  /** @param prop String property name, such as 'x'.
      @param readWrite Boolean on whether the property is both read and write;
      if false then read only. */
  _defineAccessor: function(prop, readWrite) {
    var self = this;
    
    var getMethod = function() {
      return self.getAttribute(prop);
    };
  
    this.__defineGetter__(prop, getMethod);
    
    if (readWrite) {
      var setMethod = function(newValue) {
        return self.setAttribute(prop, newValue);
      };
      
      this.__defineSetter__(prop, setMethod);
    }
  }
});


/** The DOM DocumentFragment API. 

    @param doc The document that produced this _DocumentFragment. Either
    the global, browser native 'document' or a fake _Document if this was
    created in the context of an SVG OBJECT. */
function _DocumentFragment(doc) {
  // superclass constructor
  _Node.apply(this, ['#document-fragment', _Node.DOCUMENT_FRAGMENT_NODE, 
                     null, null, null, null]);
  
  this.ownerDocument = doc;
}

// subclasses _Node
_DocumentFragment.prototype = new _Node;

extend(_DocumentFragment, {
  /** 'Resets' a _DocumentFragment so it can be reused. Basically removes
      all of it's children. */
  _reset: function() {
    // delete all the XML children; using a while() loop works better than
    // for() since the # of childNodes will change out from under us as we
    // remove children.
    while (this._nodeXML.firstChild) {
      this._nodeXML.removeChild(this._nodeXML.firstChild);
    }

    this._childNodes = this._createChildNodes();
    if (!isIE) {
      this._defineNodeAccessors();
    }
    
    // NOTE: we never remove the DocumentFragment from the svgweb._guidLookup
    // table or the HTC node for this DocumentFragment; this is because we
    // must make it possible to reuse the DocumentFragment. This could cause
    // a memory leak issue over time however.
  }
});

/** Not an official DOM interface; used so that we can track changes to
    the CSS style property of an Element
    @param element The _Element that this Style is attached to. */
function _Style(element) {
  this._element = element;
  this._setup();
}

// we use this array to build up getters and setters to watch any changes for
// any of these styles. Note: Technically we shouldn't have all of these for
// every element, since some SVG elements won't have specific kinds of
// style properties, like the DESC element having a font-size.
_Style._allStyles = [
  'font', 'fontFamily', 'fontSize', 'fontSizeAdjust', 'fontStretch', 'fontStyle',
  'fontVariant', 'fontWeight', 'direction', 'letterSpacing', 'textDecoration',
  'unicodeBidi', 'wordSpacing', 'clip', 'color', 'cursor', 'display', 'overflow',
  'visibility', 'clipPath', 'clipRule', 'mask', 'opacity', 'enableBackground',
  'filter', 'floodColor', 'floodOpacity', 'lightingColor', 'stopColor',
  'stopOpacity', 'pointerEvents', 'colorInterpolation',
  'colorInterpolationFilters', 'colorProfile', 'colorRendering', 'fill',
  'fillOpacity', 'fillRule', 'imageRendering', 'marker', 'markerEnd',
  'markerMid', 'markerStart', 'shapeRendering', 'stroke', 'strokeDasharray',
  'strokeDashoffset', 'strokeLinecap', 'strokeLinejoin', 'strokeMiterlimit',
  'strokeOpacity', 'strokeWidth', 'textRendering', 'alignmentBaseline', 
  'baselineShift', 'dominantBaseline', 'glyphOrientationHorizontal',
  'glyphOrientationVertical', 'kerning', 'textAnchor',
  'writingMode'
];

// the root SVGSVGElement has a few extra styles possible since it is nested
// into an HTML context
_Style._allRootStyles = [
  'border', 'verticalAlign', 'backgroundColor', 'top', 'right', 'bottom',
  'left', 'position', 'width', 'height', 'margin', 'marginTop', 'marginBottom',
  'marginRight', 'marginLeft', 'padding', 'paddingTop', 'paddingBottom',
  'paddingLeft', 'paddingRight', 'borderTopWidth', 'borderRightWidth',
  'borderBottomWidth', 'borderLeftWidth', 'borderTopColor', 'borderRightColor',
  'borderBottomColor', 'borderLeftColor', 'borderTopStyle', 'borderRightStyle',
  'borderBottomStyle', 'borderLeftStyle', 'zIndex', 'overflowX', 'overflowY',
  'float', 'clear'
];

extend(_Style, {
  /** Flag that indicates that the HTC should ignore any property changes
      due to style changes. Used when we are internally making style changes. */
  _ignoreStyleChanges: true,
  
  /** Initializes our magic getters and setters for non-IE browsers. For IE
      we set our initial style values on the HTC. */
  _setup: function() {
    // Handle an edge-condition: the SVG spec requires us to support
    // style="" strings that might have uppercase style names, measurements,
    // etc. Normalize these here before continuing.
    this._normalizeStyle();
    
    // now handle browser-specific initialization
    if (!isIE) {
      // setup getter/setter magic for non-IE browsers
      for (var i = 0; i < _Style._allStyles.length; i++) {
        var styleName = _Style._allStyles[i];
        this._defineAccessor(styleName);
      }
      
      // root SVGSVGElement nodes have some extra properties from being in an
      // HTML context
      // If _handler is not set, this element is a nested svg element.
      if (this._element._handler
            && this._element._getProxyNode() == this._element._handler.document.rootElement) {
        for (var i = 0; i < _Style._allRootStyles.length; i++) {
          var styleName = _Style._allRootStyles[i];
          this._defineAccessor(styleName);
        }
      }
      
      // CSSStyleDeclaration properties
      this.__defineGetter__('length', hitch(this, this._getLength));
    } else { // Internet Explorer setup
      var htcStyle = this._element._htcNode.style;
      
      // parse style string
      var parsedStyle = this._fromStyleString();
      
      // loop through each one, setting it on our HTC's style object
      for (var i = 0; i < parsedStyle.length; i++) {
        var styleName = this._toCamelCase(parsedStyle[i].styleName);
        var styleValue = parsedStyle[i].styleValue;
        // Issue 485: Cannot set textAlign style on IE
        try {
          htcStyle[styleName] = styleValue;
        } catch (exp) {
          console.log('The following exception occurred setting style.'
                      + styleName + ' on IE: ' + (exp.message || exp));
        }
      }
      
      // set initial values for style.length
      // Use try/catch; IE9 considers this read-only,
      try {
        htcStyle.length = 0;
      }
      catch (exp) {
        // IE9 has length already set to zero anyway so it does not matter.
      }
      
      // expose .length property on our custom _Style object to aid it 
      // being used internally
      this.length = 0;
      
      // set CSSStyleDeclaration methods to our implementation
      htcStyle.item = hitch(this, this.item);
      htcStyle.setProperty = hitch(this, this.setProperty);
      htcStyle.getPropertyValue = hitch(this, this.getPropertyValue);
      
      // start paying attention to style change events on the HTC node
      this._changeListener = hitch(this, this._onPropertyChange);
      this._element._htcNode.attachEvent('onpropertychange', 
                                         this._changeListener);
      if (isIE && isIE >= 8) {
        // Strange style bugs in IE: it will not fire the listener, may incorrectly
        // return "" on getPropertyValue calls, and may not activate style changes.
        // But all that is fixed by reading this style property first! (Found randomly)
        // (Return the value because simply reading may be optimized out by compiler)
        return htcStyle['pixelBottom'];
      }
    }
  },
  
  /** Defines the getter and setter for a single style, such as 'display'. */
  _defineAccessor: function(styleName) {
    var self = this;
    
    this.__defineGetter__(styleName, function() {
      return self._getStyleAttribute(styleName);
    });
    
    this.__defineSetter__(styleName, function(styleValue) {
      return self._setStyleAttribute(styleName, styleValue);
    });
  },
  
  _setStyleAttribute: function(styleName, styleValue) {
    //console.log('setStyleAttribute, styleName='+styleName+', styleValue='+styleValue);
    // Note: .style values and XML attributes have separate values. The XML
    // attributes always have precedence over any style values.
    
    // convert camel casing (i.e. strokeWidth becomes stroke-width)
    var stylePropName = this._fromCamelCase(styleName);
    
    // change our XML style string value
    
    // parse style string first
    var parsedStyle = this._fromStyleString();
    
    // is our style name there?
    var foundStyle = false;
    for (var i = 0; i < parsedStyle.length; i++) {
      if (parsedStyle[i].styleName === stylePropName) {
        parsedStyle[i].styleValue = styleValue;
        foundStyle = true;
        break;
      }
    }
    
    // if we didn't find it above add it
    if (!foundStyle) {
      parsedStyle.push({ styleName: stylePropName, styleValue: styleValue });
    }
    
    // now turn the style back into a string and set it on our XML and
    // internal list of attribute values
    var styleString = this._toStyleString(parsedStyle);
    this._element._nodeXML.setAttribute('style', styleString);
    this._element._attributes['_style'] = styleString;
    
    // for IE, update our HTC style object; we can't do magic getters for 
    // those so have to update and cache the values
    if (isIE) {
      var htcStyle = this._element._htcNode.style;
      
      // never seen before; bump our style length
      if (!foundStyle) {
        try {
          htcStyle.length++;
        } catch (ex) {
          // IE 9 does not tolerate or appear to require length++.
        }
        this.length++;
      }
      
      // update style value on HTC node so that when the value is fetched
      // it is correct; ignoreStyleChanges during this or we will get into
      // an infinite loop
      this._ignoreStyleChanges = true;
      htcStyle[styleName] = styleValue;
      this._ignoreStyleChanges = false;
    }
    
    // tell Flash about the change
    if (this._element._attached && this._element._passThrough) {
      var flashStr = FlashHandler._encodeFlashData(styleValue);
      this._element._handler.sendToFlash('jsSetAttribute',
                                          [ this._element._guid, true,
                                            null, stylePropName, flashStr ]);
    }
  },
  
  _getStyleAttribute: function(styleName) {
    //console.log('getStyleAttribute, styleName='+styleName);
    // convert camel casing (i.e. strokeWidth becomes stroke-width)
    var stylePropName = this._fromCamelCase(styleName);
    
    if (this._element._attached && this._element._passThrough
        && !this._element._handler._redrawManager.isSuspended()) {
      var value = this._element._handler.sendToFlash('jsGetAttribute',
                                              [ this._element._guid,
                                                true, false, null, 
                                                stylePropName, false ]);
      return value;
    } else {
      // not attached yet; have to parse it from our local value
      var parsedStyle = this._fromStyleString();

      for (var i = 0; i < parsedStyle.length; i++) {
        if (parsedStyle[i].styleName === stylePropName) {
          return parsedStyle[i].styleValue;
        }
      }
      
      return null;
    }
  },
  
  /** Parses our style string into an array, where each array entry is an
      object literal with the 'styleName' and 'styleValue', such as:
      
      results[0].styleName
      results[0].styleValue
      etc. 
      
      If there are no results an empty array is returned. */
  _fromStyleString: function() {
    var styleValue = this._element._nodeXML.getAttribute('style');
    
    if (styleValue === null || styleValue === undefined) {
      return [];
    }
    
    var baseStyles;
    if (styleValue.indexOf(';') == -1) {
      // only one style value given, with no trailing semicolon
      baseStyles = [ styleValue ];
    } else {
      baseStyles = styleValue.split(/\s*;\s*/);
      // last style is empty due to split()
      if (!baseStyles[baseStyles.length - 1]) {
        baseStyles = baseStyles.slice(0, baseStyles.length - 1);
      }
    }
    
    var results = [];
    for (var i = 0; i < baseStyles.length; i++) {
      var style = baseStyles[i];
      var styleSet = style.split(':');
      if (styleSet.length == 2) {
        var attrName = styleSet[0];
        var attrValue = styleSet[1];
        
        // trim leading whitespace
        attrName = attrName.replace(/^\s+/, '');
        attrValue = attrValue.replace(/^\s+/, '');
        
        var entry = { styleName: attrName, styleValue: attrValue };
        results.push(entry);
      }
    }
    
    return results;
  },
  
  /** Turns a parsed style into a string.
  
      @param parsedStyle An array where each entry is an object literal
      with two values, 'styleName' and 'styleValue'. Uses same data structure
      returned from fromStyleString() method above. */
  _toStyleString: function(parsedStyle) {
    var results = '';
    for (var i = 0; i < parsedStyle.length; i++) {
      results += parsedStyle[i].styleName + ': ';
      results += parsedStyle[i].styleValue + ';';
      if (i != (parsedStyle.length - 1)) {
        results += ' ';
      }
    }
    
    return results;
  },
  
  /** Transforms a camel case style name, such as strokeWidth, into it's
      dash equivalent, such as stroke-width. */
  _fromCamelCase: function(styleName) {
    return styleName.replace(/([A-Z])/g, '-$1').toLowerCase();
  },
  
  /** Transforms a dash style name, such as stroke-width, into it's 
      camel case equivalent, such as strokeWidth. */
  _toCamelCase: function(stylePropName) {
    if (stylePropName.indexOf('-') == -1) {
      return stylePropName;
    }
    
    var results = '';
    var sections = stylePropName.split('-');
    results += sections[0];
    for (var i = 1; i < sections.length; i++) {
      results += sections[i].charAt(0).toUpperCase() + sections[i].substring(1);
    }
    
    return results;
  },
  
  // CSSStyleDeclaration interface methods and properties
  
  // TODO: removeProperty not supported yet
  
  setProperty: function(stylePropName, styleValue, priority) {
    // TODO: priority not supported for now; not sure if it even makes
    // sense in this context
    
    // convert from dash style to camel casing (i.e. stroke-width becomes
    // strokeWidth
    var styleName = this._toCamelCase(stylePropName);
    
    this._setStyleAttribute(styleName, styleValue);
    return styleValue;
  },
  
  getPropertyValue: function(stylePropName) {
    // convert from dash style to camel casing (i.e. stroke-width becomes
    // strokeWidth
    var styleName = this._toCamelCase(stylePropName);
    
    return this._getStyleAttribute(styleName);
  },
  
  item: function(index) {
    // parse style string
    var parsedStyle = this._fromStyleString();
    
    // TODO: Throw exception if index is greater than length of style rules
    
    return parsedStyle[index].styleName;
  },
  
  // NOTE: We don't support cssText for now. The reason why is that
  // IE has a style.cssText property already on our HTC nodes. This
  // property incorrectly includes some of our custom internal code,
  // such as 'length' as well as both versions of certain camel cased
  // properties (like stroke-width and strokeWidth). There is no way 
  // currently known to work around this. The property is not that important
  // anyway so it won't currently be supported.
  
  _getLength: function() {
    // parse style string
    var parsedStyle = this._fromStyleString();
    return parsedStyle.length;
  },
  
  /** Handles an edge-condition: the SVG spec requires us to support
      style="" strings that might have uppercase style names, measurements,
      etc. We normalize these to lower-case in this method. */
  _normalizeStyle: function() {
    // style="" attribute?
    // NOTE: IE doesn't support nodeXML.hasAttribute()
    if (!this._element._nodeXML.getAttribute('style')) {
      return;
    }
    
    // no uppercase letters?
    if (!/[A-Z]/.test(this._element._nodeXML.getAttribute('style'))) {
      return;
    }
    
    // parse style into it's components
    var parsedStyle = this._fromStyleString();
    for (var i = 0; i < parsedStyle.length; i++) {
      parsedStyle[i].styleName = parsedStyle[i].styleName.toLowerCase();
      
      // don't lowercase url() values
      if (parsedStyle[i].styleValue.indexOf('url(') == -1) {
        parsedStyle[i].styleValue = parsedStyle[i].styleValue.toLowerCase();
      }
    }
    
    // turn back into a string
    var results = '';
    for (var i = 0; i < parsedStyle.length; i++) {
      results += parsedStyle[i].styleName + ': ' 
                 + parsedStyle[i].styleValue + '; ';
    }
    
    // remove trailing space
    if (results.charAt(results.length - 1) == ' ') {
      results = results.substring(0, results.length - 1);
    }
    
    // change our style value; however, don't pass this through to Flash
    // because Flash might not even know about our existence yet, because we
    // are still being run from the _Element constructor
    this._element._passThrough = false;
    this._element.setAttribute('style', results);
    this._element._passThrough = true;
  },
  
  /** For Internet Explorer, this method is called whenever a
      propertychange event fires on the HTC. */
  _onPropertyChange: function() {
    // watch to see when anyone changes a 'style' property so we
    // can mirror it in the Flash control
    
    if (this._ignoreStyleChanges) {
      return;
    }
    
    var prop = window.event.propertyName;

    if (prop && /^style\./.test(prop) && prop != 'style.length') {        
      // extract the style name and value
      var styleName = prop.match(/^style\.(.*)$/)[1];
      var styleValue = this._element._htcNode.style[styleName];
      
      // tell Flash and our fake node about our style change
      this._setStyleAttribute(styleName, styleValue);
    }
  }
});


/** An OBJECT tag that is embedding an SVG element. This class encapsulates
    how we actually do the work of embedding this into the page (such as 
    internally transforming the SVG OBJECT into a Flash one).
    
    @param svgNode The SVG OBJECT node to work with.
    @param handler The FlashHandler that owns us. */
function _SVGObject(svgNode, handler) {
  this._handler = handler;
  this._svgNode = svgNode;
  this._scriptsToExec = [];
  
  // flags to know when the SWF file (and on IE the HTC file) are done loading
  // If defineProperty is available, do not bother loading the htc.
  this._htcLoaded = Object.defineProperty ? true : false;
  this._swfLoaded = false;
  
  // handle any onload event listeners that might be present for
  // dynamically created OBJECT tags; this._svgNode._listeners is an array 
  // we expose through our custom document.createElement('object', true) -- 
  // the 'true' actually flags us to do things like this
  for (var i = 0; this._svgNode._onloadListeners 
                  && i < this._svgNode._onloadListeners.length; i++) {
    // wrap each of the listeners so that its 'this' object
    // correctly refers to the Flash OBJECT if used inside the listener
    // function; we use an outer function to prevent closure from 
    // incorrectly happening, and then return an inner function inside
    // of this that correctly makes the 'this' object be our Flash
    // OBJECT rather than the global window object
    var wrappedListener = (function(handler, listener) {
      return function() {
        //console.log('_SVGObject, wrappedListener, handler='+handler+', listener='+listener);
        listener.apply(handler.flash);
      };
    })(this._handler, this._svgNode._onloadListeners[i]); // pass values into function
    svgweb.addOnLoad(wrappedListener);
  }
  
  // start fetching the HTC file in the background
  if (isIE) {
    this._loadHTC();
  }
  
  // fetch the SVG URL now and start processing.
  // Note: unfortunately we must use the 'src' attribute instead of the 
  // standard 'data' attribute for IE. On certain installations of IE
  // with some security patches IE will display a gold security bar indicating
  // that some URLs were blocked; on others IE will attempt to download the
  // file pointed to by the 'data' attribute. Note that using the 'src'
  // attribute is a divergence from the standard, but it solves both issues.
  this.url = this._svgNode.getAttribute('src');
  if (!this.url) {
    this.url = this._svgNode.getAttribute('data');
  }

  // success function
  var successFunc = hitch(this,
    function(svgStr) {
      // clean up and parse our SVG
      this._handler._origSVG = svgStr;
      var results = svgweb._cleanSVG(svgStr, true, false);
      this._svgString = results.svg;
      this._xml = results.xml;

      // create our document objects
      this.document = new _Document(this._xml, this._handler);
      this._handler.document = this.document;

      // insert our Flash and replace the SVG OBJECT tag
      var nodeXML = this._xml.documentElement;
      
      // save any custom PARAM tags that might be nested inside our SVG OBJECT
      this._savedParams = this._getPARAMs(this._svgNode);
      
      // now insert the Flash
      this._handler._inserter = new FlashInserter('object', this._xml.documentElement,
                                                  this._svgNode, this._handler);

      // wait for Flash to finish loading; see _onFlashLoaded() in this class
      // for further execution after the Flash asynchronous process is done
    });

  if (this.url.substring(0, 5) == 'data:') {
    successFunc(this.url.substring(this.url.indexOf(',')+1));
  }
  else {
    this._fetchURL(this.url, successFunc, hitch(this, this._fallback));
  }
}

extend(_SVGObject, {
  /** An array of strings, where each string is an SVG SCRIPT tag embedded
      in an external SVG file. This is when SVG is embedded with an OBJECT. */
  _scriptsToExec: null,
 
  /**
   * UTF-8 data encode / decode
   * http://www.webtoolkit.info/
   **/
  _utf8encode : function (string) {
    string = string.replace(/\r\n/g,"\n");
    var utftext = "";
    for (var n = 0; n < string.length; n++) {
      var c = string.charCodeAt(n);
      if (c < 128) {
        utftext += String.fromCharCode(c);
      } else if ((c > 127) && (c < 2048)) {
        utftext += escape(String.fromCharCode((c >> 6) | 192));
        utftext += escape(String.fromCharCode((c & 63) | 128));
      } else {
        utftext += escape(String.fromCharCode((c >> 12) | 224));
        utftext += escape(String.fromCharCode(((c >> 6) & 63) | 128));
        utftext += escape(String.fromCharCode((c & 63) | 128));
      }
    }
    return utftext;
  },
  
  _fetchURL: function(url, onSuccess, onFailure) {
    var req = xhrObj();
    
    // bust the cache for IE since IE's XHR GET requests are wonky
    if (isIE) {
      url = this._utf8encode(url);
      url += (url.indexOf('?') == -1) ? '?' : '&';
      url += new Date().getTime();
    }
    
    req.onreadystatechange = function() {
      if (req.readyState == 4) {
        if (req.status == 200) { // done
          onSuccess(req.responseText);
        } else { // error
          onFailure(req.status + ': ' + req.statusText);
        }
        
        req = null;
      }
    };
    
    req.open('GET', url, true);
    req.send(null);
  },
  
  _fallback: function(error) {
    console.log('onError (fallback), error='+error);
    // TODO: Implement
  },
  
  _loadHTC: function() {
    // if IE, force the HTC file to asynchronously load with a dummy element;
    // we want to do the async operation now so that external API users don't 
    // get hit with the async nature of the HTC file first loading when they
    // make a sync call; we will send the SVG over to the Flash _after_ the
    // HTC file is done loading.
    this._dummyNode = document.createElement('svg:__force__load');
    this._dummyNode._handler = this._handler;
    
    // find out when the content is ready
    // NOTE: we do this here instead of inside the HTC file using an
    // internal oncontentready event in order to make the HTC file faster
    // and use less memory. Note also that 'oncontentready' is not available 
    // outside HTC files, only 'onreadystatechange' is available.
    this._readyStateListener = hitch(this, this._onHTCLoaded); // cleanup later
    this._dummyNode.attachEvent('onreadystatechange', 
                                this._readyStateListener);
    
    var head = document.getElementsByTagName('head')[0];
    // NOTE: as _soon_ as we append the dummy element the HTC file will
    // get called, branching control, so code after this call will not
    // get run in the sequence expected
    head.appendChild(this._dummyNode);
    
    // wait for HTC to load
  },
    
  _onFlashLoaded: function(msg) {
    // On IE 9, the flash control may not actually be present in the DOM
    // yet, even though it is active and calling javascript.
    if (!document.getElementById(this._handler.flashID)) {
      setTimeout((function(self, msg) {
                    return function() {
                      self._onFlashLoaded(msg);
                    };
                  })(this, msg), 1);
    } else {
      this._onFlashLoadedNow(msg);
    }
  },

  _onFlashLoadedNow: function(msg) {
    //console.log('_SVGObject, onFlashLoaded, msg='+this._handler.debugMsg(msg));

    // store a reference to our Flash object
    this._handler.flash = document.getElementById(this._handler.flashID);

    // copy any custom developer PARAM tags on the original SVG OBJECT 
    // over to the Flash element so that SVG scripts can programmatically 
    // access them; we saved these earlier in the _SVGObject constructor
    if (this._savedParams.length) {
      for (var i = 0; i < this._savedParams.length; i++) {
        var param = this._savedParams[i];
        this._handler.flash.appendChild(param);
        param = null;
      }
      
      this._savedParams = null;
    }
    
    // expose top and parent attributes on Flash OBJECT
    this._handler.flash.top = this._handler.flash.parent = window;
    
    // flag that the SWF is loaded; if not IE, send everything over to Flash;
    // if IE, make sure the HTC file is done loading
    this._swfLoaded = true;
    if (!isIE || this._htcLoaded) {
      this._onEverythingLoaded();
    }
  },
  
  _onHTCLoaded: function() {
    //console.log('_SVGObject, onHTCLoaded');
    
    // We added a 'dummy' HTC node to the page when we first instantiated our
    // _SVGObject; this was so that the HTC part of the architecture is primed
    // and loaded and ready to go, so later on when someone does a 
    // synchronous createElement() to create an SVG node the HTC behavior is
    // already loaded and ready to do it's magic. Now that the HTC file is 
    // loaded we want to remove the dummy element created earlier.
    
    // can't use htcNode.parentNode to get the parent and remove the child
    // since we override that inside svg.htc
    var head = document.getElementsByTagName('head')[0];
    head.removeChild(this._dummyNode);
    
    // cleanup our event handler
    this._dummyNode.detachEvent('onreadystatechange', this._readyStateListener);
    
    // prevent IE memory leaks
    this._dummyNode = null;
    head = null;
    
    // flag that we are loaded; send things over to Flash if the SWF is loaded
    this._htcLoaded = true;
    if (this._swfLoaded) {
      this._onEverythingLoaded();
    }
  },
  
  _onEverythingLoaded: function() {
    //console.log('_SVGObject, onEverythingLoaded');

    var size = this._handler._inserter._determineSize();
    this._handler.sendToFlash('jsHandleLoad',
                              [ /* objectURL */ this._getRelativeTo('object'),
                                /* pageURL */ this._getRelativeTo('page'),
                                /* objectWidth */ size.pixelsWidth,
                                /* objectHeight */ size.pixelsHeight,
                                /* ignoreWhiteSpace */ false,
                                /* svgString */ this._svgString ]);
  },
  
  _onRenderingFinished: function(msg) {
    //console.log('_SVGObject, onRenderingFinished, id='+this._handler.id
    //            + ', msg='+this._handler.debugMsg(msg));
    
    // we made the SVG hidden before to avoid scrollbars on IE; make visible
    // now
    this._handler.flash.style.visibility = 'visible';

    // create the documentElement and rootElement and set them to our SVG 
    // root element
    var rootXML = this._xml.documentElement;
    var rootID = rootXML.getAttribute('id');
    var root = new _SVGSVGElement(rootXML, null, null, this._handler);
    var doc = this._handler.document;
    doc._attached = true;
    doc.documentElement = root._getProxyNode();
    doc.rootElement = root._getProxyNode();
    // add to our lookup tables so that fetching this node in the future works
    doc._nodeById['_' + rootID] = root;

    if (isIE) {
      // this workaround will prevent Issue 140:
      // "SVG OBJECT.contentDocument does not work when DOCTYPE specified 
      // inside of HTML file itself"
      // http://code.google.com/p/svgweb/issues/detail?id=140
      this._handler.flash.setAttribute('contentDocument', null);
    }
    
    // add our contentDocument property
    // TODO: This should be doc._getProxyNode(), but Issue 227 needs to be
    // addressed first:
    // http://code.google.com/p/svgweb/issues/detail?id=227
    try {
      this._handler.flash.contentDocument = doc;
    }
    catch (exp) {
      // Issue 573: Solution for Issue 140 above only works up to IE version 8.
      // IE 9 throws an exception.
      try {
        this._handler.flash.__contentDocument = doc;
        var self = this;
        Object.defineProperty(this._handler.flash, 'contentDocument', 
          { get: function () {
                   return self._handler.flash.__contentDocument;
                 },
            set: function (val) {
                   self._handler.flash.__contentDocument = val;
                 }
          });
      }
      catch (exp) {
        // This should work on IE 9. Have not seen an exception here.
        console.log('This exception occurred setting object contentDocument: '
                     + (exp.message || exp));
      }
    }
    
    // FIXME: NOTE: unfortunately we can't support the getSVGDocument() method; 
    // Firefox throws an error when we try to override it:
    // 'Trying to add unsupported property on scriptable plugin object!'
    // this._handler.flash.getSVGDocument = function() {
    //   return this.contentDocument;
    // };
    
    // create a pseudo window element
    this._handler.window = new _SVGWindow(this._handler);
    
    // our fake document object should point to our fake window object
    doc.defaultView = this._handler.window;
    
    FlashHandler._patchFakeObjects(doc.defaultView, doc);
    
    // add our onload handler to the list of scripts to execute at the
    // beginning
    var onload = rootXML.getAttribute('onload');
    if (onload) {
      // we want 'this' inside of the onload handler to point to our
      // SVG root; the 'document.documentElement' will get rewritten later by
      // the _executeScript() method to point to our fake SVG root instead
      var defineEvtCode = 
        'var evt = { target: document.getElementById("' + root.getAttribute('id') + '") ,' +
                    'currentTarget: document.getElementById("' + root.getAttribute('id') + '") ,' +
                    'preventDefault: function() { this.returnValue=false; }' +
                  '};';
      onload = ';(function(){' + defineEvtCode + onload + '}).apply(document.documentElement);';
      this._scriptsToExec.push(onload);
    }
    
    // now execute any scripts embedded into the SVG file; we turn all
    // the scripts into one giant block and run them together so that 
    // global functions can 'see' and call each other
    var finalScript = '';
    for (var i = 0; i < this._scriptsToExec.length; i++) {
      finalScript += this._scriptsToExec[i] + '\n';
    }
    this._executeScript(finalScript);
    
    // indicate that we are done
    this._handler._loaded = true;
    this._handler.fireOnLoad(this._handler.id, 'object');
  },
  
  /** Relative URLs inside of SVG need to expand against something (i.e.
      such as having an SVG Audio tag with a relative URL). This method
      figures out what that relative URL should be. We send this over to
      Flash when rendering things so Flash knows what to expand against. 
      
      @param toWhat - String that controls what we use for the relative URL.
      If "object" given, we use the URL to the SVG OBJECT; if "page" given,
      we determine things relative to the page itself. */
  _getRelativeTo: function(toWhat) {
    var results = '';
    if (toWhat == 'object') {
      // strip off scheme and hostname, then match just path portion
      var pathname = this.url.replace(/[^:]*:\/\/[^\/]*/).match(/\/?[^\?\#]*/)[0];
      if (pathname && pathname.length > 0 && pathname.indexOf('/') != -1) {
        // snip off any filename after a final slash
        results = pathname.replace(/\/([^\/]*)$/, '/');
      }
    } else {
      var pathname = window.location.pathname.toString();
      if (pathname && pathname.length > 0 && pathname.indexOf('/') != -1) {
        // snip off any filename after a final slash
        results = pathname.replace(/\/([^\/]*)$/, '/');
      }
    }

    return results;
  },
  
  /** Executes a SCRIPT block inside of an SVG file. We essentially rewrite
      the references in this script to point to our Flash Handler instead, 
      create an invisible iframe that will act as the 'global' object, and then
      write the script into the iframe as a new SCRIPT block.
      
      @param script String with script to execute. */
  _executeScript: function(script) {
    // Create an iframe that we will use to 'silo' and execute our
    // code, which will act as a place for globals to be defined without
    // clobbering globals on the HTML document's window or from other
    // embedded SVG files. This is necessary so that setTimeouts and
    // setIntervals will work later on, for example.
                
    // create an iframe and attach it offscreen
    var iframe = document.createElement('iframe');
    iframe.setAttribute('src', 'about:blank');
    iframe.style.position = 'absolute';
    iframe.style.top = '-1000px';
    iframe.style.left = '-1000px';
    var body = document.getElementsByTagName('body')[0];
    body.appendChild(iframe);
    
    // get the iframes document object; IE differs on how to get this
    var iframeDoc = (iframe.contentDocument) ? 
                iframe.contentDocument : iframe.contentWindow.document;

    // set the document.defaultView to the iframe's real Window object;
    // note that IE doesn't support defaultView
    var iframeWin = iframe.contentWindow;
    this._handler.document.defaultView = iframeWin;

    // Create a script with the proper environment.
    script = this._sandboxedScript(script);

    // Add code to set back an eval function we can use for further execution.
    // Code adapted from blog post by YuppY:
    // http://dean.edwards.name/weblog/2006/11/sandbox/
    script = script + ';if (__svgHandler) __svgHandler.sandbox_eval = ' +
             (isIE ? 'window.eval;'
                   : 'function(scriptCode) { return window.eval(scriptCode) };');

    if (isOpera) {
        var _win = this;
        // Opera 10.53 just kills this event thread (see test_js2.html),
        // so we switch to a new execution context to buy more time on a
        // more appropriate thread.
        var timeoutFunc =
          setTimeout((function(_handlerwin, iframeWin, script) {
                      return function() {
                        // Opera 10.53 hangs on creating the script tag (see
                        // test_js2.html), so try running the code this way.
                        iframeWin.eval.apply(iframeWin, [script]);
                        _handlerwin._fireOnload();
                      };
                    })(this._handler.window, iframeWin, script), 1);
    } else {
      // now insert the script into the iframe to execute it in a siloed way
      iframeDoc.write('<script>' + script + '</script>');
      iframeDoc.close();
      // execute any addEventListener(onloads) that might have been
      // registered
      this._handler.window._fireOnload();
    }
    
  },

  _sandboxedScript: function(script) {
    // expose the handler as a global object at the top of the script; 
    // expose the svgns and xlinkns variables; and override the setTimeout
    // and setInterval functions for the iframe where we will execute things
    // so we can clear out all timing functions if the SVG OBJECT is later
    // removed with a call to svgweb.removeChild
    var svgwebObject = 'top.svgweb';
    if (!top.svgweb && self.frameElement) {
        if(!self.frameElement.id) {
            self.frameElement.id = svgweb._generateID('__svg__random__', '__iframe');
        }
        svgwebObject = 'top.document.getElementById("'+self.frameElement.id+'").contentWindow.svgweb';
    }
    var addToTop = 'var __svgHandler = '+svgwebObject+'.handlers["' 
                  + this._handler.id + '"];\n'
                  + 'window.svgns = "' + svgns + '";\n'
                  + 'window.xlinkns = "' + xlinkns + '";\n';
                  
    var timeoutOverride = 
                    'window._timeoutIDs = [];\n'
                  + 'window._setTimeout = window.setTimeout;\n'
                  + 'window.setTimeout = \n'
                  + '       (function() {\n'
                  + '          return function(f, ms) {\n'
                  + '            var timeID = window._setTimeout(f, ms);\n'
                  + '            window._timeoutIDs.push(timeID);\n'
                  + '            return timeID;\n'
                  + '          };\n'
                  + '        })();\n'; 
                  
    var intervalOverride = 
                    'window._intervalIDs = [];\n'
                  + 'window._setInterval = window.setInterval;\n'
                  + 'window.setInterval = \n'
                  + '       (function() {\n'
                  + '          return function(f, ms) {\n'
                  + '            var timeID = window._setInterval(f, ms);\n'
                  + '            window._intervalIDs.push(timeID);\n'
                  + '            return timeID;\n'
                  + '          };\n'
                  + '        })();\n';
                  
    script = addToTop + timeoutOverride + intervalOverride  + '\n\n' + script;
    
    // change any calls to top.document or top.window, to a temporary different 
    // string to avoid collisions when we transform next
    script = script.replace(/top\.document/g, 'top.DOCUMENT');
    script = script.replace(/top\.window/g, 'top.WINDOW');
    
    // intercept any calls to 'document.' or 'window.' inside of a string;
    // transform to this to a different temporary token so we can handle
    // it differently (i.e. we will put backslashes around certain portions:
    // top.svgweb.handlers[\"svg2\"].document for example)
    
    // change any calls to the document object to point to our Flash Handler
    // instead; avoid variable names that have the word document in them,
    // and pick up document* used with different endings
    script = script.replace(/(^|[^A-Za-z0-9_])document(\.|'|"|\,| |\))/g, 
                            '$1__svgHandler.document$2');
    
    // change some calls to the window object to point to our fake window
    // object instead
    script = script.replace(/window\.(location|addEventListener|onload|frameElement)/g, 
                            '__svgHandler.window.$1');
                            
    // change back any of our top.document or top.window calls to be
    // their original lower case (we uppercased them earlier so that we
    // wouldn't incorrectly transform them)
    script = script.replace(/top\.DOCUMENT/g, 'top.document');
    script = script.replace(/top\.WINDOW/g, 'top.window');

    return script;
  },

  
  /** Developers can nest custom PARAM tags inside our SVG OBJECT in order
      to pass parameters into their SVG file. This function gets these,
      and makes a clone of them suitable for us to re-attach and use in the
      future.
      
      @param svgNode The SVG OBJECT DOM node.
      
      @returns An array of cloned PARAM objects. If none, then the array has
      zero length. */
  _getPARAMs: function(svgNode) {
    var params = [];
    
    for (var i = 0; i < svgNode.childNodes.length; i++) {
      var child = svgNode.childNodes[i];
      if (child.nodeName.toUpperCase() == 'PARAM') {
        params.push(child.cloneNode(false));
      }
    }
    
    return params;
  }
});


/** A fake window object that we provide for SVG files to use internally. 
    
    @param handler The Flash Handler assigned to this fake window object. */
function _SVGWindow(handler) {
  this._handler = handler;
  this.fake = true; // helps to detect fake abstraction
  
  this.frameElement = this._handler.flash;
  this.location = this._createLocation();
  this.alert = window.alert;
  this.top = this.parent = window;
  
  this._onloadListeners = [];
}

extend(_SVGWindow, {
  addEventListener: function(type, listener, capture) {
    if (type.toLowerCase() == 'svgload' || type.toLowerCase() == 'load') {
      this._onloadListeners.push(listener);
    }
  },
  
  _fireOnload: function() {
    //console.log('_SVGWindow._fireOnLoad');
    for (var i = 0; i < this._onloadListeners.length; i++) {
      try {
        this._onloadListeners[i]();
      } catch (exp) {
        console.log('The following exception occurred from an SVG onload '
                    + 'listener: ' + (exp.message || exp));
      }
    }
    
    // if there is an inline window.onload execute that now
    if (this.onload) {
      try {
        this.onload();
      } catch (exp) {
        console.log('The following exception occurred from an SVG onload '
                    + 'listener: ' + (exp.message || exp));
      }
    }
  },
  
  /** Creates a fake window.location object. 
  
      @param fakeLocation A full window.location object (i.e. it has .port,
      .hash, etc.) used for testing purposes to give a fake value
      to the containing HTML page's window.location value. */
  _createLocation: function(fakeLocation) {
    var loc = {};
    var url = this._handler._svgObject.url;
    var windowLocation;
    if (fakeLocation) {
      windowLocation = fakeLocation;
    } else {
      windowLocation = window.location;
    }
    
    // Bypass parsing data: URLs.
    if (/^data:/.test(url)) {
      loc.href = url;
      loc.toString = function() {
        return this.href;
      };
      return loc;
    }
     
    // expand URL
    
    // first, see if this url is fully expanded already
    if (/^http/.test(url)) {
      // nothing to do
    } else if (url.charAt(0) == '/') { // ex: /embed1.svg
      url = windowLocation.protocol + '//' + windowLocation.host + url;
    } else { // fully relative, such as embed1.svg
      // get the pathname of the page we are on, clearing out everything after
      // the last slash
      if (windowLocation.pathname.indexOf('/') == -1) {
        url = windowLocation.protocol + '//' + windowLocation.host + '/' + url;
      } else {
        var relativeTo = windowLocation.pathname;

        // walk the string in reverse removing characters until we hit a slash
        for (var i = relativeTo.length - 1; i >= 0; i--) {
          if (relativeTo.charAt(i) == '/') {
            break;
          }
          
          relativeTo = relativeTo.substring(0, i);
        }
        
        url = windowLocation.protocol + '//' + windowLocation.host
              + relativeTo + url;
      }
    }
        
    // parse URL
    
    // FIXME: NOTE: href, search, and pathname should be URL-encoded; the others
    // should be URL-decoded
    
    // match 1 - protocol
    // match 2 - hostname
    // match 3 - port
    // match 4 - pathname
    // match 5 - search
    // match 6 - hash

    var results = 
          url.match(/^(https?:)\/\/([^\/:]*):?([0-9]*)([^\?#]*)([^#]*)(#.*)?$/);
          
    loc.protocol = (results[1]) ? results[1] : windowLocation.href;
    if (loc.protocol.charAt(loc.protocol.length - 1) != ':') {
      loc.protocol += ':';
    }
    loc.hostname = results[2];
        
    // NOTE: browsers natively drop the port if its not explicitly specified
    loc.port = '';
    if (results[3]) {
      loc.port = results[3];
    }
        
    // is the URL and the containing page at different domains?
    var sameDomain = true;
    if (loc.protocol != windowLocation.protocol
        || loc.hostname != windowLocation.hostname
        || (loc.port && loc.port != windowLocation.port)) {
      sameDomain = false;
    }
        
    if (sameDomain && !loc.port) {
      loc.port = windowLocation.port;
    }
        
    if (loc.port) {
      loc.host = loc.hostname + ':' + loc.port;
    } else {
      loc.host = loc.hostname;
    }
    
    loc.pathname = (results[4]) ? results[4] : '';
    loc.search = (results[5]) ? results[5] : '';
    loc.hash = (results[6]) ? results[6] : '';
    
    loc.href = loc.protocol + '//' + loc.host + loc.pathname + loc.search
               + loc.hash;
    
    loc.toString = function() {
      return this.protocol + '//' + this.host + this.pathname + this.search
             + this.hash;
    };
    
    return loc;
  }
});


/** Utility helper class that will generate the correct HTML for a Flash
    OBJECT and embed it into a page. Broken out so that both _SVGObject
    and _SVGSVGElement can use it in different contexts.
    
    @param embedType Either the string 'script' when embedding SVG into
    a page using the SCRIPT tag or 'object' if embedding SVG into a page
    using the OBJECT tag.
    @param nodeXML The parsed XML for the root SVG element, used for sizing,
    background, color, etc.
    @param replaceMe If embedType is 'script', this is the SCRIPT node to
    replace. If embedType is 'object', then this is the SVG OBJECT node.
    @param handler The FlashHandler that will be associated with this Flash
    object.
  */
function FlashInserter(embedType, nodeXML, replaceMe, handler) {
  this._embedType = embedType;
  this._nodeXML = nodeXML;
  this._replaceMe = replaceMe;
  this._handler = handler;
  this._parentNode = replaceMe.parentNode;
  
  // Get width and height from object tag, if present.
  if (this._embedType == 'object') {
    this._explicitWidth = this._replaceMe.getAttribute('width');
    this._explicitHeight = this._replaceMe.getAttribute('height');
  }

  this._setupFlash();
}

extend(FlashInserter, {
  _setupFlash: function() {
    // determine various information we need to display this object
    var size = this._determineSize();  
    var background = this._determineBackground();
    var style = this._determineStyle();
    var className = this._determineClassName();
    var customAttrs = this._determineCustomAttrs();
    
    // setup our ID; if we are embedded with a SCRIPT tag, we use the ID from 
    // the SVG ROOT tag; if we are embedded with an OBJECT tag, then we 
    // simply make the Flash have the exact same ID as the OBJECT we are 
    // replacing
    var elementID;
    if (this._embedType == 'script') {
      elementID = this._nodeXML.getAttribute('id');
      this._handler.flashID = elementID + '_flash';
    } else if (this._embedType == 'object') {
      elementID = this._replaceMe.getAttribute('id');
      this._handler.flashID = elementID;
    }
    
    // get a Flash object and insert it into our document
    var flash = this._createFlash(size, elementID, background, style, 
                                  className, customAttrs);
    this._insertFlash(flash);
    
    // wait for the Flash file to finish loading
  },
  
  /** Inserts the Flash object into the page.
  
      @param flash Flash HTML string. If this is an XHTML page, then this is
      an EMBED object already instantiated and ready to insert into the page.
      
      @returns The Flash DOM object. */
  _insertFlash: function(flash) {
    if (!isIE) {
      var flashObj;
      if (!isXHTML) { // no innerHTML in XHTML land
        // do a trick to turn the Flash HTML string into an actual DOM object
        // unfortunately this doesn't work on IE; on IE the Flash is immediately
        // loaded when we do div.innerHTML even though we aren't attached
        // to the document!
        var div = document.createElement('div');
        div.innerHTML = flash;
        flashObj = div.childNodes[0];
        div.removeChild(flashObj);
    
        // at this point we have the OBJECT tag; ExternalInterface communication
        // won't work on Firefox unless we get the EMBED tag itself
        for (var i = 0; i < flashObj.childNodes.length; i++) {
          var check = flashObj.childNodes[i];
          if (check.nodeName.toUpperCase() == 'EMBED') {
            flashObj = check;
            break;
          }
        }
      } else if (isXHTML) { /* XHTML */
        // 'flash' is an EMBED object already created for us by createFlash();
        // no innerHTML in this environment so we can't instantiate from
        // a string:
        // Issue 312: Odd error when using within XHTML document: 
        // works with Firefox, does not work with any other browser
        // http://code.google.com/p/svgweb/issues/detail?id=312
        flashObj = flash;
      }
      
      // now insert the EMBED tag into the document
      this._replaceMe.parentNode.replaceChild(flashObj, this._replaceMe);
  
      return flashObj;
    } else { // IE
      // NOTE 1: as _soon_ as we make this call the Flash will load, even
      // before the rest of this method has finished. The Flash can
      // therefore finish loading before anything after the next statement
      // has run, so be careful of timing bugs.
      // NOTE 2: IE requires that we have this on a slight timeout, or we
      // will get the following issue on IE 7: when the SWF and HTC files are
      // loaded from the browser's cache (i.e. the second time a page loads
      // by using ctrl-R), loading the HTC and SWF file from the same 'thread'
      // of control causes an IE bug where the SWF never loads. The one
      // second timeout gets both files loading on separate 'threads' of
      // control.
      var self = this;
      window.setTimeout(function() {
        // Remove ID from replaceMe DIV that also appears on the flash object.
        // Otherwise in some circumstances, the DIV is retrieved instead of flash.
        self._replaceMe.removeAttribute('id');
        self._replaceMe.removeAttribute('name');
        self._replaceMe.outerHTML = flash;
        self = null; // IE memory leaks
      }, 1);
    }
  },
  
  /** Determines a width and height for the parsed SVG XML. Returns an
      object literal with two values, width and height.

      It is worth noting that pixels in this function and generally in
      javascript land refer to "unzoomed" pixels. An object has a css
      width value and that unit system does not change due to browser
      zooming.
       
      Flash knows the object size in real screen pixels, so it will
      account for the zoom mismatch. It does not know the javascript
      land units, so we must tell it. That is mainly why we are
      always calculating the pixel values here (from percent values,
      if necessary).
    */
  _determineSize: function() {

    var parentWidth = this._parentNode.clientWidth;
    var parentHeight = this._parentNode.clientHeight;

    // If parentHeight is zero, then the object was sized with a %
    // object height and the parent height is not known.
    // We should use aspect ratio for sizing the object height.
    // Subsequent resizing of the object may result in a valid
    // parent height, but in this case, we should stick to our earlier
    // determination that the image should rely on aspect ratio to size
    // the object height.
    if (parentHeight == 0) {
      this.invalidParentHeight = true;
    }
    /* IE7 quirk */
    if (parentWidth == 0) {
        parentWidth = this._parentNode.offsetWidth;
    }

    if (!isSafari) {
      parentWidth -= this._getMargin(this._parentNode, 'margin-left');
      parentWidth -= this._getMargin(this._parentNode, 'margin-right');
      parentHeight -= this._getMargin(this._parentNode, 'margin-top');
      parentHeight -= this._getMargin(this._parentNode, 'margin-bottom');
    }

    if (isStandardsMode) {
      return this._getStandardsSize(parentWidth, parentHeight);
    }
    else {
      return this._getQuirksSize(parentWidth, parentHeight);
    }
  },

  _getQuirksSize: function(parentWidth, parentHeight) {
    var pixelsWidth, pixelsHeight;

    /** In the case of script or where an svg object has a height percent
        and the svg image has a height percent, then the height of the parent
        is not used and the viewBox aspect resolution is used.
        However, in certain circumstances, the % of the parent height
        is used. That circumstance is when the embed type is script
        and parentHeight is > 0 and if it is in a div with height.
        Here, we look for a parent div, and if we do not find one,
        then we default to clientHeight.
    */
    if (this._embedType == 'script') {
      var grandParent = this._parentNode;
      while (grandParent && grandParent.style) {
        // If a grandparent is a div, the parent height is ok.
        if (grandParent.nodeName.toLowerCase() == 'div') {
          // ?? may need to check for valid height
          break;
        }
        // If we get to the body without div, ignore parent height.
        if (grandParent.nodeName.toLowerCase() == 'body') {
          // See Issue 276. Images with position: fixed
          // scale into the viewport.
          if (this._nodeXML.getAttribute('style') &&
              this._nodeXML.getAttribute('style').indexOf('fixed') != -1) {
            if (window.innerHeight && window.innerHeight > 0) {
              parentHeight = window.innerHeight;
            } else if (document.documentElement &&
                       document.documentElement.clientHeight &&
                       document.documentElement.clientHeight > 0) {
              parentHeight = document.documentElement.clientHeight;
            } else {
              parentHeight = document.body.clientHeight;
            }
            this.invalidParentHeight = false;
          } else {
            // Issue 233: Default to viewBox
            this.invalidParentHeight = true;
            parentHeight = 0;
          }
          break;
        }
        grandParent = grandParent.parentNode;
      }
    }

    // Calculate the object width and size starting with
    // the width and height from the object tag.
    // 
    // If this is script embed type, the algorithm will perform as
    // an object tag with neither width nor height specified.
    // 
    var objWidth = this._explicitWidth;
    var objHeight = this._explicitHeight;

    var xmlWidth = this._nodeXML.getAttribute('width');
    if (xmlWidth && xmlWidth.indexOf('%') == -1) {
        // strip 'px' if present
        xmlWidth = parseInt(xmlWidth).toString();
    }
    var xmlHeight = this._nodeXML.getAttribute('height');
    if (xmlHeight && xmlHeight.indexOf('%') == -1) {
        // strip 'px' if present
        xmlHeight = parseInt(xmlHeight).toString();
    }

    if (objWidth && objHeight) {
      // calculate width in pixels
      if (objWidth.indexOf('%') != -1) {
        pixelsWidth = parentWidth * parseInt(objWidth) / 100;
      } else {
        pixelsWidth = objWidth;
      }

      // calculate height in pixels
      if (objHeight.indexOf('%') != -1) {
        if (parentHeight > 0) {
          pixelsHeight = parentHeight * parseInt(objHeight) / 100;
        }
        else {
          console.log('SVGWeb: unhandled resize scenario.');
          parentHeight = 200;
        }
      } else {
        pixelsHeight = objHeight;
      }
      return {width: objWidth, height: pixelsHeight,
              pixelsWidth: pixelsWidth, pixelsHeight: pixelsHeight,
              clipMode: this._nodeXML.getAttribute('viewBox') ? 'neither' : 'both'};
    }

    var viewBox, boxWidth, boxHeight;
    if (objWidth) {
      // estimate the width that will be used for percents
      if (objWidth.indexOf('%') != -1) {
        pixelsWidth = parentWidth * parseInt(objWidth) / 100;
      } else {
        pixelsWidth = objWidth;
      }

      if (this._nodeXML.getAttribute('viewBox')) {
        // If width and height are both specified on the SVG file in pixels,
        // then the height is calculated based on the object width and the
        // aspect ratio between the svg height and width.
        // The viewBox scales into resulting area (honoring preserveAspectRatio).
        // SVG height and width are not using in actual rendering.
        if (xmlWidth && xmlWidth.indexOf('%') == -1 &&
            xmlHeight && xmlHeight.indexOf('%') == -1) {
          objHeight = pixelsWidth * (xmlHeight / xmlWidth);
        }
        else {
          viewBox = this._nodeXML.getAttribute('viewBox').split(/\s+|,/);
          boxWidth = viewBox[2];
          boxHeight = viewBox[3];
          objHeight = pixelsWidth * (boxHeight / boxWidth);
        }
        return {width: objWidth, height: objHeight,
                pixelsWidth: pixelsWidth, pixelsHeight: objHeight, clipMode: 'neither'};
      } else {
        if (xmlWidth && xmlWidth.indexOf('%') == -1 &&
          xmlHeight && xmlHeight.indexOf('%') == -1) {
          objHeight = pixelsWidth * (xmlHeight / xmlWidth);
        } else {
          if (xmlHeight && xmlHeight.indexOf('%') == -1) {
            objHeight = xmlHeight;
          } else {
            objHeight = 150;
          }
        }
        return {width: objWidth, height: objHeight,
                pixelsWidth: pixelsWidth, pixelsHeight: objHeight, clipMode: 'both'};
      }
    }

    if (objHeight) {

      if (objHeight.indexOf('%') != -1) {
        pixelsHeight = parentHeight * parseInt(objHeight) / 100;
      } else {
        pixelsHeight = objHeight;
      }

      if (this._nodeXML.getAttribute('viewBox')) {
        // If width and height are both specified on the SVG file in pixels,
        // then the object width is calculated based on the object height and the
        // aspect ratio between the svg height and width.
        if (xmlWidth && xmlWidth.indexOf('%') == -1 &&
          xmlHeight && xmlHeight.indexOf('%') == -1) {
          objWidth = pixelsHeight * (xmlWidth / xmlHeight);
        } else {
          viewBox = this._nodeXML.getAttribute('viewBox').split(/\s+|,/);
          boxWidth = viewBox[2];
          boxHeight = viewBox[3];
          objWidth = pixelsHeight * (boxWidth / boxHeight);
        }
        return {width: objWidth, height: objHeight,
                pixelsWidth: objWidth, pixelsHeight: pixelsHeight, clipMode: 'neither'};
      } else {
        // No viewbox, use svg width for object size
        if (xmlWidth && xmlWidth.indexOf('%') == -1 &&
          xmlHeight && xmlHeight.indexOf('%') == -1) {
          objWidth = pixelsHeight * (xmlWidth / xmlHeight);
          pixelsWidth = objWidth;
        } else {
          if (xmlWidth) {
            objWidth = xmlWidth;
          } else {
            objWidth = "100%";
          }

          // estimate the width that will be used for percents
          if (objWidth.indexOf('%') != -1) {
            pixelsWidth = parentWidth * parseInt(objWidth) / 100;
          } else {
            pixelsWidth = objWidth;
          }
        }

        // Also use svg width for svg clipping
        return {width: objWidth, height: objHeight,
                pixelsWidth: pixelsWidth, pixelsHeight: pixelsHeight, clipMode: 'both'};
      }
    }


    // If we are here, neither object height nor width were specified.

    // Use the svg width
    if (xmlWidth) {
      objWidth = xmlWidth;
    } else {
      objWidth = "100%";
    }

    // Calculate the width that will be used for percents.
    if (objWidth.indexOf('%') != -1) {
      pixelsWidth = parentWidth * parseInt(objWidth) / 100;
    } else {
      pixelsWidth = objWidth;
    }

    // Height pixels are used directly.
    if (xmlHeight && xmlHeight.indexOf('%') == -1) {
      objHeight = xmlHeight;
      return {width: objWidth, height: objHeight,
              pixelsWidth: pixelsWidth, pixelsHeight: objHeight,
              clipMode: this._nodeXML.getAttribute('viewBox') ? 'neither' : 'both'};
    } else {
      // The height is a % or missing. Check for viewBox.
      if (this._nodeXML.getAttribute('viewBox')) {
        // Issue 276
        if (this._embedType == 'script'
            && (xmlHeight == null || xmlHeight.indexOf('%') != -1) && !this.invalidParentHeight) {
          if (xmlHeight == null) {
            xmlHeight = "100%";
          }
          if (objHeight == null) {
            objHeight = "100%";
          }
          pixelsHeight = parentHeight * parseInt(xmlHeight) / 100;
          return {width: objWidth, height: pixelsHeight,
                  pixelsWidth: pixelsWidth, pixelsHeight: pixelsHeight, clipMode: 'neither'};
        }
        var viewBox = this._nodeXML.getAttribute('viewBox').split(/\s+|,/);
        var boxWidth = viewBox[2];
        var boxHeight = viewBox[3];
        objHeight = pixelsWidth * (boxHeight / boxWidth);
        return {width: objWidth, height: objHeight,
                pixelsWidth: pixelsWidth, pixelsHeight: objHeight, clipMode: 'neither'};
      } else {
        objHeight = 150;
        return {width: objWidth, height: objHeight,
                pixelsWidth: pixelsWidth, pixelsHeight: objHeight, clipMode: 'both'};
      }
    }

  },

  _getStandardsSize: function(parentWidth, parentHeight) {
    var pixelsWidth, pixelsHeight;

    // Calculate the object width and size starting with
    // the width and height from the object tag.
    // 
    // If this is script embed type, the algorithm will perform as
    // an object tag with neither width nor height specified.
    // 
    var objWidth = this._explicitWidth;
    var objHeight = this._explicitHeight;

    var xmlWidth = this._nodeXML.getAttribute('width');
    if (xmlWidth && xmlWidth.indexOf('%') == -1) {
        // strip 'px' if present
        xmlWidth = parseInt(xmlWidth).toString();
    }
    var xmlHeight = this._nodeXML.getAttribute('height');
    if (xmlHeight && xmlHeight.indexOf('%') == -1) {
        // strip 'px' if present
        xmlHeight = parseInt(xmlHeight).toString();
    }

    if (objWidth && !objHeight) {
      return this._getQuirksSize(parentWidth, parentHeight);
    }

    if (!objWidth && !objHeight) {
      return this._getQuirksSize(parentWidth, parentHeight);
    }

    if (!objWidth && objHeight) {
      if (xmlWidth) {
         objWidth = xmlWidth;
      } else {
         objWidth = '100%';
      }

      // calculate width in pixels
      if (objWidth.indexOf('%') != -1) {
        pixelsWidth = parentWidth * parseInt(objWidth) / 100;
      } else {
        pixelsWidth = objWidth;
      }

      // Use object height pixels, if specified.
      if (objHeight.indexOf('%') == -1) {
        pixelsHeight = objHeight;
        // If width and height are both specified on the SVG file in pixels,
        // then the object width is calculated based on the object height and the
        // aspect ratio between the svg height and width.
        if (xmlWidth && xmlWidth.indexOf('%') == -1 &&
          xmlHeight && xmlHeight.indexOf('%') == -1) {
          objWidth = objHeight * (xmlWidth / xmlHeight);
          pixelsWidth = objWidth;
        } else {
          if (this._nodeXML.getAttribute('viewBox')) {
            viewBox = this._nodeXML.getAttribute('viewBox').split(/\s+|,/);
            boxWidth = viewBox[2];
            boxHeight = viewBox[3];
            objWidth = pixelsHeight * (boxWidth / boxHeight);
            pixelsWidth = objWidth;
          }
        }
        return {width: objWidth, height: objHeight,
                pixelsWidth: pixelsWidth, pixelsHeight: objHeight,
                clipMode: this._nodeXML.getAttribute('viewBox') ? 'neither' : 'both'};
      } else {
        if (xmlHeight && xmlHeight.indexOf('%') == -1) {
          pixelsHeight = xmlHeight;
        } else {
          if (this._nodeXML.getAttribute('viewBox')) {
            viewBox = this._nodeXML.getAttribute('viewBox').split(/\s+|,/);
            boxWidth = viewBox[2];
            boxHeight = viewBox[3];
            pixelsHeight = pixelsWidth * (boxHeight / boxWidth);
          }
          else {
            pixelsHeight = 150;
          }
        }
        return {width: objWidth, height: pixelsHeight,
                pixelsWidth: pixelsWidth, pixelsHeight: pixelsHeight,
                clipMode: this._nodeXML.getAttribute('viewBox') ? 'neither' : 'both'};
      }
    }

    if (objWidth && objHeight) {
      // calculate width in pixels
      if (objWidth.indexOf('%') != -1) {
        pixelsWidth = parentWidth * parseInt(objWidth) / 100;
      } else {
        pixelsWidth = objWidth;
      }

      // Use object height pixels, if specified.
      if (objHeight.indexOf('%') == -1) {
        return {width: objWidth, height: objHeight,
                pixelsWidth: pixelsWidth, pixelsHeight: objHeight,
                clipMode: this._nodeXML.getAttribute('viewBox') ? 'neither' : 'both'};
      }
      else {
        if (xmlWidth && xmlWidth.indexOf('%') == -1 &&
          // If width and height are both specified on the SVG file in pixels,
          // then the height is calculated based on the object width and the
          // aspect ratio between the svg height and width.
          xmlHeight && xmlHeight.indexOf('%') == -1) {
          pixelsHeight = pixelsWidth * (xmlHeight / xmlWidth);
          return {width: objWidth, height: pixelsHeight,
                  pixelsWidth: pixelsWidth, pixelsHeight: pixelsHeight, clipMode: 'neither'};
        } else {
          if (!this.invalidParentHeight) {
            // If parent height is "valid", use it.
            pixelsHeight = parentHeight * parseInt(objHeight) / 100;
            return {width: objWidth, height: pixelsHeight,
                    pixelsWidth: pixelsWidth, pixelsHeight: pixelsHeight, clipMode: 'neither'};
          }
          else {
            // Default to viewbox aspect resolution
            if (this._nodeXML.getAttribute('viewBox')) {
              viewBox = this._nodeXML.getAttribute('viewBox').split(/\s+|,/);
              boxWidth = viewBox[2];
              boxHeight = viewBox[3];
              objHeight = pixelsWidth * (boxHeight / boxWidth);
              return {width: objWidth, height: objHeight,
                      pixelsWidth: pixelsWidth, pixelsHeight: objHeight, clipMode: 'neither'};
            } else {
              if (xmlHeight && xmlHeight.indexOf('%') == -1) {
                pixelsHeight = xmlHeight;
              } else {
                pixelsHeight = 150;
              }
              return {width: objWidth, height: pixelsHeight,
                      pixelsWidth: pixelsWidth, pixelsHeight: pixelsHeight, clipMode: 'both'};
            }
          }
        }
      }
    }


  },

  // http://www.quirksmode.org/dom/getstyles.html
  _getMargin: function(node,styleProp) {
    var y;
    if (node.currentStyle)
      y = parseInt(node.currentStyle[styleProp]);
    else if (window.getComputedStyle)
      y = parseInt(document.defaultView.getComputedStyle(node,null).getPropertyValue(styleProp));

    if (y)
      return y;
    else
      return 0;
  },

  
  /** Determines the background coloring. Returns an object literal with
      two values, 'color' with a color or null and 'transparent' with a 
      boolean. */
  _determineBackground: function() {
    var transparent = false;
    var color = null;
    
    // NOTE: CSS 2.1 spec says background does not get inherited, and we don't
    // support external CSS style rules for now; we also only support
    // 'background-color' property and not 'background' CSS property for
    // setting the background color.
    var style = this._nodeXML.getAttribute('style');
    if (style && style.indexOf('background-color') != -1) {
      var m = style.match(/background\-color:\s*([^;]*)/);
      if (m) {
        color = m[1];
      }
    }

    if (color === null) {
      // no background color specified
      transparent = true;
    }
    
    return {color: color, transparent: transparent};
  },
  
  /** Determines what the style should be on the SVG root element, copying
      over any styles the user has placed inline and defaulting certain
      styles. We will bring these over to the Flash object.
      
      @returns Style string ready to copy over to Flash object. */
  _determineStyle: function() {
    var style = this._nodeXML.getAttribute('style');
    
    if (!style) {
      style = '';
    }
    
    // IE sometimes leaves off trailing semicolon of style values
    if (style.length > 0 && style.charAt(style.length - 1) != ';') {
      style += ';';
    }
        
    // SVG spec says default display value for SVG root element is 
    // inline
    if (this._embedType == 'script' && style.indexOf('display:') == -1) {
      style += 'display: inline;';
    }
    
    // SVG spec says SVG by default should have overflow: none
    if (this._embedType == 'script' && style.indexOf('overflow:') == -1) {
      style += 'overflow: hidden;';
    }
    
    return style;
  },
  
  /** Determines a class name for the Flash object; we simply copy over
      any class names on the SVG root object to aid in external styling.
      
      @returns Class name string. Returns '' if there is none. */
  _determineClassName: function() {
    var className = this._nodeXML.getAttribute('class');
    if (!className) {
      return 'embedssvg';
    } else {
      return className + ' embedssvg';
    }
  },
  
  /** The developer might have added custom attributes on to the place holder
      we are replacing for SVG OBJECTs; copy those over and make sure they
      show up on the Flash OBJECT as well. */
  _determineCustomAttrs: function() {
    var results = [];
    if (this._embedType == 'object') {
      var node = this._replaceMe;
      // we use a fake object to determine potential default attributes that
      // we don't want to copy over to our Flash object
      var commonObj = document._createElement('object');
      for (var j = 0; j < node.attributes.length; j++) {
        var attr = node.attributes[j];
        var attrName = attr.nodeName;
        var attrValue = attr.nodeValue;
                 
        // trim out 'empty' attributes with no value
        if (!attrValue && attrValue !== 'true') {
          continue;
        }
        
        // trim out anything that is on a common OBJECT so we don't have
        // overlap
        if (commonObj.getAttribute(attrName)) {
          continue;
        }
        
        // trim out other OBJECT overrides as well as some custom attributes
        // we might have added earlier in the OBJECT creation process 
        // (_listeners, addEventListener, etc.)
        if (/^(id|name|width|height|data|class|style|codebase|type|_listeners|addEventListener|onload)$/.test(attrName)) {
          continue;
        }
        
        results.push({attrName: attrName.toString(), 
                      attrValue: attrValue.toString()});
      }
    }
    
    return results;
  },
  
  /** Creates a Flash object that embeds the Flash SVG Viewer.

      @param size Object literal with width and height.
      @param elementID The ID of either the SVG ROOT object or of an
      SVG OBJECT.
      @param background Object literal with background color and 
      transparent boolean.
      @param style Style string to copy onto Flash object.
      @param className The class name to copy into the Flash object.
      @param customAttrs Array of custom attributes that the developer might
      have put on their SVG OBJECT; each entry in the array is an object
      literal with attrName and attrValue as the keys.
      
      @returns Flash object as HTML string. If the page is an XHTML 
      page, then we return an EMBED tag already instantiated and ready to
      insert; this is because we do not have innerHTML on XHTML pages. */ 
  _createFlash: function(size, elementID, background, style, className,
                         customAttrs) {
    var flashVars = 
          'uniqueId=' + encodeURIComponent(elementID)
        + '&sourceType=string'
        + '&clipMode=' + size.clipMode
        + '&debug=true'
        + '&svgId=' + encodeURIComponent(elementID);
    var src;
    if (this._isXDomain) {
      src = svgweb.xDomainURL + 'svg.swf';
    } else {
      src = svgweb.libraryPath + 'svg.swf';
    }

    var protocol = window.location.protocol;
    if (protocol.charAt(protocol.length - 1) == ':') {
      protocol = protocol.substring(0, protocol.length - 1);
    }

    var flash;
    if (isXHTML) {
      // XHTML environments have no innerHTML
      flash = document.createElement('embed');
      flash.setAttribute('src', src);
      flash.setAttribute('quality', 'high');
      // FIXME: Will this logic test break if the color is black?
      if (background.color) {
        flash.setAttribute('bgcolor', background.color);
      }
      if (background.transparent) {
        flash.setAttribute('wmode', 'transparent');
      }
      flash.setAttribute('width', size.width);
      flash.setAttribute('height', size.height);
      flash.setAttribute('id', this._handler.flashID);
      flash.setAttribute('name', this._handler.flashID);
      flash.setAttribute('swLiveConnect', 'true');
      flash.setAttribute('allowScriptAccess', 'always');
      flash.setAttribute('type', 'application/x-shockwave-flash');
      flash.setAttribute('FlashVars', flashVars);
      flash.setAttribute('pluginspage', protocol
                       + '://www.macromedia.com/go/getflashplayer');
      flash.setAttribute('style', style);
      flash.setAttribute('className', className);
      for (var i = 0; i < customAttrs.length; i++) {
        flash.setAttribute(customAttrs[i].attrName,
                         customAttrs[i].attrValue);
      }
    } else { // normal text/html environment
      var customAttrStr = '';
      for (var i = 0; i < customAttrs.length; i++) {
        customAttrStr += ' ' + customAttrs[i].attrName + '="'
                              + customAttrs[i].attrValue + '"';
      }
      
      flash =
          '<object\n '
            + 'classid="clsid:d27cdb6e-ae6d-11cf-96b8-444553540000"\n '
            + 'codebase="'
            + protocol
            + '://fpdownload.macromedia.com/pub/shockwave/cabs/flash/'
            + 'swflash.cab#version=10,0,0,0"\n '
            + 'width="' + size.width + '"\n '
            + 'height="' + size.height + '"\n '
            + 'id="' + this._handler.flashID + '"\n '
            + 'name="' + this._handler.flashID + '"\n '
            + 'style="' + style + '"\n '
            + 'class="' + className + '"\n '
            + customAttrStr + '\n'
            + '>\n '
            + '<param name="allowScriptAccess" value="always"></param>\n '
            + '<param name="movie" value="' + src + '"></param>\n '
            + '<param name="quality" value="high"></param>\n '
            + '<param name="FlashVars" value="' + flashVars + '"></param>\n '
            // FIXME: Will this logic test break if the color is black?
            + (background.color ? '<param name="bgcolor" value="' 
                                    + background.color + '"></param>\n ' : '')
            + (background.transparent ? 
                                    '<param name="wmode" value="transparent">'
                                    + '</param>\n ' : '')
            + '<embed '
              + 'src="' + src + '" '
              + 'quality="high" '
              + (background.color ? 'bgcolor="' + background.color 
                                     + '" \n' : '')
              + (background.transparent ? 'wmode="transparent" \n' : '')
              + 'width="' + size.width + '" '
              + 'height="' + size.height + '" '
              + 'id="' + this._handler.flashID + '" '
              + 'name="' + this._handler.flashID + '" '
              + 'swLiveConnect="true" '
              + 'allowScriptAccess="always" '
              + 'type="application/x-shockwave-flash" '
              + 'FlashVars="' + flashVars + '" '
              + 'pluginspage="'
              + protocol
              + '://www.macromedia.com/go/getflashplayer" '
              + 'style="' + style + '"\n '
              + 'class="' + className + '"\n '
              + customAttrStr + '\n'
              + ' />'
          + '</object>';
    }

    return flash;
  }
});


/** SVG Root element.

    @param nodeXML A parsed XML node object that is the SVG root node.
    @param svgString The full SVG as a string. Null if this SVG root
    element is being embedded by an SVG OBJECT.
    @param scriptNode The script node that contains this SVG. Null if this
    SVG root element is being embedded by an SVG OBJECT.
    @param handler The FlashHandler that we are a part of. */
function _SVGSVGElement(nodeXML, svgString, scriptNode, handler) {
  this._attached = true;
  // superclass constructor
  _Element.apply(this, ['svg', null, svgns, nodeXML, handler]);

  this._nodeXML = nodeXML;
  this._svgString = svgString;
  this._scriptNode = scriptNode;
  
  // flash that we use to know whether the HTC and SWF files are loaded
  // If defineProperty is available, do not bother loading the htc.
  this._htcLoaded = Object.defineProperty ? true : false;
  this._swfLoaded = false;
  
  // add to our nodeByID lookup table so that fetching this node in the
  // future works
  if (this._handler.type == 'script') {
    var rootID = this._nodeXML.getAttribute('id');
    var doc = this._handler.document;
    doc._nodeById['_' + rootID] = this;
  }
  
  this._currentScale = 1;
  this._currentTranslate = this._createCurrentTranslate();
  
  // when being embedded by a SCRIPT element, the _SVGSVGElement class
  // takes over inserting the Flash and HTC elements so that we have 
  // something visible on the screen; when being embedded by an SVG OBJECT
  // we don't do this since the OBJECT tag itself is what is visible on the 
  // screen
  if (isIE && this._handler.type == 'script') {
    // slot in our suspendRedraw/unsuspendRedraw methods
    this._addRedrawMethods();
    
    // track .style changes
    this.style = new _Style(this);
    
    // find out when the content is ready
    // NOTE: we do this here instead of inside the HTC file using an
    // internal oncontentready event in order to make the HTC file faster
    // and use less memory. Note also that 'oncontentready' is not available 
    // outside HTC files, only 'onreadystatechange' is available.
    this._readyStateListener = hitch(this, this._onHTCLoaded); // cleanup later
    this._htcNode.attachEvent('onreadystatechange', this._readyStateListener);
 
    // now wait for the HTC file to load for the SVG root element;
    // continue inserting our Flash object below as well so that the HTC 
    // file and SWF file load in parallel for better overall performance
  } else if (isIE && this._handler.type == 'object') {
    // slot in our suspendRedraw/unsuspendRedraw methods
    this._addRedrawMethods();
  }

  if (this._handler.type == 'script') { 
    // insert the Flash
    this._handler._inserter = new FlashInserter('script', this._nodeXML,
                                                this._scriptNode, this._handler);
  }
}  

// subclasses _Element
_SVGSVGElement.prototype = new _Element;

extend(_SVGSVGElement, {
  // SVGSVGElement
  
  // NOTE: there are properties and methods from SVGSVGElement not defined 
  // or implemented here; see
  // http://www.w3.org/TR/SVG/struct.html#InterfaceSVGSVGElement
  // for full list
  
  // TODO: Implement the functions below
  
  suspendRedraw: function(ms /* unsigned long */) /* unsigned long */ {
    return this._handler._redrawManager.suspendRedraw(ms);                                                     
  },

  unsuspendRedraw: function(id /* unsigned long */) /* void */
                                                /* throws DOMException */ {
    this._handler._redrawManager.unsuspendRedraw(id);                                                                                                   
  },
                                                
  unsuspendRedrawAll: function() /* void */ {
    this._handler._redrawManager.unsuspendRedrawAll();
  },
  
  forceRedraw: function() /* void */ {
    // not implemented
  },
  
  // end SVGSVGElement
  
  // SVGLocatable
  
  // TODO: Implement the following properties
  
  nearestViewportElement: null, /* readonly SVGElement */
  farthestViewportElement: null, /* readonly SVGElement */
  
  // TODO: Implement the following methods
  
  getTransformToElement: function(element /* SVGElement */) /* SVGMatrix */ {
    /* throws SVGException */
  },
  
  // end of SVGLocatable
  
  /** Called when the Microsoft Behavior HTC file is loaded. */
  _onHTCLoaded: function() {
    //console.log('SVGSVGElement.onHTCLoaded');
    //end('HTCLoading');
    //start('onHTCLoaded');
    
    // cleanup our event handler
    this._htcNode.detachEvent('onreadystatechange', this._readyStateListener);
                           
    // pay attention to style changes now in the HTC
    this.style._ignoreStyleChanges = false;
    //end('onHTCLoaded');
    
    // indicate that the HTC is loaded; see if Flash is loaded
    this._htcLoaded = true;
    if (this._swfLoaded) {
      this._onEverythingLoaded();
    }
    
    // TODO: we are not handling dynamically created nodes yet
  },

  _onFlashLoaded: function(msg) {
    // On IE 9, the flash control may not actually be present in the DOM
    // yet, even though it is active and calling javascript.
    if (!document.getElementById(this._handler.flashID)) {
      setTimeout((function(self, msg) {
                    return function() {
                      self._onFlashLoaded(msg);
                    };
                  })(this, msg), 1);
    } else {
      this._onFlashLoadedNow(msg);
    }
  },
  
  /** Called when the Flash SWF file has been loaded. Note that this doesn't
      include the SVG being rendered -- at this point we haven't even
      sent the SVG to the Flash file for rendering yet. */
  _onFlashLoadedNow: function(msg) {
    //end('SWFLoading');
    //start('onFlashLoaded');
    // the Flash object is done loading
    //console.log('SVGSVGElement._onFlashLoaded');
    
    // store a reference to our Flash object
    this._handler.flash = document.getElementById(this._handler.flashID);
    
    // for non-IE browsers we are ready to go; for IE, see if the HTC is done
    // loading yet
    this._swfLoaded = true;
    if (!isIE || this._htcLoaded) {
      this._onEverythingLoaded();
    }
    
    //end('onFlashLoaded');
  },
  
  /** Called when the Flash is loaded initially, as well as the HTC file for IE. */
  _onEverythingLoaded: function() {
    //console.log('SVGSVGElement._onEverythingLoaded');
    
    // send the SVG over to Flash now
    //start('firstSendToFlash');
    //start('jsHandleLoad');

    var size = this._handler._inserter._determineSize();
    this._handler.sendToFlash('jsHandleLoad',
                              [ /* objectURL */ this._getRelativeTo('object'),
                                /* pageURL */ this._getRelativeTo('page'),
                                /* objectWidth */ size.pixelsWidth,
                                /* objectHeight */ size.pixelsHeight,
                                /* ignoreWhiteSpace */ true,
                                /* svgString */ this._svgString ]);
    //end('jsHandleLoad');
  },
  
  /** The Flash is finished rendering. */
  _onRenderingFinished: function(msg) {
    //end('firstSendToFlash');
    //start('onRenderingFinished');
    //console.log('SVGSVGElement.onRenderingFinished');
    
    if (this._handler.type == 'script') {
      // expose the root SVG element as 'documentElement' on the EMBED
      // or OBJECT tag for SVG SCRIPT embed as a utility property for 
      // developers to descend down into the SVG root tag
      // (see Known Issues and Errata for details)
      this._handler.flash.documentElement = this._getProxyNode();
    }
    
    // set the ownerDocument based on how we are embedded
    if (this._attached) {
      if (this._handler.type == 'script') {
        this.ownerDocument = document;
      } else if (this._handler.type == 'object') {
        this.ownerDocument = this._handler.document;
      }
    }
    
    this._handler.document.rootElement = this._getProxyNode();
    
    var elementId = this._nodeXML.getAttribute('id');
    this._handler._loaded = true;
    //end('onRenderingFinished');
    this._handler.fireOnLoad(elementId, 'script');
  },
  
  /** Relative URLs inside of SVG need to expand against something (i.e.
      such as having an SVG Audio tag with a relative URL). This method
      figures out what that relative URL should be. We send this over to
      Flash when rendering things so Flash knows what to expand against. */
  _getRelativeTo: function() {
    var results = '';
    var pathname = window.location.pathname.toString();
    if (pathname && pathname.length > 0 && pathname.indexOf('/') != -1) {
      // snip off any filename after a final slash
      results = pathname.replace(/\/([^\/]*)$/, '/');
    }

    return results;
  },
  
  /** Adds the various suspendRedraw/unsuspendRedraw methods to our HTC
      proxy for IE. We do it here for two reasons: so that we don't have to
      bloat the size of the HTC file which has a large affect on performance,
      and so that these methods don't show up for SVG nodes that aren't the
      root SVG node. */
  _addRedrawMethods: function() {
    // add methods inside of fresh closures to prevent IE memory leaks
    this._htcNode.suspendRedraw = (function() {
      return function(ms) { return this._fakeNode.suspendRedraw(ms); };
    })();
    this._htcNode.unsuspendRedraw = (function() { 
      return function(id) { return this._fakeNode.unsuspendRedraw(id); };
    })();
    this._htcNode.unsuspendRedrawAll = (function() { 
      return function() { return this._fakeNode.unsuspendRedrawAll(); };
    })();
    this._htcNode.forceRedraw = (function() { 
      return function() { return this._fakeNode.forceRedraw(); };
    })();
  },
  
  /** Sets up our currentTranslate property to pass over any changes on the
      X and Y values over to Flash. */ 
  _createCurrentTranslate: function() {
    var p = new _SVGPoint(0, 0, true /* formalAccessor */,
                          hitch(this, this._updateCurrentTranslate));
    return p;
  },
  
  _updateCurrentTranslate: function(type, newValue1, newValue2) {
    if (type == 'xy') {
      this._handler.sendToFlash('jsSetCurrentTranslate', [ 'xy', newValue1, 
                                newValue2 ]);
    } else {
      this._handler.sendToFlash('jsSetCurrentTranslate', [ type, newValue1 ]);
    }
  }
});


/** Represent a Document object for manipulating the SVG document.

    @param xml Parsed XML for the SVG.
    @param handler The FlashHandler this document is a part of. */
function _Document(xml, handler) {
  // superclass constructor
  _Node.apply(this, ['#document', _Node.DOCUMENT_NODE, null, null, 
                     xml, handler], svgns);
  this._xml = xml;
  this._handler = handler;
  this._nodeById = {};
  this._namespaces = this._getNamespaces();
  this.implementation = new _DOMImplementation();
  if (this._handler.type == 'script') {
    this.defaultView = window;
  }/* else if (this._handler.type == 'object') {
    // we set the document.defaultView in _SVGObject._executeScript() once
    // we create the iframe that we execute our script into
  }*/

}

// subclasses _Node
_Document.prototype = new _Node;

extend(_Document, {
  /** Stores a lookup from a node's ID to it's _Element or _Node 
      representation. An object literal. */
  _nodeById: null,
  
  /*
    Note: technically these 2 properties should be read-only and throw 
    a DOMException when set. For simplicity we make them simple JS
    properties; if set, nothing will happen. Also note that we don't
    support the 'doctype' property.
  */
  implementation: null,
  documentElement: null,
  
  createElementNS: function(ns, qname) /* _Element */ {
    var prefix = this._namespaces['_' + ns];
    
    if (prefix == 'xmlns' || !prefix) { // default SVG namespace
      // If this is a new namespace, we may have to assume the
      // prefix from the qname
      if (qname.indexOf(':') != -1) {
        prefix=qname.substring(0, qname.indexOf(':'))
      }
      else {
       prefix = null;
      }
    }

    var node = new _Element(qname, prefix, ns, undefined, this._handler);
    
    return node._getProxyNode();
  },
  
  createTextNode: function(data /* DOM Text Node */) /* _Node */ {
    // We create a DOM Element node to represent this text node. We do this
    // so that we can track the text node over time to register changes to
    // it and so on. We must use a DOM Element node so that we have access
    // to the setAttribute method in order to store data on the XML DOM node.
    // This is due to a limitation on Internet Explorer where you can not
    // store 'expandos' on XML node objects (i.e. you can't add custom
    // properties). We store the actual data as a DOM Text Node of our DOM
    // Element. Note that since we have no handler yet we simply use a default
    // XML document object (_unattachedDoc) to create things for now.
    var doc = FlashHandler._unattachedDoc;
    var nodeXML;
    if (isIE) { // no createElementNS available
      nodeXML = doc.createElement('__text');
    } else {
      nodeXML = doc.createElementNS(svgnsFake, '__text');
    }
    nodeXML.appendChild(doc.createTextNode(data));
    var textNode = new _Node('#text', _Node.TEXT_NODE, null, null, nodeXML,
                             this._handler);
    textNode._nodeValue = data;
    textNode.ownerDocument = this;
    
    return textNode._getProxyNode();
  },
  
  createDocumentFragment: function(forSVG) {
    return new _DocumentFragment(this)._getProxyNode();
  },
  
  getElementById: function(id) /* _Element */ {
    // XML parser does not have getElementById, due to id mapping in XML
    // issues; use XPath instead
    var results = xpath(this._xml, null, '//*[@id="' + id + '"]');

    var nodeXML, node;
    
    if (results.length) {
      nodeXML = results[0];
    } else {
      return null;
    }
    
    // create or get an _Element for this XML DOM node for node
    node = FlashHandler._getNode(nodeXML, this._handler);
    this._getFakeNode(node)._attached = true;
    return node;
  },
  
  /** NOTE: on IE we don't support calls like the following:
      getElementsByTagNameNS(*, 'someTag');
      
      We do support:
      getElementsByTagNameNS('*', '*');
      getElementsByTagNameNS('someNameSpace', '*');
      getElementsByTagNameNS(null, 'someTag');
  */
  getElementsByTagNameNS: function(ns, localName) /* _NodeList of _Elements */ {
    //console.log('document.getElementsByTagNameNS, ns='+ns+', localName='+localName);
    // we might be a dynamically created SVG script node that is not done
    // loading yet
    if (this._handler.type == 'script' && !this._handler._loaded) {
      return [];
    }
    
    var results = this.rootElement.getElementsByTagNameNS(ns, localName);
    
    // Make sure to include root SVG node in our results if that is what
    // is asked for!
    if (ns == svgns && localName == 'svg') {
      // On some browsers a read-only HTMLCollection is returned
      if (typeof(results.push) == 'undefined') {
        var collection = results;
        results = [];
        for (var i=0; i<collection.length; i++) {
          results.push(collection[i]);
        }
      }
      results.push(this.rootElement);
    }
    
    return results;
  },
  
  // Note: createDocumentFragment, createComment, createCDATASection,
  // createProcessingInstruction, createAttribute, createEntityReference,
  // importNode, createElement, getElementsByTagName,
  // createAttributeNS not supported
  
  /** Extracts any namespaces we might have, creating a prefix/namespaceURI
      lookup table.
      
      NOTE: We only support namespace declarations on the root SVG node
      for now.
      
      @returns An object that associates prefix to namespaceURI, and vice
      versa. */
  _getNamespaces: function() {
    var results = [];
    var attrs = this._xml.documentElement.attributes;
    for (var i = 0; i < attrs.length; i++) {
      var attr = attrs[i];
      if (/^xmlns:?(.*)$/.test(attr.nodeName)) {
        var m = attr.nodeName.match(/^xmlns:?(.*)$/);
        var prefix = (m[1] ? m[1] : 'xmlns');
        var namespaceURI = attr.nodeValue;
                
        // don't add duplicates
        if (!results['_' + prefix]) {
          results['_' + prefix] = namespaceURI;
          results['_' + namespaceURI] = prefix;
          results.push(namespaceURI);
        }
      }
    }
    
    return results;
  }
});


// We don't create a NodeList class due to the complexity of subclassing
// the Array object cross browser. Instead, we simply patch in the item()
// method to a normal Array object
function createNodeList() {
  var results = [];
  results.item = function(i) {
    if (i >= this.length) {
      return null; // DOM Level 2 spec says return null
    } else {
      return this[i];
    }
  }
  
  return results;
}


// We don't have an actual DOM CharacterData type for now. We just return
// a String object with the 'data' property patched in, since that is what
// is most commonly accessed
function createCharacterData(data) {
  var results = (data !== undefined) ? new String(data) : new String();
  results.data = results.toString();
  return results;
}

// End DOM Level 2 Core/Events support

// SVG DOM interfaces

// Note: where the spec returns an SVGNumber or SVGString we just return
// the JavaScript base type instead. Note that in general also instead of
// returning the many SVG List types, such as SVGPointList, we just
// return standard JavaScript Arrays. For SVGAngle we also
// just return a JS Number for now.

function _SVGMatrix(a /** All Numbers */, b, c, d, e, f, _handler) {
  this.a = a; this.b = b; this.c = c; this.d = d; this.e = e; this.f = f;
  this._handler = _handler;
}

extend(_SVGMatrix, {
  // all functions return _SVGMatrix

  // TODO: Implement the following methods
  
  multiply: function(secondMatrix /* _SVGMatrix */ ) {},
  inverse: function() {
      var msg =this._handler.sendToFlash('jsMatrixInvert',
                                [ this.a, this.b, this.c, this.d,
                                  this.e, this.f ]);
      msg = this._handler._stringToMsg(msg);
      return new _SVGMatrix(new Number(msg.a), new Number(msg.b), new Number(msg.c),
                            new Number(msg.d), new Number(msg.e), new Number(msg.f),
                            this._handler);
  },
  translate: function(x /* Number */, y /* Number */) {},
  scale: function(scaleFactor /* Number */) {},
  scaleNonUniform: function(scaleFactorX /* Number */, scaleFactorY /* Number */) {},
  rotate: function(angle /* Number */) {},
  rotateFromVector: function(x, y) {},
  flipX: function() {},
  flipY: function() {},
  skewX: function(angle) {},
  skewY: function(angle) {}
});


// Note: Most of the functions on SVGLength not supported for now
function _SVGLength(/* Number */ value) {
  this.value = value;
}


// Note: We only support _SVGAnimatedLength because that is what Firefox
// and Safari return, and we want to have parity. Only baseVal works for now
function _SVGAnimatedLength(/* _SVGLength */ value) {
  this.baseVal = value;
  this.animVal = undefined; // not supported for now
}


function _SVGTransform(type, matrix, angle) {
  this.type = type;
  this.matrix = matrix;
  this.angle = angle;
}

mixin(_SVGTransform, {
  SVG_TRANSFORM_UNKNOWN: 0, SVG_TRANSFORM_MATRIX: 1, SVG_TRANSFORM_TRANSLATE: 2,
  SVG_TRANSFORM_SCALE: 3, SVG_TRANSFORM_ROTATE: 4, SVG_TRANSFORM_SKEWX: 5,
  SVG_TRANSFORM_SKEWY: 6
});

extend(_SVGTransform, {
  // Note: the following 3 should technically be readonly
  type: null, /* one of the constants above */
  matrix: null, /* _SVGMatrix */
  angle: null, /* float */
  
  // TODO: Implement the following methods
  
  setMatrix: function(matrix /* SVGMatrix */) {},
  setTranslate: function(tx /* float */, ty /* float */) {},
  setScale: function(sx /* float */, sy /* float */) {},
  setRotate: function(angle /* float */, cx /* float */, cy /* float */) {},
  setSkewX: function(angle /* float */) {},
  setSkewY: function(angle /* float */) {}  
});


/** SVGPoint class.
    @formalAccessors - Optional boolean that controls whether we force
    the class to have formal get and set method to handle limitations in
    IE, such as getX. Defaults to false. 
    @callback - Optional Function. Called when a setter is called. Given
    the following arguments: 'x', 'y', or 'xy' on what is being set followed
    by the new value(s) */
function _SVGPoint(x, y, formalAccessors, callback) {
  if (formalAccessors === undefined) {
    formalAccessors = false;
  }
  
  this._formalAccessors = formalAccessors;
  
  this.x = x;
  this.y = y;
  
  if (formalAccessors) {
    this.setX = hitch(this, function(newValue) {
      this.x = newValue;
      callback('x', newValue);
    });
    this.getX = hitch(this, function() {
      return this.x;
    });
    this.setY = hitch(this, function(newValue) {
      this.y = newValue;
      callback('y', newValue);
    });
    this.getY = hitch(this, function() {
      return this.y;
    });
    this.setXY = hitch(this, function(newX, newY) {
      this.x = newX;
      this.y = newY;
      callback('xy', newX, newY);
    });
  }
}

extend(_SVGPoint, {
  matrixTransform: function(m) {
    return new _SVGPoint(
                m.a * this.x + m.c * this.y + m.e,
                m.b * this.x + m.d * this.y + m.f,
                this._formalAccessors);
  }
});

// SVGRect
function _SVGRect(x, y, width, height) {
  this.x = x;
  this.y = y;
  this.width = width;
  this.height = height;
}
     
// end SVG DOM interfaces

/* 
  Other DOM interfaces specified by SVG 1.1:
  
  * SVG 1.1 spec requires DOM 2 Views support, which we do not implement:
    http://www.w3.org/TR/DOM-Level-2-Views/

  * SVG 1.1 spec has the DOM traversal and range APIs as optional; these are
    not supported

  * Technically we need to support certain DOM Level 2 CSS interfaces:
    http://www.w3.org/TR/DOM-Level-2-Style/css.html
    We support some (anything that should be on an SVG Element), 
    but the following interfaces are not supported:
    CSSStyleSheet, CSSRuleList, CSSRule, CSSStyleRule, CSSMediaRule,
    CSSFontFaceRule, CSSPageRule, CSSImportRule, CSSCharsetRule,
    CSSUnknownRule, CSSStyleDeclaration, CSSValue, CSSPrimitiveValue,
    CSSValueList, RGBColor, Rect, Counter, ViewCSS (getComputedStyle),
    DocumentCSS, DOMImplementationCSS, none of the CSS 2 Extended Interfaces
    
  * There are many SVG DOM interfaces we don't support
*/

window.svgweb = new SVGWeb(); // kicks things off

// hide internal implementation details inside of a closure
})();

// Uncomment when doing performance profiling
/*
window.timer = {};

function start(subject, subjectStarted) {
  //console.log('start('+subject+','+subjectStarted+')');
  if (subjectStarted && !ifStarted(subjectStarted)) {
    //console.log(subjectStarted + ' not started yet so returning for ' + subject);
    return;
  }
  //console.log('storing time for ' + subject);
  window.timer[subject] = {start: new Date().getTime()};
}

function end(subject, subjectStarted) {
  //console.log('end('+subject+','+subjectStarted+')');
  if (subjectStarted && !ifStarted(subjectStarted)) {
    //console.log(subjectStarted + ' not started yet so returning for ' + subject);
    return;
  }
  
  if (!window.timer[subject]) {
    console.log('Unknown subject: ' + subject);
    return;
  }
  
  window.timer[subject].end = new Date().getTime();
  
  //console.log('at end, storing total time: ' + total(subject));
}

function increment(subject, amount) {
  if (!window.timer[subject]) {
    window.timer[subject] = {incremented: true, total: 0};
  }
  
  window.timer[subject].total += amount;
}

function total(subject) {
  if (!window.timer[subject]) {
    console.log('Unknown subject: ' + subject);
    return;
  }
  
  var t = window.timer[subject];
  if (t.incremented) {
    return t.total;
  } else if (t) {
    return t.end - t.start;
  } else {
    return null;
  }
}

function ifStarted(subject) {
  for (var i in window.timer) {
    var t = window.timer[i];
    if (i == subject && t.start !== undefined && t.end === undefined) {
      return true;
    }
  }
  
  return false;
}

function report() {
  for (var i in window.timer) {
    var t = total(i);
    if (t !== null) {
      console.log(i + ': ' + t + 'ms');
    }
  }
}
*/
// End of performance profiling functions

