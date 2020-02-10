'use babel';

import {Model} from '../modelular';
// import Actions, {types as AType} from './CasefileSharingActions';
import SharingDispatcher from './CasefileSharingDispatcher';

const actionHandlers = {};

class SharingModel extends Model {
  constructor() {
    super();
    this._dispatchToken = SharingDispatcher.register(actionOnModel.bind(this));
  }
  
  getInitialState() {
    return {};
  }
  
  unknownAction(state, action) {
    console.error("Unknown action type \"" + action.type + "\" received by CasefileSharingModel");
    return state;
  }
}

/**
 * This function is usually bound to the CasefileSharingModel when called, so 
 * `this` is an instance of CasefileSharingModel
 */
function actionOnModel(action) {
  const handler = (actionHandlers[action.type] || this.unknownAction).bind(this);
  const newState = handler(this._state, action);
  this.updateState(newState);
}

const action = (name, handler) => {
  actionHandlers[name] = handler;
};

export default new SharingModel();
