/*
Role: Get Facebook stories from the page and put into DB
*/

const TAG = 'Scheduler/FacebookStories';
const Facebook = apprequire('facebook');
const _config = config.facebook;

exports.run = function() {
	const now = moment();

	Facebook.api('/' + _config.pageId + '/posts?limit=100&fields=id,message,place,created_time,description,permalink_url,full_picture,story,type,targeting', function(res) {
		res.data.forEach((fb_story) => {

			Data.Story
			.findOne({ 
				'facebook.id': fb_story.id  
			})
			.then((story) => {
				if (story != null) return;

				console.log(TAG, 'Creating new', fb_story);

				new Data.Story({
					text: fb_story.message,
					url: fb_story.full_picture,
					date: fb_story.created_time,
					facebook: fb_story
				}).save();
			});

		});
	});
};