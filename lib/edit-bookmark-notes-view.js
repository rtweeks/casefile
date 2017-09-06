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
}