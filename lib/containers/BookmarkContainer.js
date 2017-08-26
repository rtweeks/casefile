'use babel';

import BookmarkList from '../presentation/BookmarkList';
import {Container} from 'flux/utils';
import Store from '../data/CasefileStore';

function getStores() {
  return [Store];
}

function getState() {
  return {
    bookmarks: Store.getState()
  };
}

export default Container.createFunctional(BookmarkList, getStores, getState);
