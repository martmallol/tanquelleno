import '../styles/tokens.css';
import '../styles/main.css';
import { initPrecios } from '../app/precios';

initPrecios().catch((err) => console.error('[precios]', err));
