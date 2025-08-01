import { config } from 'dotenv';
import { join } from 'path';

// Cargar variables de entorno al inicio
config({ path: join(__dirname, '..', '.env') });
config({ path: join(__dirname, '..', '.env.local') });
