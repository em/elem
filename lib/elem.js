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
var connect = require('connect');
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
function Elem(root, options) {
  if (!(this instanceof Elem)) {
    return new Elem(root, options);
  }

  // Default options
  options = options || {};

  this.root = root || '.';
  this.buildDir = options.buildDir || path.join(this.root, '_build');
  this.converters = require('./converters');
  this.production = options.production;
  this.tagName = options.tagName || path.basename(root);

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
 * with nothing but the loader.js and
 * this elem on it.
 *
 * Example:
 *   var app = Elem('./app');
 *   server.get('*', app.boot());
 */

Elem.prototype.boot = function(opts) {
  if(typeof opts === 'string') {
    opts = {root: opts};
  }

  var src = path.join(opts.root, 'loader.js');

  return function(req, res, next) {
    var boot = '<!DOCTYPE html>\
    <script src="'+src+'"></script>\
    <'+this.tagName+'></'+this.tagName+'>';

    res.setHeader('Content-Type', 'text/html');
    res.end(boot);
  }
}

/**
 * Generate a loader.js
 *
 * @param {String} doman domain
 * @param {String} basepath Base URL that serves _build/
 * @returns {String}
 */
Elem.prototype.generateLoaderJS = function(domain, basepath) {
  var srcfile = path.join(__dirname,'../boot/loader.js')
  var src = ''+fs.readFileSync(srcfile);

  if(this.production) {
    src = uglify.minify(src, {fromString:true}).code;
  }

  var mode = this.production ? 'production' : 'development';

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
  var maxAge = opts.maxAge || 0;

  this.production = !!opts.production;

  self.build();
  this.built = true;

  return function(req,res,next) {
    if(req.path == '/loader.js') {

      // In development mode
      // rebuild every request to loader
      if(!opts.production) {
        self.build(basepath);
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
      connect.static(self.buildDir, {maxAge: maxAge})(req, res, next);
    }
  };
}


/**
 * Create an assets.json pack from a collection of resources
 */

Elem.prototype.pack = function(files) {
  var result = {};

  files.forEach(function(file) {
    result[file] = ''+fs.readFileSync(path.join(this.buildDir, file));
  },this);

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

  this.lastBuild[filei] = mtime;

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
  var root = this.root; 

  file = path.normalize(file);

  if(trimExt && path.basename(file).split('.').length > 2) {
    file = file.split('.').slice(0,-1).join('.');
  }

  file = path.join(this.buildDir, path.relative(root,file));

  return path.normalize(file);
}

/**
 * Keep track of all built files and their associated source
 */

var builtFileMap = {};

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
  var root = this.root;

  var stat = fs.statSync(filei)

  if(!filei || stat.isDirectory())
    return false;

  // If filei is a result, use the source
  if(builtFileMap[filei]) {
    filei = builtFileMap[filei];
  }

  var ext = util.last2ext(filei);
  var converters = this.converters;
  var fileo;

  if(converters[ext]) {
    var trimExt = (ext.split('.').length > 1);
    fileo = this.getBuildPath(filei, trimExt);

    if(!this.isOutdated(filei)) {
      return fileo;
    }

    try {
      // TODO: make async
      var dir = path.dirname(fileo);
      mkdirp.sync(dir);
      var data = fs.readFileSync(filei);

      var output = converters[ext](data, filei);

      fs.writeFileSync(fileo, output);
      console.log('built', fileo);
    }
    catch(e) {
      console.log(e.message);
      throw e;
    }

    builtFileMap[fileo] = filei;
    return fileo;
  }

 
  if(filei && !stat.isDirectory()) {
    fileo = this.getBuildPath(filei, false);

    var linkAbs = path.resolve(fileo);
    var fileAbs = path.resolve(filei);

    var dir = path.dirname(fileo);
    mkdirp.sync(dir);

    var rel = path.relative(dir, fileAbs);

    function cp(i,o) {
      var tmp = fs.readFileSync(i);
      fs.writeFileSync(o,tmp);
    }

    cp(filei, fileo);

    builtFileMap[fileo] = filei;
    return fileo;
  }
}

Elem.prototype.parseComponent = function(fname) {

  var json = JSON.parse(fs.readFileSync(fname));
  var dir = path.dirname(fname);

  var main = json.main || 'index.js';
  var name = json.name;

  main = path.join(dir,main);
  main = path.relative(this.root, main);

  return {
    name: name,
    main: main
  };
}

Elem.prototype.build = function(basepath) {
  var root = this.root;
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
  var files = glob.sync(root+"/**");

  if(this.production && !this.cleaned) {
    rmdir.sync(buildDir);
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
    // i.e. root/body.html
    //      root/body/index.js
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

  
  // Write index.json
  fs.writeFileSync(
    path.join(path.join(this.buildDir, 'index.json')),
    JSON.stringify(index));

  // Write last_build.json
  fs.writeFileSync(this.lastBuildFilename,
    JSON.stringify(this.lastBuild));

  this.buildStaticSiteBootstrap();
}
