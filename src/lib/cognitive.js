const _config = config.ai.cognitive;
const TAG = 'Cognitive';

const BASE_URL = 'https://westus.api.cognitive.microsoft.com';

function req(callback, ep, body, method) {
	callback = callback || (function(){});

	let headers = {};
	headers['Ocp-Apim-Subscription-Key'] = _config[ ep.split('/')[0] ].apiKey;

	let opt = {};
	opt.url = BASE_URL + '/' + ep;
	opt.method = method || 'POST';
	if (body != null && opt.method != 'GET') {
		opt.body = body;
		opt.json = true;
	} else {
		headers['Content-Type'] = 'application/octet-stream';
	}
	opt.headers = headers;

	return request(opt, (err, response, body) => {
		console.debug(TAG, ep, body);
		if (err) return callback(err);
		callback(null, body);
	});
}

exports.vision = {};
exports.face = {};
exports.spid = {};

exports.vision.analyze = function(url, callback) {
	const ep = `vision/v1.0/analyze?visualFeatures=categories,tags,description,faces,imagetype&details=celebrities`;
	if (_.isString(url)) {
		return req(callback, ep, { url: url });
	} else {
		return url.pipe(req(null, ep), callback);
	}
};

exports.vision.describe = function(url, callback) {
	const ep = `vision/v1.0/describe`;
	if (_.isString(url)) {
		return req(callback, ep, { url: url });
	} else {
		return url.pipe(req(null, ep), callback);
	}
};

exports.face.detect = function(url, callback) {
	const ep = `face/v1.0/detect`;
	if (_.isString(url)) {
		return req(callback, ep, { url: url });
	} else {
		return url.pipe(req(null, ep), callback);
	}
};

exports.face.getPerson = function(person_id, callback) {
	return req(callback, `face/v1.0/persongroups/contacts/persons/${person_id}`, {}, 'GET');
};

exports.face.identify = function(face_ids,  callback) {
	return req(callback, `face/v1.0/identify`, {
		faceIds: face_ids,
		personGroupId: 'contacts'
	});
};

exports.face.createPersonGroup = function(callback) {
	return req(callback, `face/v1.0/persongroups/contacts`, {
		name: 'Contacts'
	}, 'PUT');
};

exports.face.trainPersonGroup = function(callback) {
	return req(callback, `face/v1.0/persongroups/contacts/train`);
};

exports.face.createPerson = function(name, callback) {
	return req(callback, `face/v1.0/persongroups/contacts/persons`, {
		name: name,
	});
};

exports.face.addPersonFace = function(person_id, url, callback) {
	return req(callback, `face/v1.0/persongroups/contacts/persons/${person_id}/persistedFaces`, {
		url: url
	});
};

exports.spid.createEnrollment = function(profile_id, audio_stream, callback) {
	const ep = `spid/v1.0/identificationProfiles/${profile_id}/enroll?shortAudio=true`;
	audio_stream.pipe(req(callback, ep, null, 'POST'));
};

exports.spid.createProfile = function(locale, callback) {
	const ep = `spid/v1.0/identificationProfiles`;
	return req(callback, ep, {
		locale: locale
	}, 'POST');
};

exports.spid.verify = function(profile_id, audio_stream, callback) {
	const ep = `spid/v1.0/verify?verificationProfileId=${profile_id}`;
	audio_stream.pipe(req(callback, ep, null, 'POST'));
};

exports.spid.identify = function(profile_ids, audio_stream, callback) {
	const ep = `spid/v1.0/identify?shortAudio=true&identificationProfileIds=` + profile_ids.join(',');
	audio_stream.pipe(req(callback, ep, null, 'POST'));
};