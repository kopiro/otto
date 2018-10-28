import React, { Component } from "react";
import RecorderLibrary from "recorder-js";
import "./Recorder.css";

export default class Recorder extends Component {
  constructor(props) {
    super(props);
    this.audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();

    this.maybeSilenceTicks = 0;
    this.TIMEOUT_TO_LISTEN_SILENCE = 2000;

    this.state = {
      isRecording: false,
      recordingStartedAt: 0,
      waveStreamData: {
        data: [],
        lineTo: 0
      }
    };
  }
  componentDidMount() {}
  async initUserMedia() {
    this.recorder = new RecorderLibrary(this.audioContext, {
      onAnalysed: async e => {
        this.setState({
          waveStreamData: e
        });

        if (
          this.state.isRecording &&
          this.state.recordingStartedAt + this.TIMEOUT_TO_LISTEN_SILENCE <
            Date.now()
        ) {
          if (e.lineTo < 50) {
            this.maybeSilenceTicks++;
          } else {
            this.maybeSilenceTicks--;
          }
          this.maybeSilenceTicks = Math.max(0, this.maybeSilenceTicks);
          console.log("this.maybeSilenceTicks :", this.maybeSilenceTicks);
          if (this.maybeSilenceTicks > 10) {
            await this.stopRecording();
          }
        }
      }
    });

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.recorder.init(stream);
  }
  async startRecording() {
    if (this.state.isRecording) return;

    if (this.recorder == null) {
      await this.initUserMedia();
    }
    await this.recorder.start();
    this.maybeSilenceTicks = 0;
    this.setState({
      recordingStartedAt: Date.now(),
      isRecording: true
    });
  }
  async stopRecording() {
    if (!this.state.isRecording) return;

    this.setState({
      isRecording: false
    });
    const { blob } = await this.recorder.stop();

    if (this.props.onStopRecording) {
      this.props.onStopRecording(blob);
    }
  }
  async toggleRecording() {
    if (this.state.isRecording) {
      await this.stopRecording();
    } else {
      await this.startRecording();
    }
  }
  render() {
    return (
      <button
        onClick={this.toggleRecording.bind(this)}
        className={"recorder " + (this.state.isRecording ? "-rec" : "-notrec")}
      />
    );
  }
}
