var path = require('path');

var util = {};
module.exports = util;


/**
 * Returns <= 2 extensions from the
 * end of a filename.
 *
 * Examples:
 *
 * hello.txt.html.js => .html.js
 * hello.txt.js => .txt.js
 * hello.js => .js
 * hello => undefined
 *
 * @param {String} filename 
 * @returns {String} The extensions
 */

util.last2ext = function(filename) {
  var basename = path.basename(filename);
  var exts = basename.split('.').slice(1);
  if(!exts.length) return;
  return '.'+exts.slice(-2).join('.');
}




