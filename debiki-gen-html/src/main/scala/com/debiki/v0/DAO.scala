// vim: ts=2 sw=2 et

package debikigenhtml

/** Debiki's Data Access Object interface.
 */
abstract class Dao {

  def getDebate(id: String): Debate

}
