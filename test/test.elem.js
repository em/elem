var assert = require('assert');
var path = require('path');
var elem = require('../');

describe('elem', function() {
  var frontend = elem('./sample');

  describe('middleware', function() {
    it('middlewares', function() {
      // var frontend = elem('./sample');
      // assert.equal(frontend.root, 'poop');
    });
  });

  describe('#getBuildPath', function() {
    it('works with a base', function() {
      var frontend = elem('base');
      var path = frontend.getBuildPath('base/body.html.jade', true);
      assert.equal(path, 'base/_build/body.html');
    });

    it('works without a base', function() {
      var frontend = elem();
      var path = frontend.getBuildPath('body.html.jade', true);
      assert.equal(path, '_build/body.html');
    });

    it('can prune the last extension', function() {
      var frontend = elem('base');
      var path = frontend.getBuildPath('base/body.html.jade', true);
      assert.equal(path, 'base/_build/body.html');
    });

    it('can leave the extension alone', function() {
      var frontend = elem('base');
      var path = frontend.getBuildPath('base/body.html');
      assert.equal(path, 'base/_build/body.html');
    });

    it('normalizes', function() {
      var frontend = elem('base');
      var path = frontend.getBuildPath('base/widget/../body.html');
      assert.equal(path, 'base/_build/body.html');
    });
  });

  describe('#buildFile', function() {
    var sample = path.join(__dirname,'sample');
    var frontend = elem(sample);
  });

});
