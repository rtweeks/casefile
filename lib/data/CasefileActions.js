'use babel';

import d from './CasefileDispatcher';
import { computePegLine } from '../bookmarks';

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
  "SET_STATE CLEAR_BOOKMARKS ADD_BOOKMARK MOVE_BOOKMARK EDIT_NOTES DELETE_BOOKMARK",
  "PROMOTE_CHILDREN IMPORT_SHARED_FILE"
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
  
  addBookmark(file, line, markText, notes, children=[]) {
    const markInfo = {file, line, markText, notes, children};
    computePegLine(file, line).then(function(peg) {
      if (peg.commit) {
        markInfo.peg = peg;
      }
    }).catch(function() {
    }).then(function() {
      d.dispatch({
        type: types.ADD_BOOKMARK,
        markInfo
      });
    })
  },
  
  moveBookmark(itemPath, newParentPath, relativePosition) {
    d.dispatch({
      type: types.MOVE_BOOKMARK,
      itemPath,
      newParentPath,
      relativePosition
    });
  },
  
  editNotes(itemId, notes) {
    d.dispatch({
      type: types.EDIT_NOTES,
      itemId,
      notes
    });
  },
  
  promoteChildren(itemPath) {
    d.dispatch({
      type: types.PROMOTE_CHILDREN,
      itemPath
    });
  },
  
  // itemPath is an Array of bookmark IDs
  deleteBookmark(itemPath) {
    d.dispatch({
      type: types.DELETE_BOOKMARK,
      itemPath
    });
  },
  
  importSharedFile(name, paths) {
    d.dispatch({
      type: types.IMPORT_SHARED_FILE,
      name,
      paths
    });
  }
}

export default Actions;
