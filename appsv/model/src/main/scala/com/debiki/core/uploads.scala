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


package com.debiki.core


/** An uploaded file is located at the baseUrlHostAndPath + hashPath,
  * e.g.  some-cdn.com/some/path/0/x/yz/wq...abc.jpg
  * where xyzwq...abc (note: no slashes) is the file's hash (sha-256, base32, truncated
  * to 33 chars). '0/x/yz/wq...abc' is the file's "hash path" — because it's a hash, with
  * slashes inserted so that it's a path — this avoids us placing all files in the exact
  * same directory. Some file system don't want super many files in just one directory.
  * The digit (0 in the example above) indicates the file size, see UploadsDao.sizeKiloBase4.
  *
  * @param baseUrl e.g. '/-/u/'
  * @param hashPath e.g. '1/o/cy/wddssa4xpzugiaego7seuyurxvgef5.jpg'
  */
case class UploadRef(
  // CLEAN_UP remove baseUrl [2KGLCQ4] ?  what did I think? ?? ...
  // Maybe some "weird"? CDNs require serving uploads from "weird" paths instead of /-/u/(site-id)/... ?
  baseUrl: String, hashPath: String) {

  def url: String = baseUrl + hashPath

  // def isApproved: Boolean  [is_upl_ref_aprvd] ?

}


case class UploadInfo(sizeBytes: Int, mimeType: String, numReferences: Int)

