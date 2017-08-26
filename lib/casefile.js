'use babel';

import AddBookmarkView from './add-bookmark-view';
import CasefileView from './casefile-view';
import { casefileURI } from './pkg-vals';
import { CompositeDisposable } from 'atom';

export default {

  addBmarkView: null,
  modalPanel: null,
  subscriptions: null,
  contents: null,

  activate(state) {
    this.contents = state.contents || [];
    
    this.addBmarkView = new AddBookmarkView();
    this.modalPanel = atom.workspace.addModalPanel({
      item: this.addBmarkView.getElement(),
      visible: false
    });

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    this.subscriptions.add(
      atom.workspace.addOpener(uri => {
        if (uri === casefileURI) {
          return new CasefileView(this.contents);
        }
      }),
      atom.commands.add('atom-workspace', {
        'casefile:open': () => atom.workspace.open(casefileURI)
      }),
      atom.commands.add('atom-workspace', {
        'casefile:add-bookmark': () => this.placeMark()
      })
    );
  },

  deactivate() {
    this.modalPanel.destroy();
    this.subscriptions.dispose();
    this.addBmarkView.destroy();
  },

  serialize() {
    return {contents: this.contents};
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
    
    (this.addBmarkView.proposeMark(line, markText + (markShortened ? "..." : ""))
      .then(userInfo => {
        // TODO: Use a function that consults git for the relationship of the line number to the HEAD
        this.contents.push({
          file: filePath,
          line: line,
          markText: markText,
          notes: userInfo.notes,
          children: []
        });
      })
      .catch(function() {})
      .then(() => this.modalPanel.hide())
      );
    this.modalPanel.show();
    this.addBmarkView.startDialog();
  }

};
