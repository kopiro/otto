import React, { Component } from "react";
import { ChatFeed, Message } from "react-chat-ui";

import "./MessageList.css";

export default class MessageList extends Component {
  constructor(props) {
    super(props);
  }
  render() {
    return (
      <div className="message-list">
        <ChatFeed
          messages={this.props.list || []}
          isTyping={this.props.isTyping}
          maxHeight={400}
          showSenderName={true}
        />
      </div>
    );
  }
}
