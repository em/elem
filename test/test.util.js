var assert = require('assert');
var util = require('../lib/util');

describe('util', function() {
  describe('#last2ext', function() {
    it('returns undefined with none', function() {
      var ext = util.last2ext('hello');
      assert.equal(ext, undefined);
    });
    it('works with 1', function() {
      var ext = util.last2ext('hello.css');
      assert.equal(ext, '.css');
    });

    it('works with 2', function() {
      var ext = util.last2ext('hello.css.styl');
      assert.equal(ext, '.css.styl');
    });

    it('works with > 2', function() {
      var ext = util.last2ext('hello.js.css.styl');
      assert.equal(ext, '.css.styl');
    });


  });
});
