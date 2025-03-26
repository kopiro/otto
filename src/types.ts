export type Language = string;
export type Gender = "male" | "female";

export type API_Person = {
  id: string;
  name: string;
  language?: string;
  emotions: EmotionContext;
};

export type API_IOChannel = {
  id: string;
  name: string;
  ownerName: string;
  ioDriver: string;
  ioIdentifier: string;
  ioData: any;
  person: API_Person | null;
  people: API_Person[];
};

export type API_Interaction = {
  id: string;
  channelName: string;
  sourceName: string;
  input?: Input;
  output?: Output;
  createdAt: string;
  person: API_Person | null;
};

export type API_InputToCloseFriend = {
  uuid: string;
  ioChannel: API_IOChannel;
  person: API_Person;
  time: string;
  score: number;
};

export type API_GroupedInteractionsByChannelID = Record<
  string,
  {
    channel: API_IOChannel;
    interactions: API_Interaction[];
  }
>;

export type API_Memory = {
  id: string | number;
  score: number;
  payload?: {
    text?: string;
  } | null;
};

export type API_EpisodicMemoryTodo = {
  chunkId: string;
  dateChunk: string;
  ioChannel: API_IOChannel;
  payloads: Array<{
    id: string;
    chunkId?: string;
    text: string;
  }>;
};

export enum Authorization {
  ADMIN = "admin",
  CAMERA = "camera",
  COMMAND = "command",
  MESSAGE = "message",
  API = "api",
}

export type EmotionContext = {
  love: number;
  trust: number;
  respect: number;
  anger: number;
  jealousy: number;
};

export type AIOutput = {
  text?: string;
  reaction?: string;
  sentiment?: number;
  emotions?: EmotionContext;

  // This field it's there force the AI to extract the channel name from the text
  channelName?: string;
};

export type Output = Omit<AIOutput, "channelName"> & {
  text?: string;
  voice?: string;
  audio?: string;
  video?: string;
  image?: string;
  document?: string;
  error?: IErrorWithData;
  data?: string;
};

export type IErrorWithData = {
  message: string;
  data?: string;
};

export type InputContext = Record<string, string>;

// text: "Hello" OR command: "Hello" - and then merge with Input
export type Input = {
  text: string;
} & {
  replyToText?: string;
  role?: "system" | "user" | "assistant";
  context?: InputContext;
  // We may want to add type here
  bag?: any;
};
