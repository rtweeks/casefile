'use babel';

import AddBookmarkView from './add-bookmark-view';
import EditBookmarkNotesView from './edit-bookmark-notes-view';
import CasefileView from './casefile-view';
import CasefileSharingView from './casefile-sharing-view.js';
import { beginMarker, endMarker, validFile, readPersisted, relativizePaths } from './persisted';
import { casefileURI, casefileSharingURI } from './pkg-vals';
import Model from './data/CasefileModel';
import SharingModel from './data/CasefileSharingModel';
import Actions from './data/CasefileActions';
import SharingActions from './data/CasefileSharingActions';
import { CompositeDisposable, views as atomViews } from 'atom';
import etch from 'etch';
import jQuery from 'jquery';

// Coordinate etch scheduling with atom (https://github.com/atom/etch/tree/4c50eea107ed210044c66945d5808b352e621481#customizing-the-scheduler)
etch.setScheduler(atomViews);

function *editorLines(editor) {
  for (let i = 0, lines = editor.getLastBufferRow(); i < lines; ++i) {
    yield editor.lineTextForBufferRow(i);
  }
}

export default {

  addBmarkView: null,
  modalAddPanel: null,
  modalEditPanel: null,
  subscriptions: null,
  
  config: {
    toolPath: {
      description: "Path used when invoking external tools",
      type: 'string',
      default: (
        process.platform == 'win32'
        ? 'C:\\Program Files\\Git\\bin;C:\\Program Files (x86)\\Git\\bin;C:\\Program Files\\GnuWin;C:\\Program Files (x86)\\GnuWin'
        : '/usr/bin:/bin:/usr/local/bin'
      )
    }
  },

  activate(state) {
    if (state.contents) {
      Actions.setState(state.contents);
    }
    if (state.sharing) {
      SharingActions.setState(state.sharing);
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

    const Casefile = this;
    this.subscriptions.add(
      atom.workspace.addOpener(uri => {
        if (uri === casefileURI) {
          return new CasefileView();
        }
        if (uri === casefileSharingURI) {
          return new CasefileSharingView();
        }
      }),
      atom.commands.add('atom-workspace', {
        'casefile:share': () => atom.workspace.open(casefileSharingURI),
        'casefile:open': () => atom.workspace.open(casefileURI),
        'casefile:add-bookmark': () => this.placeMark(),
        'casefile:to-text': () => this.openAsText(),
        'casefile:clear-bookmarks': () => window.confirm('Clear all Casefile bookmarks?') && Actions.clearBookmarks()
      }),
      atom.commands.add('casefile-viewer .bookmark-body', {
        'casefile:edit-notes': function (e) {
          Casefile.editMark(jQuery(this).data('markPath'));
        },
        'casefile:move-children-up': function () {
          Casefile.promoteChildren(jQuery(this).data('markPath'));
        }
      }),
      atom.commands.add('atom-text-editor', {
        'casefile:import-bookmarks': () => this.importBookmarks()
      }),
      atom.contextMenu.add({
        'atom-text-editor': [
          {
            label: "Import Casefile Bookmarks",
            command: 'casefile:import-bookmarks',
            visible: false,
            created: function () {Casefile.configureImportMenuItem(this);}
          }
        ]
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
    const data = {};
    const collect = (name, f) => {
      try {
        data[name] = f();
      } catch (ex) {
        console.error("CASEFILE Error while serializing: %o", ex);
      }
    }
    
    collect('contents', () => Model.getState());
    collect('sharing', () => SharingModel.getState());
    
    return data;
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
  },
  
  editMark(itemPath) {
    var {file, line, markText, notes} = Model.getMarkInfo(itemPath);
    (this.editNotesView.activate({file, line, markText}, notes)
      .then(userInfo => {
        Actions.editNotes(itemPath.slice(-1)[0], userInfo.notes);
      })
      .catch(function() {})
      .then(() => {
        this.modalEditPanel.hide();
        atom.workspace.open(casefileURI);
      })
      );
    this.modalEditPanel.show();
    this.editNotesView.startDialog();
  },
  
  openAsText() {
    const contents = Model.getState();
    atom.workspace.open('').then((editor) => {
      function writeMarksAtLevel(indent, marks) {
        const indentStr = new Array(indent + 1).join('  ');
        
        for (mark of marks) {
          const file = atom.project.relativizePath(mark.file)[1];
          editor.insertText("\n");
          var lineRef = file + "@" + mark.line;
          if (mark.peg) {
            lineRef = mark.peg.commit.slice(0, 10) + ":" + file + "@" + mark.peg.line;
          }
          editor.insertText(indentStr + "* [" + lineRef + "] " + mark.markText + "\n");
          if (mark.notes) {
            let noteLines = mark.notes.trimRight("\n").split("\n");
            if (noteLines.length > 0) {
              editor.insertText("\n")
            }
            for (let line of noteLines) {
              editor.insertText(indentStr + "  " + line + "\n");
            }
          }
          
          writeMarksAtLevel(indent + 1, mark.children);
        }
      }
      
      writeMarksAtLevel(0, contents);
      
      editor.insertText('\n');
      editor.insertText(beginMarker + '\n');
      const cfBase64 = btoa(JSON.stringify(relativizePaths(contents))), step = 68;
      for (var ls = 0; ls < cfBase64.length; ls = ls + step) {
        editor.insertText('    ' + cfBase64.slice(ls, ls + step) + '\n');
      }
      editor.insertText(endMarker + '\n');
      
      editor.getCursors()[0].moveToTop();
    });
  },
  
  configureImportMenuItem(menuItem) {
    menuItem.visible = validFile(editorLines(
      atom.workspace.getActiveTextEditor()
    ));
  },
  
  importBookmarks() {
    const editor = atom.workspace.getActiveTextEditor();
    const newBookmarks = readPersisted(editorLines(editor));
    var importName = editor.getURI() || "Untitled import";
    importName = importName.slice(
      importName.lastIndexOf('/') + 1
    );
    Actions.addBookmark(null, null, importName, '', newBookmarks);
  },
  
  promoteChildren(itemPath) {
    if (!window.confirm("Move child bookmarks up one level?")) {
      return;
    }
    
    Actions.promoteChildren(itemPath);
  }
};
