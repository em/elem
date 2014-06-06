This is a very early proof of concept for sharing with friends and getting feedback. Move along.

# elem
An insanely fast asset manager for node based around custom HTML elements. You can build your entire frontend on it or incorporate it into your existing app to add some additional structure, speed and stability. 

```
myapp
  frontend
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

## How it works

1. elem builds a directory of elements, and an index of the build tree. 
   In development mode it efficiently tracks changes and only rebuilds what has changed on request. In production mode it requests compressed elements.json packages with all needed assets.

2. elem/loader runs in the browsers and fetches assets from the build tree in low latency batch requests as elements are used. It maintains a shadow filesystem allowing direct access to files from Javascript.

By keying off of elements, we are able to load entire features in a single requests when they are used. As an added benefit, we also get synchronous node-style `require()`'s in front-end Javascript for free.

## Creating Custom Elements

To make the element `<widget>` we create a folder with some files in it. The folder name is the tag name.

```
frontend
  widget
    widget.js
    widget.html.jade
    widget.css.styl
    hello.txt
  components
```
- Files with extensions like `widget.html.jade` are caught by the pre-processor and become `widget.html`.

- When a `<widget>` appears on the page `elem/loader` will pull down all of the files in the `widget` folder.

- If there is a `widget.html` the element's inner html will be replaced with it.

- If there is a `widget.css` the css will be added to the document.

- If there is a `widget.js` it will be treated like a node module. Here we can export a function that applies the behavior. This function is called for every instance of `<widget>` and passed an object containing all of the file contents of the folder.

*widget.js*:
```
module.exports = function widget(files) {
  this.innerHTML = files.hello.txt;
}
```

Giving the function two arguments makes it async:

```
module.exports = function widget(files, done) {
  var self = this;
  var id = $(this).attr('id');

  $.get('/widgets/'+id, function(data) {
    $('.widget_name', self).text(data.name); 
    done();
  });
}
```

## Express/Connect Middleware 

```
var express = require('express');
var elem = require('elem');
var app = express();
var ui = elem(__dirname+'/ui');

app.use('/elements', ui.loader({pack: true}));

// Include <script src="/elements/loader.js">
// in a template if you don't want to use the bootloader.
app.get('*', ui.boot('/elements'));

app.listen(3000);
```


## Client-side templating

```
npm install jade
ln -s node_modules/jade/jade.js frontend/window/
```

```
widget
  widget.js
  template.jade
window
  jade.js
```

widget.js
```
module.exports = function(files, done) {
  jade.render(files.template.jade, {}, done);
}
```


## Package Management
Elem has has built-in supports for [component](http://github.com/component).

```
$ component install visionmedia/page.js
```

*body.js*
```
var page = require('page');
```

You can use libraries from bower and npm by symlinking:

```
bower install jquery
ln -s bower_components/jquery/dist/jquery.js frontend/window/
```

## The `window` folder

Put all classic libraries that extend `window` 
in here. Such as jQuery and jQuery plugins. These are always loaded first, and they are not given a `module.exports` when they are run.

They are also executed in order of direct depth, and file name length. This means that all you need to do to ensure that jQuery plugins load after jQuery is ensure they are named properly as `jquery.pluginname.js`.

If unruly jQuery plugin authors don't name their plugins
according to convention, you can make a sub-directory i.e. `window/jquery-plugins/`
which will always be loaded after the files directly under
`window`.


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
