// TODO: refactor
const ELIGIBLE_MIN_MUL = 2;

function returnUser(body, session, user) {
  if (body != null) {
    return user;
  }

  // Save this value into a flash object
  session.savePipe({
    sessionsearch_user: user,
  });

  // And call the input
  // TODO
  // IOManager.handle({
  // 	session: session,
  // 	params: {
  // 		body: JSON.parse(session.pipe.sessionsearch_body)
  // 	}
  // });
}

module.exports = async function (body, session, query) {
  if (session.pipe.sessionsearch_user != null) {
    const user = session.pipe.sessionsearch_user;
    session.savePipe({
      sessionsearch_user: null,
      sessionsearch_body: null,
    });
    return user;
  }

  const result_by_id = await Data.Session.findOne({
    _id: query,
  });
  if (result_by_id != null) return returnUser(body, session, result_by_id);

  const results = await Data.Session.find(
    {
      $text: {
        $search: query,
      },
    },
    {
      score: {
        $meta: 'textScore',
      },
    },
  ).sort({
    score: {
      $meta: 'textScore',
    },
  });

  if (results.length === 0) {
    throw {
      speech: 'Non riesco a trovarlo nei miei amici',
    };
  }
  if (results.length === 1) return returnUser(body, session, results[0]);

  // If the difference from the first to the second is massive, return the first
  if (results[0].score >= ELIGIBLE_MIN_MUL * results[1].score) return returnUser(body, session, results[0]);

  if (body != null) {
    session.savePipe({
      sessionsearch_body: JSON.stringify(body),
    });
  }

  let speech =		'Ho molti amici che si chiamano così. A chi di questi ti riferisci?\n';
  speech += results.map(e => `${e.id}) ${e.alias}`).join('\n');

  throw {
    fulfillment: {
      speech,
      contextOut: [
        {
          name: '_helper_sessionsearch',
          lifespan: 1,
        },
      ],
      data: {
        replies: results.map(e => e.id),
      },
    },
  };
};
