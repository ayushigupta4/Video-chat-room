import { useEffect, useRef } from "react";

function App() {
  const localVideo = useRef();
  const remoteVideo = useRef();
  const pcRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    async function init() {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localVideo.current.srcObject = stream;

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      pcRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (e) => {
        console.log("Received remote track", e.streams);
        remoteVideo.current.srcObject = e.streams[0];
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socketRef.current.send(
            JSON.stringify({ type: "ice-candidate", candidate: e.candidate })
          );
        }
      };

      const socket = new WebSocket("ws://localhost:3001");
      socketRef.current = socket;

      socket.onmessage = async (msg) => {
        const data = JSON.parse(msg.data);

        if (data.type === "start-call") {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.send(JSON.stringify({ type: "offer", offer }));
        }

        if (data.type === "offer") {
          await pc.setRemoteDescription(data.offer);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.send(JSON.stringify({ type: "answer", answer }));
        }

        if (data.type === "answer") {
          await pc.setRemoteDescription(data.answer);
        }

        if (data.type === "ice-candidate") {
          await pc.addIceCandidate(data.candidate);
        }
      };
    }

    init();
    console.log("init called");

  }, []);

  return (
    <>
      <video ref={localVideo} autoPlay muted />
      <video ref={remoteVideo} autoPlay muted/>
    </>
  );
}

export default App;
