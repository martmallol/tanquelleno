import '../styles/tokens.css';
import '../styles/main.css';
import { initSelector } from '../app/selector';

initSelector().catch((err) => console.error('[selector]', err));
