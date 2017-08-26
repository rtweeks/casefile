'use babel';

import React from 'react';
import Actions from '../data/CasefileActions';

const Bookmark = (props) => {
  const file = atom.project.relativizePath(props.info.file)[1];
  const itemPath = [...props.ancestors, props.info.id];
  const children = props.info.children.map((childMark) =>
    <Bookmark
      key={childMark.id}
      info={childMark}
      ancestors={itemPath}/>
  );
  const deleteThis = () => {
    if (window.confirm("Delete bookmark on \"" + props.info.markText + "\"?")) {
      Actions.deleteBookmark(itemPath);
    }
  };
  return (
    <li className="bookmark">
      <div className="line-ref">
        {file}:{props.info.line}
        <div className="actions">
          <span className="icon icon-trashcan action-delete" onClick={deleteThis}></span>
        </div>
      </div>
      <div className="tagged-code">{props.info.markText}</div>
      <ul className="child-marks">{children}</ul>
    </li>
  );
}

export default Bookmark;
