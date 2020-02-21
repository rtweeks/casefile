'use babel';
/** @jsx etch.dom */

import etch from 'etch';
import SelectListView from 'atom-select-list';

export default class ConfirmingEdit {
  /**
    Expected props
    --------------
    className:
      CSS class name(s) to give to the most prominent part of the control
    
    id:
      HTML id attribute for the active part of the control
    
    value:
      Value to place in the field when editing
    
    displayValue:
      Value to show in the field when not editing
    
    disabled:
      Disable action (possibly due to a locked model)
    
    onChange:
      Handler function receiving the confirmed String value
  */
  
  constructor(props) {
    this.props = props;
    etch.initialize(this);
  }
  
  render() {
    const selectList = [];
    if (this.editing) {
      selectList.push(this.renderSelectList());
    }
    return (
      <span className="confirming-editor btn-group" style={{position: 'relative'}}>
        {selectList}
        <button
          className={"btn " + this.props.className}
          attributes={{id: this.props.id}}
          disabled={this.props.disabled}
          on={{click: this.handleEditButtonClick}}
          >
          {this.props.displayValue}
          <span className="icon icon-pencil"></span>
        </button>
      </span>
    );
  }
  
  renderSelectList() {
    return (
      <div className="select-list popover-list" style={{position: 'absolute', 'z-index': 100}}>
        <SelectListView
          ref="editor"
          items={this.props.suggestions || []}
          elementForItem={generateItemElement}
          didChangeQuery={newQuery => this.handleQueryChanged(newQuery)}
          didConfirmSelection={value => this.handleAccepted(value)}
          didConfirmEmptySelection={() => this.handleConfirmEmpty()}
          didCancelSelection={() => this.handleEditCancelled()}
          />
      </div>
    );
  }
  
  handleEditButtonClick() {
    this.setEditing(true).then(() => 
      this.refs.editor.update({
        query: this.props.value,
        selectQuery: true
      })
    ).then(() =>
      this.refs.editor.focus()
    );
  }
  
  handleQueryChanged(newQuery) {
    const view = this.refs.editor;
    view.update({
      errorMessage: newQuery.includes('/') ? "Casefile names may not include '/'" : null
    });
    this.latestQuery = newQuery;
  }
  
  handleAccepted(value) {
    if (this.props.onChange) {
      this.props.onChange(value);
    }
    this.setEditing(false);
  }
  
  handleConfirmEmpty() {
    if ((this.latestQuery || '') !== '') {
      this.handleAccepted(this.latestQuery);
    } else {
      this.handleEditCancelled();
    }
  }
  
  handleEditCancelled() {
    this.setEditing(false);
  }
  
  setEditing(val) {
    this.editing = val;
    return etch.update(this);
  }
  
  update(props) {
    this.props = props;
    etch.update(this);
  }
}

function generateItemElement(item) {
  const li = document.createElement('li');
  li.textContent = item;
  return li;
}
