import dotenv from 'dotenv';
import path from 'path';
import { seedUserTiers, seedUsers } from './src/Seeders';
dotenv.config({ path: path.join(__dirname, '.env')});

(async() => {
    await seedUsers();
    await seedUserTiers();
    console.log('Seed ended, press CTRL / CMD + C');
    return;
})();