import React, { Component } from "react";
import VoiceChat from "./VoiceChat";
import "./App.css";

export default class App extends Component {
  render() {
    return (
      <div className="app">
        <div className="logo" />
        <h1 className="header">Otto AI</h1>
        <VoiceChat />
      </div>
    );
  }
}
