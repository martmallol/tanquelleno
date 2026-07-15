import '../styles/tokens.css';
import '../styles/main.css';
import { initResultado } from '../app/resultado';

initResultado().catch((err) => console.error('[resultado]', err));
