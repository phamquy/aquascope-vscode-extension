# Test fixture workspace

The integration tests open this folder as the workspace and run the analysis on these files. `01` to `05` are copies of spike 002's programs `e1` to `e5` and `n1` of spike 003's fixtures, and `n2_nested` was added for feature 003's selection tests; keep them in step if those change. Captured tool output for some of them is in `../data/`. The tests also check that running the analysis leaves this folder unchanged (AC9), so do not add a `.vscode/` folder or build output here.
