gulp-inheritance
================

A [gulp](http://gulpjs.com/) plugin for dependency-resolution. There are several options out there, but none of those that I found were a good fit for my gulp setup. Some work like grunt plugins (i.e. they actually work on the file system), others have distinctly different use-cases.

`gulp-inheritance` does only a few things, and leaves everything else up to you:
+ searches all incoming files for dependency references based on a regular expression or a matcher function, and builds a dependency graph from that information
+ emits files based on that dependency graph

Install
-------

```shell
npm install gulp-inheritance --save-dev
```

Usage
-----
Simple example:
```js
gulp.src('src/styles/**/*.scss')
.pipe(gulpInheritance({extract: /@import '(.+)';/g}))
.pipe(process()) // whatever you want to do with the files
.pipe(gulp.dest('dev'))
```

Complex example:
```js
gulp.src('src/styles/**/*.scss')
.pipe(preProcess())
.pipe(gulpInheritance({
  includeAll: true,
  extract: /@import '(.+)';/mg
  normalizePath: customNormalization,
  originalPaths: true
}))
.pipe(sass())
.pipe(postProcess())
.pipe(gulp.dest('dev'))
```

The two examples above show the plugin's minimum and maximum supported setup.
It should be clear, on account of that simplicity, 
that you can use the plugin for any file format.

The examples apply to SCSS files, but that's just for illustration.
`gulp-inheritance` is intentionally devoid of language-specific knowledge 
in order to keep it lean. You can, of course, 
easily create derivative plugins that contain said knowledge.

### Options

#### extract [required]
This can be either a regular expression (or string) matching the pattern of dependency declaration used, or a function.

+ *Regular Expression*: Should be pretty straight-forward. Just be aware that, should you want to match line delimiters (/^$/), you need the `m` flag. Also, do not forget the `g` flag. The first matching group will be used as dependency path – either relative to the depending file's own path, or absolute.
+ *String*: Will be converted to a regular expression, with global and multiline flags set.
+ *Function*: Will be given the input file as its only argument and must return an array of strings.

#### includeAll [default: false]
+ *True*: All input files and all depending files will be emitted.
+ *False*: Will emit only those files that are no dependencies for any other files.

#### normalizePath [default: path.resolve]
You can give a function for custom path normalization here. E.g. with SCSS imports, you'll want to remove the underscore from partials in order for them to be properly identified.

Applies to both incoming files and their dependencies.

#### originalPaths [default: false]
+ *True*: Use the original file system path for each file.
+ *False*: Use the current, potentially transformed, file path.

This is useful if you perform any transformations on your files' paths 
prior to applying this plugin.

License
-------
ISC
