// SECRET_NAME is the resource ID of the secret, passed in by environment variable.
// Format: projects/PROJECT_ID/secrets/SECRET_ID/versions/VERSION
if (!process.env.DB_USER) throw Error('DB_USER needs to be set.');
if (!process.env.DB_PASS) throw Error('DB_PASS needs to be set.');
if (!process.env.DB_NAME) throw Error('DB_NAME needs to be set.');
if (!process.env.INSTANCE_CONNECTION_NAME) throw Error('INSTANCE_CONNECTION_NAME needs to be set.');

const {SecretManagerServiceClient} = require('@google-cloud/secret-manager');
// Secret Manager Client is global for snappy reuse.
let client;

// Load the secret from Secret Manager.
async function getSecret(name) {
  if (!client) client = new SecretManagerServiceClient();
  if (name) {
    try {
      const [version] = await client.accessSecretVersion({name});
      return version.payload.data.toString('utf8');
    }
    catch (e) {
      console.error(`error: could not retrieve secret: ${e}`);
      return
    }
  }
}

function getAllSecrets() {
  return {
    dbUser: process.env.DB_USER,
    dbPassword: process.env.DB_PASS,
    dbName: process.env.DB_NAME,
    cloudSqlInstance: process.env.INSTANCE_CONNECTION_NAME
  }
}

module.exports = {
  getAllSecrets
}
