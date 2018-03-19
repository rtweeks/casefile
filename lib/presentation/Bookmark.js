'use babel';
/** @jsx etch.dom */

import etch from 'etch';
import { CompositeDisposable } from 'atom';
import marked from 'marked';
import { createHash } from 'crypto';
import Actions from '../data/CasefileActions';
import { openBookmark } from '../bookmarks';
import { PureComponent } from '../etch-utils';
import { Draggable, DropTarget } from '../atom-etch-dnd';
import { DraggableItems } from '../pkg-vals';
import jQuery from 'jquery';
import TailInsertion from './TailInsertion';

function hashStr(s) {
  return createHash('md5').update(s).digest('hex');
}

class BookmarkBase {
  constructor(props) {
    this.props = props;
    this.disposables = new CompositeDisposable();
    
    etch.initialize(this);
    
    if (this.props.info.notes) {
      this.createTooltip();
    }
  }
  
  render() {
    const props = this.props;
    const file = atom.project.relativizePath(props.info.file)[1];
    const itemPath = [...props.ancestors, props.info.id];
    const children = props.info.children.map((childMark) =>
      <Bookmark
        key={childMark.id}
        info={childMark}
        ancestors={itemPath}/>
    );
    const openThis = () => {
      const mark = props.info;
      if (mark.file) {
        openBookmark(mark);
      }
    };
    const deleteThis = () => {
      if (window.confirm("Delete bookmark on \"" + props.info.markText + "\"?")) {
        Actions.deleteBookmark(itemPath);
      }
    };
    var MarkInfoDisplay = PureComponent((infoProps) => {
      var markContent;
      if (!file) {
        markContent = (
          <h3>{props.info.markText}</h3>
        );
      } else {
        markContent = (
          <div>
            <div className="line-ref">
              <span onClick={openThis}>{file}:{props.info.line}</span>
            </div>
            <div className="tagged-code" onClick={openThis}>{props.info.markText}</div>
          </div>
        );
      }
      return (
        <div className={infoProps.showInsertBefore ? "insert-before" : ""}>
          {markContent}
        </div>
      );
    });
    MarkInfoDisplay = DropTarget(
      [DraggableItems.BOOKMARK],
      MarkInfoDisplay,
      {
        canDrop(dragProps) {
          return !itemPath.includes(dragProps.id);
        },
        drop(dragProps) {
          Actions.moveBookmark(dragProps.itemPath, props.ancestors, props.info.id);
        }
      },
      (monitor) => {
        return {
          showInsertBefore: monitor.canDrop() && monitor.isOver()
        };
      }
    );
    return (
      <div className="bookmark" style={{opacity: props.isDragging ? 0.5 : 1}} notesHash={hashStr(props.info.notes || "")}>
        <div className="bookmark-body" data-mark-path={JSON.stringify(itemPath)}>
          <div className="drag-handle">
            <span className="icon icon-grabber"></span>
          </div>
          <MarkInfoDisplay />
        </div>
        <div className="child-marks">
          {children}
          <TailInsertion parentPath={itemPath} />
        </div>
      </div>
    );
  }
  
  update(newProps) {
    const oldProps = this.props;
    this.props = newProps;
    if (!oldProps.info.notes !== !newProps.info.notes) {
      if (!newProps.info.notes) {
        this.tooltip && this.tooltip.dispose();
        this.tooltip = null;
      } else if (!this.tooltip) {
        this.createTooltip();
      }
    }
    return etch.update(this);
  }
  
  createTooltip() {
    this.tooltip = atom.tooltips.add(jquery(this.element).find('.bookmark-body')[0], {
      title: () => "<div class=\"casefile-tooltip\">" + marked(this.props.info.notes) + "</div>"
    });
  }
  
  async destroy() {
    await etch.destroy(this);
    this.tooltip && this.tooltip.dispose();
    this.disposables.dispose();
  }
}

//export default Bookmark;
Bookmark = Draggable(
  DraggableItems.BOOKMARK,
  BookmarkBase,
  {
    dragHandle: '.drag-handle',
    beginDrag(props) {
      return {
        id: props.info.id,
        itemPath: [...props.ancestors, props.info.id]
      };
    },
    
    dropEffect() {
      return 'move';
    },
    
    dragImage(elt) {
      const $ = jQuery;
      const $elt = $(elt), $handle = $elt.find('.drag-handle');
      const eltPos = $elt.offset(), handlePos = $handle.offset();
      return {dragPoint: [handlePos.left - eltPos.left + $handle.width() / 2, handlePos.top - eltPos.top + $handle.height() / 2]};
    }
  },
  function(monitor) {
    return {
      isDragging: monitor.isDragging()
    }
  }
)

export default Bookmark;
