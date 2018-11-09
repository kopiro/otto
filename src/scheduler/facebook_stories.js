const TAG = 'Scheduler/FacebookStories';

const Facebook = requireLibrary('facebook');

exports.run = function() {
	return new Promise((resolve, reject) => {
		Facebook.api(
			`/${
				Facebook.config.pageId
			}/posts?limit=100&fields=id,message,place,created_time,description,permalink_url,full_picture,story,type,targeting`,
			async res => {
				if (res.error) return reject(res.error);

				for (let fb_story of res.data || []) {
					const story = await Data.Story.findOne({
						'facebook.id': fb_story.id
					});
					if (story != null) return;

					console.log(TAG, 'Creating new story', fb_story);

					try {
						await new Data.Story({
							text: fb_story.message,
							image: { uri: fb_story.full_picture },
							date: fb_story.created_time,
							facebook: fb_story
						}).save();
					} catch (err) {}
				}

				resolve(res.data);
			}
		);
	});
};
