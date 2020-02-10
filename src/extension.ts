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

    disposable = vscode.commands.registerCommand("extension.airlinerToggleComment", async () =>
    {
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

    disposable = vscode.commands.registerCommand("extension.airlinerUntabify", async () =>
    {
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

    // If the user executes this command within this timeout period, this
    // command will keep adding cut text to the clipboard.  Once the timeout
    // expires, this command will replace the clipboard's contents.
    const accrueTimeout = new Timeout(2 * 1000);
    const textWithLeadingWhitespace = /^(?<leadingWhitespace>\s+)\S+/;

    disposable = vscode.commands.registerCommand("extension.airlinerCutToEol", async () =>
    {
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

                // Remove the kill text from the doucment.
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

        // Restart the accure timeout.
        accrueTimeout.start();
    });
    context.subscriptions.push(disposable);

    // Helper function that gets the current contents of the clipboard.
    function getClipboardContent(): Promise<string>
    {
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


    ////////////////////////////////////////////////////////////////////////////////

    disposable = vscode.commands.registerCommand("extension.airlinerAppendSemicolon", async () =>
    {
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


    ////////////////////////////////////////////////////////////////////////////////

    disposable = vscode.commands.registerCommand("extension.airlinerHungryBackspace", async () =>
    {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
        {
            vscode.window.showInformationMessage("There is no active editor.");
            return;
        }

        let done = false;
        let numDeletionsMade = 0;
        while (!done) {

            const activePos = editor.selection.active;
            if (numDeletionsMade === 0 && activePos.character === 0) {
                // If we are just starting and in column 0, backspace to the end
                // of the preceding line.  In this case, we are not done and may
                // delete whitespace at the end of the preceding line.
                await vscode.commands.executeCommand("deleteLeft");
                numDeletionsMade++;
                continue;
            }

            if (activePos.character === 0) {
                // We have reached the beginning of the line.  Stop deleting.
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
                    await vscode.commands.executeCommand("deleteLeft");
                    numDeletionsMade++;
                }
                done = true;
                continue;
            }
            // The previous character is whitespace.  Delete it.
            await vscode.commands.executeCommand("deleteLeft");
            numDeletionsMade++;
        }
    });
    context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
