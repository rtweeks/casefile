## 1.3.2 - Bug fixes
* Fixed "locked condition" broadcast sequencing
* Fixed "Fetch Shared" to work even if the pseudo-branch has not yet been
  created in the remote repository

## 1.3.1 - Bug fixes
* State management when pseudo-branch does not exist on remote

## 1.3.0 - Casefile sharing
* Share casefiles through the Git repository
* Better bookmark anchors using `git blame`
* Better internal state management

## 1.2.1 - Bug fixes
* Drag-and-drop state management fixed
* Tooltip lifecycle fixed

## 1.2.0 - Improved UI
* "T" division of bookmark for drop location:
  * Move to sibling above,
  * Move to sibling below, or
  * Move to first child

## 1.1.2 - Project-relative file paths
* Make paths in bookmarks relative to files, so sharing casefiles with others
  using the same repo at a different file path works

## 1.1.1 - Bug fix
* Fix tooltip creation

## 1.1.0 - Reimplement with Etch framework
* Etch is better integrated with Atom than is ReactJS

## 1.0.0 - Basic Functionality
* Bookmarking: file, line, marked text, notes (and, invisibly, git commit)
* Bookmark ordering and hierarchy with drag-and-drop
* Dump casefile to editor
* Load casefile from editor:
  * Loads under a header (so entire casefile can be discarded)
  * Promote to container with "Move Children Up"
