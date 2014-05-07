var page = require('page');

module.exports = function(files, render) {
  page('/hello', function() {
    render(files.hello.txt);
  });

  page.start();
}

