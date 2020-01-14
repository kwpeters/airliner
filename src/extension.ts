import * as _ from "lodash";
import {toggleComment} from "./depot/comment";


// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "airliner" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('extension.airlinerToggleComment', async () => {
		// The code you place here will be executed every time your command is executed
		// vscode.window.showInformationMessage('Hello World!');

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
}

// this method is called when your extension is deactivated
export function deactivate() {}
