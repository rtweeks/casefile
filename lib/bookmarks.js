'use babel';

export function openBookmark(filePath, line, text) {
  atom.workspace.open(filePath, {initialLine: line - 1}).then((editor) => {
    // Look for *text* around the line the cursor is now on
    const rowHasText = (i) => {
      const lineText = editor.lineTextForBufferRow(i);
      return lineText && lineText.includes(text);
    };
    if (rowHasText(line - 1)) {
      editor.setCursorBufferPosition(
        [line - 1, editor.lineTextForBufferRow(line - 1).indexOf(text)]
      );
      return;
    }
    for (let i = 1; i <= 10; ++i) {
      if (rowHasText(line - 1 + i)) {
        editor.setCursorBufferPosition(
          [line - 1 + i, editor.lineTextForBufferRow(line - 1 + i).indexOf(text)]
        );
        return;
      }
      if (rowHasText(line - 1 - i)) {
        editor.setCursorBufferPosition(
          [line - 1 - i, editor.lineTextForBufferRow(line - 1 - i).indexOf(text)]
        );
        return;
      }
    }
    // TODO: A more in-depth search would consult the git diff for this file
  });
}
