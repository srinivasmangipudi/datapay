import { registerRootComponent } from "expo";
import App from "./App";

// A project-local entry point instead of the default node_modules/expo/AppEntry.js.
// That default file's own `import App from "../../App"` is a relative import
// resolved against expo's package location — fine in a normal node_modules
// layout, but pnpm symlinks that package in from its content-addressed store,
// and the relative import follows the symlink to its real (wrong) location
// instead of the project. Entry point lives in the project itself, so this
// problem doesn't exist.
registerRootComponent(App);
