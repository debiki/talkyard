
import { addEmbComManyFramesTests } from './embcom.manyframes.js-api.impl';


describe(`embcom.manyframes.js-api.sso.2br.ec  TyTEMANYEMBDISAPISSO`, () => {
  addEmbComManyFramesTests({
    usingSingleSignOn: true,
    localHostname: 'comments-for-e2e-test-manyapisso',
    embeddingOrigin: 'http://e2e-test-manyapisso.localhost:8080',
  });
});
