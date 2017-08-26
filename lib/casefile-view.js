'use babel';

import React from 'react';
import ReactDOM from 'react-dom';
import { casefileURI } from './pkg-vals';

var Bookmark = function(props) {
  const file = atom.project.relativizePath(props.info.file)[1];
  const children = props.info.children.map((childMark) =>
    <Bookmark info={childMark} />
  );
  return (
    <li>
      <div className="line-ref" >{file}:{props.info.line}</div>
      <div className="tagged-code" >{props.info.markText}</div>
      <ul className="child-marks" >{children}</ul>
    </li>
  );
}

class Casefile extends React.Component {
  constructor(props) {
    super(props);
    this.state = {casefile: props.value};
  }
  
  render() {
    const marks = this.state.casefile.map((mark) =>
      <Bookmark info={mark} />
    );
    return (
      <ul>{marks}</ul>
    );
  }
}

export default class CasefileView {
  constructor(state) {
    this.state = state;
    this.element = document.createElement('casefile-viewer');
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
