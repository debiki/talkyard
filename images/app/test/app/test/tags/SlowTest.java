/**
 * Copyright (C) 2013 Kaj Magnus Lindberg (born 1979)
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

package test.tags;

import java.lang.annotation.*;
import org.scalatest.TagAnnotation;


/**
 * This tag means that the tagged test takes really long.
 *
 * For info on tags, see class org.scalatest.TagAnnotation.java.
 *
 * To run only SlowTest:s, in Play's console:
 *   test-only * -- -n test.tags.SlowTest
 *
 * To exclude them:
 *   test-only * -- -l test.tags.SlowTest
 */
@TagAnnotation
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.METHOD, ElementType.TYPE})
public @interface SlowTest {}

