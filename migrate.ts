import DB from './src/DB';

new DB()
  .migrate()
  .then(() => {
    console.log('Migration Ended, press Ctrl + C to exit!')
    return;
  });
  