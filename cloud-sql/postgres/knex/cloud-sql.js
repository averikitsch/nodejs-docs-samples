// Copyright 2018 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const Knex = require('knex');

if (!process.env.DB_USER) throw Error('DB_USER needs to be set.');
if (!process.env.DB_PASS) throw Error('DB_PASS needs to be set.');
if (!process.env.DB_NAME) throw Error('DB_NAME needs to be set.');
if (!process.env.INSTANCE_CONNECTION_NAME) throw Error('connection name needs to be set.');

const connectWithTcp = (config) => {
  // Extract host and port from socket address
  const dbSocketAddr = process.env.DB_HOST.split(":") // e.g. '127.0.0.1:5432'

  // Establish a connection to the database
  return Knex({
    client: 'pg',
    connection: {
      user: process.env.DB_USER, // e.g. 'my-user'
      password: process.env.DB_PASS, // e.g. 'my-user-password'
      database: process.env.DB_NAME, // e.g. 'my-database'
      host: dbSocketAddr[0], // e.g. '127.0.0.1'
      port: dbSocketAddr[1], // e.g. '5432'
    },
    // ... Specify additional properties here.
    ...config
  });
}

const connectWithUnixSockets = (config) => {
  const dbSocketPath = process.env.DB_SOCKET_PATH || "/cloudsql"

  // Establish a connection to the database
  return Knex({
    client: 'pg',
    connection: {
      user: process.env.DB_USER, // e.g. 'my-user'
      password: process.env.DB_PASS, // e.g. 'my-user-password'
      database: process.env.DB_NAME, // e.g. 'my-database'
      host: `${dbSocketPath}/${process.env.INSTANCE_CONNECTION_NAME}`,
    },
    // ... Specify additional properties here.
    ...config
  });
}

// Initialize Knex, a Node.js SQL query builder library with built-in connection pooling.
const connect = () => {
  // Configure which instance and what database user to connect with.
  // Remember - storing secrets in plaintext is potentially unsafe. Consider using
  // something like https://cloud.google.com/kms/ to help keep secrets secret.
  let config = {pool: {}};

  // [START cloud_sql_postgres_knex_limit]
  // 'max' limits the total number of concurrent connections this pool will keep. Ideal
  // values for this setting are highly variable on app design, infrastructure, and database.
  config.pool.max = 5;
  // 'min' is the minimum number of idle connections Knex maintains in the pool.
  // Additional connections will be established to meet this value unless the pool is full.
  config.pool.min = 5;
  // [END cloud_sql_postgres_knex_limit]

  // [START cloud_sql_postgres_knex_timeout]
  // 'acquireTimeoutMillis' is the number of milliseconds before a timeout occurs when acquiring a
  // connection from the pool. This is slightly different from connectionTimeout, because acquiring
  // a pool connection does not always involve making a new connection, and may include multiple retries.
  // when making a connection
  config.pool.acquireTimeoutMillis = 60000; // 60 seconds
  // 'createTimeoutMillis` is the maximum number of milliseconds to wait trying to establish an
  // initial connection before retrying.
  // After acquireTimeoutMillis has passed, a timeout exception will be thrown.
  config.createTimeoutMillis = 30000; // 30 seconds
  // 'idleTimeoutMillis' is the number of milliseconds a connection must sit idle in the pool
  // and not be checked out before it is automatically closed.
  config.idleTimeoutMillis = 600000; // 10 minutes
  // [END cloud_sql_postgres_knex_timeout]

  // [START cloud_sql_postgres_knex_backoff]
  // 'knex' uses a built-in retry strategy which does not implement backoff.
  // 'createRetryIntervalMillis' is how long to idle after failed connection creation before trying again
  config.createRetryIntervalMillis = 200; // 0.2 seconds
  // [END cloud_sql_postgres_knex_backoff]

  let knex;
  if (process.env.DB_HOST) {
    knex = connectWithTcp(config);
  } else {
    knex = connectWithUnixSockets(config);
  }
  return knex;
};

const knex = connect();

/**
 * Insert a vote record into the database.
 *
 * @param {object} knex The Knex connection object.
 * @param {object} vote The vote record to insert.
 * @returns {Promise}
 */
const insertVote = async (knex, vote) => {
  try {
    return await knex('votes').insert(vote);
  } catch (err) {
    throw Error(err);
  }
};

/**
 * Retrieve the latest 5 vote records from the database.
 *
 * @param {object} knex The Knex connection object.
 * @returns {Promise}
 */
const getVotes = async (knex) => {
  return await knex
    .select('candidate', 'time_cast')
    .from('votes')
    .orderBy('time_cast', 'desc')
    .limit(5);
};

/**
 * Retrieve the total count of records for a given candidate
 * from the database.
 *
 * @param {object} knex The Knex connection object.
 * @param {object} candidate The candidate for which to get the total vote count
 * @returns {Promise}
 */
const getVoteCount = async (knex, candidate) => {
  return await knex('votes').count('vote_id').where('candidate', candidate);
};

module.exports = {
  getVoteCount,
  getVotes,
  insertVote,
  knex,
}
