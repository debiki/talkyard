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
  * e.g.  some-cdn.com/some/path/x/y/zwq...abc.jpg
  * where xyzwq...abc (note: no slashes) is the file's hash (sha-256, base32, truncated
  * to 33 chars). 'x/y/zwq...abc' is the file's "hash path" — because it's a hash, with
  * slashes inserted so that it's a path — this avoids us placing all files in the exact
  * same directory. Some file system don't want super many files in just one directory.
  */
case class UploadRef(baseUrl: String, hashPath: String) {

  def url = baseUrl + hashPath

}


case class UploadInfo(sizeBytes: Int, mimeType: String, numReferences: Int)

