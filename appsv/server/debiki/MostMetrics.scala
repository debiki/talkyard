/**
 * Copyright (c) 2015 Kaj Magnus Lindberg
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

package debiki

import com.debiki.core._
import com.codahale.metrics._
import nl.grons.metrics4.scala.MetricBuilder



class CacheMetric(val name: String, metrics: MetricBuilder) {
  import RatioGauge.Ratio

  val hitMeter = metrics.meter(name + "Hits")
  val timer = metrics.timer(name + "Timer")

  metrics.registry.register(MetricRegistry.name(getClass, name + "OneMinute"), new RatioGauge {
    override def getRatio = Ratio.of(hitMeter.oneMinuteRate, timer.oneMinuteRate)
  })

  metrics.registry.register(MetricRegistry.name(getClass, name + "15Minutes"), new RatioGauge {
    override def getRatio = Ratio.of(hitMeter.fifteenMinuteRate, timer.fifteenMinuteRate)
  })
}



class MostMetrics(override val metricRegistry: MetricRegistry)
  extends nl.grons.metrics4.scala.InstrumentedBuilder {

  val renderPageCacheMetrics = new CacheMetric("renderedPageCache", metrics)
  val defaultSiteDaoCacheMetric = new CacheMetric("defaultSiteDaoCache", metrics)

  private val renderForumTimer = metrics.timer("renderForum")
  private val renderBlogTimer = metrics.timer("renderBlog")
  private val renderCustomHtmlPageTimer = metrics.timer("renderCustomHtmlPage")
  private val renderCodePageTimer = metrics.timer("renderCodePage")
  private val renderEmbeddedCommentsTimer = metrics.timer("renderEmbeddedComments")
  private val renderCommentsPageTimer = metrics.timer("renderCommentsPage")
  private val renderNoRolePageTimer = metrics.timer("renderNoRolePage")

  def getRenderPageTimer(anyPageRole: Option[PageType]) = anyPageRole match {
    case Some(PageType.Forum) => renderForumTimer
    case Some(PageType.Blog) => renderBlogTimer
    case Some(PageType.CustomHtmlPage) => renderCustomHtmlPageTimer
    case Some(PageType.Code) => renderCodePageTimer
    case Some(PageType.EmbeddedComments) => renderEmbeddedCommentsTimer
    case Some(_) => renderCommentsPageTimer
    case None => renderNoRolePageTimer
  }

}
