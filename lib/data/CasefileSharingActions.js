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
  "SET_STATE SET_REMOTE FETCH_REMOTE SET_SHARE_PATH SHARE_CASEFILE DELETE_CASEFILES"
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
  },
  
  // path may be a <share-name> (no slashes) or <share-name>/<instance>; if
  // no <instance> part is given, an new hash will be derived, probably
  // sharing as a new instance in a group.
  setSharePath(path) {
    d.dispatch({
      type: types.SET_SHARE_PATH,
      path
    });
  },
  
  // bookmarks may be a Promise
  shareCasefile(bookmarks) {
    d.dispatch({
      type: types.SHARE_CASEFILE,
      bookmarks
    });
  },
  
  deleteCasefiles(paths) {
    d.dispatch({
      type: types.DELETE_CASEFILES,
      paths
    });
  }
};

export default Actions;
