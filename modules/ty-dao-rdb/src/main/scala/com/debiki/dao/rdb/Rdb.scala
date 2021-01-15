/**
 * Copyright (C) 2011-2013 Kaj Magnus Lindberg (born 1979)
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

package com.debiki.dao.rdb

import _root_.java.{io => jio, util => ju}
import _root_.com.debiki.core._
import _root_.com.debiki.core.Prelude._
import _root_.scala.collection.immutable
import java.{lang => jl, sql => js}
import javax.{sql => jxs}
import play.api.libs.json.{JsObject, Json}


object Rdb {


  // Calendar is very thread unsafe, and reportedly slow, because of creation of
  // the TimeZone and Locale objects, so cache those (three lines below).
  // (Source: http://stackoverflow.com/questions/6245053/how-to-make-a-static-calendar-thread-safe#comment24522525_6245117 )
  def calendarUtcTimeZone = ju.Calendar.getInstance(UtcTimeZone, DefaultLocale)

  // These are not thread safe (at least not TimeZone), but we never modify them.
  private val UtcTimeZone = ju.TimeZone.getTimeZone("UTC")
  private val DefaultLocale = ju.Locale.getDefault(ju.Locale.Category.FORMAT)


  case class Null(sqlType: Int)
  val NullVarchar = Null(js.Types.VARCHAR)
  val NullBoolean = Null(js.Types.BOOLEAN)
  val NullSmallInt = Null(js.Types.SMALLINT)
  val NullInt = Null(js.Types.INTEGER)
  val NullI64 = Null(js.Types.BIGINT)
  val NullDouble = Null(js.Types.DOUBLE)
  val NullFloat = Null(js.Types.FLOAT)
  val NullTimestamp = Null(js.Types.TIMESTAMP)
  val NullBytea = Null(js.Types.VARBINARY)

  /**
   * Pimps `Option[String]` with `orNullVarchar`, which means
   * `getOrElse(Null(java.sql.Types.VARCHAR))`.
   * (There is already an `Option.orNull`.)
   */
  implicit class StringOptionPimpedWithNullVarchar(opt: Option[String]) {
    def orNullVarchar = opt.getOrElse(NullVarchar)
    def trimOrNullVarchar = opt.trimNoneIfBlank.getOrElse(NullVarchar)
  }

  implicit class PimpOptionWithNullInt64(opt: Opt[i64]) {
    def orNullI64: AnyRef = opt.map(_.asAnyRef).getOrElse(NullI64)
  }

  implicit class PimpOptionWithNullInt(opt: Option[Int]) {
    def orNullInt: AnyRef = opt.map(_.asInstanceOf[Integer]).getOrElse(NullInt)
  }

  implicit class PimpOptionWithNullByte(opt: Option[Byte]) {
    def orNullInt: AnyRef = opt.map(_.toInt.asInstanceOf[Integer]).getOrElse(NullSmallInt).asAnyRef
  }

  implicit class PimpOptionWithNullFloat(opt: Option[Float]) {
    def orNullFloat: AnyRef = opt.map(_.asAnyRef).getOrElse(NullFloat)
  }

  implicit class PimpOptionWithNullBoolean(opt: Option[Boolean]) {
    def orNullBoolean: AnyRef = opt.map(_.asAnyRef).getOrElse(NullBoolean)
  }

  implicit class PimpBooleanWithNull(boolean: Boolean) {
    def asTrueOrNull: AnyRef = if (boolean) boolean.asAnyRef else NullBoolean
  }

  implicit class PimpOptionWithNullDate(opt: Option[ju.Date]) {
    def orNullTimestamp: AnyRef = opt.map(d2ts).getOrElse(NullTimestamp)
  }

  implicit class PimpDateWithTimestamp(date: ju.Date) {
    def asTimestamp: js.Timestamp = d2ts(date)
  }

  implicit class PimpWhenWithTimestamp(when: When) {
    def asTimestamp: AnyRef = d2ts(new ju.Date(when.unixMillis))
  }

  implicit class PimpOptionWithNullWhen(opt: Option[When]) {
    def orNullTimestamp: AnyRef = opt.map({ when =>
      d2ts(new ju.Date(when.unixMillis))
    }).getOrElse(NullTimestamp)
  }

  implicit class PimpOptionWithNullJsValue(opt: Option[play.api.libs.json.JsValue]) {
    def orNullJson: AnyRef = opt.getOrElse(Null(js.Types.OTHER))
  }

  /*
  implicit class PimpOptionWithNullArray(opt: Option[ ? ]) {
    def orNullArray: AnyRef = opt.getOrElse(Null(js.Types.ARRAY))
  }*/

  implicit class PimpStringWithNullIfBlank(string: String) {
    def trimNullVarcharIfBlank: AnyRef = {
      val trimmed = string.trim
      if (trimmed.nonEmpty) trimmed
      else NullVarchar
    }
  }

  implicit class PimpByteArrayWithNullIfEmpty(array: Array[Byte]) {
    def orNullByteaIfEmpty: AnyRef = {
      if (array.isEmpty) NullBytea
      else array
    }
  }

  /** Useful when converting Int:s to AnyRef, which the JDBC driver wants. */
  implicit class AnyAsAnyRef(a: Any) {
    def asAnyRef = a.asInstanceOf[AnyRef]
  }


  /** Converts null to the empty string ("Null To Empty"). */
  @deprecated("now", "use getStringOrEmpty instead")
  def n2e(s: String) = if (s eq null) "" else s

  def getStringOrEmpty(rs: js.ResultSet, column: String): String = {
    val value = rs.getString(column)
    if (value eq null) "" else value
  }

  def getString(rs: js.ResultSet, column: String): String = {
    val s = rs.getString(column)
    dieIf(s eq null, "TyE5WKAB03R", s"Column value is null: $column")
    s
  }

  def getOptString(rs: js.ResultSet, column: String): Option[String] =
    getOptionalStringNotEmpty(rs, column)

  def getOptionalStringNotEmpty(rs: js.ResultSet, column: String): Option[String] = {
    val value = Option(rs.getString(column))
    if (value.contains("")) None else value
  }

  def getJsObject(rs: js.ResultSet, column: String): JsObject = {
    getOptJsObject(rs, column).getOrDie("TyE603DTJ0M", s"Column is null: $column")
  }

  def getOptJsObject(rs: js.ResultSet, column: String): Option[JsObject] = {
    val anyString = getOptString(rs, column)
    anyString.map(s => Json.parse(s).asInstanceOf[JsObject])
  }

  /** Converts null to 0 (zero). */
  def n20(i: Integer): Integer = if (i eq null) 0 else i

  /** Converts empty to SQL NULL. */
  def e2n(o: Option[String]) = o.getOrElse(Null(js.Types.VARCHAR))
    // Oracle: use NVARCHAR ?

  /** Converts a dash to the empty string ("Dash To Empty"). */
  def d2e(s: String) = if (s == "-") "" else s

  /** Converts the empty string to a dash ("Empty To Dash"). */
  def e2d(s: String) = if (s isEmpty) "-" else s

  /** Converts dash and null to the empty string ("Dash or Null To Empty"). */
  def dn2e(s: String) = if ((s eq null) || s == "-") "" else s

  /** Converts java.util.Date to java.sql.Timestamp. */
  def d2ts(d: ju.Date) = new js.Timestamp(d.getTime)

  /** Converts an Option[Date] to Null or java.sql.Timestamp. */
  def o2ts(maybeDati: Option[ju.Date]) =
    maybeDati.map(d2ts(_)) getOrElse NullTimestamp

  def tOrNull(bool: Boolean) = if (bool) "T" else NullVarchar

  def getResultSetLongOption(rs: js.ResultSet, column: String): Option[Long] = {
    getOptI64(rs, column)
  }

  def getOptI64(rs: js.ResultSet, column: St): Opt[i64] = {
    // rs.getLong() returns 0 instead of null.
    val value = rs.getLong(column)
    if (rs.wasNull) None
    else Some(value)
  }

  def getOptionalByte(rs: js.ResultSet, column: String): Option[Byte] = {
    // rs.getByte() returns 0 instead of null.
    var value = rs.getByte(column)
    if (rs.wasNull) None
    else Some(value)
  }

  def getOptFloat(rs: js.ResultSet, column: String): Option[Float] = {
    // rs.getFloat() returns 0 instead of null.
    var value = rs.getFloat(column)
    if (rs.wasNull) None
    else Some(value)
  }

  def getInt(rs: js.ResultSet, column: String): Int = {
    var value = rs.getInt(column)
    dieIf(rs.wasNull, "TTyECOLINTISNL", s"Column int value is null: $column")
    value
  }

  def getLong(rs: js.ResultSet, column: String): Long = {
    var value = rs.getLong(column)
    dieIf(rs.wasNull, "TyECOLLNGISNL", s"Column long value is null: $column")
    value
  }

  def getOptInt(rs: js.ResultSet, column: String): Option[Int] =
    getResultSetIntOption(rs, column: String)

  def getOptionalInt(rs: js.ResultSet, column: String): Option[Int] =
    getResultSetIntOption(rs, column: String)

  @deprecated("Use 'getIntOption' instead", "now")
  def getResultSetIntOption(rs: js.ResultSet, column: String): Option[Int] = {
    // rs.getInt() returns 0 instead of null.
    val value = rs.getInt(column)
    if (rs.wasNull) None
    else Some(value)
  }

  def getBool(rs: js.ResultSet, column: String): Boolean = {
    val value = rs.getBoolean(column)
    dieIf(rs.wasNull, "TyECOLBOLISNL", s"Column boolean value is null: $column")
    value
  }

  def getOptBo(rs: js.ResultSet, column: St): Opt[Bo] = {
    getOptBool(rs, column)
  }

  def getOptBool(rs: js.ResultSet, column: String): Option[Boolean] = {
    // rs.getInt() returns 0 instead of null.
    val value = rs.getBoolean(column)
    if (rs.wasNull) None
    else Some(value)
  }

  /** Converts java.sql.Timestamp to java.util.Date, all in UTC. (If you send a
    * ju.Date to the database, it throws away the fractional seconds value,
    * when saving and loading.)
    */
  def getDate(rs: js.ResultSet, column: String): ju.Date = {
    val timestamp = rs.getTimestamp(column, calendarUtcTimeZone)
    if (timestamp eq null) null: ju.Date
    else new ju.Date(timestamp.getTime)
  }

  def getWhen(rs: js.ResultSet, column: String): When = {
    val timestamp = rs.getTimestamp(column, calendarUtcTimeZone)
    if (timestamp eq null) When.fromMillis(0)
    else When.fromMillis(timestamp.getTime)
  }

  def getWhenMinutes(rs: js.ResultSet, column: String): When = {
    val unixMinutes = rs.getInt(column)
    When.fromMillis(unixMinutes * 60L * 1000)
  }

  def getOptWhenMinutes(rs: js.ResultSet, column: String): Option[When] = {
    val unixMinutes = rs.getInt(column)
    if (rs.wasNull()) None
    else Some(When.fromMillis(unixMinutes * 60L * 1000))
  }

  def getOptionalDate(rs: js.ResultSet, column: String): Option[ju.Date] = {
    val timestamp = rs.getTimestamp(column, calendarUtcTimeZone)
    if (timestamp eq null) None
    else Some(new ju.Date(timestamp.getTime))
  }

  def getOptWhen(rs: js.ResultSet, column: String): Option[When] = {
    getOptionalWhen(rs, column)
  }

  def getOptionalWhen(rs: js.ResultSet, column: String): Option[When] = {
    val timestamp = rs.getTimestamp(column, calendarUtcTimeZone)
    if (timestamp eq null) None
    else Some(When.fromMillis(timestamp.getTime))
  }

  def getOptArrayOfStrings(rs: js.ResultSet, column: String): Option[immutable.Seq[String]] = {
    val sqlArray: js.Array = rs.getArray(column)
    if (sqlArray eq null) return None
    val javaArray = sqlArray.getArray.asInstanceOf[Array[String]]
    Some(javaArray.to[Vector])
  }

  def isUniqueConstrViolation(sqlException: js.SQLException): Boolean = {
    // This status code means "A violation of the constraint imposed
    // by a unique index or a unique constraint occurred".
    sqlException.getSQLState == "23505"
  }

  def uniqueConstrViolatedIs(constraintName: String, sqlException: js.SQLException): Boolean = {
    dieIf(sqlException.getSQLState != "23505", "DwE6EHW0")
    // On the 2nd line, the values of the key violated are included, but they
    // might be user provided so throw them away.
    val firstLine = sqlException.getMessage.takeWhile(_ != '\n')
    firstLine.toLowerCase.contains(s""""${constraintName.toLowerCase}"""")
  }
}


/** The read-write data source must have auto-commit off, and must (or should) use
  * the serializable isolation level.
  */
class Rdb(val readOnlyDataSource: jxs.DataSource, val readWriteDataSource: jxs.DataSource) {

  import Rdb._

  // I don't know how Play Framework has configured the data source.
  // Here's some old docs on how it could be configured, for good performance:
  /*
    // (Oracle docs: -----------
    // Implicit statement & connection cache examples:
    // <http://download.oracle.com/docs/cd/E11882_01/java.112/e16548/
    //                                                stmtcach.htm#CBHBFBAF>
    // <http://download.oracle.com/docs/cd/E11882_01/java.112/e16548/
    //                                                concache.htm#CDEDAIGA>
    // Article: "High-Performance Oracle JDBC Programming"
    // e.g. info on statement caching:
    //  <javacolors.blogspot.com/2010/12/high-performance-oracle-jdbc.html>
    // Batch insert example: (ignores prepared statements though)
    //  <http://www.roseindia.net/jdbc/Jdbc-batch-insert.shtml>
    // -------- end Oracle docs)

    // Related docs:
    // PostgreSQL datasource:
    //  http://jdbc.postgresql.org/documentation/head/ds-ds.html
    //  http://jdbc.postgresql.org/documentation/head/ds-cpds.html
    // API:
    //  http://jdbc.postgresql.org/documentation/publicapi/org/
    //    postgresql/ds/PGPoolingDataSource.html

    // COULD read and implement:
    //   http://postgresql.1045698.n5.nabble.com/
    //      keeping-Connection-alive-td2172330.html
    //   http://www.rosam.se/doc/atsdoc/Server%20-%20Messages%20and%20Codes/
    //      ADC5906BBD514757BAEE546DC6F7A4FA/F183.htm
    //   http://stackoverflow.com/questions/1988570/
    //      how-to-catch-a-specific-exceptions-in-jdbc
    //   http://download.oracle.com/javase/6/docs/api/java/sql/SQLException.html

    // COULD use this nice pool instead:
    //   http://commons.apache.org/dbcp/configuration.html

    // Opening a datasource with the same name as a closed one fails with
    // an error that "DataSource has been closed.", in PostgreSQL.
    // PostgreSQL also doesn't allow one to open > 1 datasource with the
    // same name: "DataSource with name '<whatever>' already exists!"
    val ds = new pg.ds.PGPoolingDataSource()
    ds.setDataSourceName("DebikiPostgreConnCache"+ math.random)
    ds.setServerName(server)
    ds.setPortNumber(port.toInt)
    ds.setDatabaseName(database)
    ds.setUser(user)
    ds.setPassword(password)
    ds.setInitialConnections(2)
    ds.setMaxConnections(10)
    ds.setPrepareThreshold(3)
    //// The PrepareThreshold can also be specified in the connect URL, see:
    //// See http://jdbc.postgresql.org/documentation/head/server-prepare.html
    val pthr = ds.getPrepareThreshold

    //ds.setDefaultAutoCommit(false)
    //ds.setTcpKeepAlive()
    ////ds.setURL(connUrl)  // e.g. "jdbc:postgre//localhost:1521/database-name"
    //ds.setImplicitCachingEnabled(true)  // prepared statement caching
    //ds.setConnectionCachingEnabled(true)
    //ds.setConnectionCacheProperties(props)
  */

  // Test the data sources.
  {
    def testDataSource(dataSource: jxs.DataSource, what: String) {
      val connection: js.Connection =
        try dataSource.getConnection()
        catch {
          case e: Exception =>
            System.err.println(s"Got a broken $what database connection source [EsE8YKG6]")
            throw e
        }
      connection.close()
    }
    testDataSource(readOnlyDataSource, "read-only")
    testDataSource(readWriteDataSource, "read-write")
  }


  def close() {
    // Results in PostgreSQL complaining that "DataSource has been closed",
    // also when you open another one (!) with a different name.
    //dataSource.asInstanceOf[pg.ds.PGPoolingDataSource].close()
  }


  def transaction[T](f: (js.Connection) => T): T = {
    _withConnection(f, commit = true)
  }


  def withConnection[T](f: (js.Connection) => T): T = {
    _withConnection(f, commit = false)
  }


  private def _withConnection[T](f: (js.Connection) => T, commit: Boolean)
        : T = {
    var conn: js.Connection = null
    var committed = false
    try {
      conn = getConnection(readOnly = !commit, mustBeSerializable = true)
      val result = f(conn)
      if (commit) {
        conn.commit()
        committed = true
      }
      result
    } catch {
      case e: Exception =>
        //warn("Error updating database [error DwE83ImQF]: "+  LOG
        //  classNameOf(e) +": "+ e.getMessage.trim)
        throw e
    } finally {
      _closeEtc(conn, rollback = !committed)
    }
  }


  /** If sequential scans are allowed, Postgres sometimes takes whole table locks,
    * when not needed — e.g. when 2 different transactions update 2 different
    * sites (one each). And this can cause serialization failures,  [PGSERZERR]
    * this error text:
    *
    *   ERROR:  could not serialize access due to read/write dependencies among transactions
    *   DETAIL:  Reason code: Canceled on identification as a pivot,
    *            during conflict out checking.
    *   HINT:  The transaction might succeed if retried.
    *
    * Maybe enable_seqscan could be a config value — but when a site is huge, indexes
    * are "always" needed anyway, so, allowing seq scans would just optimize for the
    * case when the database is small? which should be fast enough in any case?
    *
    * See:
    *
    *   """A sequential scan will always necessitate a relation-level predicate lock.
    *     This can result in an increased rate of serialization failures"""
    *   https://www.postgresql.org/docs/current/transaction-iso.html#XACT-SERIALIZABLE
    *
    *   https://stackoverflow.com/q/42288808/694469
    *
    *   https://stackoverflow.com/questions/12837708/
    *        predicate-locking-in-postgresql-9-2-1-with-serializable-isolation
    *
    * This should be combined with retrying failed transactions (not yet
    * implemented) — they have SQLSTATE '40001'.
    *
    *   """[apps that use Serializable isolation level should]  have a generalized way
    *     of handling serialization failures (which always return with a SQLSTATE
    *     value of '40001'), because it will be very hard to predict exactly which
    *     transactions might contribute to the read/write dependencies and need
    *     to be rolled back to prevent serialization anomalies"""
    *   https://www.postgresql.org/docs/current/transaction-iso.html#XACT-SERIALIZABLE
    */
  private def disableSequentialScan(connection: js.Connection): Unit = {
    update("set enable_seqscan = off")(connection)
  }


  def query[T](sql: String, binds: List[AnyRef],
               resultSetHandler: js.ResultSet => T)
              (implicit conn: js.Connection): T = {
    execImpl(sql, binds, resultSetHandler, conn).asInstanceOf[T]
  }


  def queryAtnms[T](sql: String,
                    binds: List[AnyRef],
                    resultSetHandler: js.ResultSet => T): T = {
    execImpl(sql, binds, resultSetHandler, conn = null).asInstanceOf[T]
  }


  /**
   * Returns the number of lines updated, or throws an exception.
   */
  def update(sql: String, binds: List[AnyRef] = Nil)
            (implicit conn: js.Connection): Int = {
    execImpl(sql, binds, null, conn).asInstanceOf[Int]
  }


  def updateAny(sql: String, binds: List[Any] = Nil)
            (implicit conn: js.Connection): Int = {
    update(sql, binds.map(_.asInstanceOf[AnyRef]))(conn)
  }


  /**
   * For calls to stored functions: """{? = call some_function(?, ?, ...) }"""
   */
  def call[A](sql: String, binds: List[AnyRef] = Nil, outParamSqlType: Int,
           resultHandler: (js.CallableStatement) => A)
          (implicit conn: js.Connection): A = {
    callImpl(sql, binds, outParamSqlType, resultHandler, conn)
  }


  private def execImpl(query: String, binds: List[AnyRef],
                resultSetHandler: js.ResultSet => Any,
                conn: js.Connection): Any = {
    val isAutonomous = conn eq null
    var conn2: js.Connection = null
    var pstmt: js.PreparedStatement = null
    var committed = false
    // Nice for verifying if using the cache, only:
    // System.out.println(o"***DB EXEC***: ${query.replaceAll("\n", " ")}")
    try {
      conn2 =
        if (conn ne null) conn
        else getConnection(readOnly = resultSetHandler ne null, mustBeSerializable = true)
      pstmt = conn2.prepareStatement(query)
      _bind(binds, pstmt)
      //s.setPoolable(false)  // don't cache infrequently used statements
      val result: Any = (if (resultSetHandler ne null) {
        val rs = pstmt.executeQuery()
        resultSetHandler(rs)
      } else {
        val updateCount = pstmt.executeUpdate()
        if (isAutonomous) {
          conn2.commit()
          committed = true
        }
        updateCount
      })
      COULD // handle errors, throw exception
      result
    } catch {
      case ex: js.SQLException =>
        //warn("Database error [error DwE83ikrK9]: "+ ex.getMessage.trim) LOG
        //warn("{}: {}", errmsg, ex.printStackTrace)
       throw ex
    } finally {
      if (pstmt ne null) pstmt.close()
      if (isAutonomous) _closeEtc(conn2, rollback = !committed)
    }
  }


  def batchUpdateAny(
        stmt: String, batchValues: List[List[Any]], batchSize: Int = 100)
        (implicit conn: js.Connection): Seq[Array[Int]] = {
    batchUpdate(stmt, batchValues.map(_.map(_.asInstanceOf[AnyRef])), batchSize)
  }


  def batchUpdate(
         stmt: String, batchValues: List[List[AnyRef]], batchSize: Int = 100)
         (implicit conn: js.Connection): Seq[Array[Int]] = {
    assert(batchSize > 0)
    // Nice for verifying if using the cache, only:
    //System.out.println(o"***DB BATCH***: ${stmt.replaceAll("\n", " ")}")
    val isAutonomous = conn eq null
    var conn2: js.Connection = null
    var pstmt: js.PreparedStatement = null
    var result = List[Array[Int]]()
    var committed = false
    try {
      conn2 =
        if (conn ne null) conn
        else getConnection(readOnly = false, mustBeSerializable = true)
      pstmt = conn2.prepareStatement(stmt)
      var rowCount = 0
      for (values <- batchValues) {
        rowCount += 1
        _bind(values, pstmt)
        pstmt.addBatch()
        if (rowCount == batchSize) {
          val updateCounts = pstmt.executeBatch() ; UNTESTED
          result ::= updateCounts
          rowCount = 0
        }
      }
      if (rowCount > 0) {
        val updateCounts = pstmt.executeBatch()
        result ::= updateCounts
      }
      if (isAutonomous) {
        conn2.commit()
        committed = true
      }
      result.reverse
    } catch {
      // A batch update seems to generate chained exceptions. Replace them
      // with one single exception that includes info on all errors
      // (not just the first one).
      case terseEx: java.sql.SQLException =>
        val sb = new StringBuilder()
        var nextEx = terseEx
        do {
          if (terseEx ne nextEx) sb ++= "\nCalled getNextException:\n"
          sb ++= nextEx.toString()
          nextEx = nextEx.getNextException()
        } while (nextEx ne null)
        val verboseEx = new js.SQLException(sb.toString,
              terseEx.getSQLState(), terseEx.getErrorCode())
        verboseEx.setStackTrace(terseEx.getStackTrace)
        throw verboseEx
    } finally {
      if (pstmt ne null) pstmt.close()
      if (isAutonomous) _closeEtc(conn2, rollback = !committed)
    }
  }


  private def callImpl[A](query: String, binds: List[AnyRef],
        outParamSqlType: Int, resultHandler: (js.CallableStatement) => A,
        conn: js.Connection): A = {
    // (Optionally, see my self-answered StackOverflow question:
    //  http://stackoverflow.com/a/15063409/694469 )
    var statement: js.CallableStatement = null
    try {
      statement = conn.prepareCall(query)
      statement.registerOutParameter(1, outParamSqlType)
      _bind(binds, statement, firstBindPos = 2)
      statement.execute()
      resultHandler(statement)
    }
    finally {
     if (statement ne null) statement.close()
    }
  }


  private def _bind(
        values: List[Any], pstmt: js.PreparedStatement, firstBindPos: Int = 1) {
    var bindPos = firstBindPos
    for (v <- values) {
      v match {
        case i: jl.Integer => pstmt.setInt(bindPos, i.intValue)
        case l: jl.Long => pstmt.setLong(bindPos, l.longValue)
        case l: jl.Float => pstmt.setFloat(bindPos, l.floatValue)
        case l: jl.Double => pstmt.setDouble(bindPos, l.doubleValue)
        case b: jl.Boolean => pstmt.setBoolean(bindPos, b.booleanValue)
        case s: String => pstmt.setString(bindPos, s)
        case a: org.postgresql.jdbc.PgArray =>
          pstmt.setArray(bindPos, a)
        case j: play.api.libs.json.JsValue =>
          val jsonObj = new org.postgresql.util.PGobject
          jsonObj.setType("jsonb")
          jsonObj.setValue(j.toString)
          pstmt.setObject(bindPos, jsonObj)
        case t: js.Time =>
          die("DwE96SK3X8", "Use Timestamp not Time")
        case t: js.Timestamp =>
          pstmt.setTimestamp(bindPos, t, calendarUtcTimeZone)
        case d: ju.Date =>
          pstmt.setTimestamp(bindPos, new js.Timestamp(d.getTime), calendarUtcTimeZone)
        case bs: Array[Byte] =>
          pstmt.setBytes(bindPos, bs)
        case Null(sqlType) =>
          pstmt.setNull(bindPos, sqlType)
        case x =>
          die("DwE60KF2F5", "Cannot bind this: "+ classNameOf(x))
      }
      bindPos += 1
    }
  }

  def getConnection(readOnly: Boolean, mustBeSerializable: Boolean): js.Connection = {
    val connection =
          if (readOnly) readOnlyDataSource.getConnection()
          else readWriteDataSource.getConnection()
    disableSequentialScan(connection)
    connection
  }

  def closeConnection(connection: js.Connection) {
    // Already rolled back or committed by the caller.
    _closeEtc(connection, rollback = false)
  }

  private def _closeEtc(conn: js.Connection, rollback: Boolean) {
    // Need to rollback before closing? Read:
    // http://download.oracle.com/javase/6/docs/api/java/sql/Connection.html:
    // "It is strongly recommended that an application explicitly commits
    // or rolls back an active transaction prior to calling the close method.
    // If the close method is called and there is an active transaction,
    // the results are implementation-defined."
    if (conn eq null)
      return

    if (rollback) {
      conn.rollback()
    }

    // Reset defaults.
    conn.setReadOnly(false)
    conn.setAutoCommit(true)
    // Read Committed is the default isolation level in PostgreSQL:
    conn.setTransactionIsolation(js.Connection.TRANSACTION_READ_COMMITTED)

    conn.close()
  }


  def nextSeqNoAnyRef(seqName: String)(implicit conn: js.Connection): AnyRef =
    nextSeqNo(seqName).asInstanceOf[AnyRef]


  def nextSeqNo(seqName: String)(implicit conn: js.Connection): Long = {
    val sno: Long = query("select nextval('"+ seqName +"') N",
          Nil, rs => {
      rs.next
      rs.getLong("N")
    })
    sno
  }
}


