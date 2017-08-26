'use babel';

import React from 'react';
import Bookmark from './Bookmark';

export default (props) => {
  const marks = props.bookmarks.map((mark) =>
    <Bookmark info={mark} />
  );
  return <ul>{marks}</ul>
}