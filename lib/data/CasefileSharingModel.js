'use babel';

import {Model} from '../modelular';
import uuidv4 from 'uuid/v4';
import Actions, {types as AType} from './CasefileSharingActions';
import SharingDispatcher from './CasefileSharingDispatcher';
import {
  promiseToFetchSharedCasefilesFromRemote,
  promiseToGetListOfCasefiles,
  promiseToShareCasefile,
  promiseToDeleteCasefilePaths
} from '../casefile-sharing';

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
  this.handleLockingAction(action, handler);
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

action(AType.SET_SHARE_PATH, (state, action) => {
  var path = action.path;
  if (path.indexOf('/') < 0) {
    path = path + '/' + uuidv4();
  }
  return Object.assign({}, state, {sharePath: path});
});

action(AType.SHARE_CASEFILE, (state, action) => {
  return Promise.resolve(action.bookmarks).then(bookmarks => {
    const {selectedRemote: remote, sharePath} = state;
    return promiseToShareCasefile(remote, sharePath, bookmarks);
  }).then(() => {
    // Update state with info on sharePath
    const {sharePath} = state;
    var [group, hash] = sharePath.split('/');
    const newState = Object.assign({}, state);
    let {knownCasefiles} = newState;
    if (!knownCasefiles) {
      newState.knownCasefiles = knownCasefiles = [];
    }
    const groupEntryIndex = knownCasefiles.findIndex(g => g.name === group);
    let groupEntry = newState.knownCasefiles.find((g, gi) => g.name === group);
    if (groupEntryIndex >= 0) {
      let groupEntry = knownCasefiles[groupEntryIndex];
      if (!groupEntry.instances.find(i => i.path === sharePath)) {
        knownCasefiles = newState.knownCasefiles = newState.knownCasefiles.slice();
        groupEntry = knownCasefiles[groupEntryIndex] = Object.assign({}, knownCasefiles[groupEntryIndex]);
        groupEntry.instances = groupEntry.instances.slice();
        groupEntry.instances.push({path: sharePath});
      }
    } else {
      knownCasefiles = newState.knownCasefiles = newState.knownCasefiles.slice();
      knownCasefiles.push({
        name: group,
        instances: [{path: sharePath}]
      });
      knownCasefiles.sort(function(a, b) {
        if (a.name < b.name) {return -1;}
        if (b.name < a.name) {return 1;}
        return 0;
      });
    }
    return newState;
  }).catch(message => {
    atom.notifications.addError(
      message.toString(),
      {
        dismissable: true
      }
    );
    throw message;
  })
});

action(AType.DELETE_CASEFILES, (state, action) => {
  const {paths} = action;
  
  // Get a promise to remove the casefiles
  return promiseToDeleteCasefilePaths(state.selectedRemote, paths).then(() => {
    // Remove casefiles from state.knownCasefiles
    const newKnownCasefiles = state.knownCasefiles.filter(group =>
      !group.instances.every(i => paths.indexOf(i.path) >= 0)
    ).map(group =>
      group.instances.every(i => paths.indexOf(i.path) < 0)
      ? group
      : Object.assign({}, group, {instances: group.instances.filter(i => paths.indexOf(i.path) < 0)})
    );
    return Object.assign({}, state, {knownCasefiles: newKnownCasefiles});
  });
});

export default new SharingModel();
