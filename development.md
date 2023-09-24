# Airliner Installation and Development

## First installation

1. Install the @vscode/vsce Node package:

   ```powershell
   npm install --global @vscode/vsce
   ```

2. Build the .vsix.  In the repo's root directory, run:

   ```powershell
   vsce package
   ```

   - For this command to succeed, you cannot have the default `README.md` in your project.  You may have to temporarily delete the file's contents.  After packaging, you can revert your changes.

3. Install the VSIX.

   VS Code Extension pane `>` ... menu `>` Install from VSIX `>` Navigate to the .vsix file created in the previous step

## Subsequent updates

```powershell
./node_modules/.bin/tsc -p ./ && copywrite full . C:/Users/kwpeters/.vscode/extensions/airliner/
```
