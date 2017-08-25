'use babel';

export default class CasefileView {

  constructor(serializedState) {
    // Create root element
    this.element = document.createElement('div');
    this.element.classList.add('casefile');
    
    // Create a heading
    const heading = document.createElement('h1');
    heading.textContent = 'Add Casefile Bookmark';
    this.element.appendChild(heading);
    
    // Create a line listing
    const codeRef = document.createElement('div');
    this.createTextTemplateIn(
      codeRef,
      "Record mark at line ",
      this.markLineSpan = document.createElement('span'),
      ": ",
      this.markContentSpan = document.createElement('span')
    );
    this.element.appendChild(codeRef);
    this.markContentSpan.classList.add('tagged-code');
    
    // Create a description entry
    const descArea = document.createElement('div');
    this.markDescription = document.createElement('textarea');
    this.markDescription.classList.add('description');
    this.markDescription.setAttribute('placeholder', "Notes about this bookmark...");
    descArea.appendChild(this.markDescription);
    this.element.appendChild(descArea);
    
    // Create an OK/Cancel
    const actions = document.createElement('div');
    actions.classList.add('actions');
    actions.appendChild(this.createButton('Add', () => this.createMark()));
    actions.appendChild(this.createButton('Cancel', () => this.abort("canceled")));
    this.element.appendChild(actions);
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
  
  createTextTemplateIn(parent, ...items) {
    for (let item of items) {
      if (typeof item === 'string') {
        parent.appendChild(document.createTextNode(item));
      } else {
        parent.appendChild(item);
      }
    }
  }
  
  createButton(content, handler) {
    const button = document.createElement('button');
    button.setAttribute('type', 'button');
    if (typeof content === 'string') {
      button.textContent = content;
    } else {
      button.appendChild(content);
    }
    button.onclick = handler;
    return button;
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
