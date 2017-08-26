'use babel';

import {ReduceStore} from 'flux/utils';
import Actions, {types as AType} from './CasefileActions';
import CasefileDispatcher from './CasefileDispatcher';

class CasefileStore extends ReduceStore {
  constructor() {
    super(CasefileDispatcher);
  }
  
  getInitialState() {
    return [];
  }
  
  reduce(state, action) {
    return (this[action.type] || this.unknownAction)(state, action);
  }
  
  unknownAction(state, action) {
    return state;
  }
}

const action = (name, handler) => {
  CasefileStore.prototype[name] = handler;
}

action(AType.SET_STATE, (state, action) => {
  return action.newState;
})

action(AType.CLEAR_BOOKMARKS, (state, action) => {
  return [];
})

action(AType.ADD_BOOKMARK, (state, action) => {
  state = state.slice();
  state.push(Object.assign({}, {children: []}, action.markInfo));
  return state;
})

export default new CasefileStore();
