'use babel';

const instId = Date.now().toString();
var nextUniq = 0;

export default function() {
  return instId + "." + (nextUniq++).toString();
}
