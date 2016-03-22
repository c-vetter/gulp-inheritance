'use strict'

var DepGraph = require('dependency-graph').DepGraph

var _ = require('lodash')
var miss = require('mississippi')
var path = require('path')
var through = miss.through.obj

var defaults
var fileCache = {}
var graph = new DepGraph()
var removeDependency = _.curry(_.bind(graph.removeDependency, graph))

//

module.exports = gulpInheritance

//

defaults = {
  includeAll: false,
  extract: null,
  normalizePath: path.resolve,
  originalPaths: false
}

//

/**
 * Accepts and parses all incoming files, builds a dependency graph,
 * and outputs files based on their known dependencies.
 * Useful for ongoing processes, just like gulp-cached or gulp-remember.
 *
 * @param {Object} options
 *
 * @returns {Stream}
 */
function gulpInheritance(options) {
  var config
  var filePaths = []
  var match

  config = _.defaults(options, defaults)

  if (config.extract) {
    if (config.extract instanceof RegExp) {
      match = regexMatcher(config.extract)
    }
    if (config.extract instanceof Function) {
      match = config.extract
    }
  } else {
    throw new Error('needs either a regular expression or a matcher function')
  }

  return through(transform, flush)

  /**
   * Integrates the input file into the dependency graph.
   *
   * @param {File} file
   * @param {string} enc
   * @param {Function} done
   */
  function transform (file, enc, done) {
    var filePath

    if (file && file.contents.length) {
      filePath = config.normalizePath(config.originalPaths ? file.history[0] : file.path)

      graph.addNode(filePath)

      _.each(graph.dependenciesOf(filePath), removeDependency(filePath))

      fileCache[filePath] = file
      filePaths.push(filePath)

      _.each(match(file), function (dependencyPath) {
        dependencyPath = config.normalizePath(path.resolve(
            path.dirname(filePath),
            dependencyPath
        ))

        graph.addNode(dependencyPath)
        graph.addDependency(filePath, dependencyPath)
      })
    }

    done()
  }

  /**
   * Will be called after all incoming files have been processed.
   *
   * @param {Function} done
   */
  function flush (done) {
    var stream = this
    var pushedPaths = []

    _.each(filePaths, function (path) {
      var dependents = graph.dependantsOf(path, !config.includeAll)

      if (pushedPaths.indexOf(path) === -1
      && (config.includeAll || dependents.length === 0)
      ) {
        stream.push(fileCache[path].clone(false))
        pushedPaths.push(path)
      }

      _.each(dependents, function (path) {
        if (pushedPaths.indexOf(path) === -1) {
          stream.push(fileCache[path].clone(false))
          pushedPaths.push(path)
        }
      })
    })

    done()
  }
}

/**
 * Resets the file cache and dependency graph.
 */
function flushInheritanceCache () {
  fileCache = {}
  graph = new DepGraph()
}

gulpInheritance.flushCache = flushInheritanceCache

/**
 * Simple factory function returning a matcher based on the given regular expression.
 *
 * @param {RegExp} regex
 *
 * @returns {Function}
 */
function regexMatcher (regex) {
  return matchRegex

  /**
   * Extracts a list of dependencies based on the regular expression given to the factory.
   *
   * @param {File} file
   *
   * @returns {string[]}
   */
  function matchRegex (file) {
    var dependencies = []
    var match
    var fileString = file.contents.toString('utf8')

    while (match = regex.exec(fileString)) {
      dependencies.push(match[1])
    }

    return dependencies
  }
}
