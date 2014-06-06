/**
 * Elem
 */

module.exports = elem;

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

function elem(root) {
  return new Elem(root);
}

/**
 *
 */

function Elem(root) {
  this.root = root || '.';
  this.converters = require('./converters');
}


Elem.prototype.data = function(data) {
  this.data = data;
}


Elem.prototype.boot = function(opts) {

  return function(req, res, next) {
    function handleBoot() {
      var boot = '<!DOCTYPE html><script src="loader.js"></script><script>elem.start();</script>';
      res.setHeader('Content-Type', 'text/html');
      res.end(boot);
    }
  }
}

/**
 * Express/Connect middleware for serving elements
 */

Elem.prototype.loader = function(opts) {
  var self = this;
  opts = opts || {};

  return function(req,res,next) {
    if(req.path == '/loader.js') {
      if(!opts.production || !this.built) {
        self.build(req.locals);
        this.built = true;
      }

      handleLoader();
    }
    else {
      handleFiles();
    }

    function handleLoader() {
      var fname = path.join(__dirname,'../boot/loader.js')
      fs.readFile(fname, function(err, js) {
        var mode = opts.production ? 'production' : 'development';
        var basepath = path.dirname(req.originalUrl);
        var starter = '\n\nelem.start("'+basepath+'","'+mode+'");\n'

        res.setHeader('Content-Type', 'application/javascript');
        res.end(js+starter);
      });
    }

    function handleFiles() {
      connect.static(self.root)(req, res, next);
    }


  };
}


/**
 * Create an element.json pack from a collection of resources
 */

Elem.prototype.pack = function(files) {
  var result = {};

  files.forEach(function(file) {
    result[file] = ''+fs.readFileSync(this.root+'/'+file);
  },this);

  return JSON.stringify(result);
}



/**
 * Map of source files to last-modified date
 */
var lastModified = {};


/**
 * Check if a source file is outdated
 *
 * @param {String} filei Input file path
 * @returns {Boolean}
 */

Elem.prototype.isOutdated = function(filei) {

  var mtime = fs.statSync(filei).mtime;

  if(''+lastModified[filei] == ''+mtime) {
    return false;
  }

  lastModified[filei] = mtime;

  return true;
}

/**
 * Generate a build file path
 * from a source file path.
 *
 * @param {String} filei Input file path
 * @returns {String} The build file path
 */

Elem.prototype.getBuildPath = function(file) {
  var root = this.root; 

  file = path.normalize(file);

  if(path.basename(file).split('.').length > 2) {
    file = file.split('.').slice(0,-1).join('.');
  }

  file = root + '/_build/' + path.relative(root,file);

  return path.normalize(file);
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

Elem.prototype.buildFile = function(filei, locals) {
  var root = this.root;
  // filei = path.relative(root, filei);

  // If filei is a result, use the source
  if(builtFileMap[filei]) {
    filei = builtFileMap[filei];
  }

  var ext = util.last2ext(filei);
  var converters = this.converters;
  var fileo;

  if(converters[ext]) {
    fileo = this.getBuildPath(filei, true);

    if(!this.isOutdated(filei)) {
      return fileo;
    }

    try {
      // TODO: make async
      var data = fs.readFileSync(filei);

      var output = converters[ext](data, filei, locals);

      var dir = path.dirname(fileo);
      mkdirp.sync(dir);

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

  var stat = fs.statSync(filei)
 
  if(filei && !stat.isDirectory()) {
    fileo = this.getBuildPath(filei, false);

    var linkAbs = path.resolve(fileo);
    var fileAbs = path.resolve(filei);

    var dir = path.dirname(fileo);
    mkdirp.sync(dir);

    var rel = path.relative(dir, fileAbs);

    // console.log(fileo);
    // Remove old link it it already exists
    // if(fs.existsSync(fileo)) {
    //   fs.unlinkSync(fileo);
    // }

    function cp(i,o) {
      var tmp = fs.readFileSync(i);
      fs.writeFileSync(o,tmp);
    }

    cp(filei, fileo);
    // fs.createReadStream(filei).pipe(fs.createWriteStream(fileo));
    // Make new link
    // fs.symlinkSync(rel, fileo);

    builtFileMap[fileo] = filei;
    return fileo;
  }

  // return filei;
}

Elem.prototype.parseComponent = function(fname) {

  var json = JSON.parse(fs.readFileSync(fname));
  var dir = path.dirname(fname);

  var main = json.main || 'index.js';
  var name = json.name;


  main = path.join(dir,main);
  main = path.relative(this.root, main);

  main = '_build/'+main;

  // console.log(main,name);
  // if(fs.fileExists(dir+'/index.json')) {
  // }

  return {
    name: name,
    main: main
  };
}

Elem.prototype.build = function(data) {
  var root = this.root;
  var self = this;
  var glob = require("glob")
  var result = [];
  var modules = {};
  var buildDir = root+'/_build';
  var files = glob.sync(root+"/**");

  if(!this.cleaned) {
    rmdir.sync(buildDir);
    this.cleaned = true;
  }

  files = files.filter(function(fname) {
    if(fname.match(/_build/)) return false;

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
    return self.buildFile(fname, data)
  });

  // Remove empties
  files = files.filter(function(fname) {
    return fname;
  });

  // remove duplicates
  files = files.filter(function(item, i) {
    return files.indexOf(item) == i;
  })

  var relfiles = files.map(function(fname) {
    return path.relative(root, fname);
  });

  relfiles.forEach( function(fname) {
    fname = fname.replace('elements/','');
    if(fname.match(/^_build\/index$/)) return;
    result.push(fname);
  });

  result =result.sort(function(a,b) {
    return b.length < a.length
  });

  var index = {
    files: result,
    modules: modules
  };

  fs.writeFileSync(
    path.join(root,"/_build/index.json"),
    JSON.stringify(index));


  // Build asset packages
  var buildDir = path.join(root,"/_build");
  var dirs = glob.sync(buildDir+"/*");
  dirs.forEach(function(dir) {

    // Remove extensions from matched files
    if(!fs.statSync(dir).isDirectory()) {
      dir = dir.split('.')[0];
    }

    // Sanity check
    if(!dir || dir == buildDir) return;


    // The resulting asset file we are
    // trying to build
    var assetfile = dir + '/assets.json';

    // Remove it if it already exists
    // if(exists(assetfile))
    //   fs.unlinkSync(assetfile);

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

    // Make all paths relative to root
    files = files.map(function(fname) {
      return path.relative(root, fname);
    });

    // Filter out any assets which
    // are not in the index
    files = files.filter(function(fname) {
      return index.files.indexOf(fname) !== -1 
    });

    var json = self.pack(files);
    fs.writeFileSync(dir + '/assets.json', json);
  });
}
