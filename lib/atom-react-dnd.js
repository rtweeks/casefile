'use babel';

import React from 'react';
import jQuery from 'jquery';

const dataType = "x-drag-and-drop/json";

function getDataTransfer(e) {
  return (e.originalEvent || e).dataTransfer;
}

export function Draggable(itemType, WrappedComponent, spec) {
  return class extends React.Component {
    render() {
      const wrapped = <WrappedComponent {...this.props} />;
      return (
        <span ref={(elt) => this.bindDragging(elt)}>{wrapped}</span>
      );
    }
    
    bindDragging(elt) {
      var $handle = jQuery(elt);
      if ('dragHandle' in spec) {
        $handle = $handle.find(spec.dragHandle);
      }
      (
        $handle
        .attr('draggable', true)
        .on('dragstart', (e) => this.startDrag(e, elt))
      );
    }
    
    startDrag(e, draggable) {
      const dragData = Object.assign(spec.beginDrag(this.props), {type: itemType});
      const dt = getDataTransfer(e);
      dt.setData(dataType, JSON.stringify(dragData));
      if ('dropEffect' in spec) {
        const effectProps = Object.assign({}, this.props);
        for (k of ["ctrlKey altKey shiftKey metaKey"]) {
          effectProps[k] = !!e[k];
        }
        let desiredEffect = spec.dropEffect(effectProps);
        if (typeof desiredEffect === 'string') {
          dt.effectAllowed = desiredEffect;
          dt.dropEffect = desiredEffect;
        } else {
          let [effect, allowed] = desiredEffect;
          dt.effectAllowed = allowed;
          if (effect !== null) dt.dropEffect = effect;
        }
      }
      var img = draggable, dragPoint = [0, 0];
      if ('dragImage' in spec) {
        const specDragImage = spec.dragImage(draggable);
        img = specDragImage.image || img;
        dragPoint = specDragImage.dragPoint || dragPoint;
      }
      dt.setDragImage(img, ...dragPoint);
    }
  }
}

export function DropTarget(itemTypes, WrappedComponent, spec) {
  if (!Array.isArray(itemTypes)) {
    itemTypes = [itemTypes];
  }
  
  return class extends React.Component {
    render() {
      const wrapped = <WrappedComponent {...this.props} />;
      return (
        <span ref={(elt) => this.bindTarget(elt)}>{wrapped}</span>
      );
    }
    
    bindTarget(elt) {
      (
        jQuery(elt)
        .on('dragover', (e) => this.checkDrop(e))
        .on('drop', (e) => this.drop(e))
      );
    }
    
    checkDrop(e) {
      const dragData = this.getDragData(e);
      if (this.dropAllowed(dragData)) {
        e.preventDefault();
      }
    }
    
    drop(e) {
      const dragData = this.getDragData(e);
      if (!this.dropAllowed(dragData)) {
        return;
      }
      e.preventDefault();
      spec.drop(dragData);
    }
    
    getDragData(e) {
      const dragDataJson = getDataTransfer(e).getData(dataType);
      if (!dragDataJson) return;
      try {
        return JSON.parse(dragDataJson);
      } catch (e) {
        return {};
      }
    }
    
    dropAllowed(dragData) {
      return itemTypes.includes(dragData.type);
    }
  }
}