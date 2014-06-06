var path = require('path');

module.exports = {
  last2ext: function(filename) {
    var basename = path.basename(filename);
    var exts = basename.split('.').slice(1);
    if(!exts.length) return;
    return '.'+exts.slice(-2).join('.');
  }
}
