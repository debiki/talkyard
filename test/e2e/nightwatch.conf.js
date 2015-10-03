module.exports = {
  "src_folders": ["target/e2e-tests/code/"],
  "output_folder": "target/e2e-tests/reports/",

  "custom_commands_path": "test/e2e/custom-commands",
  "custom_assertions_path": "",
  "page_objects_path": "",
  "globals_path": "test/e2e/globals.js",

  "selenium": {
    "start_process": true,
    "server_path": "downloads/selenium-server-standalone.jar",
    "log_path": "target/e2e-tests/",
    "cli_args": {
      "webdriver.chrome.driver": "downloads/chromedriver",
      "webdriver.ie.driver": ""
    }
  },

  "test_settings": {
    "default": {
      "silent": true,
      "screenshots": {
        "enabled": true,
        "path": "target/e2e-tests/screenshots/"
      },
      "desiredCapabilities": {
        "browserName": "chrome",
        "javascriptEnabled": true,
        "acceptSslCerts": true
      }
    },

    "chrome": {
      "desiredCapabilities": {
        "browserName": "chrome",
        "javascriptEnabled": true,
        "acceptSslCerts": true
      }
    },

    "firefox": {
      "desiredCapabilities": {
        "browserName": "firefox",
        "javascriptEnabled": true,
        "acceptSslCerts": true
      }
    },

    "phantomjs": {
      "desiredCapabilities": {
        "browserName": "phantomjs",
        "javascriptEnabled": true,
        "acceptSslCerts": true,
        "phantomjs.binary.path": "./node_modules/phantomjs/bin/phantomjs"
      }
    }
  }
};

// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
