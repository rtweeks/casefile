'use babel';

import React from 'react';
import Bookmark from './Bookmark';

export default (props) => {
  const marks = props.bookmarks.map((mark) =>
    <Bookmark key={mark.id} info={mark} />
  );
  return <ul>{marks}</ul>
}