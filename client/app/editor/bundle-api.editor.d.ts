// Things in editor-bundle.js you can access from outside the bundle.

declare namespace debiki2.editor {

  function getOrCreateEditor(success: (editor: any) => void);
  function startMentionsParserImpl(textarea, onTextEdited);

}

// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
