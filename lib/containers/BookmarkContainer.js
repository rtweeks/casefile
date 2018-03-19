'use babel';
/** @jsx etch.dom */

import etch from 'etch';
import BookmarkList from '../presentation/BookmarkList';
import Model from '../data/CasefileModel';

function getStores() {
  return [Store];
}

function getState() {
  return {
    bookmarks: Store.getState()
  };
}

//export default Container.createFunctional(BookmarkList, getStores, getState);
export default class BookmarkContainer {
  constructor(props) {
    this.props = Object.assign({bookmarks: Model.getState()}, props);
    
    // Bind to store
    this._modelBinding = Model.bindView(this, "bookmarks", "_modelUpdate");
    
    etch.initialize(this);
  }
  
  render() {
    return <BookmarkList {...this.props} />;
  }
  
  update(props) {
    this.props = props
    return etch.update(this);
  }
  
  _modelUpdate(model) {
    this.update(Object.assign({}, this.props, model));
  }
  
  async destroy() {
    await etch.destroy(this);
    Model.unbindView(this._modelBinding);
  }
}