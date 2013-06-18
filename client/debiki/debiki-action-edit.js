/* Shows inline article and comment edit dialogs.
 * Copyright (C) 2010 - 2012 Kaj Magnus Lindberg (born 1979)
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
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */


(function() {

var d = { i: debiki.internal, u: debiki.v0.util };
var $ = d.i.$;


d.i.EditTabIdEdit = 0;
d.i.EditTabIdDiff = 1;
d.i.EditTabIdPreview = 2;
d.i.EditTabIdLast = d.i.EditTabIdPreview;
d.i.EditTabCount = 3;


var onEditPreviewCallbacks = [];
debiki.onEditPreviewShown = function(callback) {
  onEditPreviewCallbacks.push(callback);
};


d.i.$loadEditorDependencies = (function() {
  // COULD use 2 loadStatus, and load Code Mirror only iff `this`
  // is the root post.
  var loadStatus;
  return function() {
    if (loadStatus)
      return loadStatus;
    loadStatus = $.Deferred();
    var loadCodeMirror = !Modernizr.touch;
    var assetsPrefix = d.i.assetsUrlPathStart;
    Modernizr.load({
      test: loadCodeMirror,
      yep: [
        assetsPrefix + 'codemirror-3-13-custom.css',
        assetsPrefix + 'codemirror-3-13-custom.js'],
      both: [
        assetsPrefix + 'debiki-pagedown.min.js'],
      complete: function() {
        loadStatus.resolve();
      }
    })
    return loadStatus;
  }
})();


/**
 * Loads editor resources and opens the edit form.
 */
d.i.$showEditForm = function(event) {
  event.preventDefault();
  var i = this;
  d.i.$loadEditorDependencies.call(i).done(function() {
    _$showEditFormImpl.call(i);
  });
};


function _$showEditFormImpl() {
  var $post = $(this);
  var $postBody = $post.children('.dw-p-bd');
  var postId = $post.dwPostId();
  var isRootPost = $post.parent().is('.dw-depth-0');
  var pageMeta = $post.dwPageMeta();

  // It's confusing with Reply/Rate/etc below the edit form.
  d.i.hideActions();

  var editFormLoader = function(rootPostId, postId, complete) {
    // (The page path is needed if the page doesn't exist, so the server has
    // some way to find out which PermsOnPage to show.)
    var url =
        '/-/edit?pageId='+ pageMeta.pageId +
        '&pagePath='+ pageMeta.pagePath +
        '&postId='+ postId +
        '&pageRole=' + pageMeta.pageRole;
    $.get(url, function(editFormText) {
      // Concerning filter(…): [0] and [2] are text nodes.
      var $editForm = $(editFormText).filter('form');
      d.u.makeIdsUniqueUpdateLabels($editForm, '#dw-e-tab-');
      complete($editForm)
    }, 'text');
  };

  function $disableSubmitBtn() {
    $(this).find('input.dw-fi-submit').button({ disabled: true }).end()
        .find('.dw-f-e-prvw-info').show();
  }

  function scrollPostIntoView() {
    $post.dwScrollIntoView({ marginLeft: 40, marginTop: -35 });
  }

  // If the edit form has already been opened, but hidden by a Cancel click,
  // reuse the old hidden form, so any edits aren't lost.
  var $oldEditForm = $post.children('.dw-f-e');
  if ($oldEditForm.length) {
    $oldEditForm.each($disableSubmitBtn);
    $oldEditForm.find('.dw-e-tabs').tabs('select' , d.i.EditTabIdEdit);
    $oldEditForm.show();
    $postBody.hide();
    scrollPostIntoView();
    return;
  }

  editFormLoader(d.i.rootPostId, postId, function($editForm) {
    var $panels = $editForm.find('.dw-e-tab');
    var $editPanel = $panels.filter('[id^="dw-e-tab-edit"]');
    var $diffPanel = $panels.filter('[id^="dw-e-tab-diff"]');
    var $previewPanel = $panels.filter('[id^="dw-e-tab-prvw"]');
    var $submitBtn = $editForm.find('input.dw-fi-submit');
    var $cancelBtn = $editForm.find('input.dw-fi-cancel');

    var $clickPreviewHelp = $editForm.find('.dw-f-e-prvw-info');
    var $suggestOnlyHelp = $editForm.find('.dw-f-e-sugg-info');

    var $editTabs = $editForm.children('.dw-e-tabs');
    var $tabPanelLinks = $editTabs.find('> ul > li > a');
    var $editTabLink = $tabPanelLinks.filter('a[href^="#dw-e-tab-edit"]');
    var $diffTabLink = $tabPanelLinks.filter('a[href^="#dw-e-tab-diff"]');
    var $previewTabLink = $tabPanelLinks.filter('a[href^="#dw-e-tab-prvw"]');

    var codeMirrorEditor = null;

    $submitBtn.button({ disabled: true }); // you need to preview before submit
    $cancelBtn.button();

    $editForm.insertAfter($postBody); // not before, that'd mess up css [8K3U5]
    $postBody.hide();
    $cancelBtn.click(function() {
      $postBody.show();
      $editForm.hide();
      $post.each(d.i.SVG.$drawParents);
    });

    // Show Markdown help text on click.
    // IF mode = markdown && is page body THEN:
    $editForm.find('.dw-f-e-help-show').click(function() {
      $editForm.find('.dw-f-e-help-text').toggle();
    });

    // Find the post's current (old) source text, and store in
    // .dw-e-src-old, so it's easily accessible to $updateEditFormDiff(…).
    if (!$editForm.data('dw-e-src-old')) {
      var oldSrc = $editForm.find('.dw-e-src-old');
      if (oldSrc.length) {
        oldSrc = oldSrc.text();
      }
      else {
        // html.scala excluded .dw-e-src-old, if the textarea's text
        // is identical to the old src. (To save bandwidth.)
        oldSrc = $editPanel.find('textarea').val();
      }
      $editForm.data('dw-e-src-old', oldSrc);
    }

    // Don't show until Submit button visible. (Would be too much to read,
    // because the 'Click Preview then Save' help text is alo visible.)
    $suggestOnlyHelp.hide();

    var enableSubmitBtn = function() {
      $submitBtn.button({ disabled: false });
      $clickPreviewHelp.hide();
      // Notify the user if s/he is making an edit suggestion only.
      var hideOrShow = d.i.Me.mayEdit($post) ? 'hide' : 'show';
      $suggestOnlyHelp[hideOrShow]();
      $editForm.children('.dw-submit-set').dwScrollIntoView();
    }

    // Update the preview, if the markup type is changed.
    $editForm.find('select[name="dw-fi-e-mup"]').change(function() {
      $editForm.each($updateEditFormPreview);
    });

    // If CodeMirror has been loaded, use it.
    // For now, use CodeMirror on the root post only — because if
    // the other posts are resized, CodeMirror's interal width
    // gets out of sync and the first character you type appears on
    // the wrong row. (But the root post is always full size.)
    if (typeof CodeMirror !== 'undefined' && isRootPost) {
      codeMirrorEditor = CodeMirror.fromTextArea(
          $editPanel.children('textarea')[0], {
        lineNumbers: true, //isRootPost,
        lineWrapping: true,
        mode: "text/html", // for now
        showMarkdownLineBreaks: true,
        // showTrailingSpace: true,
        tabMode: "indent"
      });
    }

    // Always activate the editor on mouse/touch clicks on the tab.
    // — However if the user navigates using the keyboard, s/he might
    // not want to start editing, but only view the source text.
    // Then it's annoying if the editor grabs focus. So, if this is
    // a keyboard click, we require another Enter click, before we
    // focus the editor (see the next code paragraph.)
    // — Oddly enough, keyboard Enter click generates a click event
    // with event.which set to 1, i.e. mouse button 1. Weird.
    // So use `mouseup' instead of `click.'
    // — Don't use mousedown though — because then we'd focus the editor
    // *before* jQuery UI gives focus to the tab link (which seems to
    // happen on mouse*up* when the click is over).
    // — I guess all this doesn't really matter for touch devices.
    $editTabLink.mouseup(function(event, ui) {
      focusEditor();
    });

    // Enter the editor, if the editor *panel* is shown and
    // the user clicks Enter on the editor *tab link*.
    $editTabLink.keydown(function(event) {
      if (event.which !== $.ui.keyCode.ENTER) return;
      if ($editTabs.tabs('option', 'selected') !== d.i.EditTabIdEdit) {
        // Only activate the editor if the user clicks when the panel is
        // already  visible. Instead, let jQuery UI handle the click
        // — it will show the edit panel.
        return;
      }
      focusEditor();
    });

    function focusEditor() {
      // jQuery UI shows the panel on Enter click — but right now,
      // the edit panel *might* not yet be visible. If it is not,
      // the editor cannot be given focus right now.
      setTimeout(function() {
        // Now (later) the editor panel should be visible.
        if (codeMirrorEditor) {
          codeMirrorEditor.refresh();
          codeMirrorEditor.focus();
        }
        else $editPanel.find('textarea').focus();
      }, 0);
    }

    // Sometimes we'll make the panels at least as tall as
    // the post itself (below). But not large enough to push the
    // Submit/Cancel buttons of screen, if editing the root post
    // and the page title is visible (at the top of the page).
    var approxTitleAndBtnsHeight = 260; // page title + tabs + submit buttons
    var maxPanelHeight = Math.max(
        140, $(window).height() - approxTitleAndBtnsHeight);
    var minPanelHeight = Math.max(140, $postBody.height() + 60);
    if (minPanelHeight > maxPanelHeight) minPanelHeight = maxPanelHeight;

    // Place the edit/diff/preview tabs below the content, close to the Submit
    // button. Otherwise people (my father) tend not to notice the tabs,
    // if the edit form is tall (then there'd be lots of space & text
    // between the tabs and the submit & cancel button).
    // Clearfix the tabs, because .dw-p-bd makes the preview tab float left.
    $editTabs.addClass('dw-ui-tabs-bottom ui-helper-clearfix').tabs({
      selected: d.i.EditTabIdEdit,
      show: function(event, ui) {
        // Sync the edit panel <textarea> with any codeMirrorEditor,
        // so the diff and preview tabs will work correctly.
        if (codeMirrorEditor) codeMirrorEditor.save();

        // Update the tab to be shown.
        var $panel = $(ui.panel);
        switch (ui.panel.id) {
          case $editPanel.attr('id'):
            $editTabLink.focus();
            break;
          case $diffPanel.attr('id'):
            $diffTabLink.focus();
            $(this).each($updateEditFormDiff);
            break;
          case $previewPanel.attr('id'):
            $previewTabLink.focus();
            $(this).each($updateEditFormPreview);
            enableSubmitBtn();
            $.each(onEditPreviewCallbacks, function(index, callback) {
              callback($previewPanel.attr('id'));
            });
            break;
          default: d.u.die('[error DwE4krERS]');
        };

        // Resize the root post dynamically, fix size of other posts.
        // Then e.g. CodeMirror can make the root post editor taller
        // dynamically, and the preview panel adjusts its size.
        $panel.height('auto');

        // But don't push the Submit/Cancel buttons of screen.
        $panel.css('max-height', maxPanelHeight +'px');

        // If CodeMirror isn't enabled and thus auto-resize the <textarea>,
        // then resize it manually, so it's as tall as the other panels.
        // {{{ Also don't shrink any panel
        // because: (and old comment of mine follows)
        //  "Don't reduce the form heigt, because if the form is at the
        //  very bottom of the screen, everything would jump downwards
        //  when the browser window shrinks."
        //  [[later: Jump downwards, and vanish outside the browser window?
        //  was that what happened?]]
        // And: (another old hard to understand comment)
        //  "jQuery UI shows the panels before the `show' event is triggered,
        //  so unless the other panels are resized *before* one of them is
        //  shown, that other panel might be smaller than the current one,
        //  causing the window to shrink and everything to jump downwards
        //  (if you're viewing the bottom of the page).
        //  So change the height of all panels — then they won't shrink
        //  later, when shown."  }}}
        if (!codeMirrorEditor) {
          if (minPanelHeight < $panel.height())
            minPanelHeight = $panel.height();
          else
            $panels.height(minPanelHeight);
        }
      }
    });

    // Prevent tab float drop.
    // If the $editForm is narrow, the tabs will float drop. Since they're
    // placed below the form, they'll actually float drop *upwards*, and
    // be hidden below the form. One way to avoid this, is making
    // the .tabs-nav very wide. (This is a stupid fix — it'll break
    // should you add perhaps two more tabs.)
    var $tabsNav = $editTabs.children('.ui-tabs-nav');
    $tabsNav.css('min-width', '300px');

    // Flip rounded corner placement — because tabs placed below contents.
    // (See jqueryui.com/demos/tabs/#bottom)
    $tabsNav.children().andSelf()
        .removeClass('ui-corner-all ui-corner-top')
        .addClass('ui-corner-bottom');

    // Show help info.
    // It might not be obvious that you can scroll down and click a Save
    // button. (Neither my mom nor dad found it! when it was off screen.)
    // For now, simply write a tips if it perhaps is off screen.
    if ($editForm.height() > 650)
      $editForm.children('.dw-f-e-inf-save').show();

    // When clicking the Save button, open a login dialog, unless logged in.
    $submitBtn.each(d.i.$loginSubmitOnClick(function(event, userName) {
      var text = userName ?  'Save as '+ userName : 'Save as ...';  // i18n
      $(this).val(text);
    }));

    // Redraw SVG arrows, since the edit form is larger than the post.
    $post.each(d.i.SVG.$drawParents);

    // Ajax-post edit on submit, and update the page with all recent changes.
    $editForm.submit(function() {
      // Ensure any text edited with CodeMirror gets submitted.
      if (codeMirrorEditor) codeMirrorEditor.save();

      var pagesToCreate = [];
      if (!pageMeta.pageExists) {
        // When the server generated this page, which doesn't exist,
        // it included a passhash in the URL, which we need to send back
        // to the server, so it knows that the server itself actually
        // generated the page creation data (and that the client cannot e.g.
        // forge a mallicious id).
        // (It's okay to mutate pageMeta a little bit.)
        pageMeta.passhash = d.i.parsePasshashInPageUrl();
        pageMeta.newPageApproval = d.i.parseApprovalInPageUrl();
        // Push don't unshift; http://server/-/edit expects them in that order.
        pagesToCreate.push(pageMeta);
      }

      var jsonObj = {
        createPagesUnlessExist: pagesToCreate,
        editPosts: [{
          pageId: pageMeta.pageId,
          postId: postId,
          text: $editForm.find('[name="dw-fi-e-txt"]').val(),
          markup: $editForm.find('[name="dw-fi-e-mup"]').val()
        }]
      };

      d.u.postJson({ url: '/-/edit', data: jsonObj })
          .fail(d.i.showErrorEnableInputs($editForm))
          .done(function(newDebateHtml) {

        d.i.slideAwayRemove($editForm);

        // Show page body reply button if the page body was just created.
        // (Do this before `patchPage` or SVG arrows apparently won't appear
        // until after zoom or resize.)
        $post.closest('.dw-t').removeClass('dw-dummy');

        // If the edit was a *suggestion* only, the post body has not been
        // changed. Unless we make it visible again, it'll remain hidden
        // because mergeChangesIntoPage() ignores it (since it hasn't changed).
        $postBody.show();

        // This destroys $post, $postBody etcetera...
        d.i.patchPage(newDebateHtml);

        // ... So find them again, when needed:
        $editedPost = d.i.findPost$(postId);

        // In case this page is a new page that was just created from an
        // admin page, then notify the admin page that this page was saved.
        // Check the opener's opener too, and so on, in case 1) a page P was
        // from the admin page, and then 2) from P another page P2 was
        // created (P could be a blog main page, and P2 a blog article)
        // — then we should still find and call onOpenedPageSavedCallbacks
        // on the admin page.
        var editedTitle = $editedPost.dwPageTitleText();
        var editedMeta = $editedPost.dwPageMeta();
        d.i.forEachOpenerCall('onOpenedPageSavedCallbacks',
            [editedMeta, editedTitle]);

        if (!pageMeta.pageExists) {
          // Now the page does exist, since it's been saved,
          // so tell AngularJS to update the page as appropriately,
          // e.g. show certain buttons in the admin dashbar.
          // ((This won't update the data-page_exists attribute though,
          // so we'll trigger Angular's $digest whenever we edit the page,
          // if it is newly created (didn't exist when it was rendered).))
          d.i.angularApply(function(rootScope) {
            rootScope.pageExists = true;
          });
        }
      });

      d.i.disableSubmittedForm($editForm);
      return false;
    });

    // Provide an interface to internal stuff.
    $editForm.data("dwEditFormInterface", {
      focusEditor: focusEditor
    });

    // Finally,
    d.i.activateShortcutReceiver($editForm);
    focusEditor();
    scrollPostIntoView();
  });
};


d.i.forEachOpenerCall = function(callbackName, params) {
  $.each(d.i.windowOpeners, function(index, curOpener) {
    if (curOpener && curOpener.debiki && curOpener.debiki.internal) {
      var callbacks = curOpener.debiki.internal[callbackName] || [];
      $.each(callbacks, function(index, callback) {
        callback.apply(null, params);
      });
    }
  });
};


// Call on a .dw-f-e, to update the diff tab.
function $updateEditFormDiff() {
  // Find the closest post
  var $editForm = $(this).closest('.dw-f-e');
  var $editTab = $(this).find('div.dw-e-tab[id^="dw-e-tab-edit"]');
  var $diffTab = $(this).find('div.dw-e-tab[id^="dw-e-tab-diff"]');
  var $textarea = $editTab.find('textarea');

  // Find the current draft text, and the old post text.
  var newSrc = $textarea.val();
  var oldSrc = $editForm.data('dw-e-src-old');

  var htmlDiff = d.i.makeHtmlDiff(oldSrc, newSrc);

  // Remove any old diff.
  $diffTab.children('.dw-p-diff').remove();
  // Show the new diff.
  $diffTab.append('<div class="dw-p-diff">'+ htmlDiff +'</div>\n');
};


// Call on a .dw-f-e, to update the preview tab.
function $updateEditFormPreview() {
  var $i = $(this);
  var $editForm = $i.closest('.dw-f-e');
  var $editTab = $editForm.find('div.dw-e-tab[id^="dw-e-tab-edit"]');
  var $previewTab = $editForm.find('div.dw-e-tab[id^="dw-e-tab-prvw"]');
  var $textarea = $editTab.find('textarea');
  var $selectedMarkup =
    $editForm.find('select[name="dw-fi-e-mup"] > option:selected');
  var markupType = $selectedMarkup.val();
  var markupSrc = $textarea.val();
  var htmlSafe = '';
  var $post = $i.closest('.dw-p');
  var isForTitle = $post.is('.dw-p-ttl');
  var sanitizerOptions = d.i.sanitizerOptsForPost($post);

  switch (markupType) {
    case "para":
      // Convert to paragraphs, but for now simply show a <pre> instead.
      // The Scala implementation changes \n\n to <p>...</p> and \n to <br>.
      htmlSafe = $(isForTitle ? '<h1></h1>' : '<pre></pre>').text(markupSrc);
      break;
    case "dmd0":
      // Debiki flavored Markdown version 0.
      if (isForTitle) markupSrc = '<h1>'+ markupSrc +'</h1>';
      htmlSafe = d.i.markdownToSafeHtml(
          markupSrc, window.location.host, sanitizerOptions);
      break;
    case "code":
      // (No one should use this markup for titles, insert no <h1>.)
      htmlSafe = $('<pre class="prettyprint"></pre>').text(markupSrc);
      break;
    case "html":
      if (isForTitle) markupSrc = '<h1>'+ markupSrc +'</h1>';
      htmlSafe = d.i.sanitizeHtml(markupSrc, sanitizerOptions);
      break;
    default:
      d.u.die("Unknown markup [error DwE0k3w25]");
  }

  $previewTab.children('.dw-p-bd-blk').html(htmlSafe);
};


// Invoke this function on a textarea or an edit suggestion.
// It hides the closest post text and shows a diff of the-text-of-the-post
// and $(this).val() or .text(). $removeEditDiff shows the post again.
d.i.$showEditDiff = function() {
  // Find the closest post
  var $post = $(this).closest('.dw-t').children('.dw-p');
  var height = $post.height();
  // Remove any old diff
  var $oldDiff = $post.children('.dw-p-diff');
  $oldDiff.remove();
  // Extract the post's current text.
  var $postBody = $post.children('.dw-p-bd');
  var oldText =
      $postBody.map($extractMarkupSrcFromHtml)[0]; // SHOULD excl inline threads
  // Try both val() and text() -- `this' might be a textarea or
  // an elem with text inside.
  var newText = $(this).val();
  if (newText === '') newText = $(this).text();
  newText = newText.trim() +'\n';  // $htmlToMarkup trims in this way

  var htmlDiff = d.i.makeHtmlDiff(oldText, newText);

  // Hide the post body, show the diff instead.
  $postBody.hide();
  $postBody.after('<div class="dw-p-diff">'+ htmlDiff +'</div>\n');
  // Fix the height of the post, so it won't change when showing
  // another diff, causing everything below to jump up/down.

  // For now, make it somewhat higher than its current height,
  // so there's room for <ins> elems.
  //$post.css('height', '');
  //$post.css('height', $post.height() + 50 +'px');
  //$post.height(height + ($oldDiff.length ? 0 : 75));
  $post.height(height);
  $post.css('overflow-y', 'auto');

  // COULD make inline comments point to marks in the diff.
};


// Removes any diff of the closest post; shows the post text instead.
d.i.$removeEditDiff = function() {
  var $post = $(this).closest('.dw-t').children('.dw-p');
  $post.children('.dw-p-diff').remove();
  $post.children('.dw-p-bd').show();
  $post.css('overflow-y', 'hidden');
};


function $extractMarkupSrcFromHtml() {
  var mup = '';
  $(this).find('p').each(function(){ mup += $(this).text() +'\n\n'; });
  return mup.trim() +'\n';
};



})();

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
