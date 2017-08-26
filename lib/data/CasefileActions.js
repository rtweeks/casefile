'use babel';

import d from './CasefileDispatcher';

const makeTypes = (...nameLists) => {
  var result = {};
  for (nameList of nameLists) {
    for (name of nameList.split(/\s+/)) {
      result[name] = name;
    }
  }
  return result;
}

export const types = makeTypes(
  "SET_STATE ADD_BOOKMARK"
);

const Actions = {
  setState(newState) {
    d.dispatch({
      type: types.SET_STATE,
      newState
    });
  },
  
  addBookmark(file, line, markText, notes) {
    d.dispatch({
      type: types.ADD_BOOKMARK,
      markInfo: {file, line, markText, notes}
    });
  }
}

export default Actions;
