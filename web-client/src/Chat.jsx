import React, { Component } from "react";
import { Message } from "react-chat-ui";
import MessageList from "./MessageList";
import openSocket from "socket.io-client";
import Recorder from "./Recorder";
import "./Chat.css";

export default class Chat extends Component {
  constructor(props) {
    super(props);

    this.state = {
      isTyping: false,
      messageList: []
    };

    this.socket = openSocket("http://localhost:9000");

    this.socket.on("output", this.onOutput.bind(this));
    this.socket.on("typing", this.onTyping.bind(this));

    this.textarea = null;
  }
  async sendMessage(message) {
    this.setState({
      messageList: this.state.messageList.concat(
        new Message({
          id: 0,
          message: message,
          senderName: "Web Client"
        })
      )
    });

    this.socket.emit("input", {
      text: message,
      sessionId: "web-client"
    });
  }
  async onTyping(e) {
    this.setState({
      isTyping: true
    });
  }
  async onOutput(e) {
    console.log("Message received :", e);

    if (e.voice) {
      new Audio(e.voice).play();
    }

    if (e.speech) {
      this.setState({
        isTyping: false,
        messageList: this.state.messageList.concat(
          new Message({
            id: 1,
            message: e.speech,
            senderName: "Otto"
          })
        )
      });
    }
  }
  onKeyPress(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (this.textarea.value.length > 0) {
        this.sendMessage(this.textarea.value);
        this.textarea.value = "";
      }
    }
  }
  componentDidMount() {
    this.sendMessage("Ciao");
  }
  onStopRecording(blob) {
    this.socket.emit("input", {
      audio: blob,
      sessionId: "web-client"
    });
  }
  render() {
    return (
      <div className="chat">
        <MessageList
          isTyping={this.state.isTyping}
          list={this.state.messageList}
        />
        <div className="chat-bottom">
          <textarea
            ref={el => (this.textarea = el)}
            onKeyPress={this.onKeyPress.bind(this)}
          />
        </div>
        <Recorder onStopRecording={this.onStopRecording.bind(this)} />
      </div>
    );
  }
}
