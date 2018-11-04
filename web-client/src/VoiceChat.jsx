import React, { Component } from "react";
import { Message } from "react-chat-ui";
import MessageList from "./MessageList";
import openSocket from "socket.io-client";
import Recorder from "./Recorder";
import "./VoiceChat.css";

export default class VoiceChat extends Component {
  constructor(props) {
    super(props);

    this.state = {
      isTyping: false,
      speech: ""
    };

    this.socket = openSocket("http://localhost:9000");

    this.socket.on("output", this.onOutput.bind(this));
    this.socket.on("typing", this.onTyping.bind(this));

    this.textarea = null;
  }
  async onTyping(e) {
    this.setState({
      isTyping: true
    });
  }
  async playAudio(url) {
    return new Promise(resolve => {
      const audio = new Audio(url);
      audio.onended = resolve;
      audio.play();
    });
  }
  async onOutput(e) {
    console.log("Message received :", e);
    this.setState({
      isTyping: false,
      speech: e.speech
    });
    if (e.voice) {
      await this.playAudio(e.voice);
      this.recorder.startRecording();
    }
  }
  onStopRecording(blob) {
    this.socket.emit("input", {
      audio: blob,
      outputType: "voice",
      sessionId: "web-client"
    });
  }
  render() {
    return (
      <div className="voice-chat">
        <div className="speech">
          {this.state.speech || (this.state.isTyping ? "..." : "")}
        </div>
        <Recorder
          ref={el => (this.recorder = el)}
          onStopRecording={this.onStopRecording.bind(this)}
        />
      </div>
    );
  }
}
