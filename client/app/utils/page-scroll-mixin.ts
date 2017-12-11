/*
 * Copyright (C) 2015 Kaj Magnus Lindberg
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


//------------------------------------------------------------------------------
   namespace debiki2.utils {
//------------------------------------------------------------------------------


export var PageScrollMixin = {
  componentDidMount: function() {
    document.getElementById('esPageColumn').addEventListener('scroll', this.__onScroll, false);
    this.checkIsScrollingHandle = setInterval(this.__checkIsScrolling, 100);
    this.isScrolling = false;
    this.lastScrollTime = 0;
  },
  componentWillUnmount: function() {
    document.getElementById('esPageColumn').removeEventListener('scroll', this.__onScroll, false);
    clearInterval(this.checkIsScrollingHandle);
  },
  __checkIsScrolling: function() {
    if (Date.now() - this.lastScrollTime > 200 && this.isScrolling) {
      this.isScrolling = false;
      if (this.onScrollStop) {
        this.onScrollStop();
      }
    }
  },
  __onScroll: function() {
    if (!this.isScrolling) {
      this.isScrolling = true;
      if (this.onScrollStart) {
        this.onScrollStart();
      }
    }
    if (this.onScroll) {
      this.onScroll();
    }
    this.lastScrollTime = Date.now();
  }
};


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
