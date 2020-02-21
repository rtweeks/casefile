'use babel';

import BookmarkModalView from './bookmark-modal-view';

export default class EditBookmarkNotesView extends BookmarkModalView {
  
  constructor() {
    super("Edit Casefile Bookmark Notes", {
      createDescriptiveText: function(site, {elt}) {
        site.appendChild(elt(
          'div',
          {},
          "Notes for ",
          this.markLocationSpan = elt('span'),
          ":"
        ));
      },
      acceptButton: ["Save", "saveNotes"]
    })
  }
  
  activate({file, line}, notes) {
    file = atom.project.relativizePath(file)[1];
    this.markLocationSpan.textContent = file.toString() + " at line " + line.toString();
    this.markDescription.value = notes;
    
    return new Promise((resolve, reject) => {
      this.updateMark = resolve;
      this.abort = reject;
    });
  }
  
  startDialog() {
    this.markDescription.focus();
  }
  
  saveNotes() {
    this.updateMark({
      notes: this.markDescription.value.trim()
    });
  }
  
  _modelUpdate(bookmarks, {locked: modelLocked}) {
    this._setActionDisabled(modelLocked);
  }
}