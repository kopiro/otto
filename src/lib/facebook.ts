import fetch from "node-fetch";
import config from "../config";

const MAX_LIMIT = 100;

type FeedItem = {
  permalink_url: string;
  message: string;
  created_time: string;
  place: {
    name: string;
    location: {
      city: string;
      country: string;
      latitude: number;
      longitude: number;
    };
    id: string;
  };
  id: string;
};

export const getFacebookFeed = async (): Promise<{ data: FeedItem[]; paging: { next: string } }> => {
  const { facebook } = config();
  const { pageId, accessToken } = facebook;
  const response = await fetch(
    `https://graph.facebook.com/v17.0/${pageId}/feed?access_token=${accessToken}&fields=permalink_url,message,created_time,place,id&limit=${MAX_LIMIT}`,
  );
  const data = await response.json();
  return data;
};
