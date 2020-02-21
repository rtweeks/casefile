'use babel';
/** @jsx etch.dom */

import etch from 'etch';
import CasefileSharing from '../presentation/CasefileSharing';
import Model from '../data/CasefileSharingModel';

export default class CasefileSharingContainer {
  constructor(props) {
    this.props = Object.assign({state: Model.getState()}, props);
    
    // Bind to store
    this._modelBinding = Model.bindView(this, 'state', "_modelUpdate");
    
    etch.initialize(this);
  }
  
  render() {
    return <CasefileSharing {...this.props} />;
  }
  
  update(props) {
    this.props = props;
    return etch.update(this);
  }
  
  _modelUpdate(model, {locked: modelLocked}) {
    this.update(Object.assign(
      {},
      this.props,
      model,
      {modelLocked}
    ));
  }
  
  async destroy() {
    await etch.destroy(this);
    Model.unbindView(this._modelBinding);
  }
}
