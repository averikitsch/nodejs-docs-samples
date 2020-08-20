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

'use strict';

// Require process, so we can mock environment variables.
// const process = require('process');
const admin = require('firebase-admin');
const express = require('express');
const { getVotes, getVoteCount, insertVote, knex } = require('./cloud-sql');
const { logger } = require('./logging');

const app = express();
app.set('view engine', 'pug');
app.enable('trust proxy');

app.use(express.static(__dirname + '/static'));

// Automatically parse request body as form data.
app.use(express.urlencoded({extended: false}));
app.use(express.json());

// Set Content-Type for all responses for these routes.
app.use((req, res, next) => {
  res.set('Content-Type', 'text/html');
  next();
});

admin.initializeApp();

// [START run_user_auth_jwt]
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    // If the provided ID token has the correct format, is not expired, and is
    // properly signed, the method returns the decoded ID token
    admin.auth().verifyIdToken(token).then(function(decodedToken) {
      let uid = decodedToken.uid;
      req.uid = uid;
      next();
    }).catch(function(error) {
      return res.sendStatus(403);
    });
  } else {
    return res.sendStatus(401);
  }
};
// [END run_user_auth_jwt]

app.get('/', async (req, res) => {
  try {
    // Query the total count of "TABS" from the database.
    const tabsResult = await getVoteCount(knex, 'TABS');
    const tabsTotalVotes = parseInt(tabsResult[0].count);
    // Query the total count of "SPACES" from the database.
    const spacesResult = await getVoteCount(knex, 'SPACES');
    const spacesTotalVotes = parseInt(spacesResult[0].count);
    // Query the last 5 votes from the database.
    const votes = await getVotes(knex);
    // Calculate and set leader values.
    let leadTeam = '';
    let voteDiff = 0;
    let leaderMessage = '';
    if (tabsTotalVotes !== spacesTotalVotes) {
      if (tabsTotalVotes > spacesTotalVotes) {
        leadTeam = 'TABS';
        voteDiff = tabsTotalVotes - spacesTotalVotes;
      } else {
        leadTeam = 'SPACES';
        voteDiff = spacesTotalVotes - tabsTotalVotes;
      }
      leaderMessage = `${leadTeam} are winning by ${voteDiff} vote${
        voteDiff > 1 ? 's' : ''
      }.`;
    } else {
      leaderMessage = 'TABS and SPACES are evenly matched!';
    }
    res.render('index.pug', {
      votes: votes,
      tabsCount: tabsTotalVotes,
      spacesCount: spacesTotalVotes,
      leadTeam: leadTeam,
      voteDiff: voteDiff,
      leaderMessage: leaderMessage,
    });
  }
  catch(err) {
    logger.error(`Error while attempting to get vote: ${err}`);
    res
      .status(500)
      .send('Unable to load page; see logs for more details.')
      .end();
  }

});

app.post('/', authenticateJWT, async (req, res) => {
  // Get decoded Id Platform user id
  const uid = req.uid;
  // Get the team from the request and record the time of the vote.
  const {team} = req.body;
  const timestamp = new Date();

  if (!team || (team !== 'TABS' && team !== 'SPACES')) {
    res.status(400).send('Invalid team specified.').end();
    return;
  }

  // Create a vote record to be stored in the database.
  const vote = {
    candidate: team,
    time_cast: timestamp,
  };

  // Save the data to the database.
  try {
    await insertVote(knex, vote);
  } catch (err) {
    logger.error(`Error while attempting to submit vote: ${err}`);
    res
      .status(500)
      .send('Unable to cast vote; see logs for more details.')
      .end();
    return;
  }
  res.status(200).send(`Successfully voted for ${team} at ${timestamp}`).end();
});

module.exports = {app};
