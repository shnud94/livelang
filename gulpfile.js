'use strict';

// Sass configuration
var process = require('child_process');
var gulp = require('gulp');
var sass = require('gulp-sass');
var ts = require('gulp-typescript');
var concat = require('gulp-concat');
var sourcemaps = require('gulp-sourcemaps');
var merge = require('merge2');
var run = require('gulp-run');
var electron = require('electron-connect').server.create({
    port: 10235
});
 
var paths = {
    typescript: ['src/**/*.ts', 'src/**/*.tsx', 'typings/**/*.d.ts'],
    sass: ['src/sass/**/*.scss']
}

var tsProject = ts.createProject('tsconfig.json');
 
gulp.task('typescript', function() {
    var tsResult = gulp.src(paths.typescript)
        .pipe(sourcemaps.init())
        .pipe(ts(tsProject));
 
    return merge([ // Merge the two output streams, so this task is finished when the IO of both operations are done. 
        tsResult.dts.pipe(gulp.dest('build/definitions')),
        tsResult.js
            .pipe(sourcemaps.write())
            .pipe(gulp.dest('build'))
    ]);
});

gulp.task('sass', function() {
    gulp.src(paths.sass)
        .pipe(sourcemaps.init())
        .pipe(sass())
        .pipe(concat('style.css'))
        .pipe(sourcemaps.write())
        .pipe(gulp.dest('build/css'))
});

gulp.task('default', ['sass', 'typescript'], function() {
    electron.start();

    gulp.watch(paths.sass, ['sass']);
    gulp.watch(paths.typescript, ['typescript'], electron.restart);

    gulp.watch('build/css/style.css', electron.reload);
    gulp.watch('build/**/*.js', electron.reload);
});