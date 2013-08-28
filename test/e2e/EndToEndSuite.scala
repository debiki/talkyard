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

package test.e2e

import org.scalatest._
import test.e2e.code.StartServerAndChromeDriverFactory
import test.e2e.specs._


/**
 * Runs all end to end tests. Empties the database and restarts the browser
 * once before all tests are run. (Each test usually creates a new
 * site, so there's no need to empty the database inbetween each test.)
 *
 * In SBT:  test-only test.e2e.EndToEndSuite
 * In test:console:  (new test.e2e.EndToEndSuite).execute()
 */
@test.tags.EndToEndTest
class EndToEndSuite extends Suites(
  new CreateSiteSpec,
  new DeleteActivitySpec,
  new AdminDashboardSpec,
  new AnonLoginSpec,
  new ForumSpec,
  new StyleSiteSpecSpec)
  with StartServerAndChromeDriverFactory

