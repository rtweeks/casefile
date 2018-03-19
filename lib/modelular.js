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
   */
  bindView(view, propName, updateWith) {
    const key = "listener_" + (++this._bindCount);
    updateWith = updateWith || 'update';
    this._viewUpdaters.set(key, function(state) {
      try {
        var props = propName ? {[propName]: state} : state;
        view[updateWith](props);
      } catch (e) {
        console.error("Error from data-bound view update:", e);
      }
    });
    return key;
  }
  
  unbindView(key) {
    this._viewUpdaters.delete(key);
  }
  
  updateState(newState) {
    if (!this.sameState(newState)) {
      this._state = newState;
      for (const consumer of this._viewUpdaters.values()) {
        consumer(newState);
      }
    }
  }
  
  /**
   * Override this if there is a better way to compare the current state with
   * a proposed new state.  This definition only works if the state of the model
   * is immutable.
   */
  sameState(otherState) {
    return this._state === otherState;
  }
}
