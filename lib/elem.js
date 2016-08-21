/**
 * Elem
 */

module.exports = Elem;

var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var rmdir = require('rimraf');
var basename = path.basename;
var dirname = path.dirname;
var resolve = path.resolve;
var exists = fs.existsSync || path.existsSync;
var serveStatic = require('serve-static')
var util = require('./util');
var uglify = require('uglify-js');
var glob = require('glob');


/**
 * Autoloaded file extensions
 */
var autoload = ['.css', '.html', '.js'];

/**
 * Elem
 */
function Elem(sourceDir, options) {
  if (!(this instanceof Elem)) {
    return new Elem(sourceDir, options);
  }

  // Default options
  options = options || {};

  // Allow either Elem(opts) or Elem(src,opts)
  if (typeof sourceDir === 'object') {
    options = sourceDir;
  }
  else {
    options.sourceDir = sourceDir;
  }

  this.sourceDir = options.sourceDir || '.';
  this.buildDir = options.buildDir || path.join(this.sourceDir, '_build');
  this.converters = require('./converters');
  this.production = options.production;
  this.tagName = options.tagName || path.basename(this.sourceDir);

  /**
   * Information about the last build, per source file.
   *
   * Particularly, the last-modified file of the source file
   * at the time we last built it.
   *
   * This allows us to determine if the source needs to be
   * rebuilt by checking if the last-modified is different.
   */
  this.lastBuild = {};

  
  /**
   * A filename for persisting lastBuild to disk.
   */
  this.lastBuildFilename = path.join(this.buildDir + "/last_build.json");

  /**
   * Try to load lastBuild from disk.
   */
  try {
    this.lastBuild = JSON.parse( fs.readFileSync( this.lastBuildFilename ) );
  } catch (e) {
    if (e.code !== 'ENOENT') {
      throw e;
    }
    this.lastBuild = {};
  }

}

/**
 * Middleware that returns an empty page
 * with nothing but the loader.js and an
 * the elem on it.
 *
 * Example:
 *   var app = Elem('./app');
 *   server.use('/app', app.loader());
 *   server.get('*', app.boot('/app'));
 *
 *   @param {String} elemuri The URI of the elem to boot
 */

Elem.prototype.boot = function(elemuri) {
  var self = this;
  var src = path.join(elemuri, 'loader.js');

  return function(req, res, next) {
    var html = '<!DOCTYPE html><script src="'+src+'"></script><'+self.tagName+'></'+self.tagName+'>';

    res.setHeader('Content-Type', 'text/html');
    res.end(html);
  }
}

/**
 * Generate a loader.js
 *
 * @param {String} doman domain
 * @param {String} basepath Base URL that serves _build/
 * @returns {String}
 */
Elem.prototype.generateLoaderJS = function(domain, basepath, mode) {
  var srcfile = path.join(__dirname,'../boot/loader.js')
  var src = ''+fs.readFileSync(srcfile);

  if(this.production) {
    src = uglify.minify(src, {fromString:true}).code;
  }

  mode = mode || (this.production ? 'production' : 'development');

  basepath = basepath || '/';

  var starter = '\n\nelem.start("'+domain+'","'+basepath+'","'+mode+'",'+JSON.stringify(this.index)+');\n';

  src += starter;

  return src;
}

/**
 * Generate and write loader.js 
 */
Elem.prototype.buildLoader = function(domain, basepath) {
  src = this.generateLoaderJS(domain, basepath)
  out = path.join(this.buildDir, 'loader.js');
  fs.writeFileSync(out, src);
}

/**
 * Generates a simple index.html 
 * so elem can be used as a static site generator.
 *
 * Every build gets this put in for convenience.
 */
Elem.prototype.buildStaticSiteBootstrap = function(basepath) {
  var src, out;

  // index.html
  src = '<!DOCTYPE HTML><script src="/loader.js"></script>'
  out = path.join(this.buildDir, 'index.html');
  fs.writeFileSync(out, src);
}


/**
 * Middleware for serving elements
 */

Elem.prototype.loader = function(opts) {
  var self = this;
  opts = opts || {};

  this.production = !!opts.production;

  self.build();
  this.built = true;

  return function(req,res,next) {
    if(req.path == '/loader.js') {

      // In development mode
      // rebuild every request to loader
      if(!opts.production) {
        self.build();
        this.loaderValid = false;
      }

      if(!this.loaderValid) {
        var domain = opts.domain ? opts.domain : req.protocol + '://' + req.get('host');
        var basepath = path.dirname(req.originalUrl);
        self.buildLoader(domain, basepath);
        this.loaderValid = true;
      }
    }

    handleFiles();

    function handleFiles() {
      serveStatic(self.buildDir)(req, res, next);
    }
  };
}

/**
 * Create an assets.json pack from a collection of built files
 *
 * @param {Array} files (relative t
 * o buildDir)
 */

Elem.prototype.pack = function(files) {
  var result = {};

  files.forEach(function(file) {
    result[file] = ''+fs.readFileSync(path.join(this.buildDir, file));
  }, this);

  return JSON.stringify(result);
}

/**
 * Check if a source file is outdated
 *
 * @param {String} filei Input file path
 * @returns {Boolean}
 */

Elem.prototype.isOutdated = function(filei) {

  var mtime = ''+fs.statSync(filei).mtime;

  if(this.lastBuild[filei] == mtime) {
    return false;
  }


  return true;
}


/**
 * Add a pre-processor to the build process
 * for a particular set of double file extensions.
 *
 * @param {String} exts ".to.from" extension matcher
 */

Elem.prototype.prep = function(exts, fn) {
  this.converters[exts] = fn;
}


/**
 * Generate a build path
 * from a source file path.
 *
 * Examples:
 * a/b.js.html
 * _build/a/b.js
 *
 * @param {String} filei Input file path
 * @returns {String} The build file path
 */

Elem.prototype.getBuildPath = function(file, trimExt) {
  var sourceDir = this.sourceDir; 

  file = path.normalize(file);

  if(trimExt && path.basename(file).split('.').length > 2) {
    file = file.split('.').slice(0,-1).join('.');
  }

  file = path.join(this.buildDir, path.relative(sourceDir,file));

  return path.normalize(file);
}

/**
 * Check if a file is outdated and rebuild it.
 *
 * It first attempts to convert anything
 * that has a converter. Otherwise it creates a
 * symlink to the original.
 *
 * Only rebuilds when the source has been modified
 * since the last file it was built.
 *
 * @param {String} filei Input file path
 * @returns {String} The built file or symlink path
 */

Elem.prototype.buildFile = function(filei) {
  var sourceDir = this.sourceDir;

  var stat = fs.statSync(filei)

  if(!filei || stat.isDirectory())
    return false;

  // Extract preprocessor directive from file extensions
  var ext = util.last2ext(filei);

  // Find converter for extension
  var converter = this.converters[ext];

  // Get build path, trim extension if converter available
  var fileo = this.getBuildPath(filei, !!converter);

  // If not outdated do nothing
  if(!this.isOutdated(filei)) {
    return fileo;
  }

  // Ensure dirs exist
  var dir = path.dirname(fileo);
  mkdirp.sync(dir);

  // Read in data from source
  var data = fs.readFileSync(filei);

  // If converter, apply it to data
  if (converter) {
    data = converter.call(this, data, filei);
  }

  // Write the output
  fs.writeFileSync(fileo, data);

  // Remember the last-modify-time associated with this build
  var mtime = ''+fs.statSync(filei).mtime;
  this.lastBuild[filei] = mtime;

  console.log('built', path.relative(this.buildDir, fileo));

  return fileo;
}

Elem.prototype.parseComponent = function(fname) {

  var json = JSON.parse(fs.readFileSync(fname));
  var dir = path.dirname(fname);

  var main = json.main || 'index.js';
  var name = json.name;

  main = path.join(dir,main);
  main = path.relative(this.sourceDir, main);

  return {
    name: name,
    main: main
  };
}

/**
 * Deletes the build dir
 */
Elem.prototype.clean = function() {
  rmdir.sync(this.buildDir);
}


/**
 * Builds everything
 */
Elem.prototype.build = function() {
  var sourceDir = this.sourceDir;
  var self = this;

  // Only build once in production mode.
  if (this.production && fs.existsSync(this.lastBuildFilename) ) {
    console.log('Existing elem build detected. Using it.');
    return;
  }
  
  var result = [];
  var modules = {};
  var buildDir = this.buildDir;

  // Recursively find all files
  var files = glob.sync(sourceDir+"/**");

  if(this.production && !this.cleaned) {
    this.clean();
    this.cleaned = true;
  }

  // Filter out files we don't want
  // 1. Directories
  // 2. Anything that begins with `_` or '.'
  // 3. Anything empty
  files = files.filter(function(fname) {
    if(fname.match(/\/_/)) return false;

    if(!fname.trim()) return false;

    if(fs.statSync(fname).isDirectory()) {
      return false;
    }

    return true;
  });


  files = files.filter(function(fname) {
    // If a component.json file
    if(fname.match(/component\.json$/)) {
      // If within a components/ folder
      if(fname.match(/components\//)) {
        var component = self.parseComponent(fname);
        modules[component.name] = component.main;
      }

      // Never serve component.json
      return false;
    }

    return true;
  });
  
  files = files.map( function(fname) {
    return self.buildFile(fname)
  });


  // Remove any non-autoload extention
  files = files.filter( function(fname) {
    var ext = path.extname(fname);
    return autoload.indexOf(ext) != -1;
  });

  // Remove empties
  files = files.filter(function(fname) {
    return fname;
  });

  // Remove duplicates
  files = files.filter(function(item, i) {
    return files.indexOf(item) == i;
  })

  // Convert to relative paths
  files = files.map(function(fname) {
    return path.relative(self.buildDir, fname);
  });

  // Sort lexicographically
  files = files.sort(function(a,b) {
    return a.localeCompare(b);
  });

  var index = {
    files: files,
    modules: modules,
    packages: {}
  };


  if(this.production) {
    // Build asset packages
    var dir = this.buildDir;

    if(!dir) return;

    // The resulting asset file we are
    // trying to build
    var assetfile = dir + '/assets.json';

    mkdirp.sync(dir);

    // Find all files under this directory
    // AND any files w/ the directory name.
    // i.e. sourceDir/body.html
    //      sourceDir/body/index.js
    var files = glob.sync(dir+"{/**,*}")
    files = files.filter(function(f) {
      if(fs.statSync(f).isDirectory()) {
        return false;

      }
      return true;
    });

    // Make all paths relative to _build
    files = files.map(function(fname) {
      return path.relative(self.buildDir, fname);
    });

    // Filter out any assets which
    // are not in the index
    files = files.filter(function(fname) {
      return index.files.indexOf(fname) !== -1 
    });

    var json = self.pack(files);
    fs.writeFileSync(assetfile, json);

    var relassetfile = path.relative(self.buildDir, assetfile);

    index.files.push(relassetfile);

    files.forEach(function(fname) {
      index.packages[fname] = relassetfile;
    });
  }


  this.index = index;

  // Ensure buildDir exists
  mkdirp.sync(this.buildDir);

  // Write index.json
  fs.writeFileSync(
    path.join(this.buildDir, 'index.json'),
    JSON.stringify(index));

  // Write last_build.json
  fs.writeFileSync(this.lastBuildFilename,
    JSON.stringify(this.lastBuild));

  this.buildStaticSiteBootstrap();
}

/**
 * Simulate using JSDOM
 */
Elem.prototype.simulate = function(html, globals) {
  var self = this;
  var result = {};
  var jsdom = require('jsdom');
  // var loader = require('../boot/loader');

  html = html || '<!DOCTYPE html><'+self.tagName+'></'+self.tagName+'>';

  var js = this.generateLoaderJS(null, this.buildDir, 'test');


  var doc = jsdom.jsdom(html);
  var el = doc.getElementsByTagName(self.tagName)[0]
  var window = doc.defaultView;
  window.nodeRequire = require;
  window.env = 'test'
  window.console = console;

  for (var k in globals) {
    window[k] = globals[k];
  }

  var vm = require('vm');
  var script = new vm.Script(js);

  jsdom.evalVMScript(window, script);

  return el;
}
