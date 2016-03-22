'use strict'

// dependencies

var _ = require('lodash')
var expect = require('chai').expect
var gulp = require('gulp')
var inheritance = require('./index.js')
var miss = require('mississippi')
var path = require('path')

// helpers

function currentPathOf (file) {
    return path.resolve(file.path)
}

function fixture (filename) {
    return path.resolve('spec-fixtures/', filename)
}

function originalPathOf (file) {
    return path.resolve(file.history[0])
}

function testStreamOutput (test) {
    var files = []

    function consume (file, enc, done) {
        files.push(file)

        done()
    }

    function flush (done) {
        test(files)

        done()
    }

    return miss.to.obj(consume, flush)
}

function toPath (file) {
    return path.resolve(file.path)
}

function sink () {
    return miss.to.obj(function (c, e, done) {done()})
}

function source (glob) {
    return gulp.src('spec-fixtures/' + glob)
}

// the specs

describe('gulpInheritance', function () {
    var config

    beforeEach(function () {
        config = {extract: /^@include\s+(.+)$/mg}
    })

    afterEach(inheritance.flushCache)

    function execute (options) {
        return inheritance(_.defaults(options, config))
    }

    describe('extractor', function () {
        it('is necessary', function () {
            expect(inheritance).to.throw('match')
        })

        it('accepts a regular expression', function () {
            expect(function () {
                inheritance({extract: new RegExp()})
            }).to.not.throw()
        })

        it('accepts a string', function () {
            expect(function () {
                inheritance({extract: new RegExp()})
            }).to.not.throw()
        })

        it('accepts a function', function () {
            expect(function () {
                inheritance({extract: function () {}})
            }).to.not.throw()
        })

        describe('function', function () {
            it('is given the stream\'s input object')
            it('should return null if no dependencies are found')
            it('should return the file path for each dependency found, one per call')
        })
    })

    describe('on first run', function () {
        it('pipes through all files that are not dependencies', function (done) {
            miss.finished(
                source('*')
                .pipe(execute())
                .pipe(testStreamOutput(function (files) {
                    var filePaths = _.map(files, toPath)

                    expect(filePaths).to.have.a.lengthOf(3)
                    .and.to.include(fixture('_hidden-dependency')) // not identified by default
                    .and.to.include(fixture('dependent'))
                    .and.to.include(fixture('independent'))
                }))
            , done)
        })

        describe('given the includeAll flag', function () {
            beforeEach(function () {
                config.includeAll = true
            })

            it('pipes through all files, including dependencies', function (done) {
                miss.finished(
                    source('*')
                    .pipe(execute())
                    .pipe(testStreamOutput(function (files) {
                        var filePaths = _.map(files, toPath)

                        expect(filePaths).to.have.a.lengthOf(4)
                        .and.to.include(fixture('_hidden-dependency'))
                        .and.to.include(fixture('dependency'))
                        .and.to.include(fixture('dependent'))
                        .and.to.include(fixture('independent'))
                    }))
                , done)
            })
        })
    })

    describe('on subsequent run', function () {
        beforeEach(function (done) {
            miss.finished(
                source('*')
                .pipe(execute())
                .pipe(sink())
            , done)
        })

        it('pipes through independent files', function (done) {
            miss.finished(
                source('independent')
                .pipe(execute())
                .pipe(testStreamOutput(function (files) {
                    expect(files).to.have.a.lengthOf(1)

                    expect(currentPathOf(files[0]))
                    .to.equal(fixture('independent'))
                }))
            , done)
        })

        it('emits dependent files, not dependencies', function (done) {
            miss.finished(
                source('dependency')
                .pipe(execute())
                .pipe(testStreamOutput(function (files) {
                    expect(files).to.have.a.lengthOf(1)

                    expect(currentPathOf(files[0]))
                    .to.equal(fixture('dependent'))
                }))
            , done)
        })

        it('emits copies in order to not mutate the originals', function (done) {
            var firstFile
            var secondFile

            miss.finished(
                firstRun(),
                function () {
                    miss.finished(secondRun(), done)
                }
            )

            function firstRun () {
                return source('dependency')
                .pipe(execute())
                .pipe(testStreamOutput(function (files) {
                    firstFile = files[0]
                }))
            }

            function secondRun () {
                return source('dependency')
                .pipe(execute())
                .pipe(testStreamOutput(function (files) {
                    secondFile = files[0]

                    expect(currentPathOf(firstFile))
                    .to.equal(currentPathOf(secondFile))

                    expect(firstFile).to.not.equal(secondFile)
                }))
            }
        })

        describe('given the includeAll flag', function () {
            beforeEach(function () {
                config.includeAll = true
            })

            it('emits both dependent files and dependencies', function (done) {
                miss.finished(
                    source('dependency')
                    .pipe(execute())
                    .pipe(testStreamOutput(function (files) {
                        var filePaths

                        filePaths = _.map(files, toPath)

                        expect(filePaths).to.have.a.lengthOf(2)
                        .and.to.include(fixture('dependency'))
                        .and.to.include(fixture('dependent'))
                    }))
                , done)
            })
        })

        describe('given the originalPaths flag for files with changed paths', function () {
            beforeEach(function () {
                config.originalPaths = true
            })

            function moveVirtualFile () {
                return miss.through.obj(transform)

                function transform (file, enc, done) {
                    file.path = 'some/arbitrary/path'

                    this.push(file)

                    done()
                }
            }

            it('pipes through independent files', function (done) {
                miss.finished(
                    source('independent')
                    .pipe(moveVirtualFile())
                    .pipe(execute())
                    .pipe(testStreamOutput(function (files) {
                        expect(files).to.have.a.lengthOf(1)

                        expect(currentPathOf(files[0]))
                        .to.equal(path.resolve('some/arbitrary/path'))

                        expect(originalPathOf(files[0]))
                        .to.equal(fixture('independent'))
                    }))
                , done)
            })

            it('emits dependent files, not dependencies', function (done) {
                miss.finished(
                    source('dependency')
                    .pipe(moveVirtualFile())
                    .pipe(execute())
                    .pipe(testStreamOutput(function (files) {
                        expect(files).to.have.a.lengthOf(1)

                        expect(originalPathOf(files[0]))
                        .to.equal(fixture('dependent'))
                    }))
                , done)
            })
        })
    })

    describe('given a custom path normalization function', function () {
        beforeEach(function (done) {
            config.normalizePath = function (filePath) {
                return path.basename(filePath).replace(/^_/, '')
            }

            miss.finished(
                source('*')
                .pipe(execute())
                .pipe(sink())
            , done)
        })

        it('finds special files', function (done) {
            miss.finished(
                source('_hidden-dependency')
                .pipe(execute())
                .pipe(testStreamOutput(function (files) {
                    expect(files).to.have.a.lengthOf(1)

                    expect(originalPathOf(files[0]))
                    .to.equal(fixture('dependent'))
                }))
            , done)
        })
    })
})
