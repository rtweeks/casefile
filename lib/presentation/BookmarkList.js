'use babel';

import React from 'react';
import Bookmark from './Bookmark';
import Actions from '../data/CasefileActions';

class Trash extends React.Component {
  renderOverlay(color) {
    return (
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        height: '100%',
        width: '100%',
        zIndex: 1,
        opacity: 0.5,
        backgroundColor: color
      }} />
    )
  }
  
  render() {
    return (
      <div 
        className={"trash"}>
        <div>
          <span className="icon icon-trashcan"></span> Remove
        </div>
      </div>
    )
  }
};

export default (props) => {
  const marks = props.bookmarks.map((mark) =>
    <Bookmark key={mark.id} info={mark} ancestors={[]}/>
  );
  return (
    <div>
      <div>
        {marks}
      </div>
      <Trash />
    </div>
  );
}
