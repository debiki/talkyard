module.exports = function(config) {
  config.set({
    basePath: '.',
    frameworks: ['dart-unittest'],

    files: [
      'main_test.dart',
      {pattern: '**/*.dart', watched: false, included: false, served: true},
      {pattern: 'packages/browser/dart.js', watched: false, included: true, served: true},
      {pattern: 'packages/browser/interop.js', watched: false, included: true, served: true},
    ],

    autoWatch: false,

    plugins: [
      'karma-dart',
      'karma-chrome-launcher'
    ]
  });
};

