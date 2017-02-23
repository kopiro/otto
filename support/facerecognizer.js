const _config = config.ai.cognitive;
const BASE_URL = 'https://westus.api.cognitive.microsoft.com';
const TAG = 'FaceRec';

function req(ep, attr, callback) {
	request(_.extend({
		url: `${BASE_URL}/face/v1.0/${ep}`,
		method: 'POST',
		json: true,
		headers: {
			'Ocp-Apim-Subscription-Key': _config.apiKey
		}
	}, attr), function(error, response, body) {
		console.debug(TAG, ep, body);
		if (callback) callback(error, body);
	});
}

exports.detect = function(url, callback) {
	req(`detect`, {
		body: { 
			url: url
		},
	}, callback);
};

exports.getPerson = function(person_id, callback) {
	req(`persongroups/contacts/persons/${person_id}`, {
		method: 'GET'
	}, callback);
};

exports.identify = function(face_ids,  callback) {
	req(`identify`, {
		body: { 
			faceIds: face_ids,
			personGroupId: 'contacts'
		},
	}, callback);
};

exports.createPersonGroup = function(callback) {
	req(`persongroups/contacts`, {
		method: 'PUT',
		body: { 
			name: 'Contacts'
		},
	}, callback);
};

exports.trainPersonGroup = function(callback) {
	req(`persongroups/contacts/train`, {
	}, callback);
};

exports.createPerson = function(name, callback) {
	req(`persongroups/contacts/persons`, {
		body: { 
			name: name,
		},
	}, callback);
};

exports.addPersonFace = function(person_id, url, callback) {
	req(`persongroups/contacts/persons/${person_id}/persistedFaces`, {
		body: { 
			url: url
		},
	}, callback);
};