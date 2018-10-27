import React, { Component } from "react";
import { ChatFeed, Message } from "react-chat-ui";
import MessageList from "./MessageList";
import "./Chat.css";

export default class Chat extends Component {
  constructor(props) {
    super(props);
    this.state = {
      isTyping: false,
      messageList: []
    };
    this.textarea = null;
  }
  async sendMessage(message) {
    this.setState({
      isTyping: true,
      messageList: this.state.messageList.concat(
        new Message({
          id: 0,
          message: message,
          senderName: "Web Client"
        })
      )
    });

    let response = await fetch("/io/rest?sessionId=web-client", {
      method: "POST",
      body: JSON.stringify({ text: message }),
      headers: {
        "Content-Type": "application/json"
      }
    });

    response = await response.json();

    this.setState({
      isTyping: false,
      messageList: this.state.messageList.concat(
        new Message({
          id: 1,
          message: response.speech,
          senderName: "Otto"
        })
      )
    });
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
      </div>
    );
  }
}
