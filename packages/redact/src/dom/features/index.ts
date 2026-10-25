import './context';
import './forward-ref';
import './memo';
import './lazy';
import './suspense';
import './portal';
import './activity';
import './class';
// Feature wiring. Each import is a side-effect import that triggers the
// feature module's self-registration with the reconciler (renderer, type
// matcher, element marker). A vite plugin can swap any entry to './stub'
// to disable that feature in the emitted bundle.
