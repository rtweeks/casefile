'use babel';

import { casefileURI } from './pkg-vals';
import BookmarkContainer from './containers/BookmarkContainer'
import { Disposable } from 'atom';

export default class CasefileView {
  constructor(state) {
    this.state = state;
    this.element = document.createElement('casefile-viewer');
    var initialCasefile = state;
    if (typeof initialCasefile === 'undefined') {
      initialCasefile = [];
    }
    const bookmarks = new BookmarkContainer();
    this.element.appendChild(bookmarks.element);
    const cleanup = new Disposable(() => {
      bookmarks.destroy();
    });
    this.dispose = cleanup.dispose.bind(cleanup);
  }
  
  getTitle() {
    return "Casefile";
  }
  
  getURI() {
    return casefileURI;
  }
  
  getDefaultLocation() {
    return 'left';
  }
}
