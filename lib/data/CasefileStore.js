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

function getMarkPath(state, ids) {
  const result = []
  var level = state;
  for (step of ids) {
    let i = level.findIndex((mark) => mark.id === step);
    if (i < 0) {
      return [];
    }
    result.push({index: i, mark: level[i]});
    level = level[i].children;
  }
  return result;
}

action(AType.MOVE_BOOKMARK, (state, action) => {
  var level;
  state = state.slice();
  
  // TODO: Traverse movingMarkPath and newParentPath together
  // so far as the entries are equal, avoiding extra new mark instances.
  
  // Remove moving mark from old parent
  const movingMarkPath = getMarkPath(state, action.itemPath);
  const {index: delIndex, mark: movingMark} = movingMarkPath.pop(); 
  var level = state;
  for (let {index, mark} of movingMarkPath) {
    let newMark = Object.assign({}, mark, {children: mark.children.slice()});
    level[index] = newMark;
    level = newMark.children;
  }
  level.splice(delIndex, 1);
  
  // Insert mark in new parent
  const newParentPath = getMarkPath(state, action.newParentPath);
  var level = state;
  for (let {index, mark} of newParentPath) {
    let newMark = Object.assign({}, mark, {children: mark.children.slice()});
    level[index] = newMark;
    level = newMark.children;
  }
  var insertIndex = level.findIndex((mark) => mark.id === action.beforeItemId);
  if (insertIndex < 0) {
    insertIndex = level.length;
  }
  level.splice(insertIndex, 0, movingMark);
  
  return state;
});

action(AType.DELETE_BOOKMARK, (state, action) => {
  const modPath = getMarkPath(state, action.itemPath);
  if (modPath.length <= 0) {
    return state;
  }
  const {index: delIndex} = modPath.pop();
  
  var level = state = state.slice();
  for (let {index, mark} of modPath) {
    let newMark = Object.assign({}, mark, {children: mark.children.slice()});
    level[index] = newMark;
    level = newMark.children;
  }
  level.splice(delIndex, 1);
  
  return state;
})

export default new CasefileStore();
