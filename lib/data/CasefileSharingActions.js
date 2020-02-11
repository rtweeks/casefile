'use babel';

import d from './CasefileSharingDispatcher';

const makeTypes = (...nameLists) => {
  var result = {};
  for (let nameList of nameLists) {
    for (let name of nameList.split(/\s+/)) {
      result[name] = name;
    }
  }
  return result;
}

export const types = makeTypes(
  "SET_STATE SET_REMOTE FETCH_REMOTE"
);

const Actions = {
  setState(newState) {
    d.dispatch({
      type: types.SET_STATE,
      newState
    });
  },
  
  setRemote(newRemote) {
    d.dispatch({
      type: types.SET_REMOTE,
      newRemote
    });
  },
  
  fetchRemote({onDone = null} = {}) {
    d.dispatch({
      type: types.FETCH_REMOTE,
      onDone
    });
  }
};

export default Actions;
