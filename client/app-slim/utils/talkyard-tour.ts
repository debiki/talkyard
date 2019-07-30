/*
 * Copyright (c) 2019 Kaj Magnus Lindberg
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


// Talkyard Tour gives the user a guided tour of the for-the-moment relevant
// features s/he is about to use.
//
// There're many many open source intro tour Javascript libs,
// but none of them had the functionality I needed, (e.g. waiting for the next
// element to appear, or waiting for a click on the highlighted elem,
// but blocking clicks outside, or in other case requiring a Next
// button click instead, and a nice ellipse highligt whose shape
// and position I can tweak if needed)
// and most of them were a bit bloated, I mean, many many lines of code
// or even bringing in jQuery. So in the end, I created this lib, Talkyard Tour
// instead. (Just 70% LOC size of the smallest other tour lib I could find
// (namely https://github.com/callahanrts/tiny-tour) (ignoring Typescript defs)).


//------------------------------------------------------------------------------
   namespace debiki2.utils {
//------------------------------------------------------------------------------

let tourElem;
let startTour;
let tourRunning = false;

export function maybeRunTour(tour: TalkyardTour) {
  // Currently the e2e tests don't expect any tours to start, so skip them, if is test site.
  const hostname = location.hostname;
  if ((hostname.startsWith('e2e-test-') || hostname.startsWith('comments-for-e2e-test-')) &&
      !getFromLocalStorage('runToursAlthoughE2eTest'))
    return;

  // Don't run tours for built-in users and groups (if impersonating).
  if (tour.forWho.id < LowestAuthenticatedUserId || tour.forWho.isGroup)
    return;

  const tourIdsSeen = tour.forWho.tourTipsSeen;
  const thisTourSeen = tourIdsSeen.indexOf(tour.id) >= 0;
  if (thisTourSeen || tourRunning)
    return;

  if (!tourElem) {
    tourElem = ReactDOM.render(React.createFactory(TalkyardTour)(), utils.makeMountNode());
  }
  setTimeout(function() {
    startTour(tour);
  }, 1);
}


function TalkyardTour() {
  const [tour, setTour] = React.useState<TalkyardTour>(null);
  const [stepIx, setStepIx] = React.useState(0);
  const [showExitButton, setShowExitButton] = React.useState(false);
  const tourHighlightRef = React.useRef(null);
  const tourClickHereRef = React.useRef(null);
  const tourDialogRef = React.useRef(null);
  React.useLayoutEffect(waitForAndScrollToElemThenShowDialog);

  let beforeThingDone = false;
  let showExitTimeoutHandle;

  if (!startTour) startTour = (tour: TalkyardTour) => {
    tourRunning = true;
    setTour(tour);
    setStepIx(0);
  }

  if (!tour)
    return null;

  const step: TalkyardTourStep = tour.steps[stepIx];
  if (!step)
    return r.div({ className: 'e_NoTourStep' });

  function waitForAndScrollToElemThenShowDialog() {
    if (!tour) return;
    if (!step) return;
    if (step.doBefore && !beforeThingDone) {
      beforeThingDone = true;
      step.doBefore();
    }

    // Remove highlighting, until new elem appears and done scrolling.
    const highlightElem: HTMLElement = tourHighlightRef.current;
    const clickHereElem: HTMLElement = tourClickHereRef.current;
    highlightElem.style.padding = '0px';
    clickHereElem.style.display = 'none';

    // Hide the dialog, until the elem to place it at, appears, and any pause is over.
    // Don't use display:none — that'd mess up the position calc code, which needs
    // the dialog size.
    const dialogElem: HTMLElement = tourDialogRef.current;
    dialogElem.style.visibility = 'hidden';

    const placeAtElem: HTMLElement = $first(step.placeAt);  // [27KAH5]
    if (!placeAtElem) {
      setTimeout(waitForAndScrollToElemThenShowDialog, 100);
      if (!showExitTimeoutHandle) {
        showExitTimeoutHandle = setTimeout(() => setShowExitButton(true), 1500);
      }
      return;
    }

    if (showExitTimeoutHandle) {
      clearTimeout(showExitTimeoutHandle);
      showExitTimeoutHandle = null;
    }
    setShowExitButton(false);

    const isScrolling = utils.scrollIntoViewInPageColumn(
        placeAtElem, { marginTop: 90, marginBottom: 250 });
    // For now. Currently there's no scroll-done event.
    const delayMs = (step.pauseBeforeMs || 0) + (isScrolling ? 700 : 0);
    setTimeout(showDialog, delayMs);
  }

  function showDialog() {
    const placeAtElem: HTMLElement = $first(step.placeAt);  // [27KAH5]
    const highlightElem: HTMLElement = tourHighlightRef.current;
    const clickHereElem: HTMLElement = tourClickHereRef.current;

    if (step.waitForClick) {
      // Let clicks pass through the highlight overlay, so the elem can be clicked.
      highlightElem.style.pointerEvents = 'none';
    }

    const placeAtRect = placeAtElem.getBoundingClientRect();

    const dialogElem: HTMLElement = tourDialogRef.current;
    const dialogWidth = dialogElem.clientWidth;
    const dialogHeight = dialogElem.clientHeight;

    let left;
    let top;
    let highlight = true;
    const extraPadding = 30;

    switch (step.placeHow) {
      case PlaceHow.ToTheLeft:
        left = placeAtRect.left - dialogWidth - 2 * extraPadding;
        top = Math.max(30, placeAtRect.top + placeAtRect.height / 2 - dialogHeight / 2);
        break;
      case PlaceHow.ToTheRight:
        left = placeAtRect.left + placeAtRect.width + 2 * extraPadding;
        top = Math.max(30, placeAtRect.top + placeAtRect.height / 2 - dialogHeight / 2);
        break;
      case PlaceHow.Above:
        left = placeAtRect.left + placeAtRect.width / 2 - dialogWidth / 2;
        top = placeAtRect.top - dialogHeight - 2 * extraPadding;
        break;
      case PlaceHow.Below:
        placeBelow();
        break;
      default:
        left = placeAtRect.left + placeAtRect.width / 2 - dialogWidth / 2;
        top = placeAtRect.top + placeAtRect.height / 2 - dialogHeight / 2;
        highlight = false;
    }

    if (left < 0 || left + dialogWidth > window.innerWidth) {
      // Didn't fit on screen. Place it below the elem; should work fine also on small
      // screens.
      placeBelow();
    }

    function placeBelow() {
      const dialogPadding = 17; // [4BQWTJ0]
      const aLittleBit = 4;
      left = Math.max(aLittleBit, placeAtRect.left + placeAtRect.width / 2 - dialogWidth / 2);
      if (left + dialogWidth - dialogPadding > window.innerWidth) {
        left = window.innerWidth - dialogWidth - aLittleBit;
      }
      top = placeAtRect.top + placeAtRect.height + 2 * extraPadding;
      if (top + dialogHeight - dialogPadding > window.innerHeight) {
        top = window.innerHeight - dialogHeight + dialogPadding - aLittleBit;
      }
    }

    dialogElem.style.visibility = 'visible';
    dialogElem.style.left = left + 'px';
    dialogElem.style.top = top + 'px';

    if (highlight) {
      // This, + a 100vmax border with 50% radius, creates an ellipse centered around
      // the elem to highlight.
      const offsetX = step.highlightOffsetX || 0;
      const offsetY = step.highlightOffsetY || 0;
      highlightElem.style.left = placeAtRect.left + placeAtRect.width / 2 + offsetX + 'px';
      highlightElem.style.top = placeAtRect.top + placeAtRect.height / 2 + offsetY + 'px';
      const padding = step.highlightPadding || extraPadding;
      highlightElem.style.padding =
          `${placeAtRect.height / 2 + padding}px ${placeAtRect.width / 2 + padding}px`;
      if (step.waitForClick) {
        // Make the elem as bright as it can be, to indicate it *is* to be clicked.
        // Otherwise people frequently don't realize they shall click it.
        highlightElem.style.background = 'none';             // area to click
        highlightElem.style.borderColor = 'rgba(0,0,0,0.6)'; // backdrop background
      }
      else {
        // Make the elem just a little bit dimmed out, to indicate it is *not* to be clicked.
        highlightElem.style.background = 'rgba(0,0,0,0.15)';
        highlightElem.style.borderColor = 'rgba(0,0,0,0.28)';
      }
    }
    else {
      highlightElem.style.left = '0px';
      highlightElem.style.top = '0px';
      highlightElem.style.padding = '0px';
    }

    // Show a colored circle around the elem to click, otherwise people don't realize
    // they are to click it.
    if (step.waitForClick) {
      clickHereElem.style.left = highlightElem.style.left;
      clickHereElem.style.top = highlightElem.style.top;
      clickHereElem.style.padding = highlightElem.style.padding;
      clickHereElem.style.display = 'block';
    }

    // Ignore clicks outside the highlighted area.
    // The maths here is confusing? because style.right is the distance from the right edge
    // of the display — but placeAtRect.right is the distance from the *left* edge (although both
    // are named `.right`).
    $first('.s_Tour_ClickBlocker-Left-All').style.right = (window.innerWidth - placeAtRect.left) + 'px';
    $first('.s_Tour_ClickBlocker-Right').style.left = placeAtRect.right + 'px';
    $first('.s_Tour_ClickBlocker-Above').style.bottom = (window.innerHeight - placeAtRect.top) + 'px';
    $first('.s_Tour_ClickBlocker-Below').style.top = placeAtRect.bottom + 'px';

    if (step.waitForClick) {
      placeAtElem.addEventListener('click', callNextAndUnregister);
    }

    function callNextAndUnregister() {
      placeAtElem.removeEventListener('click', callNextAndUnregister);
      goToNextStep();
    }
  }

  function goToNextStep() {
    tourHighlightRef.current.style.pointerEvents = 'auto';
    const isLastStep = stepIx === tour.steps.length - 1;
    if (isLastStep) {
      exitTour();
    }
    else {
      setStepIx(stepIx + 1);
    }
  }

  function goToPrevStep() {
    setStepIx(stepIx - 1);
  }

  function exitTour() {
    // This updates the state in place. Fine, in this case.  [redux]
    tour.forWho.tourTipsSeen.push(tour.id);
    Server.markTourTipsSeen(tour.id);
    setTour(null);
    tourRunning = false;
  }

  function maybeGoNextOnElemClick() {
    if (!step.waitForClick) return;
    goToNextStep();
  }

  const nextDisabled = step.waitForClick;
  const isFirstStep = stepIx === 0;
  const isLastStep = stepIx === tour.steps.length - 1;
  // If we're at the first step, or the previous step involved clicking a button,
  // then we cannot go back (because don't know how to reverse the button click).
  const prevStep = tour.steps[stepIx - 1];
  const canGoBack = prevStep && !prevStep.waitForClick;

  // If the elem the dialog should be placed at won't appear (maybe a tour
  // starts in the wrong situation, where it won't work), then after a while,
  // show an exit-tour button, so the tour won't block the screen forever.
  //
  // I18N: Translate "(Loading) The next step", "Next", "Prev", "Exit" but
  // only for tours that aren't for admins. Hmm?
  //
  const anyExitButton = !showExitButton ? null :
    r.div({ className: 's_Tour_D s_Tour_D-Exit' },
      r.h3({ className: 's_Tour_D_Ttl' }, t.Loading),
      r.p({ className: 's_Tour_D_Txt' }, "The next step in the tour ..."),
      r.div({ className: 's_Tour_D_Bs' },
        Button({ onClick: exitTour, className: 's_Tour_D_Bs_ExitB'  }, "Exit tour")));

  const tourDialogAndNextButton =
    r.div({ className: 's_Tour_D', ref: tourDialogRef },
      r.h3({ className: 's_Tour_D_Ttl' }, step.title),
      r.p({ className: 's_Tour_D_Txt' }, step.text),
      r.div({ className: 's_Tour_D_Bs' },
        !canGoBack ? null :
            Button({ onClick: goToPrevStep, className: 's_Tour_D_Bs_PrevB'  }, "Prev"),
        PrimaryButton({ onClick: goToNextStep, className: 's_Tour_D_Bs_NextB',
            disabled: nextDisabled }, isLastStep ? "Goodbye" : step.nextTitle || "Next"),
        r.div({ className: 's_Tour_D_Bs_Ix' }, `${stepIx + 1}/${tour.steps.length}`),
        isLastStep ? null :
            Button({ onClick: exitTour, className: 's_Tour_D_Bs_ExitB'  },
              isFirstStep ? "Exit tour" : "Exit")));

  const shallClickClass = step.waitForClick ? ' s_Tour-Click' : '';
  return r.div({ className: 's_Tour s_Tour-Step-' + (stepIx + 1) + shallClickClass },
    r.div({ className: 's_Tour_Highlight', ref: tourHighlightRef,
        onClick: maybeGoNextOnElemClick }),
    r.div({ className: 's_Tour_ClickHere', ref: tourClickHereRef }),
    r.div({ className: 's_Tour_ClickBlocker-Left-All' }),
    r.div({ className: 's_Tour_ClickBlocker-Right' }),
    r.div({ className: 's_Tour_ClickBlocker-Above' }),
    r.div({ className: 's_Tour_ClickBlocker-Below' }),
    anyExitButton,
    // Show always, needed for size calculations also before shown for real.
    tourDialogAndNextButton);
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------