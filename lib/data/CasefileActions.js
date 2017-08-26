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
  "SET_STATE CLEAR_BOOKMARKS ADD_BOOKMARK"
);

const Actions = {
  setState(newState) {
    d.dispatch({
      type: types.SET_STATE,
      newState
    });
  },
  
  clearBookmarks() {
    d.dispatch({type: types.CLEAR_BOOKMARKS});
  },
  
  addBookmark(file, line, markText, notes) {
    d.dispatch({
      type: types.ADD_BOOKMARK,
      markInfo: {file, line, markText, notes}
    });
  }
}

export default Actions;
