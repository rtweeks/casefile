'use babel';

var elt = function(tag, options={}, ...children) {
  var r = document.createElement(tag);
  for (c of (options.classes || [])) {
    r.classList.add(c);
  }
  for (a in (options.attrs || {})) {
    r.setAttribute(a, options.attrs[a]);
  }
  for (p in (options.props || {})) {
    r[p] = options.props[p];
  }
  for (c of children) {
    if (typeof c === 'string') {
      c = document.createTextNode(c);
    }
    r.appendChild(c);
  }
  return r;
};

var button = function(content, handler) {
  return elt(
    'button',
    {
      attrs: {type: 'button'},
      props: {
        onclick: handler
      },
    },
    content
  );
};

export default class AddBookmarkView {

  constructor() {
    
    // Create root element
    this.element = elt('div', {classes: ['casefile']});
    
    // Create a heading
    this.element.appendChild(elt('h1', {
      props: {textContent: 'Add Casefile Bookmark'}
    }));
    
    // Create a line listing
    this.element.appendChild(elt(
      'div',
      {},
      "Record mark at line ",
      this.markLineSpan = elt('span'),
      ": ",
      this.markContentSpan = elt('span', {classes: ["tagged-code"]})
    ));
    
    // Create a description entry
    this.element.appendChild(elt(
      'div', {},
      this.markDescription = elt('textarea', {
        classes: ['description'],
        attrs: {placeholder: "Notes about this bookmark..."}
      })
    ));
    
    // Create an OK/Cancel
    this.element.appendChild(elt(
      'div', {classes: ['actions']},
      button('Add', () => this.createMark()),
      button('Cancel', () => this.abort("canceled"))
    ));
  }

  // Returns an object that can be retrieved when package is activated
  serialize() {}

  // Tear down any state and detach
  destroy() {
    this.element.remove();
  }

  getElement() {
    return this.element;
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
      notes: this.markDescription.value
    });
  }

}
