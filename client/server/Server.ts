
module debiki2 {

  export var Server: any = {
    logBrowserError: function(errorMessage: string) {  // rename to logError
      console.error(errorMessage);
    }
  };

}

