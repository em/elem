module.exports = {
  '.html.jade': function(source,file) {
    var jade = require('jade');
    return jade.render(''+source);
  }
, '.js.jade': function(source, file, locals) {
    var jade = require('jade');

    try {
      var js = ''+jade.compileClient(source);
    }
    catch(e) {
      console.error("error rendering " + file);
      console.error(e.message);
      var js = 'function(){console.error("'+e.message+'");}';
    }

    return '\
      var jade = require("jade"); \n\
      module.exports='+js+';';
  }
, '.css.styl': function(source, file) {
    var stylus = require('stylus');
    var nib = require('nib');

    return stylus(''+source)
      .set('filename', file)
      .set('compress', true)
      .use(nib()).render();
  }
// , '.js': function(source,file) {
//     var uglify = require("uglify-js");
//     return uglify.minify(file).code;
//   }
};



  // TEMPORARY!

