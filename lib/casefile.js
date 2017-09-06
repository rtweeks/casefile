'use babel';

import AddBookmarkView from './add-bookmark-view';
import EditBookmarkNotesView from './edit-bookmark-notes-view';
import CasefileView from './casefile-view';
import { casefileURI } from './pkg-vals';
import Store from './data/CasefileStore';
import Actions from './data/CasefileActions';
import { CompositeDisposable } from 'atom';

export default {

  addBmarkView: null,
  modalAddPanel: null,
  modalEditPanel: null,
  subscriptions: null,

  activate(state) {
    if (state.contents) {
      Actions.setState(state.contents);
    }
    
    this.addBmarkView = new AddBookmarkView();
    this.modalAddPanel = atom.workspace.addModalPanel({
      item: this.addBmarkView.getElement(),
      visible: false
    });
    
    this.editNotesView = new EditBookmarkNotesView();
    this.modalEditPanel = atom.workspace.addModalPanel({
      item: this.editNotesView.getElement(),
      visible: false
    });

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    this.subscriptions.add(
      atom.workspace.addOpener(uri => {
        if (uri === casefileURI) {
          return new CasefileView();
        }
      }),
      atom.commands.add('atom-workspace', {
        'casefile:open': () => atom.workspace.open(casefileURI)
      }),
      atom.commands.add('atom-workspace', {
        'casefile:add-bookmark': () => this.placeMark()
      }),
      atom.commands.add('atom-workspace, casefile-viewer', {
        'casefile:clear-bookmarks': () => Actions.clearBookmarks()
      })
    );
  },

  deactivate() {
    this.modalAddPanel.destroy();
    this.modalEditPanel.destroy();
    this.subscriptions.dispose();
    this.addBmarkView.destroy();
  },

  serialize() {
    return {contents: Store.getState()};
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
        Actions.addBookmark(filePath, line, markText, userInfo.notes);
        if (!atom.workspace.paneContainerForURI(casefileURI)) {
          return atom.workspace.open(casefileURI);
        }
      })
      .catch(function() {})
      .then(() => {
        this.modalAddPanel.hide();
        atom.workspace.paneForItem(editor).activate();
      })
      );
    this.modalAddPanel.show();
    this.addBmarkView.startDialog();
  }

};
