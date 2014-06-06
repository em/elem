# elem
An insanely fast asset manager/packager for node based on custom HTML elements. You can build your entire frontend on it or incorporate it into your existing app to add some additional structure, speed and stability. 

```
app
  ui
    body
      body.html
    hello
      hello.js
      hello.txt
    components
      visionmedia-page.js
```

*hello.txt*
```
Hello World!
```

*body.html*
```
<a href="/hello">
<hello message="hello.txt"/>
```

*hello.js*
```
var page = require('page');

module.exports = function(files, render) {
  page('/hello', function() {
    render(files.hello.txt);
  });

  page.start();
}
```

## Creating Custom Elements

An element is just a folder who's name is the tag name. Certain sub-folders have [special directives](#special-folders) for loading.

```
ui
  widget
    widget.js
    widget.html.jade
    widget.css.styl
    hello.txt
  window
    jquery.js
```
- Files with extensions like `widget.html.jade` are caught by the pre-processor and become `widget.html`.

- When a `<widget>` appears on the page `elem/loader` will pull down all of the files in the `widget` folder.

- If there is a `widget.html` the element's inner html will be replaced with it.

- If there is a `widget.css` the css will be added to the document.

- If there is a `widget.js` it will be treated like a node module. Here we can export a function that applies the behavior. This function is called for every instance of `<widget>` and passed an object containing all of the file contents of the folder.

*widget.js*:
```
module.exports = function widget(files) {
  $(this).text(files.hello.txt);
}
```

Giving the function two arguments makes it async:

```
module.exports = function widget(files, done) {
  var self = this;

  $.get('/content.txt', function(text) {
    $(self).text(text);
    done();
  });
}
```


## Special Folders
* `*/lib` is recursively pre-loaded before the element is applied. Put anything you want to require() in here so it is available when the element implementation. 

* `*/components` are parsed as installed [components](http://component.io) and can be required globally.

* `*/window` is recursively pre-loaded but executed without a module.exports.

  This is where you would put classic global libraries like jQuery.

  You could also `component install component/jquery` and `require('jquery')`. But jQuery was always designed to extend window. Using it as a module breaks plugins.

  Everything in `window` is run in top-down order of directory depth. So to make jQuery plugins run after jQuery, you can put them in a `window/jquery-plugins/` folder.

## Express/Connect Middleware 

```
var express = require('express');
var elem = require('elem');
var app = express();
var ui = elem(__dirname+'/ui');

app.use('/elements', ui.loader({pack: true}));

// Remove this route and include
// <script src="/elements/loader.js">
// in a template if you don't want to use the bootloader.
app.get('*', ui.boot('/elements'));

app.listen(3000);
```


## Client-side templating

```
component install jade
```

```
widget
  widget.js
  template.js.jade
```

widget.js
```
var jade = require('jade');

module.exports = function(files, done) {
  jade.render(files.template.js, {}, done);
}
```

## Package Management
Elem has has built-in supports for [component](http://github.com/component/component).

```
$ npm install -g component
$ component install visionmedia/page.js
```

*body.js*
```
var page = require('page');
```

You can use libraries from bower or npm if you need to by symlinking:

```
bower install jquery
ln -s bower_components/jquery/dist/jquery.js frontend/window/
```

## Page Layouts

... can be *deleted*. Try making a dynamic \<body\> element instead.

```
- app
  - frontend
    - body
      - body.html.jade
      - body.css.styl
    - header
      - header.html.jade
      - header.css.styl
      - header.js
    - page
      - page.css.styl
      - page.js
    - window
      - jquery.js
```

## Pre-processor
The pre-processor keys off of sequential file extensions.
e.g. any template.html.jade will envoke the .html.jade pre-processor
and result in a static template.html build that is exposed to the element.


The standard pre-processors elem supports are:

- `.html.jade`
- `.css.styl`
- `.css.less`

To add additional pre-processors, or override the built-in ones:

```
frontend.prep('.html.md', function(str, done){
  marked(str, done);
});
```

Note that if you override a built-in pre-processor, it will only apply
to your own elements. Not installed ones.

By supporting these standard pre-processors element authors are able
to use their templating language of choice without incuring a setup
penalty. Since they are just pre-processors so there is no overhead.

If you think there is a pre-processor that should be standard make a pull request.
The only requirement is that it be a well-known standard *format*.

## No Headaches
Elem is built with the premise that your development and debugging workflow can never be impeded by the build process. In development mode, it actually enhances your workflow making it clear what code is responsible for what is happening on the page.

Development Mode:

1. All files are requested independently.
2. File names and line numbers are preserved.
3. CSS is linked to the page, not injected.
4. The final DOM is annotated with HTML comments that indicate how and where the markup was generated.
5. Files are rebuilt on request, and only when they have changed.

## elem(1)
<b>elem(1)</b> is provided as a convenience for developing isolated elements. It is not meant to be a real web server.

```
$ npm install -g elem
```

```
Usage: elem [options] <file ...>

Commands:

  index [options]        build index

Options:

  -h, --help     output usage information
  -V, --version  output the version number
```

```
elem create widget
elem run widget
```

## License

MIT
