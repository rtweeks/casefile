# casefile package

The essential assistant for deep-dives in code

![A screenshot of your package](https://f.cloud.github.com/assets/69169/2290250/c35d867a-a017-11e3-86be-cd7c5bf3ff9b.gif)

Casefile is a bookmark manager on steroids, including:

* A _Casefile_ tab that displays all bookmarks in the project
* Bookmarks that include text to find at (or around) the designated location
* Drag-and-drop reordering and hierarchical organization of bookmarks
* User-supplied notes on bookmarks
* Bookmark locations linked to specific commits (for Git-managed projects), allowing the bookmarked text to be located even after the file is modified
* Export to and import from text, allowing collaboration or preservation in a ticketing system
* Sharing bookmarks with collaborators through a central Git repository

## Hierarchical Organization

<img src="./images/bookmarks.png" alt="Annotated bookmark picture" width="300"/>

When dragging a bookmark, you can drop it on another bookmark in one of three areas, divided in the picture above with green, dashed lines forming a "T":
* Dropping on the top section moves the dragged bookmark to be just before -- and at the same level as -- the destination bookmark.
* Dropping on the lower left section (bottom half of the drag handle) moves the dragged bookmark to be the next bookmark at the same level as the destination bookmark (after all of that bookmark's children).
* Dropping on the lower right section makes the dragged bookmark the first child of the destination bookmark.

During the drag, an insertion indicator will reflect where the dragged bookmark will end up.  The indicator will have the same _width_  as the resulting bookmark, which helps you see whether you are dropping as "next sibling" or "first child".

## Casefile Sharing

By invoking the _Casefile: Share_ command (or choosing _Share Bookmarks..._ from the Casefile tab's context menu), you can open the _Casefile Sharing_ pane, which gives you access to the casefiles you or your collaborators have shared in the Git repository.  This pane can be used to share the casefile you currently have or to import casefiles recorded in the repository.  Importing bookmarks never deletes the bookmarks you have, but if you want to update a particular casefile (rather than creating a separate instance with the same name), you need to empty the current casefile before importing.

Recovery of casefiles previously deleted from the repository requires typing at least three consecutive characters of the deleted casefile's name.

Of note if you find need to do advanced manipulation of the shared casefiles (e.g. to forget a password captured in a bookmark), the files are stored in a pseudo-branch whose head is referenced by `refs/collaboration/shared-casefiles` on the remote used for sharing.

## Configuration

If you have your `git` or `diff` tools installed in any unusual directories, make sure to set the *Tool Path* setting appropriately.
