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
  "SET_STATE"
);

const Actions = {
  setState(newState) {
    d.dispatch({
      type: types.SET_STATE,
      newState
    });
  }
};

export default Actions;
