'use babel';

import BookmarkModalView from './bookmark-modal-view';

export default class AddBookmarkView extends BookmarkModalView {

  constructor() {
    super("Add Casefile Bookmark", {
      createDescriptiveText: function(site, {elt}) {
        site.appendChild(elt(
          'div',
          {},
          "Record mark at line ",
          this.markLineSpan = elt('span'),
          ": ",
          this.markContentSpan = elt('span', {classes: ["tagged-code"]})
        ));
      },
      acceptButton: ["Add", "createMark"]
    });
  }

  proposeMark(line, text) {
    this.markLine = line;
    this.markLineSpan.textContent = line.toString();
    
    this.markContent = text;
    this.markContentSpan.textContent = text.toString();
    
    var view = this;
    return new Promise(function(resolve, reject) {
      view.addMark = resolve;
      view.abort = reject;
    });
  }
  
  startDialog() {
    this.markDescription.value = "";
    this.markDescription.focus();
  }
  
  createMark() {
    this.addMark({
      notes: this.markDescription.value.trim()
    });
  }
  
  _modelUpdate(bookmarks, {locked: modelLocked}) {
    this._setActionDisabled(modelLocked);
  }
}
