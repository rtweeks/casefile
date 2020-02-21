'use babel';

/**
 * This file provides the basics of a subscribable model.  It is mildly
 * opinionated toward *etch*, but should be usable with any framework.
 */

export class Model {
  constructor() {
    this._viewUpdaters = new Map();
    this._bindCount = 0;
    this._state = this.getInitialState();
    this._locked = false;
  }
  
  /**
   * Override this to return a copy of the state or throw if your model's state
   * is mutable
   */
  getState() {
    return this._state;
  }
  
  /**
   * This method returns a key for use with `unbindView`.  The *view* will be
   * updated by passing a value to its *updateWith* method (defaulting to 
   * `update`); if *propName* is given, this value will be an object with a
   * property named *propName* set to the current content of the model;
   * otherwise the model state itself will be passed.
   *
   * In addition to the model state, the receiving method will get a
   * "model conditions" object, which can specify:
   *   * 'locked':
   *         indicates whether the model is locked against further actions; this
   *         can be used to disable UI elements that would allow the user to
   *         instigate actions that would be refused by the model due to the
   *         ongoing lock.
   */
  bindView(view, propName, updateWith = 'update') {
    const key = "listener_" + (++this._bindCount);
    this._viewUpdaters.set(key, function(state, conditions) {
      try {
        var props = propName ? {[propName]: state} : state;
        view[updateWith](props, conditions);
      } catch (e) {
        console.error("Error from data-bound view update:", e);
      }
    });
    return key;
  }
  
  unbindView(key) {
    this._viewUpdaters.delete(key);
  }
  
  /**
   * This method updates the state to the given newState (or the value of the
   * newState Promise) and then notifies all model consumers.
   */
  updateState(newState) {
    return doStateUpdate.call(this, newState);
  }
  
  /**
   * Override this if there is a better way to compare the current state with
   * a proposed new state.  This definition only works if the state of the model
   * is immutable.
   */
  sameState(otherState) {
    return this._state === otherState;
  }
  
  handleLockingAction(action, handler) {
    if (this.lockingAction) {
      atom.notifications.addError(
        `${action.type} not possible while waiting for ${this.lockingAction}`,
        {
          dismissable: true
        }
      );
      return;
    }
    const lockToken = {toString: function() {return action.type;}};
    this.lockingAction = lockToken;
    let newState = this._state;
    try {
      newState = handler(this._state, action);
    } catch (ex) {
      delete this.lockingAction;
      throw ex;
    }
    this.updateState(newState).finally(() => {
      delete this.lockingAction;
      if (this._locked) {
        doStateUpdate.call(this, this._state, {locked: false});
      }
    });
    
    // If the Promise from updateState does not resolve immediately...
    process.nextTick(() => {
      if (this.lockingAction !== lockToken) return;
      
      // Update state with the lock
      doStateUpdate.call(this, this._state, {locked: true});
    });
  }
}

// private within this module to prevent external manipulation of the "locked"
// property; this function is usually evaluated bound to a Model instance
function doStateUpdate(newState, options = {}) {
  let conditionsChanged = false;
  if ('locked' in options) {
    conditionsChanged = conditionsChanged || (this._locked !== options.locked);
    this._locked = options.locked;
  }
  return Promise.resolve(newState).then(newState => {
    if (conditionsChanged || !this.sameState(newState)) {
      this._state = newState;
      for (const consumer of this._viewUpdaters.values()) {
        consumer(newState, {
          locked: this._locked
        });
      }
    }
  });
}
