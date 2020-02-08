'use babel';

import {Model} from '../modelular';
import Actions, {types as AType} from './CasefileActions';
import CasefileDispatcher from './CasefileDispatcher';
import nextId from './idgen';

const actionHandlers = {};

class CasefileModel extends Model {
  constructor() {
    super();
    this._dispatchToken = CasefileDispatcher.register(actionOnModel.bind(this));
  }
  
  getInitialState() {
    return [];
  }
  
  unknownAction(state, action) {
    console.log("Unknown action type \"" + action.type + "\" received by CasefileModel");
    return state;
  }
  
  getMarkInfo(itemPath) {
    const markPath = getMarkPath(this._state, itemPath);
    return markPath.slice(-1)[0].mark;
  }
}

/**
 * This function is usually bound to the CasefileModel when called, so `this`
 * is an instance of CasefileModel
 */
function actionOnModel(action) {
  const handler = (actionHandlers[action.type] || this.unknownAction).bind(this);
  const newState = handler(this._state, action);
  this.updateState(newState);
}

const action = (name, handler) => {
  actionHandlers[name] = handler;
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
  for (const step of ids) {
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
  var relPos = action.relativePosition;
  var insertIndex = relPos ? level.findIndex((mark) => mark.id === (relPos.before || relPos.after)) : 0;
  if (relPos && relPos.after) {
    insertIndex++;
  }
  level.splice(insertIndex, 0, movingMark);
  
  return state;
});

action(AType.EDIT_NOTES, (state, action) => {
  
  function update(ancestorPath, marks) {
    var output = marks;
    
    for (let i = 0; i < marks.length; ++i) {
      const mark = marks[i];
      const newChildren = update([...ancestorPath, mark.id], mark.children);
      const markUpdates = {};
      if (mark.id == action.itemId) {
        markUpdates.notes = action.notes;
      }
      if (!Object.is(mark.children, newChildren)) {
        markUpdates.children = newChildren;
      }
      if (Object.keys(markUpdates).length) {
        if (Object.is(output, marks)) {
          output = marks.slice();
        }
        output[i] = Object.assign({}, mark, markUpdates);
      }
    }
    
    return output;
  }
  
  return update([], state);
});

action(AType.PROMOTE_CHILDREN, (state, action) => {
  const modPath = getMarkPath(state, action.itemPath);
  if (modPath.length <= 0) {
    return state;
  }
  const {index: sourceIndex} = modPath.pop();
  
  var level = state = state.slice();
  for (let {index, mark} of modPath) {
    let newMark = Object.assign({}, mark, {children: mark.children.slice()});
    level[index] = newMark;
    level = newMark.children;
  }
  var sourceItem = level[sourceIndex];
  level[sourceIndex] = Object.assign({}, sourceItem, {children: []})
  level.splice(sourceIndex + 1, 0, ...sourceItem.children);
  
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

export default new CasefileModel();
