import '../styles/tokens.css';
import '../styles/main.css';
import { initHome } from '../app/home';

initHome().catch((err) => console.error('[inicio]', err));
