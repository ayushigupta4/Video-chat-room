import { useRef, useState } from "react";
import "./App.css";

function App() {
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);

  const pcRef = useRef(null);
  const socketRef = useRef(null);
  const streamRef = useRef(null);
  const pendingCandidates = useRef([]);
  const remoteDescSet = useRef(false);

  const [joined, setJoined] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");

  async function drainCandidates() {
    const pc = pcRef.current;
    for (const candidate of pendingCandidates.current) {
      await pc.addIceCandidate(candidate);
    }
    pendingCandidates.current = [];
  }

  async function startCall() {
    if (joined) return;

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    streamRef.current = stream;
    localVideo.current.srcObject = stream;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    pcRef.current = pc;

    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    pc.ontrack = (event) => {
      remoteVideo.current.srcObject = event.streams[0];
    };

    const socket = new WebSocket("ws://localhost:3001");
    socketRef.current = socket;

    socket.onopen = () => {
      console.log("Connected to signaling server");
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.send(
          JSON.stringify({
            type: "ice-candidate",
            candidate: event.candidate,
          })
        );
      }
    };

    socket.onmessage = async (message) => {
      const data = JSON.parse(message.data);

      if (data.type === "start-call") {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.send(JSON.stringify({ type: "offer", offer }));
      }

      if (data.type === "offer") {
        await pc.setRemoteDescription(data.offer);
        remoteDescSet.current = true;
        await drainCandidates();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.send(JSON.stringify({ type: "answer", answer }));
      }

      if (data.type === "answer") {
        await pc.setRemoteDescription(data.answer);
        remoteDescSet.current = true;
        await drainCandidates();
      }

      if (data.type === "ice-candidate") {
        if (remoteDescSet.current) {
          await pc.addIceCandidate(data.candidate);
        } else {
          pendingCandidates.current.push(data.candidate);
        }
      }

      if (data.type === "chat") {
        setMessages((prev) => [...prev, { from: "them", text: data.text }]);
      }
    };

    setJoined(true);
  }

  function leaveCall() {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    localVideo.current.srcObject = null;
    remoteVideo.current.srcObject = null;

    pendingCandidates.current = [];
    remoteDescSet.current = false;

    setJoined(false);
    setMessages([]);
  }

  function sendMessage() {
    if (!chatInput.trim() || !socketRef.current) return;
    socketRef.current.send(JSON.stringify({ type: "chat", text: chatInput }));
    setMessages((prev) => [...prev, { from: "me", text: chatInput }]);
    setChatInput("");
  }

  function toggleMute() {
    const audioTrack = streamRef.current?.getAudioTracks()[0];
    if (!audioTrack) return;
    audioTrack.enabled = !audioTrack.enabled;
    setIsMuted(!audioTrack.enabled);
  }

  function toggleVideo() {
    const videoTrack = streamRef.current?.getVideoTracks()[0];
    if (!videoTrack) return;
    videoTrack.enabled = !videoTrack.enabled;
    setIsVideoOff(!videoTrack.enabled);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") sendMessage();
  }

  return (
    <div className="app">
      {/* Video area */}
      <div className="video-area">
        <video ref={remoteVideo} autoPlay playsInline className="remote-video" />
        <video ref={localVideo} autoPlay muted playsInline className="local-video" />

        <div className="controls">
          {!joined ? (
            <button className="btn btn-join" onClick={startCall}>Join Call</button>
          ) : (
            <>
              <button
                className={`btn btn-mute${isMuted ? " btn-active" : ""}`}
                onClick={toggleMute}
              >
                {isMuted ? "Unmute" : "Mute"}
              </button>
              <button
                className={`btn btn-video${isVideoOff ? " btn-active" : ""}`}
                onClick={toggleVideo}
              >
                {isVideoOff ? "Start Video" : "Stop Video"}
              </button>
              <button className="btn btn-leave" onClick={leaveCall}>Leave Call</button>
            </>
          )}
        </div>
      </div>

      {/* Chat panel */}
      {joined && (
        <div className="chat-panel">
          <div className="chat-messages">
            {messages.length === 0 && (
              <span className="chat-empty">No messages yet...</span>
            )}
            {messages.map((msg, i) => (
              <div key={i} className="chat-message">
                <strong className={msg.from === "me" ? "chat-me" : "chat-them"}>
                  {msg.from === "me" ? "Me" : "Them"}:
                </strong>{" "}
                {msg.text}
              </div>
            ))}
          </div>
          <div className="chat-input-row">
            <input
              className="chat-input"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
            />
            <button className="btn btn-send" onClick={sendMessage}>Send</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
