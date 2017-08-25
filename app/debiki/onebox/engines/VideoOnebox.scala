/**
 * Copyright (c) 2015 Kaj Magnus Lindberg
 * Parts Copyright (c) 2013 jzeta (Joanna Zeta)
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
 *
 * The parts copyrighted by jzeta are available under the MIT license:
 * - https://github.com/discourse/onebox/blob/master/lib/onebox/engine/video_onebox.rb
 * - https://github.com/discourse/onebox/blob/master/LICENSE.txt
 */

package debiki.onebox.engines

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.{Globals, ReactRenderer}
import debiki.onebox._
import scala.util.Success



class VideoOnebox(globals: Globals, nashorn: ReactRenderer)
  extends InstantOneboxEngine(globals, nashorn) {

  val regex = """^(https?:)?\/\/.*\.(mov|mp4|m4v|webm|ogv)(\?.*)?$""".r

  val cssClassName = "dw-ob-video"

  def renderInstantly(url: String) = Success(o"""
     <video width='100%' height='100%' controls src='$url'>
       <a href='$url'>$url</a>
     </video>
    """)

}


