/* Copyright (c) 2012 Kaj Magnus Lindberg. All rights reserved. */

// Alternatively, could define shortcuts next to the components that
// they control. But I think it's nice to have all shortcuts here
// in one place, or I'll easily forget what shortcuts I've defined.

// COULD add WordPress style comment moderation shortcuts, see:
// http://codex.wordpress.org/Keyboard_Shortcuts

// Misc notes: Cannot intercept Ctrl+Tab — Chrome has reserved that
// combination, and probably e.g. Ctrl+W and Ctrl+PageDown too. (So buggy
// Web apps never prevent users from closing/switching browser tab).

// SHOULD !!! use this scheme everywhere: A single Ctrl click opens a
// context sensitive shortcut menu (a modal dialog that lists all
// available shortcuts) — with lots of 1 char buttons :-)
// E.g.  first Ctrl then 'E' would focus the editor, Ctrl then S
// would focus the Save button and the preview. Ctrl then Tab
// tabs to the right, Shift+Tab to the left.
// (The modal dialog: Click '?' in Gmail, and you'll find an example.)
// — However, don't place the `enter tab' logic here, instead
// place it close to where the tab is constructed.

// Overall strategy:
// 1) When you navigate with the tab key, clicking enter on a
// jQuery UI Tab first opens the tab panel. If you click Enter
// again, only then will you actually enter the panel.
// (That is, the first elem inside the panel gains focus.)
// So, you can tab to a tab, and click Enter to view its contents,
// and then you can either a) click tab again to navigate to the next tab,
// or b) you can click enter, to enter the tab.
// 2) See the [Ctrl *click*, **followed by** another single key click]
// shortcut discussion just above.

// Call:
//   debiki.internal.activateShortcutReceiver(<some-form>)
// to outline and activate a shortcut receiver (e.g. the edit form).

// WOULD be better with something like RequireJS, then could
// return { initFunction, activateShortcutReceiver },
// instead of using global debiki.internal.activateShortcutReceiver.

debiki.internal.initKeybdShortcuts = function($) {

  // No shortcuts for touch devices. They don't have no keyboard?
  // I'd guess all shortcut code would cause nothing but troubles.
  if (Modernizr.touch)
    return;

  function handleEditFormKeys(event, $editForm) {

    // Return quickly if there's nothing to do.
    if (event.which !== $.ui.keyCode.ESCAPE &&
        event.which !== $.ui.keyCode.TAB &&
        !event.ctrlKey)
      return false;

    var whichChar = String.fromCharCode(event.which);
    var anyModifierDown = event.shiftKey || event.ctrlKey || event.altKey;
    var onlyCtrlDown = !event.shiftKey && event.ctrlKey && !event.altKey;
    var $activeElem = $(document.activeElement);
    var $anyFocusedTab = $activeElem.closest('.dw-e-tab');
    var $tabPanelLinks = $editForm.find('.dw-e-tabs > ul > li > a');
    var $editTabLink = $tabPanelLinks.filter('[href^="#dw-e-tab-edit"]');
    var $diffTabLink = $tabPanelLinks.filter('[href^="#dw-e-tab-diff"]');
    var $previewTabLink = $tabPanelLinks.filter('[href^="#dw-e-tab-prvw"]');

    var editFormIf = $editForm.data("dwEditFormInterface");

    // Let Ctrl+S show the Save button and the Preview tab.
    if (whichChar === 'S' && onlyCtrlDown) {
      $editForm.tabs('select', debiki.internal.EditTabIdPreview);
      var $submitBtn = $editForm.find('input.dw-fi-submit');
      $submitBtn.focus(); // don't click, user should review changes
      return true;
    }

    // Let Ctrl+E activate the editor.
    if (whichChar === 'E' && onlyCtrlDown) {
      $editTabLink.focus().click();
      editFormIf.focusEditor();
      return true;
    }

    // Let Ctrl+D show the diff tab panel.
    if (whichChar === 'D' && onlyCtrlDown) {
      $diffTabLink.focus().click();
      return true;
    }

    // Let Ctrl+P show the preview tab panel.
    if (whichChar === 'P' && onlyCtrlDown) {
      $previewTabLink.focus().click();
      return true;
    }

    // Let Escape exit the editor and focus the tab nav.
    if (event.which === $.ui.keyCode.ESCAPE && !anyModifierDown &&
        $anyFocusedTab.is('.dw-e-tab-edit')) {
      $editTabLink.focus();
      // (Now, the next time you click Tab, you'll focus the next *tab*,
      // which shows its releated *panel* on focus, see d.i.$showEditForm().)
      return true;
    }

    return false;
  };

  // Remembers which <form> should handle key presses (shortcuts),
  // even when focus is lost (e.g. when you select text in the
  // edit diff tab, then focus will be lost — the document body will
  // be focused. But the edit <form> should still handle keyboard
  // shortcuts.)
  var $currentRecvr = $();
  var possibleRecvrs = '.dw-f-e';
  var $lastFocus = $();

  function switchRecvr($newRecvr) {
    $currentRecvr.removeClass('dw-keyrecvr');
    $currentRecvr = $newRecvr;
    $currentRecvr.addClass('dw-keyrecvr');
  };

  debiki.internal.activateShortcutReceiver = switchRecvr;

  // When a new <form> appears, indicate it is the keyboard shortcut receiver.
  $(document).delegate(possibleRecvrs, 'focusin', function(event) {
    switchRecvr($(this));
  });

  // Remember the last focused elem — we'll use that instead,
  // if the browser tries to focus the booring document.body.
  $(document).focusout(function(event) {
    if (event.target !== document.body)
      $lastFocus = $(event.target);
  });

  // Override focus on Tab click, if the browser focuses the boring
  // document.body.
  $(document).keydown(function(event) {
    // (Need not check Alt and Ctrl — the browser eats Alt-Tab and
    // Ctrl-Tab anyway?)
    if (event.which !== $.ui.keyCode.TAB)
      return;
    if (document.activeElement === document.body)
      $lastFocus.focus();
  });

  // Clear or change receiver if you tab away from the current one.
  // But not on the blur event — it happens too easily, e.g. if
  // you scrolldrag or select text inside the current recevier.
  $(document).keyup(function(event) {
    // (Need not check Alt and Ctrl — the browser eats Alt-Tab and
    // Ctrl-Tab anyway?)
    if (event.which !== $.ui.keyCode.TAB)
      return;
    var $newRecvr = $(document.activeElement).closest(possibleRecvrs);
    if (!$newRecvr.length || $newRecvr[0] !== $currentRecvr[0]) {
      switchRecvr($newRecvr);
    }
  });

  // Clear or change the receiver on click.
  // If the click doesn't change focus, then don't change receiver though.
  // If the click is inside a possible receiver, activate it.
  // (But only on *click*, not on *drag* — ignore e.g. scrolldrag and text
  // selections — otherwise the reciver would be lost e.g. if you select
  // text *inside* the current receiver <form>!)
  $('.debiki').click(function(event) {
    var $perhapsFocusedRecvr =
      $(document.activeElement).closest(possibleRecvrs);
    var $perhapsClickedRecvr =
      $(event.target).closest(possibleRecvrs)
          .filter(':visible');  // perhaps Cancel button hid the form

    var $newRecvr = $perhapsFocusedRecvr;
    if (!$newRecvr.length) {
      // A new receiver was clicked. Activate it and focus some input or
      // tab link inside.
      // (This looses CodeMirrors caret position though!
      // Should do codeMirrorEditor.focus() instead.)
      $newRecvr = $perhapsClickedRecvr;
      $perhapsClickedRecvr.find(
          'input:visible, button:visible, a:visible').first().focus();
    }

    switchRecvr($newRecvr);
  });

  // Handle keyboard shortcuts.
  $(document).keydown(function(event) {
    if (!$currentRecvr.length)
      return;

    var consumeEvent = false;
    if ($currentRecvr.is('.dw-f-e')) {
      consumeEvent = handleEditFormKeys(event, $currentRecvr);
    } else {
      // (in the future, check other possible event targets)
    }

    if (consumeEvent) {
      event.preventDefault();
      event.stopPropagation();
    }
  });
}

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
