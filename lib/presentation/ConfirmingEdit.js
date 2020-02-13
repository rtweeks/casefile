'use babel';
/** @jsx etch.dom */

import etch from 'etch';

export default class ConfirmingEdit {
  /**
    Expected props
    --------------
    value:
      Value to place in the field when editing
    
    displayValue:
      Value to show in the field when not editing
    
    onChange:
      Handler function receiving the confirmed String value
  */
  
  constructor(props) {
    this.props = props;
    etch.initialize(this);
  }
  
  render() {
    return (
      <span className="confirming-editor btn-group">
        <button className={"btn " + this.props.className}>
          {this.props.displayValue}
          <span className="icon icon-pencil"></span>
        </button>
      </span>
    );
  }
  
  renderDisplay() {
    return [
      <input
        attributes={{type: 'text', disabled: true, id: this.props.id}}
        className={this.props.className}
        value={this.props.displayValue}
        />,
      <button className="icon icon-pencil"></button>
    ];
  }
  
  update(props) {
    this.props = props;
    etch.update(this);
  }
}