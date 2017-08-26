'use babel';

import React from 'react';

const Bookmark = (props) => {
  const file = atom.project.relativizePath(props.info.file)[1];
  const children = props.info.children.map((childMark) =>
    <Bookmark info={childMark} />
  );
  return (
    <li key={props.info.file + ":" + props.info.line}>
      <div className="line-ref">{file}:{props.info.line}</div>
      <div className="tagged-code">{props.info.markText}</div>
      <ul className="child-marks">{children}</ul>
    </li>
  );
}

export default Bookmark;
