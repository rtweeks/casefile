'use babel';

import { casefileSharingURI } from './pkg-vals';
import CasefileSharingContainer from './containers/CasefileSharingContainer';
import { Disposable } from 'atom';

export default class CasefileSharingView {
  constructor(state) {
    this.element = document.createElement('casefile-sharing');
    const sharedCasefiles = new CasefileSharingContainer();
    this.element.appendChild(sharedCasefiles.element);
    const cleanup = new Disposable(() => {
      sharedCasefiles.destroy();
    })
    this.dispose = cleanup.dispose.bind(cleanup);
  }
  
  getTitle() {
    return "Casefile Sharing";
  }
  
  getURI() {
    return casefileSharingURI;
  }
  
  getDefaultLocation() {
    return 'center';
  }
}
