module.exports = function(grunt) {

	require('load-grunt-tasks')(grunt);
	grunt.initConfig({
		less: {
			development: {
				options: {
					paths: ['./scr/css'],
					yuicompress: true
				},
				files: {
					'./src/css/style.css': './src/css/style.less'
				}
			}
		},
		watch: {
			less: {
				files: './src/css/*.less',
				tasks: ['newer:less']
			},
			js: {
				files: ['src/**/*.js', '!src/js/libs/**'],
				tasks: ['newer:jshint']
			}
		},
		'http-server': {
			dev: {
				root: 'src',
				port: 9000,
				host: '127.0.0.1',
				runInBackground: true
			}
		},
		jshint: {
			target: {
				files: {
					src: ['src/**/*.js', '!src/js/libs/**']
				}
			}
		},
		nodewebkit: {
			options: {
				platforms: ['win'],
				buildDir: 'bin'
			},
			src: ['src/**/*']
		}
	});

	grunt.registerTask('default', [
		'http-server',
		'watch'
	]);

	grunt.registerTask('build', [
		'jshint',
		'less',
		'nodewebkit'
	]);
};