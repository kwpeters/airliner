# Airliner Installation and Development

## First installation

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Install the @vscode/vsce Node package globally:

   ```powershell
   npm install --global @vscode/vsce
   ```

3. Build the .vsix.  In the repo's root directory, run:

   ```powershell
   vsce package
   ```

   - For this command to succeed, you cannot have the default `README.md` in your project.  You may have to temporarily delete the file's contents.  After packaging, you can revert your changes.

4. Install the VSIX.

   VS Code Extension pane `>` ... menu `>` Install from VSIX `>` Navigate to the .vsix file created in the previous step

## Subsequent updates

From this repo's root directory:

```powershell
./node_modules/.bin/tsc -p ./ && copywrite full . C:\Users\kwpeters\.vscode\extensions\undefined_publisher.airliner-0.0.1
```

```powershell
./node_modules/.bin/tsc -p ./ && copywrite full . C:\Users\kwpet\.vscode\extensions\undefined_publisher.airliner-0.0.1
```
