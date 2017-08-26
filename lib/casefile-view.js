'use babel';

import React from 'react';
import ReactDOM from 'react-dom';
import { casefileURI } from './pkg-vals';

class Casefile extends React.Component {
  constructor(props) {
    super(props);
    this.state = {casefile: props.value};
  }
  
  render() {
    return (
      <div>THESE ARE BOOKMARKS!!!</div>
    );
  }
}

export default class CasefileView {
  constructor(state) {
    this.state = state;
    this.element = document.createElement('div');
    this.element.classList.add('casefile-viewer');
    var initialCasefile = state;
    if (typeof initialCasefile === 'undefined') {
      initialCasefile = [];
    }
    const view = <Casefile value={initialCasefile} />;
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
