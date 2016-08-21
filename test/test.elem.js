var fs = require('fs');
var assert = require('assert');
var expect = require('chai').expect;
var path = require('path');
var Elem = require('../');
var $ = require('jquery');

describe('Elem', function() {
  var sample = null;

  beforeEach(function() {
    sample = Elem(__dirname+'/sample');
    sample.clean();
  });

  describe('constructor', function() {
    it('initializes sourceDir', function() {
      expect(sample.sourceDir).eq(__dirname+'/sample');
    });
    it('defaults buildDir', function() {
      expect(sample.buildDir).eq(__dirname+'/sample/_build');
    });
    it('defaults tagName', function() {
      expect(sample.tagName).eq('sample');
    });
    it('defaults lastBuildFilename', function() {
      expect(sample.lastBuildFilename).eq(__dirname+'/sample/_build/last_build.json');
    });
    it('inits lastBuild using lastBuildFilename', function() {
      sample.build();
      // Re-initialize
      sample = Elem(__dirname+'/sample');
      var json = JSON.parse( fs.readFileSync(__dirname+'/sample/_build/last_build.json') );
      expect(sample.lastBuild).eql(json);
    });
    it('works with 1 string arg', function() {
      var sample = Elem('hello');
      expect(sample.sourceDir).eq('hello');
    });
    it('works with 1 object arg', function() {
      var sample = Elem({sourceDir: 'hello'});
      expect(sample.sourceDir).eq('hello');
    });
    it('works with 2 args', function() {
      var sample = Elem('hello', {tagName: 'yo'});
      expect(sample.sourceDir).eq('hello');
      expect(sample.tagName).eq('yo');
    });
  });

  describe('boot', function() {
    it('returns middleware that boots the root', function() {
      var boot = sample.boot('/sample');
      var header;
      var html;
      var res = {
        setHeader: function (h) {
          header = h;
        },
        end: function(data) {
          html = data;
        }
      };
      boot({}, res);

      expect(html).eq('<!DOCTYPE html><script src="/sample/loader.js"></script><sample></sample>');
    });
  });


  describe('generateLoadeJS', function() {
    it('minifies template boot/loader.js');
    it('adds a starter call with configs');
  });

  describe('buildLoader', function() {
    it('TODO');
  });

  describe('buildStaticSiteBootstrap', function() {
    it('TODO');
  });


  describe('loader', function() {
    it('TODO');
  });

  describe('pack', function() {
    it('combines a list of files into a single name-data map', function() {
      sample.build();
      var data = sample.pack([
        'sample.html'
      ]);

      var parsed = JSON.parse(data);

      expect(parsed).eql({
        'sample.html': '<h1>Sample</h1>\n'
      });
    });
  });

  describe('isOutdated', function() {
    it('returns false if the file has not been modified since the last build', function() {
      sample.build();
      var outdated = sample.isOutdated(__dirname+'/sample/sample.html');
      expect(outdated).eq(false);
    });

    it('returns true if the file has been modified since the last build', function() {
      sample.build();

      var srcfile = __dirname+'/sample/sample.html';

      // Overwrite the file with the same
      // content but should bump the mtime
      var tmp = fs.readFileSync(srcfile);
      fs.writeFileSync(srcfile, tmp);

      var outdated = sample.isOutdated(srcfile);
      expect(outdated).eq(true);
    });
  });

  describe('getBuildPath', function() {
    it('works with a base', function() {
      var sample = Elem('base');
      var path = sample.getBuildPath('base/body.html.jade', true);
      assert.equal(path, 'base/_build/body.html');
    });

    it('works without a base', function() {
      var sample = Elem();
      var path = sample.getBuildPath('body.html.jade', true);
      assert.equal(path, '_build/body.html');
    });

    it('can prune the last extension', function() {
      var sample = Elem('base');
      var path = sample.getBuildPath('base/body.html.jade', true);
      assert.equal(path, 'base/_build/body.html');
    });

    it('leaves singletons alone', function() {
      var sample = Elem('base');
      var path = sample.getBuildPath('base/body.html');
      assert.equal(path, 'base/_build/body.html');
    });

    it('leaves extensionless alone', function() {
      var sample = Elem('base');
      var path = sample.getBuildPath('base/body');
      assert.equal(path, 'base/_build/body');
    });

    it('can handle a path with a . in it', function() {
      var sample = Elem('base');
      var path = sample.getBuildPath('base/poop.js/body.html');
      assert.equal(path, 'base/_build/poop.js/body.html');
    });

    it('normalizes', function() {
      var sample = Elem('base');
      var path = sample.getBuildPath('base/widget/../body.html');
      assert.equal(path, 'base/_build/body.html');
    });
  });

  describe('buildFile', function() {
    it('builds one file' , function() {
      sample.buildFile(__dirname+'/sample/sample.html');
      var data = ''+fs.readFileSync(__dirname+'/sample/_build/sample.html');
      expect(data).eq('<h1>Sample</h1>\n');
    });
  });

  describe('build', function() {
    it('creates _build dir', function() {
      sample.build();
      var exists = fs.existsSync(__dirname+'/sample/_build');
      expect(exists).eq(true);
    });
    it('writes index.json');
    it('writes last_build.json');
  });

  describe('clean', function() {
    it('deletes _build dir', function() {
      sample.build();
      sample.clean();
      var exists = fs.existsSync(__dirname+'/sample/_build');
      expect(exists).eq(false);
    });

    it('empties lastBuild', function() {
      sample.build();
      sample.clean();
      expect(sample.lastBuild).eql({});
    });
  });

  describe('simulate', function() {
    it('runs an element with jsdom', function() {
      sample.build();
      var domnode = sample.simulate();
      expect(domnode.hello).eq('hello');
    });
    it('returns top dom element in provided html', function() {
      sample.build();
      var domnode = sample.simulate('<blah></blah>');
      expect(domnode.tagName).eq('BLAH');
    });
  });

  describe('<wrapper>', function() {
    it('wraps innerHTML in <span>', function() {
      sample.build();
      var domnode = sample.simulate('<wrapper>hello</wrapper>');

      console.log(domnode.outerHTML);
    });

    it('does not enhance detached subelements', function() {
      /**
       * <wrapper> does a render(html) which replaces
       * all of the old innerHTML. This tests that we
       * do not enhance any of the removed elements.
       */
      sample.build();
      var domnode = sample.simulate('<wrapper><wrapper>hello</wrapper></wrapper>', {count: 0});
      var window = domnode.ownerDocument.defaultView;
      expect(window.count).eq(2);
    });
  });
});
