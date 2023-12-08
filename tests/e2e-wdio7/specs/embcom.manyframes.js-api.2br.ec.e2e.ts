
import { addEmbComManyFramesTests } from './embcom.manyframes.js-api.impl';

describe(`embcom.manyframes.js-api.2br.ec  TyTEMANYEMBDISAPI`, () => {
  addEmbComManyFramesTests({
    usingSingleSignOn: false,
    localHostname: 'comments-for-e2e-test-manyapi-localhost-8080',
    embeddingOrigin: 'http://e2e-test-manyapi.localhost:8080',
  });
});
