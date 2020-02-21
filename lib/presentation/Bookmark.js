'use babel';
/** @jsx etch.dom */

import etch from 'etch';
import { CompositeDisposable } from 'atom';
import marked from 'marked';
import { createHash } from 'crypto';
import Actions from '../data/CasefileActions';
import { openBookmark } from '../bookmarks';
import { PureComponent } from '../etch-utils';
import { Draggable, DropTarget, whenDragEnds } from '../atom-etch-dnd';
import { DraggableItems } from '../pkg-vals';
import jQuery from 'jquery';

function hashStr(s) {
  return createHash('md5').update(s).digest('hex');
}

function insertionFromPointInRect(point, rect, {handleWidth = null} = {}) {
  // Takes a point {x, y} and a DOMRect and determines what kind of insertion
  // is represented.  The properties on the returned Object that might be
  // true are "siblingBefore", "siblingAfter", "child", and "invalid".
  try {
    var midlineY = (rect.top + rect.bottom) / 2;
    if (handleWidth === null) {
      handleWidth = (4 * rect.left + rect.right) / 5;
    }
    var insert = {}; 
    if (point.y < midlineY) {
      return {siblingBefore: true};
    } else if (point.x < rect.left + handleWidth) {
      return {siblingAfter: true};
    } else {
      return {child: true};
    }
  } catch (ex) {
    return {invalid: true};
  }
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
      if (!file) {
        return (
          <h3>{props.info.markText}</h3>
        );
      } else {
        return (
          <div onClick={openThis}>
            <div className="line-ref">
              <span>{file}:{props.info.line}</span>
            </div>
            <div className="tagged-code">{props.info.markText}</div>
          </div>
        );
      }
    });
    var BookmarkBody = PureComponent((infoProps) => {
      return (
        <div className="bookmark-body" attributes={{"data-mark-path": JSON.stringify(itemPath)}}>
          <div className="drag-handle">
            <span className="icon icon-grabber"></span>
          </div>
          <MarkInfoDisplay />
        </div>
      );
    });
    BookmarkBody = DropTarget(
      [DraggableItems.BOOKMARK],
      BookmarkBody,
      {
        canDrop(dragProps) {
          return !itemPath.includes(dragProps.id);
        },
        drop(dragProps, dropLocation) {
          const insert = insertionFromPointInRect(
            dropLocation.point,
            dropLocation.targetElement.getBoundingClientRect(),
            {handleWidth: jQuery(dropLocation.targetElement).find('.drag-handle').width()}
          );
          if (insert.siblingBefore) {
            Actions.moveBookmark(dragProps.itemPath, props.ancestors, {before: props.info.id});
          } else if (insert.siblingAfter) {
            Actions.moveBookmark(dragProps.itemPath, props.ancestors, {after: props.info.id});
          } else if (insert.child) {
            Actions.moveBookmark(dragProps.itemPath, itemPath, null);
          }
        }
      },
      (monitor) => {
        if (!monitor.getTargetElement()) {
          return {};
        }
        const targRect = monitor.targetBounds(), pointerAt = monitor.pointerCoords();
        const $handle = jQuery(monitor.getTargetElement()).find('.drag-handle');
        const insert = pointerAt && monitor.canDrop() && monitor.isOver() && 
          insertionFromPointInRect(pointerAt, targRect, {handleWidth: $handle.width()});
        if (insert) {
          // directly move indicator to insertion position
          const $elt = jQuery(monitor.getTargetElement());
          const $mark = $elt.closest('.bookmarks-ui').find('.insertion-marker');
          let markHeight = $mark[0] && $mark[0].getBoundingClientRect().height || 0;
          let markLocation = null;
          if (insert.siblingBefore) {
            markLocation = {left: targRect.left, y: targRect.top};
          } else if (insert.siblingAfter) {
            let treeRect = $elt.closest('.bookmark')[0].getBoundingClientRect();
            markLocation = {left: targRect.left, y: treeRect.bottom};
          } else if (insert.child) {
            markLocation = {left: targRect.left + $handle.width(), y: targRect.bottom};
          }
          if (markLocation) {
            let markRect = {
              left: markLocation.left + "px",
              top: markLocation.y - (markHeight / 2) + "px",
              width: targRect.width - markLocation.left + targRect.left + "px",
              right: "",
              bottom: ""
            };
            $mark.removeClass('casefile-hidden').css(markRect);
            whenDragEnds('casefile.insertion-marker', () => {
              $mark.addClass('casefile-hidden');
            });
          } else {
            $mark.addClass('casefile-hidden');
          }
        }
        return {};
      }
    );
    return (
      <div className="bookmark" style={{opacity: props.isDragging ? 0.5 : 1}} notesHash={hashStr(props.info.notes || "")}>
        <BookmarkBody />
        <div className="child-marks">
          {children}
        </div>
      </div>
    );
  }
  
  update(newProps) {
    const oldProps = this.props;
    this.props = newProps;
    if (this.tooltip) {
      this.tooltip.dispose();
    }
    return etch.update(this).then(() => {
      if (this.props.info.notes) {
        this.createTooltip();
      }
    });
  }
  
  createTooltip() {
    this.tooltip = atom.tooltips.add(jQuery(this.element).find('.bookmark-body')[0], {
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
        itemPath: [...props.ancestors, props.info.id],
        disabled: props.modelLocked
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
