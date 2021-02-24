import Crowi from '~/server/crowi';

let _instance = null;

async function createInstance() {
  const crowi = new Crowi();
  await crowi.initForTest();

  return crowi;
}

async function getInstance(isNewInstance) {
  if (isNewInstance) {
    return createInstance();
  }

  // initialize singleton instance
  if (_instance == null) {
    _instance = await createInstance();
  }
  return _instance;
}

module.exports = {
  getInstance,
};
