'use babel';

import {ReduceStore} from 'flux/utils';
import Actions, {types as AType} from './CasefileActions';
import CasefileDispatcher from './CasefileDispatcher';
import nextId from './idgen';

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
    console.log("Unknown action type \"" + action.type + "\" received by CasefileStore");
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
  state.push(Object.assign({}, {children: []}, action.markInfo, {id: nextId()}));
  return state;
})

action(AType.DELETE_BOOKMARK, (state, action) => {
  const itemPath = action.itemPath.slice();
  const delId = itemPath.pop(), modPath = [];
  var level;
  
  level = state;
  for (step of itemPath) {
    let i = level.findIndex((mark) => mark.id === step);
    if (i < 0) {
      return state;
    }
    modPath.push({index: i, mark: level[i]});
    level = level[i].children;
  }
  const delIndex = level.findIndex((mark) => mark.id === delId);
  if (delIndex < 0) {
    return state;
  }
  
  state = level = state.slice();
  for (let {index, mark} of modPath) {
    let newMark = Object.assign({}, mark, {children: mark.children.slice()});
    level[index] = newMark;
    level = newMark.children;
  }
  level.splice(delIndex, 1);
  
  return state;
})

export default new CasefileStore();
