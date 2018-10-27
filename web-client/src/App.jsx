import React, { Component } from "react";
import Chat from "./Chat";

import "./App.css";

export default class App extends Component {
  render() {
    return (
      <div className="app">
        <Chat />
      </div>
    );
  }
}
