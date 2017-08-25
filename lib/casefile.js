'use babel';

import CasefileView from './casefile-view';
import { CompositeDisposable } from 'atom';

export default {

  casefileView: null,
  modalPanel: null,
  subscriptions: null,

  activate(state) {
    this.casefileView = new CasefileView(state.casefileViewState);
    this.modalPanel = atom.workspace.addModalPanel({
      item: this.casefileView.getElement(),
      visible: false
    });

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'casefile:add-bookmark': () => this.placeMark()
    }));
  },

  deactivate() {
    this.modalPanel.destroy();
    this.subscriptions.dispose();
    this.casefileView.destroy();
  },

  serialize() {
    return {
      casefileViewState: this.casefileView.serialize()
    };
  },
  
  placeMark() {
    var editor = atom.workspace.getActiveTextEditor();
    if (!editor) return;
    
    var filePath = editor.getPath();
    if (!filePath) return;
    
    var line = editor.getCursorBufferPosition().row + 1;
    var markText = editor.getSelectedText(), markShortened = false;
    if (!markText) {
      markText = editor.lineTextForBufferRow(line - 1).trim();
    }
    if (markText.length > 40) {
      markText = markText.slice(0, 37);
      markShortened = true
    }
    
    (this.casefileView.proposeMark(line, markText + (markShortened ? "..." : ""))
      // TODO: .then(function(userInfo) {...}) to save the bookmark (filePath, line, markText, userInfo.notes)
      .catch(function() {})
      .then(() => this.modalPanel.hide())
      );
    this.modalPanel.show();
    this.casefileView.startDialog();
  }

};
