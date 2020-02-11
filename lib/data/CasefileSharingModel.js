'use babel';

import {Model} from '../modelular';
import Actions, {types as AType} from './CasefileSharingActions';
import SharingDispatcher from './CasefileSharingDispatcher';
import { promiseToFetchSharedCasefilesFromRemote, promiseToGetListOfCasefiles } from '../casefile-sharing';

const actionHandlers = {};

class SharingModel extends Model {
  constructor() {
    super();
    this._dispatchToken = SharingDispatcher.register(actionOnModel.bind(this));
  }
  
  getInitialState() {
    return {selectedRemote: 'origin'};
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

action(AType.SET_STATE, (state, action) => action.newState);

action(AType.SET_REMOTE, (state, action) => {
  return Object.assign({}, state, {selectedRemote: action.newRemote});
});

action(AType.FETCH_REMOTE, (state, action) => {
  return promiseToFetchSharedCasefilesFromRemote(state.selectedRemote).then(() => {
    return promiseToGetListOfCasefiles().then((sharedCasefiles) => {
      return Object.assign({}, state, {knownCasefiles: sharedCasefiles});
    });
  }).catch(message => {
    atom.notifications.addError(message, {
      dismissable: true,
      description: "See the console for the logged error."
    });
  }).finally(() => {
    if (action.onDone) {
      action.onDone();
    }
  });
});

export default new SharingModel();
