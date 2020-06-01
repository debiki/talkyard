
import * as React from 'react';
import * as ReactDOM from 'react-dom';

const r = ReactDOMFactories;
const Modal = rb.Modal;
const ModalHeader = rb.ModalHeader;
const ModalTitle = rb.ModalTitle;
const ModalBody = rb.ModalBody;
const ModalFooter = rb.ModalFooter;


// Migrating to WebPack, temporary code:
//----- "Importing" old namespace debiki2 ---------------------------------
const d2 = debiki2;
const utils = d2.utils;
const Server = d2.Server;
const PrimaryButton = d2.PrimaryButton;
const Button = d2.Button;
const LinkButton = d2.LinkButton;
//--- / "Importing" old namespace debiki2 ---------------------------------



export const BackupPanel = React.createFactory<AdminPanelProps>(
      function(props: AdminPanelProps) {

  // const [formData, setFormData] = React.useState(new FormData());

  return (
      r.div({ className: 's_A_Bkp' },
        rb.Alert({ bsStyle: 'info' },
          r.p({},
            r.b({}, "Experimental!"), " You can ignore all this.")),
        r.p({},
          "Here you can export and import a Talkyard JSON backup (currently " +
          "only text, no images)."),
        r.p({},
          LinkButton({ download: true, className: 'e_DnlBkp', href: '/-/export-site-json' },
            "Download backup"),
          Button({ onClick: openBackupDialog, className: 'e_RstBkp' },
            "Restore backup"))));
});


var importBackupDiagElm;
var setImportBackupDiagOpen;

export function openBackupDialog() {
  if (!importBackupDiagElm) {
    importBackupDiagElm = ReactDOM.render(ImportBackupDiag(), utils.makeMountNode());
  }
  setImportBackupDiagOpen(true);
}


const ImportBackupDiag = React.createFactory(function() {
  const [isOpen, setOpen] =  React.useState(false);
  const [resultJson, setResultJson] =  React.useState<any>(null);
  setImportBackupDiagOpen = setOpen;
  const closeFn = () => setOpen(false);
  const doUpload = (event) => {
    // selectedFile: event.target.files[0],
    //formData.append('file', event.target.files[0]); //this.state.selectedFile)
    Server.uploadFiles('/-/restore-backup-overwrite-site', event.target.files, json => {
      setResultJson(json);
    }, error => {
      // Server.uploadFiles() has shown an error dialog already.
    });
  };

  let title;
  let body;
  let footer;

  if (resultJson) {
    title = "Done restoring backup";
    body =
        ModalBody({},
          r.p({ className: 'e_RstrDne' },
            "Backup restored. Reload this page (hit F5) to see the restored site."),
          r.pre({},
            JSON.stringify(resultJson, null, 2)));
  }
  else {
    title = "Restore backup?";
    body =
        ModalBody({},
        rb.Alert({ bsStyle: 'warning' },
          r.p({},
            r.b({}, "WARNING:"), " This site will get overwritten and destroyed!")),
          r.input({ className: 'e_SelFil', type: 'file', name: 'Choose file ...', onChange: doUpload }));
    footer =
        ModalFooter({},
          PrimaryButton({ onClick: closeFn }, "Cancel"));
  }

  return (
      Modal({ show: isOpen, onHide: closeFn, dialogClassName: 's_RstrBkpD' },
        ModalHeader({}, ModalTitle({}, title)),
        body,
        footer));
});


// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list