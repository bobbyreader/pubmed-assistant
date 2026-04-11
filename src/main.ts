import './styles/reset.css';
import './styles/variables.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/utilities.css';

import { initUI } from './ui';

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUI);
} else {
  initUI();
}
