'use babel';

import Model from './data/CasefileModel';
import jQuery from 'jquery';

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

var button = function(content, handler, options = {}) {
  const {classes} = options;
  return elt(
    'button',
    {
      classes,
      attrs: {type: 'button'},
      props: {
        onclick: handler
      },
    },
    content
  );
};

export default class BookmarkModalView {
  constructor(title, options={}) {
    var newProps;
        
    // Create root element
    this.element = elt('div', {classes: ['casefile']});
    
    // Create a heading
    this.element.appendChild(elt('h1', {
      props: {textContent: title}
    }));
    
    // Create a line listing
    newProps = {};
    options.createDescriptiveText && Object.assign(this,
      options.createDescriptiveText.bind(newProps)(this.element, {elt}) || {});
    Object.assign(this, newProps);
    
    // Create a description entry
    this.element.appendChild(elt(
      'div', {classes: ['native-key-bindings']},
      this.markDescription = elt('textarea', {
        classes: ['description'],
        attrs: {placeholder: "Notes about this bookmark (GitHub-flavored Markdown)..."}
      })
    ));
    
    // Create an Add/Cancel button group
    var addButton, cancelButton;
    this.element.appendChild(elt(
      'div', {classes: ['actions']},
      addButton = button(options.acceptButton[0], () => this[options.acceptButton[1]](), {classes: ['accept']}),
      cancelButton = button('Cancel', () => this.abort("canceled"))
    ));
    
    // Force TAB in the notes textarea to focus the "Add" button
    this.markDescription.addEventListener('keydown', (e) => {
      if (!e.shiftKey && e.keyCode === 9) {
        e.preventDefault();
        addButton.focus();
      }
    });
    
    // Ignore TAB key when cancel button is focued
    cancelButton.addEventListener('keydown', (e) => {
      if (!e.shiftKey && e.keyCode === 9) {
        e.preventDefault();
      }
    });
    
    this._modelBinding = Model.bindView(this, 'bookmarks', '_modelUpdate');
  }

  // Returns an object that can be retrieved when package is activated
  serialize() {}
  
  _modelUpdate(bookmarks, {locked: modelLocked}) {
    // for override
  }
  
  _setActionDisabled(value) {
    jQuery(this.element).find('button.accept').prop({disabled: value});
  }

  // Tear down any state and detach
  destroy() {
    this.element.remove();
    Model.unbindView(this._modelBinding);
  }

  getElement() {
    return this.element;
  }
  
}
