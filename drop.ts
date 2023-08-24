import DB from './src/DB';

new DB()
  .droptable()
  .then(() => {
    console.log('Dropped all table')
    return;
  });