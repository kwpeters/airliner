import * as _ from "lodash";
import * as copyPaste from "copy-paste";
import {toggleComment} from "./depot/comment";
import {Timeout} from "./depot/timers";

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    // This function will only be executed once when your extension is activated.

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // console.log('Airliner extension is now active.');

    // Commands are defined in the package.json file.
    // Now provide their implementations using registerCommand().

    let disposable: vscode.Disposable;


    ////////////////////////////////////////////////////////////////////////////
    //
    // Comments/uncomments the current selection or line.
    //
    ////////////////////////////////////////////////////////////////////////////
    disposable = vscode.commands.registerCommand("extension.airlinerToggleComment", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage('There is no active editor.');
            return;
        }

        // If the selection is reversed, reverse it.
        if (editor.selection.isReversed) {
            editor.selection = new vscode.Selection(editor.selection.active, editor.selection.anchor);
        }

        // Extend the selection to column 0 of the first line and the end of the
        // line on the last line.
        editor.selection = new vscode.Selection(editor.selection.anchor.line, 0,
                                                editor.selection.active.line, 1000);

        // Figure out what text is in the previous line (if there is a previous
        // line).
        let precedingLine: string | undefined;
        if (editor.selection.anchor.line > 0) {
            const prevLineNum = editor.selection.anchor.line - 1;
            precedingLine = editor.document.getText(new vscode.Range(prevLineNum, 0, prevLineNum, 1000));
        }
        const selectedLines = editor.document.getText(editor.selection);

        const newText = toggleComment(selectedLines, precedingLine);

        if (newText) {
            await editor.edit((editBuilder: vscode.TextEditorEdit) => {
                editBuilder.replace(editor.selection, newText);
            });
        }

        // Get rid of the editor's selection.
        editor.selection = new vscode.Selection(
            editor.selection.active,
            editor.selection.active
        );

        await vscode.commands.executeCommand("cursorDown");
        await vscode.commands.executeCommand("cursorHome");
    });
    context.subscriptions.push(disposable);


    ////////////////////////////////////////////////////////////////////////////
    //
    // Removes tab characters from the current document.
    //
    ////////////////////////////////////////////////////////////////////////////

    disposable = vscode.commands.registerCommand("extension.airlinerUntabify", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage("There is no active editor.");
            return;
        }

        const tabSize = editor.options.tabSize;
        if (typeof tabSize === "string" || typeof tabSize === "undefined") {
            vscode.window.showInformationMessage("Tab size could not be determined.");
            return;
        }

        // Remember the current cursor location so it can be restored.
        const cursorPos: vscode.Position = editor.selection.active;

        const numLines = editor.document.lineCount;
        const docText  = editor.document.getText();
        const expanded = _.repeat(" ", tabSize);
        const newDocText = docText.replace(/\t/g, expanded);

        // Select the entire document.
        const wholeDocRange = new vscode.Range(0, 0, numLines - 1, 1000);

        await editor.edit((editBuilder: vscode.TextEditorEdit) => {
            editBuilder.replace(wholeDocRange, newDocText);
        });

        // Restore the cursor position.
        editor.selection = new vscode.Selection(cursorPos, cursorPos);
    });
    context.subscriptions.push(disposable);


    ////////////////////////////////////////////////////////////////////////////
    //
    // Cuts selected text or the text between the cursor and the end of the line
    // (if no text is selected).  If this command is executed repeatedly without
    // more than a 2 second delay, the cut text is appended to the text already
    // on the clipboard, thus accruing it.
    //
    ////////////////////////////////////////////////////////////////////////////

    // If the user executes this command within this timeout period, this
    // command will keep adding cut text to the clipboard.  Once the timeout
    // expires, this command will replace the clipboard's contents.
    const accrueTimeout = new Timeout(2 * 1000);
    const textWithLeadingWhitespace = /^(?<leadingWhitespace>\s+)\S+/;

    disposable = vscode.commands.registerCommand("extension.airlinerCutToEol", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage("There is no active editor.");
            return;
        }

        // If we are accruing copied text (due to the timeout timer), then the
        // text we need to copy should start with the current clipboard
        // contents.
        let textToCopy: string = accrueTimeout.isRunning() ? await getClipboardContent() : "";

        const activePos = editor.selection.active;
        const eolPos = new vscode.Position(editor.selection.active.line, 1000);
        const toEolRange = new vscode.Range(activePos, eolPos);

        const toEolText =  editor.document.getText(toEolRange);
        if (toEolText.length > 0) {

            // If the text remaining on the line is whitespace followed by
            // non-whitespace, then kill just the leading whitespace.  By
            // removing just the whitespace, we will make joining two lines
            // easier.
            const match = textWithLeadingWhitespace.exec(toEolText);
            if (match) {
                const leadingWhitespace = match.groups!.leadingWhitespace;
                textToCopy += leadingWhitespace;

                const whitespaceRange = new vscode.Range(
                    activePos,
                    new vscode.Position(activePos.line, activePos.character + leadingWhitespace.length)
                );

                // Remove the kill text from the document.
                await editor.edit((editBuilder: vscode.TextEditorEdit) => {
                    editBuilder.replace(whitespaceRange, "");
                });
            }
            else {
                textToCopy += toEolText;

                // Remove the kill text from the document.
                await editor.edit((editBuilder: vscode.TextEditorEdit) => {
                    editBuilder.replace(toEolRange, "");
                });
            }
        }
        else {
            textToCopy += "\n";
            vscode.commands.executeCommand("deleteRight");
        }

        copyPaste.copy(textToCopy);

        // Restart the accrue timeout.
        accrueTimeout.start();
    });
    context.subscriptions.push(disposable);

    // Helper function that gets the current contents of the clipboard.
    function getClipboardContent(): Promise<string> {
        return new Promise((resolve) => {
            copyPaste.paste((err, clipboardContents: string) => {
                if (err) {
                    vscode.window.showInformationMessage("Could not get clipboard contents.");
                    resolve("");
                }
                else {
                    resolve(clipboardContents);
                }
            });
        });

    }


    ////////////////////////////////////////////////////////////////////////////
    //
    // Appends a semicolon onto the end of the current line.  Pretty simple.
    //
    ////////////////////////////////////////////////////////////////////////////

    disposable = vscode.commands.registerCommand("extension.airlinerAppendSemicolon", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage("There is no active editor.");
            return;
        }

        await editor.edit((editBuilder: vscode.TextEditorEdit) => {
            editBuilder.insert(new vscode.Position(editor.selection.active.line, 10000), ";");
        });
    });
    context.subscriptions.push(disposable);


    ////////////////////////////////////////////////////////////////////////////
    //
    // Deletes whitespace characters to the left of the cursor until either a
    // non-whitespace character is encountered or the beginning of the line.
    //
    ////////////////////////////////////////////////////////////////////////////

    disposable = vscode.commands.registerCommand("extension.airlinerHungryBackspace", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage("There is no active editor.");
            return;
        }

        let done = false;
        let numDeletionsMade = 0;
        // A helper function that helps keep track of how many deletions have
        // been made.
        const doBackspace = async function (): Promise<void> {
            await vscode.commands.executeCommand("deleteLeft");
            numDeletionsMade++;
        };

        while (!done) {
            const activePos = editor.selection.active;
            if (numDeletionsMade === 0 && activePos.character === 0) {
                // If we are just starting and in column 0, backspace to the end
                // of the preceding line.  In this case, we are not done and may
                // delete whitespace at the end of the preceding line.
                await doBackspace();
                continue;
            }

            if (activePos.character === 0) {
                // Deletions have already been made and we have reached the
                // beginning of the line.  Stop deleting.
                done = true;
                continue;
            }

            const prevCharRange = new vscode.Range(
                activePos.line, activePos.character - 1,
                activePos.line, activePos.character
            );

            const prevChar = editor.document.getText(prevCharRange);

            if (!/\s/.test(prevChar)) {
                if (numDeletionsMade === 0) {
                    // The user has backspaced over a non-whitespace character.
                    // Behave like a normal backspace.
                    await doBackspace();
                }
                done = true;
                continue;
            }

            // The previous character is whitespace.  Delete it. We are not done
            // yet.
            await doBackspace();
        }
    });
    context.subscriptions.push(disposable);


    ////////////////////////////////////////////////////////////////////////////
    //
    // Deletes whitespace characters to the right of the cursor until either a
    // non-whitespace character is encountered or the end of the line.
    //
    ////////////////////////////////////////////////////////////////////////////

    disposable = vscode.commands.registerCommand("extension.airlinerHungryDeleteRight", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage("There is no active editor.");
            return;
        }
        const doc = vscode.window.activeTextEditor!.document;
        let done = false;
        let numDeletionsMade = 0;
        // A helper function that helps keep track of how many deletions have
        // been made.
        const doDeleteRight = async function(): Promise<void> {
            await vscode.commands.executeCommand("deleteRight");
            numDeletionsMade++;
        };
        while (!done) {
            const activePos = editor.selection.active;
            if (numDeletionsMade === 0 && isAtEndOfLine(doc, activePos)) {
                // If we are starting at the end of a line, delete right to pull
                // up the following line.  In this case, we are not done and may
                // delete whitespace at the beginning of the next line.
                await doDeleteRight();
                continue;
            }

            if (isAtEndOfLine(doc, activePos)) {
                // We have reached the end of the line.  Stop deleting.
                done = true;
                continue;
            }

            const nextCharRange = new vscode.Range(
                activePos.line, activePos.character,
                activePos.line, activePos.character + 1
            );

            const nextChar = editor.document.getText(nextCharRange);

            if (!/\s/.test(nextChar)) {
                if (numDeletionsMade === 0) {
                    // The user has deleted a non-whitespace character.
                    // Behave like a normal backspace.
                    await doDeleteRight();
                }
                done = true;
                continue;
            }
            // The next character is whitespace.  Delete it.
            await doDeleteRight();
        }
    });

    context.subscriptions.push(disposable);


    ////////////////////////////////////////////////////////////////////////////
    //
    // Splits the current editor and takes you to the top of the file.  This is
    // convenient when you have to add import statements or a #include to the
    // top of you current file and don't want to lose your position.
    //
    ////////////////////////////////////////////////////////////////////////////
    disposable = vscode.commands.registerCommand("extension.airlinerSplitTop", async () => {
        // await vscode.commands.executeCommand("workbench.action.splitEditorDown");
        await vscode.commands.executeCommand("extension.airlinerSplitEditorDown");
        await vscode.commands.executeCommand("cursorTop");
    });

    context.subscriptions.push(disposable);

    ////////////////////////////////////////////////////////////////////////////
    //
    // The normal vscode "workbench.action.splitEditorDown" command does not
    // make sure that the cursor is visible in either the original editor nor
    // the new editor.  So, if your cursor is in the lower half of the editor
    // and you split it, you will have no idea where your cursor is until you
    // move it.  This command fixes that.
    //
    ////////////////////////////////////////////////////////////////////////////
    disposable = vscode.commands.registerCommand("extension.airlinerSplitEditorDown", async () => {
        const topEditor = vscode.window.activeTextEditor;
        if (!topEditor) {
            vscode.window.showInformationMessage("There is no active editor.");
            return;
        }
        const topCursorPos = topEditor.selection.active;

        await vscode.commands.executeCommand("workbench.action.splitEditorDown");
        const bottomEditor = vscode.window.activeTextEditor!;

        topEditor.revealRange(
            new vscode.Range(topCursorPos, topCursorPos),
            vscode.TextEditorRevealType.InCenterIfOutsideViewport
        );
        bottomEditor.revealRange(
            new vscode.Range(topCursorPos, topCursorPos),
            vscode.TextEditorRevealType.InCenterIfOutsideViewport
        );
    });

    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand("extension.airlinerOpenVisualStudio", async () => {

        // const activeFile = new File(vscode.window.activeTextEditor?.document.fileName);
        //
        // if (vscode.workspace.workspaceFolders !== undefined) {
        //
        //
        //     // const f = vscode.workspace.workspaceFolders[0].uri.fsPath;
        //
        //     // const message = `YOUR-EXTENSION: folder: ${wf} - ${f}`;
        //     // vscode.window.showInformationMessage(message);
        // }
        // else {
        //     const message = "YOUR-EXTENSION: Working folder not found, open a folder an try again";
        //
        //     vscode.window.showErrorMessage(message);
        // }
    });

    context.subscriptions.push(disposable);


    ////////////////////////////////////////////////////////////////////////////
    // An example of how to prompt the user for a choice.
    ////////////////////////////////////////////////////////////////////////////
    // disposable = vscode.commands.registerCommand('extension.quickPickExample', async function () {
    //     const options = ['Option 1', 'Option 2', 'Option 3'];
    //     const selected = await vscode.window.showQuickPick(options, {
    //         placeHolder: 'Choose an option',
    //     });
    //
    //     if (selected) {
    //         vscode.window.showInformationMessage(`You selected: ${selected}`);
    //     } else {
    //         vscode.window.showInformationMessage('No option was selected!');
    //     }
    // });
    // context.subscriptions.push(disposable);
}



// this method is called when your extension is deactivated
export function deactivate() {}


/**
 * Helper function that determines whether `position` is at the end of its line
 * @param doc - The document containing `position`
 * @param position - The position to be tested
 * @return Whether `position` is at the end of its line
 */
function isAtEndOfLine(
    doc: vscode.TextDocument,
    position: vscode.Position
): boolean {
    const exaggeratedEndOfLine = new vscode.Position(position.line, position.character + 100000);
    const validated = doc.validatePosition(exaggeratedEndOfLine);
    return (position.line === validated.line) &&
           (position.character === validated.character);
}
