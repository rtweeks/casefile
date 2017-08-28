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
  "SET_STATE CLEAR_BOOKMARKS ADD_BOOKMARK MOVE_BOOKMARK DELETE_BOOKMARK"
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
  },
  
  moveBookmark(itemPath, newParentPath, beforeItemId) {
    d.dispatch({
      type: types.MOVE_BOOKMARK,
      itemPath,
      newParentPath,
      beforeItemId
    });
  },
  
  // itemPath is an Array of bookmark IDs
  deleteBookmark(itemPath) {
    d.dispatch({
      type: types.DELETE_BOOKMARK,
      itemPath
    });
  }
}

export default Actions;
