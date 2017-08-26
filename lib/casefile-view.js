'use babel';

import React from 'react';
import ReactDOM from 'react-dom';
import { casefileURI } from './pkg-vals';
import BookmarkContainer from './containers/BookmarkContainer'

export default class CasefileView {
  constructor(state) {
    this.state = state;
    this.element = document.createElement('casefile-viewer');
    var initialCasefile = state;
    if (typeof initialCasefile === 'undefined') {
      initialCasefile = [];
    }
    const view = <BookmarkContainer />;
    ReactDOM.render(view, this.element);
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
