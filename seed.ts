import dotenv from 'dotenv';
import path from 'path';
import { seedProfileTiers, seedProfiles } from './src/Seeders';
dotenv.config({ path: path.join(__dirname, '.env')});

(async() => {
    await seedProfiles();
    await seedProfileTiers();
    console.log('Seed ended, press CTRL / CMD + C');
    return;
})();