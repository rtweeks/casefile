'use babel';

import etch from 'etch';

/**
 * Convert a single, purely functional `render` function into an Etch component
 *
 * *pureRender* may accept *props* and *children*.  They are accepted and
 * stored in both the constructor and `update` and provided to the passed
 * *pureRender* function for rendering.
 *
 * If the model is not immutable, the component must be rerendered every time
 * it receives an update.
 *
 */
export function PureComponent(pureRender, {immutableModel = true} = {}) {
  return class PureComponentImpl {
    constructor(props, children) {
      this.props = props;
      this.children = children;
      etch.initialize(this);
    }
    
    render() {
      return pureRender(this.props, this.children);
    }
    
    update(props, children) {
      if (immutableModel && this.props === props && this.children === children) {
        return Promise.resolve();
      }
      this.props = props;
      this.children = children;
      return etch.update(this);
    }
  }
}
