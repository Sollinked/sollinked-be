import DB from './src/DB';

new DB()
  .rollback()
  .then(() => {
    console.log('Rollback Ended, press Ctrl + C to exit!')
    return;
  });